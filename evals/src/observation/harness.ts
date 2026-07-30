// Runs an Agent SDK query, observes its typed message stream, and captures
// the repository delta around the run. Everything a case asserts on comes from
// here: this file observes a run, then classifies those observations into the
// facts a case can assert on. It reads no intent from the agent's narration --
// every fact traces to a tool call, a result message, or a git delta.
//
// Node's native TypeScript type stripping runs this directly: `node run.ts`.
// Keep the syntax erasable (no enums, no parameter properties, no decorators).

import { execFileSync } from "node:child_process";

import { query } from "@anthropic-ai/claude-agent-sdk";
import * as z from "zod";

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface Observation {
  /** Result message subtype: "success", "error_max_budget_usd", ... */
  subtype: string;
  /**
   * The SDK's own verdict that the run failed.
   *
   * Separate from `subtype` because the two disagree: an expired login is
   * reported as `subtype: "success"` with `is_error: true`, so the subtype
   * alone cannot tell a real answer from a request that never reached a model.
   */
  isError: boolean;
  /** Final assistant text as returned in the result message. */
  finalText: string;
  toolCalls: ToolCall[];
  gitStatusBefore: GitStatus;
  gitStatusAfter: GitStatus;
  costUsd: number;
  durationMs: number;
  /** True when the harness aborted the run for exceeding wallClockMs. */
  timedOut: boolean;
}

export interface RunOptions {
  /** Working directory the agent runs in. Skills resolve relative to it. */
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

/** The subprocess-error fields consumed by git-status classification. */
const subprocessErrorSchema = z
  .object({
    status: z.number().nullable().optional().catch(undefined),
    stderr: z.unknown().optional().catch(undefined),
    code: z.unknown().optional().catch(undefined),
    message: z.unknown().optional().catch(undefined),
  })
  .catch({
    status: undefined,
    stderr: undefined,
    code: undefined,
    message: undefined,
  });

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
    const subprocessError = subprocessErrorSchema.parse(error);
    const stderr = toText(subprocessError.stderr);

    // Exit 128 alone does not mean "not a repository" -- a corrupt index and
    // an unreadable HEAD return it too. Only git's own wording separates the
    // expected `not-git` fixture state from a repository that cannot be read,
    // and everything unmatched falls through to `unreadable` so an unfamiliar
    // failure fails closed rather than passing as clean.
    if (
      subprocessError.status === GIT_NOT_A_REPOSITORY &&
      /not a git repository/i.test(stderr)
    ) {
      return { kind: "no-worktree" };
    }

    // git's own message when there is one, else the syscall code (ENOENT for
    // a missing directory or a missing git binary), else whatever was thrown.
    const detail = stderr.trim().split("\n")[0] ?? "";
    const fallback = subprocessError.code ?? subprocessError.message ?? error;
    return {
      kind: "unreadable",
      reason: detail === "" ? toText(fallback) : detail,
    };
  }
}

const NS_PER_MS = 1e6;
/** A run with no reported cost books nothing rather than `NaN`. */
const ZERO_COST = 0;

/** Foreign values, rendered without rejecting observation settlement. */
function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") {
    return value.toString();
  }

  try {
    const json: unknown = JSON.stringify(value);
    if (typeof json === "string") return json;
    // eslint-disable-next-line sonarjs/no-ignored-exceptions -- Serialization failure is expected for values such as BigInt or cycles, which use the guarded fallback below.
  } catch (jsonSerializationError) {
    // Continue to the guarded string-conversion fallback.
  }

  try {
    // oxlint-disable-next-line typescript/no-base-to-string -- Guarded last-resort rendering is required for foreign cyclic and BigInt values.
    return String(value);
  } catch (stringConversionError) {
    return "(unprintable value)";
  }
}

/**
 * Tool inputs cross the SDK boundary as `unknown` -- their shape is decided
 * by the model, not the type system. A malformed input degrades to `{}`
 * rather than discarding the call: the call's existence is the fact cases
 * assert on, and `mutationEvidence` already treats an unreadable input as
 * unverifiable rather than clean.
 */
// eslint-disable-next-line zod/prefer-string-schema-with-trim -- SDK identifiers, answers, and diagnostics must be retained verbatim.
const untrimmedStringSchema = z.string();
const toolInputSchema = z.record(untrimmedStringSchema, z.unknown()).catch({});

const streamMessageDiscriminatorSchema = z.object({
  type: untrimmedStringSchema,
});
const assistantMessageSchema = z.object({
  type: z.literal("assistant"),
  message: z.object({ content: z.array(z.unknown()) }),
});
const contentBlockDiscriminatorSchema = z.object({
  type: untrimmedStringSchema,
});
const toolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  name: untrimmedStringSchema,
  input: z.unknown(),
});
const successfulResultMessageSchema = z.object({
  type: z.literal("result"),
  subtype: z.literal("success"),
  is_error: z.boolean(),
  result: untrimmedStringSchema,
  total_cost_usd: z.number(),
});
const failedResultMessageSchema = z.object({
  type: z.literal("result"),
  subtype: untrimmedStringSchema,
  is_error: z.boolean(),
  errors: z.array(untrimmedStringSchema),
  total_cost_usd: z.number(),
});

type ResultVerdict = Pick<
  Observation,
  "subtype" | "isError" | "finalText" | "costUsd"
>;

type NormalizedStreamMessage =
  | { kind: "ignored" }
  | { kind: "assistant" }
  | { kind: "result"; verdict: ResultVerdict };

/**
 * Subtype of the synthetic Observation produced when the query never yielded
 * a result message: the SDK threw (option validation, bundled-CLI startup,
 * transport, abort) or the stream ended early. There is no result to trust,
 * so the run reports failure and books no cost. Exported so case assertions
 * reject the same constant the harness emits instead of a drifting literal.
 */
export const QUERY_ERROR_SUBTYPE = "query_error";

/** Relevant SDK messages, validated and reduced to the fields observed here. */
function normalizeStreamMessage(
  message: unknown,
  observedToolCalls: ToolCall[],
): NormalizedStreamMessage {
  const parsedDiscriminator =
    streamMessageDiscriminatorSchema.safeParse(message);
  if (!parsedDiscriminator.success) return { kind: "ignored" };

  if (parsedDiscriminator.data.type === "assistant") {
    const assistantMessage = assistantMessageSchema.parse(message);
    const messageToolCalls: ToolCall[] = [];

    for (const contentBlock of assistantMessage.message.content) {
      // A relevant assistant message fails closed when any content entry lacks
      // the minimum SDK block shape. Its calls are committed only after every
      // entry validates, preserving the message-level atomicity of the SDK.
      const blockDiscriminator =
        contentBlockDiscriminatorSchema.parse(contentBlock);
      if (blockDiscriminator.type === "tool_use") {
        const toolUseBlock = toolUseBlockSchema.parse(contentBlock);
        messageToolCalls.push({
          name: toolUseBlock.name,
          input: toolInputSchema.parse(toolUseBlock.input),
        });
      }
    }

    observedToolCalls.push(...messageToolCalls);
    return { kind: "assistant" };
  }

  if (parsedDiscriminator.data.type === "result") {
    const parsedSubtype = z
      .object({ subtype: untrimmedStringSchema })
      .parse(message);
    if (parsedSubtype.subtype === "success") {
      const resultMessage = successfulResultMessageSchema.parse(message);
      return {
        kind: "result",
        verdict: {
          subtype: resultMessage.subtype,
          isError: resultMessage.is_error,
          finalText: resultMessage.result,
          costUsd: resultMessage.total_cost_usd,
        },
      };
    }

    const resultMessage = failedResultMessageSchema.parse(message);
    return {
      kind: "result",
      verdict: {
        subtype: resultMessage.subtype,
        isError: resultMessage.is_error,
        // Error results carry diagnostics instead of an answer. Joining them
        // keeps auth and execution failures readable in a case failure.
        finalText: resultMessage.errors.join("\n"),
        costUsd: resultMessage.total_cost_usd,
      },
    };
  }

  return { kind: "ignored" };
}

/** What a run without a result message can still say about why. */
function failureText(failure: unknown): string {
  if (failure == null) return "query ended without a result message";
  return failure instanceof Error ? failure.message : toText(failure);
}

/**
 * One Agent SDK query, observed end to end.
 *
 * The typed message stream is what makes "the skill triggered" and "no file
 * was written" checkable rather than a matter of trusting the model's
 * narration: every assistant message carries its `tool_use` blocks, and the
 * terminal result message carries the SDK's own verdict and cost.
 *
 * Option parity with the previous `claude -p` invocation is deliberate:
 * `permissionMode: "auto"`, `maxBudgetUsd`, and the fixture `cwd` map
 * one-to-one to the old flags. Two options are new obligations the CLI met
 * implicitly: the `claude_code` system-prompt and tool presets (the SDK
 * default is a minimal prompt with no Skill tool), and `settingSources`
 * pinned to `["project"]` so a run sees the fixture's `.claude/skills` but
 * not this machine's user or local settings.
 */
export async function runClaude(opts: RunOptions): Promise<Observation> {
  const repo = opts.gitRepo ?? opts.cwd;
  const gitStatusBefore = gitStatus(repo);
  const startedAt = process.hrtime.bigint();

  const abortController = new AbortController();
  const toolCalls: ToolCall[] = [];
  let resultVerdict: ResultVerdict | null = null;
  let failure: unknown = null;
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, opts.wallClockMs);

  try {
    const messages = query({
      prompt: opts.prompt,
      options: {
        cwd: opts.cwd,
        model: opts.model,
        maxBudgetUsd: opts.budgetUsd,
        permissionMode: "auto",
        abortController,
        // `env` is omitted on purpose: the subprocess then inherits
        // `process.env`, including whatever credentials the ambient
        // environment carries. Setting `env` would REPLACE the environment,
        // not merge it.
        settingSources: ["project"],
        systemPrompt: { type: "preset", preset: "claude_code" },
        tools: { type: "preset", preset: "claude_code" },
      },
    });

    for await (const message of messages) {
      const normalizedMessage = normalizeStreamMessage(message, toolCalls);
      if (normalizedMessage.kind === "result") {
        resultVerdict = normalizedMessage.verdict;
        // Breaking here runs the generator's cleanup, which ends the query.
        break;
      }
    }
  } catch (error) {
    // Includes the AbortError raised by the wall-clock timer; `timedOut`
    // separates that from a genuine failure.
    failure = error;
  } finally {
    clearTimeout(timer);
  }

  // Sampled after settlement on every path -- a run that threw may still
  // have mutated the repo, and that evidence must not be lost.
  const settled = {
    // Copied so nothing can grow an observation a caller already holds.
    toolCalls: [...toolCalls],
    gitStatusBefore,
    gitStatusAfter: gitStatus(repo),
    durationMs: Number(process.hrtime.bigint() - startedAt) / NS_PER_MS,
    timedOut,
  };

  if (resultVerdict == null) {
    // No result message means no trustworthy verdict and no reported cost:
    // the run failed as infrastructure, whatever partial state accumulated.
    return {
      ...settled,
      subtype: QUERY_ERROR_SUBTYPE,
      isError: true,
      finalText: failureText(failure),
      costUsd: ZERO_COST,
    };
  }

  return { ...settled, ...resultVerdict };
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
  // `\b` treats a hyphen as a boundary, so bare `merge` would also match
  // `git merge-base` -- a read-only command the skill under eval is documented
  // to run, which failed a legitimate paid run. Only that one form is excepted:
  // other hyphenated collisions (`merge-tree`, `checkout-index`,
  // `prune-packed`) mutate and must stay flagged, so they keep matching.
  String.raw`merge(?!-base\b)`,
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

/** Path input read from each tool call that writes a file. */
const MUTATING_TOOL_PATH_KEYS: Readonly<Record<string, string>> = {
  Write: "file_path",
  Edit: "file_path",
  NotebookEdit: "notebook_path",
};

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
    const occurrences = cmd.matchAll(
      new RegExp(String.raw`\bgit\s+(?:${GIT_OPTION})*${verb}\b`, "g"),
    );

    for (const match of occurrences) {
      // Arguments belong only to this shell command. A read-only marker after a
      // separator cannot launder an earlier mutation in the same Bash payload.
      const [segment = ""] = cmd
        .slice(match.index + match[0].length)
        .split(/&&|\|\||[;|\n]/, 1);
      const rest = segment.trim();
      if (rest === "") {
        if (bareWrites) return true;
        continue;
      }

      const isReadOnly = readOnly.some((marker) =>
        new RegExp(String.raw`(?:^|\s)${escapeRegExp(marker)}(?:$|[\s=])`).test(
          rest,
        ),
      );
      if (!isReadOnly) return true;
    }

    return false;
  });
}

function fileWriteEvidence(call: ToolCall): string | null {
  const pathKey = MUTATING_TOOL_PATH_KEYS[call.name];
  if (pathKey === undefined) return null;
  const filePath = call.input[pathKey];
  return `${call.name} called on ${typeof filePath === "string" && filePath !== "" ? filePath : "?"}`;
}

function bashEvidence(call: ToolCall): string | null {
  if (call.name !== "Bash") return null;

  const raw = call.input["command"];
  if (raw == null) {
    return "unverifiable Bash command (absent)";
  }
  if (typeof raw !== "string") {
    // Unscannable rather than clean: coercing would hide a mutating verb.
    return `unverifiable Bash command (non-string): ${typeof raw}`;
  }

  const cmd = raw;
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
