import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  cases,
  DETAILED_PATH,
  FINAL_PATH,
  INVALID_SNAPSHOT,
  KEY,
  OUTPUT_PATHS,
  PRIORITIZED_PATH,
  SKILL,
  SNAPSHOT,
  SOURCE_PATH,
} from "#/cases/planning-work-item-tasks.ts";
import {
  HEAD_LOG,
  SEED_COMMIT,
} from "#/cases/planning-work-item-tasks-checks.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

function getCase(suffix: string) {
  const result = cases.find((entry) => entry.id === `${SKILL}/${suffix}`);
  if (result === undefined) throw new Error(`missing case ${suffix}`);
  return result;
}

function task(number: number, title: string): string {
  const branch = `feature/${KEY}-task-${number}-${title.toLowerCase().replaceAll(" ", "-")}`;
  return `## Task ${number}: ${title}
**Priority:** High
**Branch name:** \`${branch}\`
**Objective:** ${title}.
**Relevant requirements and context:** Source acceptance criteria.
**Questions to answer before starting:** None.
**Implementation notes:** Plan only.
**Definition of done:** Boundary tests cover the source requirements.
**Likely files / artifacts affected:** src/timeout.js
**Dependencies / prerequisites:** None.
`;
}

const FIRST_TASK_NUMBER = 1;
const SECOND_TASK_NUMBER = 2;
const FIRST_CHECK_NUMBER = 1;
const TASK_COUNT = 2;
const VALIDATION_COUNT = 20;
const STAGE_TWO = `# Plan
## Issue Summary
Validate timeout.
## Execution Order Summary
| Task | Branch |
| 1 | \`feature/${KEY}-task-1-validate-timeout\` |
| 2 | \`feature/${KEY}-task-2-add-tests\` |
## Problem Framing
### End User
CLI users.
### Underlying Need
Reject invalid inputs.
### Proposed Solution
Validate timeout.
### Solution-Problem Fit
Direct correction.
### Alternative Approaches Not Explored
None.
### Evidence Basis
The captured acceptance criteria.
## Assumptions and Constraints
No implementation.
## Cross-Cutting Open Questions
None.
## Tasks
${task(FIRST_TASK_NUMBER, "Validate timeout")}${task(SECOND_TASK_NUMBER, "Add tests")}
## Notes
None.
## Dependency Graph
Independent.
`;
const FINAL_PLAN = `${STAGE_TWO}## Validation Report
### Summary
| Result | Count |
| PASS | ${VALIDATION_COUNT} |
| WARN | 0 |
| FAIL | 0 |
### Check Results
${Array.from({ length: VALIDATION_COUNT }, (_, index) => `| ${index + FIRST_CHECK_NUMBER} | Check | PASS | Evidence |`).join("\n")}
`;
const HANDOFF = `PLANNING: PASS
ISSUE_SLUG: ${KEY}
File: ${FINAL_PATH}
Tasks: ${TASK_COUNT}
Branches: ${TASK_COUNT}
Cross-cutting questions: 0
Validation warnings: 0
Failure category: NONE
Reason: All gates passed
Artifacts preserved: ${OUTPUT_PATHS.join(", ")}`;
const STAGE_ONE =
  "# Detailed Plan\n## Issue Summary\nScope.\n## Problem Framing\nNeed.\n## Tasks\n### Task A: Validate timeout\nDetails.\n## Notes\nNone.\n";

function completedObservation(): Observation {
  return createObservation({
    finalText: HANDOFF,
    gitStatusAfter: {
      kind: "worktree",
      entries: OUTPUT_PATHS.map((path) => `?? ${path}`).join("\n"),
    },
    repoFiles: {
      [SOURCE_PATH]: SNAPSHOT,
      [HEAD_LOG]: `commit: ${SEED_COMMIT}\n`,
      [DETAILED_PATH]: STAGE_ONE,
      [PRIORITIZED_PATH]: STAGE_TWO,
      [FINAL_PATH]: FINAL_PLAN,
    },
  });
}

function changeFinal(text: string): Observation {
  const observation = completedObservation();
  return {
    ...observation,
    repoFiles: { ...observation.repoFiles, [FINAL_PATH]: text },
  };
}

function failedObservation(): Observation {
  return createObservation({
    finalText: `PLANNING: FAIL
ISSUE_SLUG: ${KEY}
File: not written
Tasks: 0
Branches: 0
Cross-cutting questions: 0
Validation warnings: 0
Failure category: PREFLIGHT
Reason: Missing ## Acceptance Criteria heading
Artifacts preserved: none`,
    repoFiles: {
      [SOURCE_PATH]: INVALID_SNAPSHOT,
      ...Object.fromEntries(OUTPUT_PATHS.map((path) => [path, null])),
    },
  });
}

describe("routing", () => {
  test("positive requires a Skill call, negative rejects it", () => {
    const invoked = createObservation({
      toolCalls: [{ name: "Skill", input: { skill: SKILL } }],
    });
    expect(() => getCase("trigger-positive").check(invoked)).not.toThrow();
    expect(() =>
      getCase("trigger-positive").check(createObservation()),
    ).toThrow();
    expect(() =>
      getCase("trigger-negative-selected-task").check(createObservation()),
    ).not.toThrow();
    expect(() =>
      getCase("trigger-negative-selected-task").check(invoked),
    ).toThrow();
  });
  test.each(cases)("$id rejects a run that never happened", (entry) => {
    expect(() => entry.check(createObservation({ timedOut: true }))).toThrow(
      /wall clock/,
    );
  });
});

describe("staged-plan", () => {
  test("accepts the complete staged artifacts and handoff", () => {
    expect(() =>
      getCase("staged-plan").check(completedObservation()),
    ).not.toThrow();
  });
  test.each([
    ["missing heading", FINAL_PLAN.replace("## Problem Framing", "## Wrong")],
    [
      "missing framing subsection",
      FINAL_PLAN.replace("### Evidence Basis", "### Sources"),
    ],
    [
      "wrong order",
      FINAL_PLAN.replace(
        "## Issue Summary",
        "## Execution Order Summary",
      ).replace("## Execution Order Summary\n|", "## Issue Summary\n|"),
    ],
    ["missing task field", FINAL_PLAN.replace("**Objective:**", "Objective:")],
    ["skipped task number", FINAL_PLAN.replace("## Task 2:", "## Task 3:")],
    [
      "non-deterministic branch",
      FINAL_PLAN.replaceAll(
        `feature/${KEY}-task-1-validate-timeout`,
        `feature/${KEY}-task-1-fix-it`,
      ),
    ],
    [
      "branch missing from table",
      FINAL_PLAN.replace(
        `| 1 | \`feature/${KEY}-task-1-validate-timeout\` |`,
        "| 1 | omitted |",
      ),
    ],
    [
      "single parent task",
      FINAL_PLAN.replace(task(SECOND_TASK_NUMBER, "Add tests"), ""),
    ],
    [
      "only 19 checks",
      FINAL_PLAN.replace("| 20 | Check | PASS | Evidence |", ""),
    ],
    [
      "duplicate check number",
      FINAL_PLAN.replace("| 20 | Check", "| 19 | Check"),
    ],
    ["wrong totals", FINAL_PLAN.replace("| PASS | 20 |", "| PASS | 19 |")],
    [
      "failed check with consistent counts",
      FINAL_PLAN.replace("| 20 | Check | PASS", "| 20 | Check | FAIL")
        .replace("| PASS | 20 |", "| PASS | 19 |")
        .replace("| FAIL | 0 |", "| FAIL | 1 |"),
    ],
    ["phase 3 section", `${FINAL_PLAN}\n## Decisions Log\nNot allowed.\n`],
  ])("rejects %s", (_label, content) => {
    expect(() => getCase("staged-plan").check(changeFinal(content))).toThrow();
  });
  test.each([
    [
      "wrong handoff",
      { finalText: HANDOFF.replace("PLANNING: PASS", "PLANNING: FAIL") },
    ],
    ["extra handoff line", { finalText: `${HANDOFF}\nExtra` }],
    [
      "wrong task count",
      { finalText: HANDOFF.replace("Tasks: 2", "Tasks: 8") },
    ],
    [
      "wrong branch count",
      { finalText: HANDOFF.replace("Branches: 2", "Branches: 8") },
    ],
    [
      "unexpected write",
      {
        gitStatusAfter: {
          kind: "worktree",
          entries: [
            ...OUTPUT_PATHS.map((path) => `?? ${path}`),
            "?? extra.txt",
          ].join("\n"),
        },
      },
    ],
    [
      "staged artifact",
      {
        gitStatusAfter: {
          kind: "worktree",
          entries: OUTPUT_PATHS.map((path) => `A  ${path}`).join("\n"),
        },
      },
    ],
    ["no repository", { gitStatusAfter: { kind: "no-worktree" } }],
    [
      "ignored write",
      {
        toolCalls: [
          { name: "Write", input: { file_path: ".claude/rogue.md" } },
        ],
      },
    ],
    [
      "git mutation",
      {
        toolCalls: [
          { name: "Bash", input: { command: "git switch new-branch" } },
        ],
      },
    ],
    [
      "tracker read",
      { toolCalls: [{ name: "Bash", input: { command: "gh issue view 42" } }] },
    ],
  ] satisfies ReadonlyArray<readonly [string, Partial<Observation>]>)(
    "rejects %s",
    (_label, overrides) => {
      expect(() =>
        getCase("staged-plan").check({
          ...completedObservation(),
          ...overrides,
        }),
      ).toThrow();
    },
  );
  test.each([
    ["missing output", DETAILED_PATH, null],
    ["wrong stage 1 shape", DETAILED_PATH, "unstructured"],
    ["wrong stage 2 shape", PRIORITIZED_PATH, "unstructured"],
    ["altered input", SOURCE_PATH, "changed"],
    ["new commit", HEAD_LOG, "commit: committed plans\n"],
  ])("rejects %s", (_label, path, value) => {
    const observation = completedObservation();
    expect(() =>
      getCase("staged-plan").check({
        ...observation,
        repoFiles: { ...observation.repoFiles, [path]: value },
      }),
    ).toThrow();
  });
  test("permits declared artifact Write calls", () => {
    const observation = completedObservation();
    expect(() =>
      getCase("staged-plan").check({
        ...observation,
        toolCalls: [
          {
            name: "Write",
            input: { file_path: `/fixture/${DETAILED_PATH}` },
          },
        ],
      }),
    ).not.toThrow();
  });
});

describe("invalid-snapshot", () => {
  test("accepts a preflight failure without artifacts", () => {
    expect(() =>
      getCase("invalid-snapshot").check(failedObservation()),
    ).not.toThrow();
  });
  test.each([
    [
      "wrong gate",
      {
        finalText: failedObservation().finalText.replace(
          "PREFLIGHT",
          "STAGE_1",
        ),
      },
    ],
    [
      "missing reason",
      {
        finalText: failedObservation().finalText.replace(
          "Acceptance Criteria",
          "Metadata",
        ),
      },
    ],
    [
      "write tool",
      { toolCalls: [{ name: "Write", input: { file_path: "scratch.md" } }] },
    ],
    [
      "created artifact",
      {
        repoFiles: {
          ...failedObservation().repoFiles,
          [DETAILED_PATH]: "plan",
        },
      },
    ],
    [
      "unrequested snapshot",
      { repoFiles: { [SOURCE_PATH]: INVALID_SNAPSHOT } },
    ],
  ] satisfies ReadonlyArray<readonly [string, Partial<Observation>]>)(
    "rejects %s",
    (_label, overrides) => {
      expect(() =>
        getCase("invalid-snapshot").check({
          ...failedObservation(),
          ...overrides,
        }),
      ).toThrow();
    },
  );
});

test.each(["staged-plan", "invalid-snapshot"])(
  "%s seeds tracked input and exact untracked paths",
  (suffix) => {
    const entry = getCase(suffix);
    const fixture = makeFixture(
      "clean",
      [SKILL],
      "seed" in entry ? entry.seed : undefined,
    );
    try {
      const source = snapshotRepoFiles(fixture.cwd, [SOURCE_PATH]);
      expect(source[SOURCE_PATH]).toBe(
        suffix === "staged-plan" ? SNAPSHOT : INVALID_SNAPSHOT,
      );
      expect(
        execFileSync("git", ["status", "--short"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toBe("");
      writeFileSync(join(fixture.cwd, DETAILED_PATH), "plan");
      expect(
        execFileSync("git", ["status", "--short"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toBe(`?? ${DETAILED_PATH}\n`);
    } finally {
      fixture.cleanup();
    }
  },
);
