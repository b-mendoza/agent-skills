// Pins the read-only detector that the `mutation-scope` case depends on.
//
// This is the assertion that proves a skill under test wrote nothing, so a
// false negative here would silently retire the guarantee: the suite would keep
// reporting PASS while a skill mutated the repo. The word-boundary cases matter
// most -- `git log --stat` must not read as `git stash`.
//
//   pnpm test

import { expect, test } from "vitest";

import type { GitStatus, Observation, ToolCall } from "#/harness.ts";
import { mutationEvidence, skillInvocations } from "#/harness.ts";

/** A sampled worktree; `entries` is `git status --short` output. */
const worktree = (entries = ""): GitStatus => ({ kind: "worktree", entries });

/** A clean observation: same status before and after, no tool calls. */
function observe(overrides: Partial<Observation> = {}): Observation {
  return {
    exitCode: 0,
    subtype: "success",
    isError: false,
    finalText: "",
    toolCalls: [],
    gitStatusBefore: worktree(),
    gitStatusAfter: worktree(),
    costUsd: 0,
    durationMs: 0,
    timedOut: false,
    ...overrides,
  };
}

function bash(command: unknown): ToolCall {
  return { name: "Bash", input: { command } };
}

test("a clean run reports no evidence", () => {
  expect(mutationEvidence(observe())).toStrictEqual([]);
});

test("a changed git status is evidence even with no tool calls", () => {
  const found = mutationEvidence(
    observe({
      gitStatusBefore: worktree(""),
      gitStatusAfter: worktree(" M a.txt"),
    }),
  );

  expect(found).toHaveLength(1);
  expect(found[0]).toContain("git status changed");
  // Both sides are quoted so an empty "before" is visible rather than blank.
  expect(found[0]).toContain('""');
  expect(found[0]).toContain('" M a.txt"');
});

test("an unchanged non-empty status is not evidence", () => {
  // The dirty fixture starts with a dirty status; only a *delta* is a mutation.
  const dirty = worktree(" M a.txt\n?? c.txt");

  expect(
    mutationEvidence(
      observe({ gitStatusBefore: dirty, gitStatusAfter: dirty }),
    ),
  ).toStrictEqual([]);
});

// An unreadable sample proves nothing about what the run did. It used to be
// the same empty string a clean worktree yields, so two failed samples matched
// and mutation-scope passed on evidence that was never collected.
test("an unreadable status is evidence, not silence", () => {
  const unreadable: GitStatus = { kind: "unreadable", reason: "ENOENT" };

  expect(
    mutationEvidence(
      observe({ gitStatusBefore: unreadable, gitStatusAfter: unreadable }),
    ),
  ).toStrictEqual([
    "git status could not be sampled before the run: ENOENT",
    "git status could not be sampled after the run: ENOENT",
  ]);
});

test("one unreadable sample is reported without a bogus delta", () => {
  // Comparing a readable sample against an unreadable one would invent a
  // "change" that says more about the failure than about the run.
  const found = mutationEvidence(
    observe({
      gitStatusBefore: worktree(""),
      gitStatusAfter: { kind: "unreadable", reason: "EACCES" },
    }),
  );

  expect(found).toStrictEqual([
    "git status could not be sampled after the run: EACCES",
  ]);
});

test("a repo that is not a worktree is clean, not unreadable", () => {
  // The `not-git` fixture is an expected state: it must keep passing.
  const noWorktree: GitStatus = { kind: "no-worktree" };

  expect(
    mutationEvidence(
      observe({ gitStatusBefore: noWorktree, gitStatusAfter: noWorktree }),
    ),
  ).toStrictEqual([]);
});

test("a worktree appearing where there was none is evidence", () => {
  const found = mutationEvidence(
    observe({
      gitStatusBefore: { kind: "no-worktree" },
      gitStatusAfter: worktree(""),
    }),
  );

  expect(found).toHaveLength(1);
  expect(found[0]).toContain("git status changed");
  expect(found[0]).toContain("(not a worktree)");
});

test.each(["Write", "Edit", "NotebookEdit"])(
  "%s is evidence and names the file",
  (name) => {
    const found = mutationEvidence(
      observe({ toolCalls: [{ name, input: { file_path: "/work/x.ts" } }] }),
    );

    expect(found).toStrictEqual([`${name} called on /work/x.ts`]);
  },
);

test("a write tool with no usable path still reports the call", () => {
  // The call is the violation; a missing path must not make it disappear.
  const found = mutationEvidence(
    observe({
      toolCalls: [
        { name: "Write", input: {} },
        { name: "Edit", input: { file_path: 42 } },
      ],
    }),
  );

  expect(found).toStrictEqual(["Write called on ?", "Edit called on 42"]);
});

test("read-only tools are not evidence", () => {
  const found = mutationEvidence(
    observe({
      toolCalls: [
        { name: "Read", input: { file_path: "/work/x.ts" } },
        { name: "Grep", input: { pattern: "x" } },
        { name: "Skill", input: { skill: "analyzing-recent-project-state" } },
      ],
    }),
  );

  expect(found).toStrictEqual([]);
});

// These verbs always mutate, including operations that can leave
// `git status --short` identical before and after. `git switch` moving HEAD
// between two clean branches is the motivating case: the command text is the
// only evidence that survives.
const MUTATING_GIT = [
  "add",
  "commit",
  "merge",
  // Hyphenated collisions with `merge` must stay flagged even though
  // `merge-base` alone is excepted as read-only.
  "merge-tree",
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

test.each(MUTATING_GIT)("`git %s` is evidence", (verb) => {
  const found = mutationEvidence(observe({ toolCalls: [bash(`git ${verb}`)] }));

  expect(found).toStrictEqual([`mutating git command: git ${verb}`]);
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
  "git worktree list",
  "git submodule status",
  "git reflog show",
  "git notes list",
  "git stash list",
  "git tag --list",
  "git tag -l v1.*",
])("`%s` is read-only and stays clean", (command) => {
  expect(
    mutationEvidence(observe({ toolCalls: [bash(command)] })),
  ).toStrictEqual([]);
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
])("`%s` mutates and is evidence", (command) => {
  expect(
    mutationEvidence(observe({ toolCalls: [bash(command)] })),
  ).toHaveLength(1);
});

// Every occurrence is classified within its own shell command. A read-only
// command later in a chain cannot launder an earlier mutation, and a read-only
// first occurrence cannot hide a later mutation.
test.each([
  "git branch new && git branch --list",
  "git stash list && git stash push",
])("`%s` is evidence when any dual-mode occurrence mutates", (command) => {
  expect(
    mutationEvidence(observe({ toolCalls: [bash(command)] })),
  ).toHaveLength(1);
});

test("a chain of read-only dual-mode commands stays clean", () => {
  expect(
    mutationEvidence(
      observe({ toolCalls: [bash("git stash list && git stash show")] }),
    ),
  ).toStrictEqual([]);
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
  expect(
    mutationEvidence(observe({ toolCalls: [bash(command)] })),
  ).toHaveLength(1);
});

// Detection intentionally scans literal command text rather than requiring
// `git` at the start, so common wrappers and prefixes cannot hide a mutation.
test.each([
  'sh -c "git commit"',
  "cd x && git commit",
  "GIT_DIR=/g git commit",
])("`%s` still exposes the literal mutating git command", (command) => {
  expect(
    mutationEvidence(observe({ toolCalls: [bash(command)] })),
  ).toHaveLength(1);
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
  expect(
    mutationEvidence(observe({ toolCalls: [bash(command)] })),
  ).toStrictEqual([]);
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
  expect(
    mutationEvidence(observe({ toolCalls: [bash(command)] })),
  ).toStrictEqual([]);
});

test("a non-string Bash command is unverifiable rather than clean", () => {
  // Coercing it would let a mutating verb hide inside a non-string payload.
  const found = mutationEvidence(
    observe({ toolCalls: [bash({ cmd: "git commit" })] }),
  );

  expect(found).toStrictEqual([
    "unverifiable Bash command (non-string): object",
  ]);
});

test("an absent Bash command is unverifiable rather than clean", () => {
  expect(
    mutationEvidence(observe({ toolCalls: [{ name: "Bash", input: {} }] })),
  ).toStrictEqual(["unverifiable Bash command (absent)"]);
});

test("every distinct violation is reported, not just the first", () => {
  const found = mutationEvidence(
    observe({
      gitStatusBefore: worktree(""),
      gitStatusAfter: worktree("?? new.txt"),
      toolCalls: [
        { name: "Write", input: { file_path: "/work/a" } },
        bash("git commit -m x"),
      ],
    }),
  );

  // The status delta, the Write, and the git commit are three separate facts;
  // naming each one is what lets a failure message point at the offender.
  expect(found).toStrictEqual([
    expect.stringContaining("git status changed"),
    "Write called on /work/a",
    "mutating git command: git commit -m x",
  ]);
});

test("skillInvocations selects only Skill calls naming the skill", () => {
  const o = observe({
    toolCalls: [
      { name: "Skill", input: { skill: "wanted" } },
      { name: "Skill", input: { skill: "other" } },
      { name: "Bash", input: { skill: "wanted" } },
      { name: "Skill", input: {} },
      { name: "Skill", input: { skill: "wanted" } },
    ],
  });

  expect(skillInvocations(o, "wanted")).toStrictEqual([
    { name: "Skill", input: { skill: "wanted" } },
    { name: "Skill", input: { skill: "wanted" } },
  ]);
  expect(skillInvocations(o, "never-called")).toStrictEqual([]);
});
