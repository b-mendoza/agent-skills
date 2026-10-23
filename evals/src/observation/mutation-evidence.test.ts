import { expect, test } from "vitest";

import type { GitStatus } from "#/observation/mutation-evidence.ts";
import {
  mutationEvidence,
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
