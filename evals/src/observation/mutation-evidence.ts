import { execFileSync } from "node:child_process";

import { Predicate, Schema } from "effect";

import type { Observation, ToolCall } from "#/observation/agent-query.ts";

export const gitStatusSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("worktree"), entries: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("no-worktree") }),
  Schema.Struct({ kind: Schema.Literal("unreadable"), reason: Schema.String }),
]);
export type GitStatus = typeof gitStatusSchema.Type;

const GIT_NOT_A_REPOSITORY = 128;

/** Whether two samples describe the same repository state. */
function sameGitStatus(before: GitStatus, after: GitStatus): boolean {
  if (before.kind === "worktree" && after.kind === "worktree") {
    return before.entries === after.entries;
  }
  return before.kind === after.kind;
}

function describeGitStatus(
  status: Exclude<GitStatus, { kind: "unreadable" }>,
): string {
  return status.kind === "worktree"
    ? JSON.stringify(status.entries)
    : "(not a worktree)";
}

function describeGitFailure(
  error: unknown,
  fields: Record<string, unknown>,
): GitStatus {
  const stderr = toText(fields["stderr"]);
  if (
    fields["status"] === GIT_NOT_A_REPOSITORY &&
    /^fatal: not a git repository/im.test(stderr)
  ) {
    return { kind: "no-worktree" };
  }
  const detail = stderr
    .trim()
    .split("\n")
    .find((line) => line !== "");
  return {
    kind: "unreadable",
    reason:
      detail ??
      toText(
        [fields["code"], fields["message"], error].find(
          (value) => value != null,
        ),
      ),
  };
}

/** A failed sample is evidence, never an empty or clean worktree. */
export function sampleGitStatus(repo: string): GitStatus {
  try {
    const output = execFileSync("git", ["status", "--short"], {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { kind: "worktree", entries: output.trim() };
  } catch (error) {
    return describeGitFailure(error, Predicate.isObject(error) ? error : {});
  }
}

/** Render foreign failures, including non-finite numbers and cyclic objects. */
export function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return serialize(value);
}

const stringify: (value: unknown) => string | undefined = JSON.stringify;

function serialize(value: unknown): string {
  try {
    return stringify(value) ?? coerceText(value);
  } catch (error) {
    return coerceText(value);
  }
}

function coerceText(value: unknown): string {
  try {
    return String(value);
  } catch (error) {
    return "(unprintable value)";
  }
}

/** Calls to the Skill tool naming `skill`. Empty when it never triggered. */
export function skillInvocations(
  observation: Observation,
  skill: string,
): ToolCall[] {
  return observation.toolCalls.filter(
    (call) => call.name === "Skill" && call.input["skill"] === skill,
  );
}

const MUTATING_TOOL_PATH_KEYS: Readonly<Record<string, string>> = {
  Write: "file_path",
  Edit: "file_path",
  NotebookEdit: "notebook_path",
};

function readablePath(path: unknown): string {
  return typeof path === "string" && path !== "" ? path : "?";
}

function collectBashEvidence(command: unknown, evidence: string[]): void {
  if (command == null) {
    evidence.push("unverifiable Bash command (absent)");
  } else if (typeof command !== "string") {
    evidence.push(`unverifiable Bash command (non-string): ${typeof command}`);
  } else if (isMutatingGitCommand(command)) {
    evidence.push(`mutating git command: ${command}`);
  }
}

/** Ordered evidence, including unreadable samples rather than false clean results. */
export function mutationEvidence(observation: Observation): string[] {
  const { gitStatusBefore: before, gitStatusAfter: after } = observation;
  const evidence = Object.entries({ before, after }).flatMap(
    ([label, status]) =>
      status.kind === "unreadable"
        ? [`git status could not be sampled ${label} the run: ${status.reason}`]
        : [],
  );
  if (
    before.kind !== "unreadable" &&
    after.kind !== "unreadable" &&
    !sameGitStatus(before, after)
  ) {
    evidence.push(
      `git status changed:\n  before: ${describeGitStatus(before)}\n  after:  ${describeGitStatus(after)}`,
    );
  }
  observation.toolCalls.forEach((call) => {
    const pathKey = MUTATING_TOOL_PATH_KEYS[call.name];
    if (pathKey !== undefined) {
      evidence.push(
        `${call.name} called on ${readablePath(call.input[pathKey])}`,
      );
    }
    if (call.name === "Bash") {
      collectBashEvidence(call.input["command"], evidence);
    }
  });
  return evidence;
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

/**
 * Matches `verb` in git's verb position, past any leading global options.
 *
 * A fresh RegExp per call: the `g`-flag caller carries `lastIndex` state, so a
 * shared instance would resume mid-string and miss occurrences.
 */
function gitVerbPattern(verb: string, flags?: string): RegExp {
  return new RegExp(String.raw`\bgit\s+(?:${GIT_OPTION})*${verb}\b`, flags);
}

const MUTATING_GIT_PATTERNS = MUTATING_GIT.map((verb) => gitVerbPattern(verb));

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
    verb: "config",
    readOnly: ["--get", "--get-all", "--get-regexp", "--list", "-l"],
    // `git config user.name x` writes `.git/config` while leaving
    // `git status --short` unchanged, so the command text is the only surviving
    // evidence. Argument forms without a read-only marker, including plain
    // `git config user.name`, deliberately read as mutations to fail loudly.
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

const FIRST_SHELL_COMMAND_SEGMENT_COUNT = 1;
const FULL_MATCH_INDEX = 0;

/** Whether a literal shell command contains a repo-mutating git invocation. */
function isMutatingGitCommand(command: string): boolean {
  if (MUTATING_GIT_PATTERNS.some((pattern) => pattern.test(command))) {
    return true;
  }
  return DUAL_MODE_GIT.some(({ verb, readOnly, bareWrites }) =>
    [...command.matchAll(gitVerbPattern(verb, "g"))].some((match) => {
      // A later command's read-only marker cannot excuse this invocation.
      const [segment = ""] = command
        .slice(match.index + match[FULL_MATCH_INDEX].length)
        .split(/&&|\|\||[;|\n]/, FIRST_SHELL_COMMAND_SEGMENT_COUNT);
      const args = segment.trim();
      if (args === "") return bareWrites;
      return !readOnly.some((marker) =>
        new RegExp(String.raw`(?:^|\s)${escapeRegExp(marker)}(?:$|[\s=])`).test(
          args,
        ),
      );
    }),
  );
}
