import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  checkProgressProjection,
  PROGRESS_PATH,
  PROGRESS_ROOT,
  progressCases,
  SKIP_REASON,
} from "#/cases/orchestrating-workflow-progress-cases.ts";
import {
  BASELINE_REFLOG,
  HEAD_LOG,
  makeFixture,
  writeRepoFiles,
} from "#/fixtures/fixtures.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const main = `# acme-app-42 — Workflow Progress
| Phase | Name | Status | Completed at | Notes |
| --- | --- | --- | --- | --- |
| 1 | Fetch work item | Complete | now | Fetched |
| 2 | Plan tasks | Complete | now | Planned |
| 3 | Clarify and critique | Complete | now | Clarified |
| 4 | Create child items | Complete | now | Linked |
## Task Execution (Phases 5–7)
| Task | Title | Dependencies | Priority | Child item | Current Phase | Status | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Code | None | High | acme/app#101 | 7/7 Execute | Active | — |
| 2 | Manual verification | 1 | Low | task-list | — | Skipped | ${SKIP_REASON} |
## Execution Log
${SKIP_REASON}
`;

function progressObservation() {
  const [entry] = progressCases;
  const fixture = makeFixture("clean", ["orchestrating-workflow"], entry.seed);
  try {
    const files = Object.fromEntries(
      ["fixture-facts.txt", HEAD_LOG, BASELINE_REFLOG].map((path) => [
        path,
        readFileSync(join(fixture.cwd, path), "utf8"),
      ]),
    );
    return createObservation({
      gitStatusAfter: {
        kind: "worktree",
        entries: `?? ${PROGRESS_PATH}`,
      },
      finalText:
        "Tasks: 0/2 complete | 1 skipped | 1 remaining\nResume from: Phase 7, Task 1",
      repoFiles: {
        ...files,
        [`${PROGRESS_ROOT}/`]: "",
        [PROGRESS_PATH]: main,
      },
    });
  } finally {
    fixture.cleanup();
  }
}

describe("progress observation checks", () => {
  test("accepts separate phase/task state and unstarted exclusion", () => {
    expect(() => checkProgressProjection(progressObservation())).not.toThrow();
  });
  test.each([
    ["premature task completion", main.replace("| Active |", "| Complete |")],
    ["missing child metadata", main.replace("acme/app#101", "Not Created")],
    ["shifted columns", main.replace("| Child item |", "| Unknown |")],
    [
      "dropped early phase",
      main.replace(
        "| 1 | Fetch work item | Complete",
        "| 1 | Fetch work item | Pending",
      ),
    ],
    ["unrecorded exclusion", main.replaceAll(SKIP_REASON, "—")],
  ])("rejects %s", (_label, corrupted) => {
    const observation = progressObservation();
    expect(() =>
      checkProgressProjection({
        ...observation,
        repoFiles: { ...observation.repoFiles, [PROGRESS_PATH]: corrupted },
      }),
    ).toThrow();
  });
  test("rejects an extra progress file for the skipped task", () => {
    const observation = progressObservation();
    expect(() =>
      checkProgressProjection({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [`${PROGRESS_ROOT}/acme-app-42-task-2-progress.md`]: "fabricated",
        },
      }),
    ).toThrow();
  });
  test("rejects wrong totals and wrong resume target", () => {
    const observation = progressObservation();
    for (const finalText of [
      "Tasks: 2/2 complete\nResume from: Phase 7, Task 1",
      "Tasks: 0/2 complete | 1 skipped | 1 remaining\nResume from: Phase 5, Task 2",
    ]) {
      expect(() =>
        checkProgressProjection({ ...observation, finalText }),
      ).toThrow();
    }
  });
});

test("fresh progress fixture exposes the untracked progress file to the case checker", () => {
  const [entry] = progressCases;
  const fixture = makeFixture("clean", ["orchestrating-workflow"], entry.seed);
  try {
    writeRepoFiles(fixture.cwd, { [PROGRESS_PATH]: main });
    const actual = execFileSync("git", ["status", "--short"], {
      cwd: fixture.cwd,
      encoding: "utf8",
    }).trim();
    expect(actual).toBe(`?? ${PROGRESS_PATH}`);
  } finally {
    fixture.cleanup();
  }
});
