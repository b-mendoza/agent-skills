// Spawns an agent CLI, parses its NDJSON event stream, and captures the
// repository delta around the run. Everything a case asserts on comes from
// here: this file observes a run, then classifies those observations into the
// facts a case can assert on. It reads no intent from the agent's narration --
// every fact traces to a tool call, a result envelope, or a git delta.
//
// Node's native TypeScript type stripping runs this directly: `node run.ts`.
// Keep the syntax erasable (no enums, no parameter properties, no decorators).

import { execFileSync, spawn } from "node:child_process";

import * as z from "zod";

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
  gitStatusBefore: GitStatus;
  gitStatusAfter: GitStatus;
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

/**
 * The outcome of sampling a repository's status.
 *
 * Three outcomes, not two, because "the worktree is clean" and "the sample
 * failed" used to be the same empty string. Two failed samples then compared
 * equal and the read-only assertion passed on evidence that was never
 * collected -- the mutation-scope guarantee silently reduced to "nothing was
 * observed", which is exactly what it must not mean.
 */
export type GitStatus =
  | { kind: "worktree"; entries: string }
  | { kind: "no-worktree" }
  | { kind: "unreadable"; reason: string };

/** A git exit status meaning "this is not a repository". */
const GIT_NOT_A_REPOSITORY = 128;

/** Whether two samples describe the same repository state. */
function sameGitStatus(a: GitStatus, b: GitStatus): boolean {
  if (a.kind === "worktree" && b.kind === "worktree") {
    return a.entries === b.entries;
  }
  return a.kind === b.kind;
}

/** Renders a status for a failure message. */
export function describeGitStatus(status: GitStatus): string {
  if (status.kind === "worktree") return JSON.stringify(status.entries);
  if (status.kind === "no-worktree") return "(not a worktree)";
  return `(unreadable: ${status.reason})`;
}

/**
 * Samples `git status --short`.
 *
 * The `not-git` fixture legitimately has no worktree, and that must stay
 * distinct from a git binary that is missing, a directory that cannot be
 * read, or an index that is corrupt. Only the first is an expected state.
 */
export function gitStatus(repo: string): GitStatus {
  try {
    const entries = execFileSync("git", ["status", "--short"], {
      cwd: repo,
      encoding: "utf8",
      // stderr is captured, not silenced: exit 128 is git's generic fatal
      // code, so the message is the only thing separating "not a repository"
      // from a corrupt index. Discarding it would put both in the same bucket.
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { kind: "worktree", entries };
  } catch (error) {
    const read = (key: string): unknown =>
      error instanceof Error ? Reflect.get(error, key) : undefined;

    // Exit 128 alone does not mean "not a repository" -- a corrupt index and
    // an unreadable HEAD return it too. Only git's own wording separates the
    // expected `not-git` fixture state from a repository that cannot be read,
    // and everything unmatched falls through to `unreadable` so an unfamiliar
    // failure fails closed rather than passing as clean.
    const stderr = toText(read("stderr"));
    if (
      read("status") === GIT_NOT_A_REPOSITORY &&
      /not a git repository/i.test(stderr)
    ) {
      return { kind: "no-worktree" };
    }

    // git's own message when there is one, else the syscall code (ENOENT for
    // a missing directory or a missing git binary), else whatever was thrown.
    const detail = stderr.trim().split("\n")[0] ?? "";
    const fallback = error instanceof Error ? error.message : error;
    return {
      kind: "unreadable",
      reason: detail === "" ? toText(read("code") ?? fallback) : detail,
    };
  }
}

const NS_PER_MS = 1e6;
/** A run with no reported cost books nothing rather than `NaN`. */
const ZERO_COST = 0;

/** Foreign scalars, rendered without `String()`'s `[object Object]`. */
function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * The stream is a foreign contract, so these schemas describe only the fields
 * the harness reads and coerce everything else to a usable default. Each
 * optional field mirrors what the CLI omits in practice: a budget-capped run
 * ends without a cost, a killed one without a result.
 */
const toolUseBlockSchema = z
  .object({
    type: z.literal("tool_use"),
    name: z.unknown().optional().transform(toText),
    input: z.record(z.string(), z.unknown()).catch({}),
  })
  .transform(({ name, input }): ToolCall => ({ name, input }));

const assistantEventSchema = z.object({
  type: z.literal("assistant"),
  message: z.object({ content: z.array(z.unknown()) }),
});

const resultEventSchema = z.object({
  type: z.literal("result"),
  subtype: z.unknown().optional().transform(toText),
  result: z
    .unknown()
    .optional()
    .transform((value) => (typeof value === "string" ? value : "")),
  // A JSON number and nothing else. Coercing instead would let `true` book
  // $1.00 and `["4.2"]` book $4.20 into a committed report -- a fabricated
  // figure indistinguishable from a measured one. An absent or malformed cost
  // books nothing, which is the documented fallback.
  total_cost_usd: z.number().catch(ZERO_COST).default(ZERO_COST),
});

/** Partial or non-JSON noise; the result event is what matters. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
    // oxlint-disable-next-line preserve-caught-error -- The thrown SyntaxError carries no information this function can use: the contract is that any unparseable line degrades to `undefined` so a truncated stream never loses a paid run.
  } catch {
    return undefined;
  }
}

/** The only two stream events the harness reads. Everything else is noise. */
export type StreamEvent =
  | { kind: "tool_calls"; calls: ToolCall[] }
  | { kind: "result"; subtype: string; finalText: string; costUsd: number };

/**
 * Parses one NDJSON line from the CLI stream.
 *
 * Total and non-throwing by contract: malformed JSON, non-object lines,
 * unknown event types, and missing or wrong-typed fields all yield `null` or
 * empty defaults. A truncated stream must degrade to an empty observation,
 * never to a crash that loses the whole run.
 */
export function parseStreamLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;

  // JSON has no `undefined`, so it doubles as the "unparseable" sentinel.
  const event = parseJson(trimmed);
  if (event === undefined) return null;

  const assistant = assistantEventSchema.safeParse(event);
  if (assistant.success) {
    const calls = assistant.data.message.content.flatMap((block) => {
      const parsed = toolUseBlockSchema.safeParse(block);
      return parsed.success ? [parsed.data] : [];
    });
    return { kind: "tool_calls", calls };
  }

  const result = resultEventSchema.safeParse(event);
  if (result.success) {
    const { subtype, result: finalText, total_cost_usd: costUsd } = result.data;
    return { kind: "result", subtype, finalText, costUsd };
  }

  return null;
}

/**
 * One `claude -p` run in stream-json mode.
 *
 * stream-json is the only output format that exposes tool calls, which is what
 * makes "the skill triggered" and "no file was written" checkable rather than
 * a matter of trusting the model's narration.
 *
 * `error` and `close` can both fire, so the promise is resolve-once: whichever
 * handler runs first produces the observation and the other is a no-op.
 */
export async function runClaude(opts: RunOptions): Promise<Observation> {
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
    "auto",
    "--model",
    opts.model,
    "--max-budget-usd",
    opts.budgetUsd.toString(),
  ];

  // oxlint-disable-next-line promise/avoid-new -- `spawn` is callback-based: turning its `close`/`error` events into a value requires exactly this constructor, and `async`/`await` has nothing to await until it exists.
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
    let costUsd = ZERO_COST;
    let timedOut = false;
    let pending = "";

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.wallClockMs);

    const handleLine = (line: string): void => {
      const event = parseStreamLine(line);
      if (event === null) return;

      if (event.kind === "tool_calls") {
        toolCalls.push(...event.calls);
      } else {
        ({ subtype, finalText, costUsd } = event);
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

    // Both `close` and `error` can fire, so settling funnels through one place.
    // `resolve` alone is not enough to make the first handler the one that
    // defines the observation: it ignores the second call, but the second
    // handler's own work still runs, and `toolCalls` is handed out by
    // reference. A late `handleLine` would then push into the array a caller
    // is already holding, so the observation grows after it was returned.
    // This flag is what stops the losing handler before it touches anything.
    let settled = false;

    const settle = (
      outcome: Pick<Observation, "exitCode" | "subtype">,
    ): void => {
      settled = true;
      clearTimeout(timer);
      // oxlint-disable-next-line promise/no-multiple-resolved -- False positive: there is exactly one `resolve` call in this function, and the rule points at the `clearTimeout` above it as the supposed earlier resolution.
      resolve({
        ...outcome,
        finalText,
        toolCalls,
        gitStatusBefore,
        gitStatusAfter: gitStatus(repo),
        costUsd,
        durationMs: Number(process.hrtime.bigint() - startedAt) / NS_PER_MS,
        timedOut,
      });
    };

    child.on("close", (code) => {
      // Checked before parsing, not just before resolving: `handleLine` is the
      // side effect that would leak into an already-returned observation.
      if (settled) return;
      // A final line without a trailing newline is still a real event.
      if (pending !== "") handleLine(pending);
      settle({ exitCode: code, subtype });
    });

    // Spawn never produced a usable stream, so the run reports no result and
    // books no cost rather than whatever partial state happened to accumulate.
    child.on("error", () => {
      if (settled) return;
      finalText = "";
      costUsd = ZERO_COST;
      settle({ exitCode: null, subtype: "spawn_error" });
    });
  });
}

// --- Observation helpers used by case assertions -------------------------

/** Calls to the Skill tool naming `skill`. Empty when it never triggered. */
export function skillInvocations(o: Observation, skill: string): ToolCall[] {
  return o.toolCalls.filter(
    (c) => c.name === "Skill" && c.input["skill"] === skill,
  );
}

/**
 * Git subcommands that mutate no matter how they are invoked.
 *
 * Some of these leave `git status --short` identical before and after --
 * `git switch` between two clean branches moves HEAD and shows no delta -- so
 * the command text is the only evidence that survives. That is why the list
 * matters beyond the obvious `commit`/`push` cases.
 */
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
  "clean",
  "rm",
  "switch",
  "restore",
  "cherry-pick",
  "revert",
  "update-ref",
  "apply",
  "am",
  "mv",
  "prune",
  "gc",
] as const;

/** Tool calls that write a file, for the same read-only assertion. */
const MUTATING_TOOLS = new Set(["Write", "Edit", "NotebookEdit"] as const);

/**
 * Global git options that consume the NEXT token as their value, so the verb
 * after them is still a verb. Enumerated rather than guessed: inferring arity
 * from whether the following token starts with `-` misreads both
 * `git --no-pager --no-optional-locks commit` (two valueless flags, read as
 * one option plus a value) and `git -C --weird commit` (a dash-prefixed path,
 * which git accepts).
 */
const GIT_OPTIONS_WITH_VALUE = [
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--exec-path",
  "--config-env",
];

// Word-boundary match so `git log --stat` isn't read as `git stash`. No `g`
// flag, so these carry no lastIndex state and are safe to share across calls.
//
// An option is either one of the value-taking flags above plus its quoted or
// unquoted argument, or any other `-`-prefixed token on its own (`--no-pager`,
// `--git-dir=/r/.git`). Skipping them is what lets `git -C "/repo path" commit`
// -- an agent acting on a repo it is not sitting in -- still read as a mutation.
const GIT_OPTION_VALUE = String.raw`(?:"[^"]*"|'[^']*'|\S+)`;
const GIT_OPTION = String.raw`(?:(?:${GIT_OPTIONS_WITH_VALUE.join("|")})\s+${GIT_OPTION_VALUE}|-\S+)\s+`;
const MUTATING_GIT_PATTERNS = MUTATING_GIT.map(
  (verb) => new RegExp(String.raw`\bgit\s+(?:${GIT_OPTION})*${verb}\b`),
);

/**
 * Verbs that mutate or read depending on their arguments, paired with the
 * subcommands and flags that make them read-only.
 *
 * These cannot join `MUTATING_GIT`: `analyzing-recent-project-state` documents
 * read-only `git branch` among the commands it is allowed to run, so matching
 * the bare verb would fail runs behaving exactly as specified. They cannot be
 * omitted either -- `git branch -D` and `git worktree add` are real mutations.
 * So the verb is evidence unless its arguments put it in read-only form.
 */
const DUAL_MODE_GIT: ReadonlyArray<{
  verb: string;
  /** Subcommands and flags whose presence makes the verb read-only. */
  readOnly: readonly string[];
  /** Whether the verb with no arguments writes. `git stash` is `stash push`. */
  bareWrites: boolean;
}> = [
  {
    verb: "branch",
    readOnly: [
      "--list",
      "-l",
      "--show-current",
      "-a",
      "-r",
      "-v",
      "-vv",
      "--all",
      "--remotes",
      "--contains",
      "--merged",
      "--no-merged",
      "--points-at",
      "--format",
      "--sort",
    ],
    bareWrites: false,
  },
  {
    verb: "tag",
    readOnly: [
      "--list",
      "-l",
      "-n",
      "--contains",
      "--points-at",
      "--merged",
      "--no-merged",
      "--format",
      "--sort",
    ],
    // Bare `git tag` lists, but it is not among the commands any skill here is
    // allowed to run, so it stays evidence: an unexplained `git tag` in a
    // read-only run is worth surfacing even when that particular form prints.
    bareWrites: true,
  },
  { verb: "stash", readOnly: ["list", "show"], bareWrites: true },
  { verb: "worktree", readOnly: ["list"], bareWrites: false },
  {
    verb: "submodule",
    readOnly: ["status", "summary", "foreach"],
    bareWrites: false,
  },
  { verb: "reflog", readOnly: ["show"], bareWrites: false },
  { verb: "notes", readOnly: ["list", "show"], bareWrites: false },
  { verb: "sparse-checkout", readOnly: ["list"], bareWrites: false },
  { verb: "bisect", readOnly: ["log", "view", "visualize"], bareWrites: false },
];

/** Escapes a literal so it can sit inside a constructed pattern. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\-]/g, String.raw`\$&`);
}

/**
 * Whether a dual-mode verb appears in its mutating form.
 *
 * Mirrors git's own argument handling: `git branch` prints and `git branch x`
 * writes, so the arguments -- not the verb -- decide. When a verb's read-only
 * markers are absent, it reads as a mutation, which keeps an unrecognized new
 * subcommand failing loudly rather than passing silently.
 */
function dualModeEvidence(cmd: string): boolean {
  return DUAL_MODE_GIT.some(({ verb, readOnly, bareWrites }) => {
    const match = new RegExp(
      String.raw`\bgit\s+(?:${GIT_OPTION})*${verb}\b(?<rest>.*)`,
    ).exec(cmd);
    if (match === null) return false;

    const rest = (match.groups?.["rest"] ?? "").trim();
    if (rest === "") return bareWrites;

    return !readOnly.some((marker) =>
      new RegExp(String.raw`(?:^|\s)${escapeRegExp(marker)}(?:$|[\s=])`).test(
        rest,
      ),
    );
  });
}

function fileWriteEvidence(call: ToolCall): string | null {
  if (!MUTATING_TOOLS.has(call.name)) return null;
  const filePath = toText(call.input["file_path"]);
  return `${call.name} called on ${filePath === "" ? "?" : filePath}`;
}

function bashEvidence(call: ToolCall): string | null {
  if (call.name !== "Bash") return null;

  const raw = call.input["command"];
  if (raw !== undefined && raw !== null && typeof raw !== "string") {
    // Unscannable rather than clean: coercing would hide a mutating verb.
    return `unverifiable Bash command (non-string): ${typeof raw}`;
  }

  const cmd = typeof raw === "string" ? raw : "";
  const mutates =
    MUTATING_GIT_PATTERNS.some((pattern) => pattern.test(cmd)) ||
    dualModeEvidence(cmd);
  return mutates ? `mutating git command: ${cmd}` : null;
}

/**
 * Every observed way the run could have written to the repo. A case asserts
 * this is empty; the list is returned rather than a boolean so a failure
 * message can name the offending call.
 */
export function mutationEvidence(o: Observation): string[] {
  const found: string[] = [];
  const { gitStatusBefore: before, gitStatusAfter: after } = o;

  // Unreadable is not clean. A sample that failed proves nothing about what
  // the run did, so it is reported rather than compared -- otherwise two
  // failed samples match and the assertion passes on absent evidence.
  for (const [label, status] of [
    ["before", before],
    ["after", after],
  ] as const) {
    if (status.kind === "unreadable") {
      found.push(
        `git status could not be sampled ${label} the run: ${status.reason}`,
      );
    }
  }

  const comparable =
    before.kind !== "unreadable" && after.kind !== "unreadable";
  if (comparable && !sameGitStatus(before, after)) {
    found.push(
      `git status changed:\n  before: ${describeGitStatus(before)}\n  after:  ${describeGitStatus(after)}`,
    );
  }

  for (const call of o.toolCalls) {
    const write = fileWriteEvidence(call);
    if (write !== null) found.push(write);

    const bash = bashEvidence(call);
    if (bash !== null) found.push(bash);
  }

  return found;
}
