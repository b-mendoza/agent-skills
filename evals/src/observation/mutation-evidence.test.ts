import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

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
test.each([
  {
    label: "both unreadable samples",
    before: { kind: "unreadable", reason: "ENOENT" },
    after: { kind: "unreadable", reason: "ENOENT" },
    expected: [
      "git status could not be sampled before the run: ENOENT",
      "git status could not be sampled after the run: ENOENT",
    ],
  },
  {
    label: "one unreadable sample",
    before: { kind: "worktree", entries: "" },
    after: { kind: "unreadable", reason: "EACCES" },
    expected: ["git status could not be sampled after the run: EACCES"],
  },
] satisfies Array<{
  label: string;
  before: GitStatus;
  after: GitStatus;
  expected: string[];
}>)(
  "$label is reported without a bogus delta",
  ({ before, after, expected }) => {
    expect(
      mutationEvidence(
        createObservation({ gitStatusBefore: before, gitStatusAfter: after }),
      ),
    ).toStrictEqual(expected);
  },
);

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

// Bare tag and merge-tree are deliberately conservative. Leading options,
// quoted invocations, and chains must retain the same lexical classification.
test.each([
  ...ALWAYS_MUTATING_GIT_VERBS.map((verb) => `git ${verb}`),
  "git stash",
  "git tag",
  "git merge-tree",
  "git config user.name x",
  "git config --unset user.name",
  "git config --global core.editor vim",
  "git branch new-feature",
  "git branch -D old",
  "git worktree add /tmp/wt",
  "git submodule update --init",
  "git notes add -m x",
  "git stash push",
  "git tag v1.0.0",
  "git sparse-checkout set src",
  "git bisect start",
  // A later command's read-only marker cannot excuse a prior mutation.
  "git branch new && git branch --list",
  "git config --list && git config user.name x",
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
  'sh -c "git commit"',
  "GIT_DIR=/g git commit",
])("`%s` supplies mutation evidence", (command) => {
  expect(
    mutationEvidence(
      createObservation({ toolCalls: [{ name: "Bash", input: { command } }] }),
    ),
  ).toStrictEqual([`mutating git command: ${command}`]);
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
  "git stash list && git stash show",
  "git -C /repo log --stat",
  "git --no-pager log commit",
  "git merge-base HEAD origin/main",
])("`%s` supplies no mutation evidence", (command) => {
  expect(
    mutationEvidence(
      createObservation({ toolCalls: [{ name: "Bash", input: { command } }] }),
    ),
  ).toStrictEqual([]);
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
