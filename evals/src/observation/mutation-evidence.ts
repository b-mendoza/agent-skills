import { describeGitStatus, sameGitStatus } from "#/observation/git-status.ts";
import type { Observation, ToolCall } from "#/observation/observation-types.ts";

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
