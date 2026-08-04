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

import type { GitStatus } from "#/observation/git-status.ts";
import {
  mutationEvidence,
  skillInvocations,
} from "#/observation/mutation-evidence.ts";
import {
  bash,
  createObservation,
  createWorktreeStatus,
  evidenceFor,
} from "#/observation/observation-test-support.ts";

test.each([
  ["a clean run reports no evidence", createObservation()],
  // The dirty fixture starts with a dirty status; only a *delta* is a mutation.
  [
    "an unchanged non-empty status is not evidence",
    createObservation({
      gitStatusBefore: createWorktreeStatus(" M a.txt\n?? c.txt"),
      gitStatusAfter: createWorktreeStatus(" M a.txt\n?? c.txt"),
    }),
  ],
  // The `not-git` fixture is an expected state: it must keep passing.
  [
    "a repo that is not a worktree is clean, not unreadable",
    createObservation({
      gitStatusBefore: { kind: "no-worktree" },
      gitStatusAfter: { kind: "no-worktree" },
    }),
  ],
])("%s", (_caseName, observation) => {
  expect(mutationEvidence(observation)).toStrictEqual([]);
});

test("a changed git status is evidence even with no tool calls", () => {
  const found = mutationEvidence(
    createObservation({
      gitStatusBefore: createWorktreeStatus(""),
      gitStatusAfter: createWorktreeStatus(" M a.txt"),
    }),
  );

  expect(found).toHaveLength(1);
  expect(found[0]).toContain("git status changed");
  // Both sides are quoted so an empty "before" is visible rather than blank.
  expect(found[0]).toContain('""');
  expect(found[0]).toContain('" M a.txt"');
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

  expect(found).toHaveLength(1);
  expect(found[0]).toContain("git status changed");
  expect(found[0]).toContain("(not a worktree)");
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

test("a path containing a newline stays a single evidence entry", () => {
  // Evidence is a list of facts, not of lines. A path carrying a newline must
  // not read as two violations once a failure message joins the list.
  const found = mutationEvidence(
    createObservation({
      toolCalls: [{ name: "Write", input: { file_path: "/work/a\nb.ts" } }],
    }),
  );

  expect(found).toStrictEqual(["Write called on /work/a\nb.ts"]);
});

test("read-only tools are not evidence", () => {
  const found = mutationEvidence(
    createObservation({
      toolCalls: [
        { name: "Read", input: { file_path: "/work/x.ts" } },
        { name: "Grep", input: { pattern: "x" } },
        { name: "Skill", input: { skill: "analyzing-recent-project-state" } },
      ],
    }),
  );

  expect(found).toStrictEqual([]);
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

test("a non-git Bash write produces no command evidence", () => {
  // A boundary, not an oversight: command scanning classifies git invocations
  // only, so a plain shell write leaves no command-text evidence at all. The
  // git-status delta is the sole detector for writes made this way.
  expect(evidenceFor("rm -rf /repo/src")).toStrictEqual([]);
});

test("every distinct violation is reported, not just the first", () => {
  const found = mutationEvidence(
    createObservation({
      gitStatusBefore: createWorktreeStatus(""),
      gitStatusAfter: createWorktreeStatus("?? new.txt"),
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
