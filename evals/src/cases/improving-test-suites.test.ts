import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

import {
  cases,
  DIRTY_TEST_CONTENT,
  seedDirtyTestSuite,
  seedTestSuite,
  TEST_FILES,
  TEST_PATH,
} from "#/cases/improving-test-suites.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import { sampleGitStatus } from "#/observation/mutation-evidence.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const [, , approval, dirty] = cases;
const PLAN = `MINIMAL_HARNESS_DECISION for ${TEST_PATH}
Keep adds shipping and rejects negative amounts to preserve behavior.
Delete the duplicate shipping example (duplicated-coverage) and rewrite the function spelling check (implementation-detail-assertion).
Do you approve this plan before I edit any tests?`;
const BLOCKED = `# Improving Test Suites Handoff
I stopped before editing because uncommitted target edits require a workspace decision.
## Resume Packet
Inputs: TARGET_TEST_FILES=${TEST_PATH}, AUTO_APPROVE=true
Reports so far: none
Pending question: Commit, stash, or abort your uncommitted edits?
Next step: WorkspaceRisk
REPAIR_TOTAL: 0`;
const cleanObservation = createObservation({
  finalText: PLAN,
  repoFiles: TEST_FILES,
});
const dirtyObservation = createObservation({
  finalText: BLOCKED,
  repoFiles: { ...TEST_FILES, [TEST_PATH]: DIRTY_TEST_CONTENT },
  gitStatusBefore: { kind: "worktree", entries: `M ${TEST_PATH}` },
  gitStatusAfter: { kind: "worktree", entries: `M ${TEST_PATH}` },
});

describe("approval-before-mutation", () => {
  test("accepts an actionable plan paused for approval", () => {
    expect(approval.check(cleanObservation)).toContain("approval gate");
    expect(
      approval.check({
        ...cleanObservation,
        finalText: PLAN.replace(
          "Do you approve this plan before I edit any tests?",
          "Please approve this plan before I edit any tests.",
        ),
      }),
    ).toContain("approval gate");
  });
  test.each([
    ["target", PLAN.replace(TEST_PATH, "other.test.mjs")],
    [
      "plan",
      PLAN.replace("MINIMAL_HARNESS_DECISION", "Review").replace(
        "this plan",
        "this review",
      ),
    ],
    [
      "retained behavior",
      PLAN.replace("Keep", "Consider").replace("preserve", "cover"),
    ],
    [
      "action",
      PLAN.replace("Delete", "Consider").replace("rewrite", "consider"),
    ],
    [
      "approval request",
      PLAN.replace(
        "Do you approve this plan before I edit any tests?",
        "The plan is listed above.",
      ),
    ],
    ["duplicate category", PLAN.replace("duplicated-coverage", "redundant")],
    [
      "implementation category",
      PLAN.replace("implementation-detail-assertion", "brittle"),
    ],
    ["premature success", `${PLAN}\nStatus: CHANGED_PASS`],
  ])("rejects missing or wrong %s", (_label, finalText) => {
    expect(() => approval.check({ ...cleanObservation, finalText })).toThrow();
  });
  test.each(Object.keys(TEST_FILES))(
    "rejects silently changed %s even with unchanged git status",
    (path) => {
      expect(() =>
        approval.check({
          ...cleanObservation,
          repoFiles: { ...TEST_FILES, [path]: "changed" },
        }),
      ).toThrow(/fixture changed/);
    },
  );
  test("requires captured files rather than treating missing snapshots as unchanged", () => {
    expect(() =>
      approval.check({ ...cleanObservation, repoFiles: {} }),
    ).toThrow(/not captured/);
  });
  test("rejects both direct write tools and git status changes", () => {
    expect(() =>
      approval.check({
        ...cleanObservation,
        toolCalls: [{ name: "Edit", input: { file_path: TEST_PATH } }],
      }),
    ).toThrow(/read-only/);
    expect(() =>
      approval.check({
        ...cleanObservation,
        gitStatusAfter: { kind: "worktree", entries: `M ${TEST_PATH}` },
      }),
    ).toThrow(/read-only/);
  });
});

describe("dirty-target guard", () => {
  test("AUTO_APPROVE stops without disturbing user edits", () => {
    expect(dirty.check(dirtyObservation)).toContain(
      "blocked on workspace decision",
    );
  });
  test.each([
    ["old status", `${BLOCKED}\nStatus: COMPLETE_BLOCKED`],
    ["Markdown status", `${BLOCKED}\n**Status:** COMPLETE_BLOCKED`],
    [
      "missing workspace blocker",
      BLOCKED.replaceAll("Uncommitted", "Local").replaceAll(
        "uncommitted",
        "local",
      ),
    ],
    ["missing resume", BLOCKED.replace("Resume Packet", "Summary")],
    ["missing repair count", BLOCKED.replace("REPAIR_TOTAL", "repair count")],
    ["missing inputs", BLOCKED.replace("Inputs:", "Setup:")],
    ["missing reports", BLOCKED.replace("Reports so far:", "Reviews:")],
    [
      "missing question",
      BLOCKED.replace("Pending question", "Pending decision"),
    ],
  ])("rejects %s", (_label, finalText) => {
    expect(() => dirty.check({ ...dirtyObservation, finalText })).toThrow();
  });
  test("rejects overwritten uncommitted work with otherwise unchanged status", () => {
    expect(() =>
      dirty.check({ ...dirtyObservation, repoFiles: TEST_FILES }),
    ).toThrow(/fixture changed/);
  });
  test("rejects committing or stashing the user's target", () => {
    expect(() =>
      dirty.check({
        ...dirtyObservation,
        toolCalls: [{ name: "Bash", input: { command: "git stash push" } }],
      }),
    ).toThrow(/read-only/);
  });
});

describe("seeded checkout suite", () => {
  test("contains four runnable passing tests in a clean committed project", () => {
    const fixture = makeFixture("clean", [], seedTestSuite);
    try {
      expect(snapshotRepoFiles(fixture.cwd, Object.keys(TEST_FILES))).toEqual(
        TEST_FILES,
      );
      expect(sampleGitStatus(fixture.cwd)).toEqual({
        kind: "worktree",
        entries: "",
      });
      const output = execFileSync(
        process.execPath,
        ["--test", "--test-reporter=tap", TEST_PATH],
        {
          cwd: fixture.cwd,
          encoding: "utf8",
        },
      );
      expect(output).toMatch(/# tests 4/);
      expect(output).toMatch(/# fail 0/);
    } finally {
      fixture.cleanup();
    }
  });
  test("dirty fixture adds a real uncommitted user test", () => {
    const fixture = makeFixture("clean", [], seedDirtyTestSuite);
    try {
      expect(snapshotRepoFiles(fixture.cwd, [TEST_PATH])[TEST_PATH]).toBe(
        DIRTY_TEST_CONTENT,
      );
      expect(sampleGitStatus(fixture.cwd)).toEqual({
        kind: "worktree",
        entries: `M ${TEST_PATH}`,
      });
      const output = execFileSync(
        process.execPath,
        ["--test", "--test-reporter=tap", TEST_PATH],
        {
          cwd: fixture.cwd,
          encoding: "utf8",
        },
      );
      expect(output).toMatch(/# tests 5/);
      expect(output).toMatch(/# fail 0/);
    } finally {
      fixture.cleanup();
    }
  });
});
