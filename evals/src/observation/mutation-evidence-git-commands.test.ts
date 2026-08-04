// Pins the read-only detector that the `mutation-scope` case depends on.
//
// This is the assertion that proves a skill under test wrote nothing, so a
// false negative here would silently retire the guarantee: the suite would keep
// reporting PASS while a skill mutated the repo. The word-boundary cases matter
// most -- `git log --stat` must not read as `git stash`.
//
//   pnpm test

import { expect, test } from "vitest";

import { evidenceFor } from "#/observation/observation-test-support.ts";

// These verbs always mutate, including operations that can leave
// `git status --short` identical before and after. `git switch` moving HEAD
// between two clean branches is the motivating case: the command text is the
// only evidence that survives.
const ALWAYS_MUTATING_GIT_VERBS = [
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
];

test.each(ALWAYS_MUTATING_GIT_VERBS)("`git %s` is evidence", (verb) => {
  expect(evidenceFor(`git ${verb}`)).toStrictEqual([
    `mutating git command: git ${verb}`,
  ]);
});

// The bare form of these reaches the same verdict by a different mechanism, so
// they are pinned apart from the always-mutating list: `stash` and `tag` are
// dual-mode verbs declared to write when invoked with no arguments, while
// `merge-tree` is caught by the `merge` pattern's prefix match -- `\b` treats
// the hyphen as a boundary, and only `merge-base` is excepted from it.
test.each([
  ["git stash", "a dual-mode verb whose bare form writes"],
  ["git tag", "a dual-mode verb whose bare form writes"],
  ["git merge-tree", "a hyphenated collision with the `merge` pattern"],
])("`%s` is evidence as %s", (command) => {
  expect(evidenceFor(command)).toStrictEqual([
    `mutating git command: ${command}`,
  ]);
});

// Dual-mode verbs: the same word mutates or reads depending on its arguments.
// `analyzing-recent-project-state` documents read-only `git branch` as an
// allowed command, so treating the bare verb as mutating would fail runs that
// are behaving exactly as specified.
test.each([
  "git branch",
  "git branch --show-current",
  "git branch --list",
  "git branch -a",
  "git config --get user.name",
  "git config --list",
  "git config -l",
  "git worktree list",
  "git submodule status",
  "git reflog show",
  "git notes list",
  "git stash list",
  "git tag --list",
  "git tag -l v1.*",
  "git sparse-checkout list",
  "git bisect log",
  // A marker terminated by `=` rather than whitespace or end of string: the
  // read-only forms an agent actually types include attached option values.
  "git branch --format=%(refname)",
])("`%s` is read-only and stays clean", (command) => {
  expect(evidenceFor(command)).toStrictEqual([]);
});

test.each([
  "git config user.name x",
  "git config --local user.name x",
  "git -C /repo config user.name x",
  "git config --unset user.name",
  "git config --global core.editor vim",
])("`%s` configures git and is evidence", (command) => {
  expect(evidenceFor(command)).toStrictEqual([
    `mutating git command: ${command}`,
  ]);
});

test.each([
  "git branch new-feature",
  "git branch -d old",
  "git branch -D old",
  "git branch -m renamed",
  "git worktree add /tmp/wt",
  "git worktree remove /tmp/wt",
  "git submodule update --init",
  "git notes add -m x",
  "git stash push",
  "git tag v1.0.0",
  // `sparse-checkout` rewrites the working tree and `bisect` moves HEAD, both
  // of which can settle back to an identical `git status --short`.
  "git sparse-checkout set src",
  "git sparse-checkout init",
  "git bisect start",
  "git bisect reset",
])("`%s` mutates and is evidence", (command) => {
  expect(evidenceFor(command)).toStrictEqual([
    `mutating git command: ${command}`,
  ]);
});

// Every occurrence is classified within its own shell command. A read-only
// command later in a chain cannot launder an earlier mutation, and a read-only
// first occurrence cannot hide a later mutation.
test.each([
  "git branch new && git branch --list",
  "git config --list && git config user.name x",
  "git stash list && git stash push",
])("`%s` is evidence when any dual-mode occurrence mutates", (command) => {
  expect(evidenceFor(command)).toStrictEqual([
    `mutating git command: ${command}`,
  ]);
});

test("a chain of read-only dual-mode commands stays clean", () => {
  expect(evidenceFor("git stash list && git stash show")).toStrictEqual([]);
});

// Regression guard: the option group once matched only valueless flags, so
// `git -C /repo commit` -- an agent acting on a repo it is not sitting in --
// read as clean. Separate-argument options must not hide the verb.
test.each([
  "git -C /repo commit -m x",
  'git -C "/repo path" commit',
  "git -C '/repo path' push",
  'git -c "user.name=x y" commit',
  'git --git-dir="/r/.git" commit',
  "git -C /repo --no-pager commit",
  "git --no-pager commit",
  "git -c user.name=x commit",
  "git --git-dir=/r/.git commit",
  "git -C /repo push",
  "git -C /repo add .",
  // Consecutive valueless flags: inferring arity from a leading `-` used to
  // read `--no-optional-locks` as the *value* of `--no-pager` and lose the verb.
  "git --no-pager --no-optional-locks commit",
  "git --no-pager -c k=v commit",
  "git -c a=1 -c b=2 commit",
  // git accepts a dash-prefixed argument here, so arity cannot be guessed.
  "git -C --weird commit",
  "git --work-tree=/w add .",
  "git -C /repo --no-pager reset --hard",
])("`%s` is evidence despite the leading options", (command) => {
  expect(evidenceFor(command)).toStrictEqual([
    `mutating git command: ${command}`,
  ]);
});

// Detection intentionally scans literal command text rather than requiring
// `git` at the start, so common wrappers and prefixes cannot hide a mutation.
test.each([
  'sh -c "git commit"',
  "cd x && git commit",
  "GIT_DIR=/g git commit",
])("`%s` still exposes the literal mutating git command", (command) => {
  expect(evidenceFor(command)).toStrictEqual([
    `mutating git command: ${command}`,
  ]);
});

// The same option handling must not start swallowing read-only commands.
test.each([
  "git -C /repo log --stat",
  'git -C "/repo path" log --stat',
  "git -C /repo status",
  "git --no-pager log",
  // `commit` here is a revision argument to `log`, not the verb. Only the
  // token in verb position counts.
  "git --no-pager log commit",
  "git log commit",
])("`%s` stays clean despite the leading options", (command) => {
  expect(evidenceFor(command)).toStrictEqual([]);
});

// The regexes are word-bounded precisely so read-only commands stay read-only.
// `git log --stat` sharing a prefix with `stash` is the motivating example.
test.each([
  "git log --stat",
  "git status --short",
  "git diff HEAD",
  "git show",
  // Read-only despite starting with `merge`: `\b` treats the hyphen as a word
  // boundary, so without its explicit exception this documented command would
  // read as `git merge`. It failed a legitimate paid run before being pinned.
  "git merge-base HEAD origin/main",
  "git merge-base --is-ancestor HEAD origin/main",
  "ls add",
  "npm add-something",
])("`%s` is not evidence", (command) => {
  expect(evidenceFor(command)).toStrictEqual([]);
});
