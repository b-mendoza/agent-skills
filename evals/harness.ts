// Spawns an agent CLI, parses its NDJSON event stream, and captures the
// repository delta around the run. Everything a case asserts on comes from
// here, so this file only reports what was observed -- it never interprets.
//
// Node's native TypeScript type stripping runs this directly: `node run.ts`.
// Keep the syntax erasable (no enums, no parameter properties, no decorators).

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface Observation {
  exitCode: number | null;
  /** Result envelope subtype: "success", "error_max_budget_usd", ... */
  subtype: string;
  /** Final assistant text as returned in the result event. */
  finalText: string;
  toolCalls: ToolCall[];
  gitStatusBefore: string;
  gitStatusAfter: string;
  costUsd: number;
  durationMs: number;
  /** True when the harness killed the run for exceeding wallClockMs. */
  timedOut: boolean;
}

export interface RunOptions {
  /** Working directory the CLI is invoked in. Skills resolve relative to it. */
  cwd: string;
  prompt: string;
  budgetUsd: number;
  model: string;
  /** Hard wall-clock ceiling. A hung run must fail the case, not the suite. */
  wallClockMs: number;
  /** Repo whose `git status` is sampled before and after. Usually `cwd`. */
  gitRepo?: string;
}

/** `git status --short` for the mutation-scope delta, or "" when not a repo. */
export function gitStatus(repo: string): string {
  try {
    return execFileSync("git", ["status", "--short"], {
      cwd: repo,
      encoding: "utf8",
      // Silence "fatal: not a git repository" for the not-git fixture.
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * One `claude -p` run in stream-json mode.
 *
 * stream-json is the only output format that exposes tool calls, which is what
 * makes "the skill triggered" and "no file was written" checkable rather than
 * a matter of trusting the model's narration.
 */
export function runClaude(opts: RunOptions): Promise<Observation> {
  const repo = opts.gitRepo ?? opts.cwd;
  const gitStatusBefore = gitStatus(repo);
  const startedAt = process.hrtime.bigint();

  const args = [
    "-p",
    opts.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "bypassPermissions",
    "--model",
    opts.model,
    "--max-budget-usd",
    String(opts.budgetUsd),
  ];

  return new Promise<Observation>((resolve) => {
    const child = spawn("claude", args, {
      cwd: opts.cwd,
      // Inherit auth from the ambient environment; no API key is set up here.
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const toolCalls: ToolCall[] = [];
    let finalText = "";
    let subtype = "";
    let costUsd = 0;
    let timedOut = false;
    let pending = "";

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.wallClockMs);

    const handleLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) return;

      let event: any;
      try {
        event = JSON.parse(trimmed);
      } catch {
        return; // Partial or non-JSON noise; the result event is what matters.
      }

      if (event.type === "assistant") {
        const content = event.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === "tool_use") {
              toolCalls.push({
                name: String(block.name),
                input:
                  block.input && typeof block.input === "object"
                    ? block.input
                    : {},
              });
            }
          }
        }
      } else if (event.type === "result") {
        subtype = String(event.subtype ?? "");
        finalText = typeof event.result === "string" ? event.result : "";
        costUsd = Number(event.total_cost_usd ?? 0);
      }
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      pending += chunk;
      const lines = pending.split("\n");
      // Last element may be an incomplete line; hold it for the next chunk.
      pending = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    });

    // Drained so the process can't block on a full stderr pipe.
    child.stderr.resume();

    child.on("close", (code) => {
      clearTimeout(timer);
      if (pending) handleLine(pending);

      resolve({
        exitCode: code,
        subtype,
        finalText,
        toolCalls,
        gitStatusBefore,
        gitStatusAfter: gitStatus(repo),
        costUsd,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
        timedOut,
      });
    });

    child.on("error", () => {
      clearTimeout(timer);
      resolve({
        exitCode: null,
        subtype: "spawn_error",
        finalText: "",
        toolCalls,
        gitStatusBefore,
        gitStatusAfter: gitStatus(repo),
        costUsd: 0,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
        timedOut,
      });
    });
  });
}

// --- Observation helpers used by case assertions -------------------------

/** Calls to the Skill tool naming `skill`. Empty when it never triggered. */
export function skillInvocations(o: Observation, skill: string): ToolCall[] {
  return o.toolCalls.filter(
    (c) => c.name === "Skill" && c.input.skill === skill,
  );
}

/** Git subcommands that would mutate a repo, for the read-only assertion. */
const MUTATING_GIT = [
  "add",
  "commit",
  "merge",
  "push",
  "fetch",
  "pull",
  "reset",
  "checkout",
  "rebase",
  "stash",
  "clean",
  "rm",
  "tag",
];

/**
 * Every observed way the run could have written to the repo. A case asserts
 * this is empty; the list is returned rather than a boolean so a failure
 * message can name the offending call.
 */
export function mutationEvidence(o: Observation): string[] {
  const found: string[] = [];

  if (o.gitStatusBefore !== o.gitStatusAfter) {
    found.push(
      `git status changed:\n  before: ${JSON.stringify(o.gitStatusBefore)}\n  after:  ${JSON.stringify(o.gitStatusAfter)}`,
    );
  }

  for (const call of o.toolCalls) {
    if (["Write", "Edit", "NotebookEdit"].includes(call.name)) {
      found.push(`${call.name} called on ${String(call.input.file_path ?? "?")}`);
    }
    if (call.name === "Bash") {
      const cmd = String(call.input.command ?? "");
      for (const verb of MUTATING_GIT) {
        // Word-boundary match so `git log --stat` isn't read as `git stash`.
        if (new RegExp(`\\bgit\\s+(-\\S+\\s+)*${verb}\\b`).test(cmd)) {
          found.push(`mutating git command: ${cmd}`);
          break;
        }
      }
    }
  }

  return found;
}
