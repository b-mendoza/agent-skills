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

const FIRST_HEREDOC_INDEX = 0;
const SHELL_TOKENS = [
  /\\[\s\S]/,
  /'[^']*'/,
  /"(?:\\[\s\S]|[^"\\])*"/,
  /`(?:\\[\s\S]|[^`\\])*`/,
  /#[^\n]*/,
  /<<(?<tabs>-?)[ \t]*(?<quote>['"])(?<delimiter>[A-Za-z_]\w*)\k<quote>(?=[ \t;|&<>\n]|$)/,
  /(?<uncertain><<|['"`\\])/,
  /[\s\S]/,
]
  .map((pattern) => pattern.source)
  .join("|");
interface QuotedHeredoc {
  delimiter: string;
  tabs: boolean;
}

const AFTER_NEWLINE_OFFSET = 1;
const FIRST_CHARACTER_INDEX = 0;

function targetIsOnlyValidated(otherText: string, target: string): boolean {
  // Even stdin can execute a script; exempt only the known report-validator read.
  const validatorRead = new RegExp(
    String.raw`^sh \$SKILL_DIR/scripts/validate-output\.sh report < ${escapeRegExp(target)}(?=[ \t]*(?:;|$))`,
    "gm",
  );
  return !otherText.replace(validatorRead, "").includes(target);
}

function isPlainFileSink(command: string, token: RegExpExecArray): boolean {
  const lineStart =
    command.lastIndexOf("\n", token.index) + AFTER_NEWLINE_OFFSET;
  const prefix = command.slice(lineStart, token.index);
  const suffix = command.slice(token.index + token[FULL_MATCH_INDEX].length);
  const sink = /^[ \t]*cat[ \t]+>[ \t]*(?<target>[.\w/-]+)[ \t]+$/.exec(prefix);
  if (sink === null) return false;
  const target = String(sink.groups?.["target"]);
  const otherText =
    command.slice(FIRST_CHARACTER_INDEX, lineStart) +
    command.slice(token.index);
  return (
    /^[ \t]*(?:\n|$)/.test(suffix) && targetIsOnlyValidated(otherText, target)
  );
}

function queueQuotedHeredoc(
  command: string,
  token: RegExpExecArray,
  pending: QuotedHeredoc[],
): boolean {
  const { uncertain, delimiter, tabs } = token.groups ?? {};
  if (delimiter === undefined) return uncertain === undefined;
  if (!isPlainFileSink(command, token)) return false;
  pending.push({ delimiter, tabs: tabs === "-" });
  return true;
}

function afterHeredocBodies(
  command: string,
  start: number,
  pending: QuotedHeredoc[],
): number | undefined {
  let end = start;
  for (const heredoc of pending.splice(FIRST_HEREDOC_INDEX)) {
    const closing = new RegExp(
      `^${heredoc.tabs ? "\\t*" : ""}${heredoc.delimiter}(?:\\n|$)`,
      "gm",
    );
    closing.lastIndex = end;
    if (closing.exec(command) === null) return undefined;
    end = closing.lastIndex;
  }
  return end;
}

function nextExecutableOffset(
  command: string,
  token: RegExpExecArray,
  pending: QuotedHeredoc[],
): number | undefined {
  if (!queueQuotedHeredoc(command, token, pending)) return undefined;
  const end = token.index + token[FULL_MATCH_INDEX].length;
  return token[FULL_MATCH_INDEX] === "\n"
    ? afterHeredocBodies(command, end, pending)
    : end;
}

/** Excludes quoted heredocs only for standalone cat-to-file sinks; executable input stays visible. */
function withoutQuotedHeredocData(command: string): string {
  const tokens = new RegExp(SHELL_TOKENS, "g");
  const pending: QuotedHeredoc[] = [];
  const parts: string[] = [];
  let copiedThrough = 0;
  for (
    let token = tokens.exec(command);
    token !== null;
    token = tokens.exec(command)
  ) {
    const end = nextExecutableOffset(command, token, pending);
    if (end === undefined) return command;
    parts.push(command.slice(copiedThrough, tokens.lastIndex));
    copiedThrough = end;
    tokens.lastIndex = end;
  }
  return parts.join("") + command.slice(copiedThrough);
}

/** Whether a literal shell command contains a repo-mutating git invocation. */
export function isMutatingGitCommand(shellCommand: string): boolean {
  const command = withoutQuotedHeredocData(shellCommand);
  // xargs can take git's verb from stdin, so no literal `git push` need appear.
  if (
    MUTATING_GIT_PATTERNS.some((pattern) => pattern.test(command)) ||
    /\bxargs\b[^\n]*\bgit\b[^\n]*<</.test(command)
  ) {
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
