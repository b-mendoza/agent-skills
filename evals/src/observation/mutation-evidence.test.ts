import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { isMutatingGitCommand } from "#/observation/git-command-evidence.ts";
import type { GitStatus } from "#/observation/mutation-evidence.ts";
import {
  mutationEvidence,
  sampleGitStatus,
  skillInvocations,
} from "#/observation/mutation-evidence.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const SINGLE_EVIDENCE_COUNT = 1;
const ALL_EVIDENCE_COUNT = 3;

// Command scanning only classifies git invocations. A non-git shell write
// needs a status delta before it can supply evidence.
test("a quiet run ignores unchanged status, read-only tools, and non-git Bash", () => {
  expect(mutationEvidence(createObservation())).toStrictEqual([]);
  expect(
    mutationEvidence(
      createObservation({
        gitStatusBefore: { kind: "worktree", entries: " M a.txt\n?? c.txt" },
        gitStatusAfter: { kind: "worktree", entries: " M a.txt\n?? c.txt" },
        toolCalls: [
          { name: "Read", input: { file_path: "/work/x.ts" } },
          { name: "Grep", input: { pattern: "x" } },
          { name: "Skill", input: { skill: "analyzing-recent-project-state" } },
          { name: "Bash", input: { command: "rm -rf /repo/src" } },
        ],
      }),
    ),
  ).toStrictEqual([]);
});

test("a repo that is not a worktree is clean, not unreadable", () => {
  expect(
    mutationEvidence(
      createObservation({
        gitStatusBefore: { kind: "no-worktree" },
        gitStatusAfter: { kind: "no-worktree" },
      }),
    ),
  ).toStrictEqual([]);
});

// Failed samples once compared equal to clean worktrees, hiding mutations.
test("an unreadable status is evidence, not silence", () => {
  const unreadable: GitStatus = { kind: "unreadable", reason: "ENOENT" };
  expect(
    mutationEvidence(
      createObservation({
        gitStatusBefore: unreadable,
        gitStatusAfter: unreadable,
      }),
    ),
  ).toStrictEqual([
    "git status could not be sampled before the run: ENOENT",
    "git status could not be sampled after the run: ENOENT",
  ]);
});

test("one unreadable sample is reported without a bogus delta", () => {
  expect(
    mutationEvidence(
      createObservation({
        gitStatusAfter: { kind: "unreadable", reason: "EACCES" },
      }),
    ),
  ).toStrictEqual(["git status could not be sampled after the run: EACCES"]);
});

test("a worktree appearing where there was none is evidence", () => {
  const found = mutationEvidence(
    createObservation({ gitStatusBefore: { kind: "no-worktree" } }),
  );
  const [statusChangeEvidence] = found;
  expect(found).toHaveLength(SINGLE_EVIDENCE_COUNT);
  expect(statusChangeEvidence).toContain("git status changed");
  expect(statusChangeEvidence).toContain("(not a worktree)");
});

test.each([
  ["Write", "file_path", "/work/x.ts"],
  ["Edit", "file_path", "/work/x.ts"],
  ["NotebookEdit", "notebook_path", "/work/notebook.ipynb"],
])("%s is evidence and names the file", (name, pathKey, filePath) => {
  expect(
    mutationEvidence(
      createObservation({
        toolCalls: [{ name, input: { [pathKey]: filePath } }],
      }),
    ),
  ).toStrictEqual([`${name} called on ${filePath}`]);
});

test("a write tool with no usable mapped path still reports the call", () => {
  const found = mutationEvidence(
    createObservation({
      toolCalls: [
        { name: "Write", input: {} },
        { name: "Write", input: { file_path: "" } },
        { name: "Edit", input: { file_path: 42 } },
        { name: "NotebookEdit", input: { file_path: "/work/old.ipynb" } },
        { name: "NotebookEdit", input: { notebook_path: 42 } },
      ],
    }),
  );
  expect(found).toStrictEqual([
    "Write called on ?",
    "Write called on ?",
    "Edit called on ?",
    "NotebookEdit called on ?",
    "NotebookEdit called on ?",
  ]);
});

test.each([
  {
    name: "an absent Bash command",
    bashInput: {},
    expectedEvidence: "unverifiable Bash command (absent)",
  },
  {
    name: "a non-string Bash command",
    bashInput: { command: { cmd: "git commit" } },
    expectedEvidence: "unverifiable Bash command (non-string): object",
  },
])(
  "$name is unverifiable rather than clean",
  ({ bashInput, expectedEvidence }) => {
    expect(
      mutationEvidence(
        createObservation({ toolCalls: [{ name: "Bash", input: bashInput }] }),
      ),
    ).toStrictEqual([expectedEvidence]);
  },
);

test("every distinct violation is reported, not just the first", () => {
  const observation = createObservation({
    gitStatusAfter: { kind: "worktree", entries: " M a.txt" },
  });
  const statusOnly = mutationEvidence(observation);
  const [statusChangeEvidence] = statusOnly;
  expect(statusOnly).toHaveLength(SINGLE_EVIDENCE_COUNT);
  expect(statusChangeEvidence).toContain("git status changed");
  expect(statusChangeEvidence).toContain('""');
  expect(statusChangeEvidence).toContain('" M a.txt"');

  const found = mutationEvidence({
    ...observation,
    toolCalls: [
      { name: "Write", input: { file_path: "/work/a" } },
      { name: "Bash", input: { command: "git commit -m x" } },
    ],
  });
  expect(found).toHaveLength(ALL_EVIDENCE_COUNT);
  expect(found).toEqual(
    expect.arrayContaining([
      ...statusOnly,
      "Write called on /work/a",
      "mutating git command: git commit -m x",
    ]),
  );
});

test("skillInvocations selects only Skill calls naming the skill", () => {
  const observation = createObservation({
    toolCalls: [
      { name: "Skill", input: { skill: "wanted" } },
      { name: "Skill", input: { skill: "other" } },
      { name: "Bash", input: { skill: "wanted" } },
      { name: "Skill", input: {} },
      { name: "Skill", input: { skill: "wanted" } },
    ],
  });
  expect(skillInvocations(observation, "wanted")).toStrictEqual([
    { name: "Skill", input: { skill: "wanted" } },
    { name: "Skill", input: { skill: "wanted" } },
  ]);
  expect(skillInvocations(observation, "never-called")).toStrictEqual([]);
});

// These can mutate HEAD or git metadata without changing worktree status.
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

test.each(ALWAYS_MUTATING_GIT_VERBS)("`git %s` is mutating", (verb) => {
  expect(isMutatingGitCommand(`git ${verb}`)).toBe(true);
});

test.each([
  ["git stash", "a bare form that writes"],
  ["git tag", "conservative policy even though bare tag lists"],
  ["git merge-tree", "the documented merge-prefix collision policy"],
])("`%s` is flagged by %s", (command) => {
  expect(isMutatingGitCommand(command)).toBe(true);
});

test.each([
  "git branch",
  "git branch --list",
  "git config --get user.name",
  "git worktree list",
  "git submodule status",
  "git reflog show",
  "git notes list",
  "git stash list",
  "git tag --list",
  "git tag -l v1.*",
  "git sparse-checkout list",
  "git bisect log",
  "git branch --format=%(refname)",
])("`%s` is read-only", (command) => {
  expect(isMutatingGitCommand(command)).toBe(false);
});

test.each([
  "git config user.name x",
  "git config --unset user.name",
  "git config --global core.editor vim",
])("`%s` configures git", (command) => {
  expect(isMutatingGitCommand(command)).toBe(true);
});

test.each([
  "git branch new-feature",
  "git branch -D old",
  "git worktree add /tmp/wt",
  "git submodule update --init",
  "git notes add -m x",
  "git stash push",
  "git tag v1.0.0",
  "git sparse-checkout set src",
  "git bisect start",
])("`%s` mutates", (command) => {
  expect(isMutatingGitCommand(command)).toBe(true);
});

// Read-only markers cannot excuse a different command in the same chain.
test.each([
  "git branch new && git branch --list",
  "git config --list && git config user.name x",
])("`%s` is flagged when any occurrence mutates", (command) => {
  expect(isMutatingGitCommand(command)).toBe(true);
});

test("a chain of read-only dual-mode commands stays clean", () => {
  expect(isMutatingGitCommand("git stash list && git stash show")).toBe(false);
});

// Option arity, quoting, and repetition must not hide the verb.
test.each([
  "git -C /repo commit -m x",
  'git -C "/repo path" commit',
  "git -C '/repo path' push",
  'git -c "user.name=x y" commit',
  'git --git-dir="/r/.git" commit',
  "git -C /repo --no-pager commit",
  "git --no-pager --no-optional-locks commit",
  "git --no-pager -c k=v commit",
  "git -c a=1 -c b=2 commit",
  "git -C --weird commit",
])("`%s` mutates despite the leading options", (command) => {
  expect(isMutatingGitCommand(command)).toBe(true);
});

test.each(['sh -c "git commit"', "GIT_DIR=/g git commit"])(
  "`%s` still exposes the literal mutating git command",
  (command) => {
    expect(isMutatingGitCommand(command)).toBe(true);
  },
);

test.each(["git -C /repo log --stat", "git --no-pager log commit"])(
  "`%s` stays clean despite the leading options",
  (command) => {
    expect(isMutatingGitCommand(command)).toBe(false);
  },
);

test("`git merge-base HEAD origin/main` is read-only despite the merge prefix", () => {
  expect(isMutatingGitCommand("git merge-base HEAD origin/main")).toBe(false);
});

describe("sampleGitStatus", () => {
  let repositoryDirectory = "";
  const realIndex = process.env["GIT_INDEX_FILE"];
  beforeEach(() => {
    repositoryDirectory = mkdtempSync(join(tmpdir(), "git-status-"));
  });
  afterEach(() => {
    if (realIndex === undefined) delete process.env["GIT_INDEX_FILE"];
    else process.env["GIT_INDEX_FILE"] = realIndex;
    rmSync(repositoryDirectory, { recursive: true, force: true });
  });

  test("a directory that is not a repo is a known state, not a failure", () => {
    expect(sampleGitStatus(repositoryDirectory)).toStrictEqual({
      kind: "no-worktree",
    });
  });

  test("a corrupt index is unreadable rather than clean", () => {
    // Exit 128 alone cannot distinguish an absent repository from corruption.
    execFileSync("git", ["init", "-q"], { cwd: repositoryDirectory });
    writeFileSync(join(repositoryDirectory, "f.txt"), "x");
    execFileSync("git", ["add", "f.txt"], { cwd: repositoryDirectory });
    writeFileSync(join(repositoryDirectory, ".git", "index"), "garbage");
    const status = sampleGitStatus(repositoryDirectory);
    expect(status.kind).toBe("unreadable");
    if (status.kind !== "unreadable") {
      throw new Error("expected an unreadable git status");
    }
    expect(status.reason).not.toBe("");
  });

  test("a missing directory is unreadable, not clean", () => {
    expect(sampleGitStatus(join(repositoryDirectory, "missing"))).toStrictEqual(
      {
        kind: "unreadable",
        reason: "ENOENT",
      },
    );
  });

  test("a fatal message merely containing the phrase stays unreadable", () => {
    execFileSync("git", ["init", "-q"], { cwd: repositoryDirectory });
    const index = join(repositoryDirectory, "not a git repository");
    writeFileSync(index, "garbage");
    process.env["GIT_INDEX_FILE"] = index;
    const status = sampleGitStatus(repositoryDirectory);
    expect(status.kind).toBe("unreadable");
    if (status.kind !== "unreadable") {
      throw new Error("expected unreadable index");
    }
    expect(status.reason).toContain(index);
  });
});
