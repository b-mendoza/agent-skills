// Pins how observed facts become mutation evidence for the `mutation-scope`
// case: status-delta classification, unreadable-sample reporting, write-tool
// calls, and Bash payloads that cannot be scanned.
//
// This is the assertion that proves a skill under test wrote nothing, so a
// false negative here would silently retire the guarantee: the suite would keep
// reporting PASS while a skill mutated the repo. Which git command texts count
// as mutations is pinned separately, in `mutation-evidence-git-commands`.
//
//   pnpm test

import { expect, test } from "vitest";

import type { GitStatus } from "#/observation/mutation-evidence.ts";
import {
  mutationEvidence,
  skillInvocations,
} from "#/observation/mutation-evidence.ts";
import {
  createObservation,
  createWorktreeStatus,
} from "#/observation/observation-test-support.ts";

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

// An unreadable sample proves nothing about what the run did. It used to be
// the same empty string a clean worktree yields, so two failed samples matched
// and mutation-scope passed on evidence that was never collected.
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
  // Comparing a readable sample against an unreadable one would invent a
  // "change" that says more about the failure than about the run.
  const found = mutationEvidence(
    createObservation({
      gitStatusBefore: createWorktreeStatus(""),
      gitStatusAfter: { kind: "unreadable", reason: "EACCES" },
    }),
  );

  expect(found).toStrictEqual([
    "git status could not be sampled after the run: EACCES",
  ]);
});

test("a worktree appearing where there was none is evidence", () => {
  const found = mutationEvidence(
    createObservation({
      gitStatusBefore: { kind: "no-worktree" },
      gitStatusAfter: createWorktreeStatus(""),
    }),
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
  const found = mutationEvidence(
    createObservation({
      toolCalls: [{ name, input: { [pathKey]: filePath } }],
    }),
  );

  expect(found).toStrictEqual([`${name} called on ${filePath}`]);
});

test("a write tool with no usable mapped path still reports the call", () => {
  // The call is the violation; a missing or non-string path must not make it
  // disappear or render an untrusted value as if it were a usable path.
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
    // A payload that cannot be scanned is not clean: coercing it would let a
    // mutating verb hide inside a shape the detector never reads.
    const found = mutationEvidence(
      createObservation({ toolCalls: [{ name: "Bash", input: bashInput }] }),
    );

    expect(found).toStrictEqual([expectedEvidence]);
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
