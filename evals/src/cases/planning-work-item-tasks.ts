import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertOrderedHeadings,
  assertPlanningWrites,
  capturedText,
  HEAD_LOG,
  seedPlanningFiles,
} from "#/cases/planning-work-item-tasks-checks.ts";
import {
  assertFileAbsent,
  assertNoMutation,
  assertNoPublicStatusLine,
  checkNegativeRouting,
  checkPositiveRouting,
  FIXTURE_ROOT_PATH,
  normalizeReplyText,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

export const SKILL = "planning-work-item-tasks";
export const KEY = "acme-timer-42";
export const SOURCE_PATH = `docs/${KEY}.md`;
export const OUTPUT_PATHS = [
  `docs/${KEY}-stage-1-detailed.md`,
  `docs/${KEY}-stage-2-prioritized.md`,
  `docs/${KEY}-tasks.md`,
] as const;
export const [DETAILED_PATH, PRIORITIZED_PATH, FINAL_PATH] = OUTPUT_PATHS;
export const FACTS = {
  requirement:
    "Reject fractional timeout values and values outside 1 through 300 seconds.",
  acceptance:
    "Missing timeout uses the existing 30-second default; invalid supplied values produce a validation error.",
  comment: "Keep the existing timeout option name and do not add dependencies.",
  child: "acme-timer-43: Add timeout boundary regression tests.",
} as const;
export const SNAPSHOT = `# ${KEY}: Validate timeout input
## Metadata
Issue: ${KEY}\nType: parent issue\nRepository: acme/timer
## Description
${FACTS.requirement}
## Acceptance Criteria
${FACTS.acceptance}
## Comments
${FACTS.comment}
## Retrieval Warnings
None.
## Child Issues
${FACTS.child}
## Linked Issues
None.
## Labels
bug
## Assignees
None.
## Milestone
None.
## Projects
None.
## Attachments
None.
`;
export const INVALID_SNAPSHOT = SNAPSHOT.replace(
  "## Acceptance Criteria\n",
  "## Unstructured Requirements\n",
);

const FINAL_HEADINGS = [
  "## Issue Summary",
  "## Execution Order Summary",
  "## Problem Framing",
  "## Assumptions and Constraints",
  "## Cross-Cutting Open Questions",
  "## Tasks",
  "## Notes",
  "## Dependency Graph",
  "## Validation Report",
] as const;
const TASK_FIELDS = [
  "Priority",
  "Branch name",
  "Objective",
  "Relevant requirements and context",
  "Questions to answer before starting",
  "Implementation notes",
  "Definition of done",
  "Likely files / artifacts affected",
  "Dependencies / prerequisites",
] as const;
const FRAMING_HEADINGS = [
  "### End User",
  "### Underlying Need",
  "### Proposed Solution",
  "### Solution-Problem Fit",
  "### Alternative Approaches Not Explored",
  "### Evidence Basis",
] as const;
const VALIDATION_COUNT = 20;
const MINIMUM_TASK_COUNT = 2;
const SLUG_LIMIT = 40;
const SLUG_START = 0;
const FIRST_TASK_NUMBER = 1;

function taskSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(SLUG_START, SLUG_LIMIT)
    .replace(/-$/, "");
  return slug === "" ? "task" : slug;
}

function checkTaskBody(
  body: string,
  title: string,
  number: string,
  content: string,
): void {
  for (const field of TASK_FIELDS) {
    assert.ok(body.includes(`**${field}:**`), `missing task field: ${field}`);
  }
  const match = /\*\*Branch name:\*\*\s*`(?<branch>[^`]+)`/.exec(body);
  assert.ok(match?.groups !== undefined);
  const { branch } = match.groups;
  const cleanTitle = title.replace(/ \(was Task [A-Z]+\)$/, "");
  assert.equal(
    branch,
    `feature/${KEY}-task-${number}-${taskSlug(cleanTitle)}`,
    "branch is not deterministically derived",
  );
  const [summary = ""] = content.split("## Problem Framing");
  assert.ok(
    summary.includes(`\`${branch}\``),
    "execution table lacks task branch",
  );
}

function checkTaskSections(content: string): number {
  const tasks = [
    ...content.matchAll(
      /^## Task (?<number>\d+): (?<title>.+)\n(?<body>[\s\S]*?)(?=^## |$(?![\s\S]))/gm,
    ),
  ];
  assert.ok(
    tasks.length >= MINIMUM_TASK_COUNT,
    "parent issue needs at least two tasks",
  );
  for (const [index, task] of tasks.entries()) {
    assert.ok(task.groups !== undefined);
    const { number, title, body } = task.groups;
    assert.ok(typeof number === "string");
    assert.ok(typeof title === "string");
    assert.ok(typeof body === "string");
    assert.equal(
      Number(number),
      index + FIRST_TASK_NUMBER,
      "task numbering must be sequential",
    );
    checkTaskBody(body, title, number, content);
  }
  return tasks.length;
}

function checkValidation(content: string): void {
  const report = content.slice(content.indexOf("\n## Validation Report\n"));
  const rows = [
    ...report.matchAll(
      /^\|\s*(?<number>\d+)\s*\|[^\n|]+\|\s*(?<result>PASS|WARN|FAIL)\s*\|/gm,
    ),
  ];
  assert.equal(
    rows.length,
    VALIDATION_COUNT,
    "validation must contain exactly 20 checks",
  );
  assert.deepEqual(
    rows.map((row) => Number(row.groups?.["number"])),
    Array.from(
      { length: VALIDATION_COUNT },
      (_, index) => index + FIRST_TASK_NUMBER,
    ),
  );
  for (const result of ["PASS", "WARN", "FAIL"]) {
    const count = rows.filter(
      (row) => row.groups?.["result"] === result,
    ).length;
    assert.match(
      report,
      new RegExp(`^\\|\\s*${result}\\s*\\|\\s*${count}\\s*\\|`, "m"),
      "validation totals disagree",
    );
  }
  assert.ok(
    rows.every((row) => row.groups?.["result"] !== "FAIL"),
    "PASS handoff cannot contain FAIL checks",
  );
}

function checkCompletedPlan(observation: Observation): string {
  assertPlanningWrites(observation, OUTPUT_PATHS, { [SOURCE_PATH]: SNAPSHOT });
  assertNoPublicStatusLine(
    observation.finalText,
    "PLANNING",
    "Status",
    "Failure category",
  );
  const content = capturedText(observation, FINAL_PATH);
  assertOrderedHeadings(content, FINAL_HEADINGS);
  assertOrderedHeadings(content, FRAMING_HEADINGS);
  assert.doesNotMatch(content, /^## Decisions Log$/m);
  const taskCount = checkTaskSections(content);
  checkValidation(content);
  const stageOne = capturedText(observation, DETAILED_PATH);
  assertOrderedHeadings(stageOne, [
    "## Issue Summary",
    "## Problem Framing",
    "## Tasks",
    "## Notes",
  ]);
  assert.match(stageOne, /^### Task [A-Z]+: /m);
  const stageTwo = capturedText(observation, PRIORITIZED_PATH);
  assertOrderedHeadings(
    stageTwo,
    FINAL_HEADINGS.filter((heading) => heading !== "## Validation Report"),
  );
  assert.equal(
    checkTaskSections(stageTwo),
    taskCount,
    "Stage 3 must preserve the Stage 2 task count",
  );
  return "three preserved plans; numbered tasks; deterministic branches; consistent 20-check report";
}

export const cases = [
  {
    id: `${SKILL}/trigger-positive`,
    ...routingDefaults,
    skill: SKILL,
    intent: "Decompose a captured GitHub issue into a Phase 2 task plan",
    prompt: () =>
      "Plan the implementation tasks from docs/acme-timer-42.md, including dependencies and branch names.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // Sibling boundary: planning-task-execution plans one already-selected task.
    id: `${SKILL}/trigger-negative-selected-task`,
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["planning-task-execution"],
    intent:
      "A selected task execution brief belongs to planning-task-execution",
    prompt: () =>
      "Plan how to execute Task 2 in docs/acme-timer-42-tasks.md. Produce its brief, execution plan, test spec, and refactoring recommendation, not a new decomposition.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    id: `${SKILL}/staged-plan`,
    tier: BEHAVIORAL_TIER,
    skill: SKILL,
    fixture: "clean",
    mutationPolicy: "allowed",
    budgetUsd: 2.0,
    // Recorded attempt reached Stage 3 at 602s after eight dispatches; two gates remained.
    wallClockMs: 1_200_000,
    intent:
      "Persist all three Phase 2 artifacts without touching the source or git state",
    seed: (context) => {
      seedPlanningFiles(context, { [SOURCE_PATH]: SNAPSHOT });
    },
    snapshotPaths: [FIXTURE_ROOT_PATH, ...OUTPUT_PATHS, SOURCE_PATH, HEAD_LOG],
    prompt: () =>
      `Use ${SKILL} with TICKET_KEY=${KEY}. The Phase 1 snapshot is ready. Complete Phase 2 only.`,
    check: checkCompletedPlan,
    judge: async (observation) =>
      judgeLive({
        artifact: `Completion reply:\n${observation.finalText}\n\n${OUTPUT_PATHS.map(
          (path) => `${path}\n${capturedText(observation, path)}`,
        ).join("\n\n")}`,
        knownFacts: JSON.stringify(FACTS),
        rubric: [
          {
            id: "coverage",
            requirement:
              "Tasks preserve the timeout bounds, integer constraint, 30-second missing-value default, existing option name, and no-new-dependencies constraint. Their definitions of done cover the acceptance criteria.",
          },
          {
            id: "child-coverage",
            requirement:
              "The existing acme-timer-43 boundary-regression child issue is mapped to a task, explicitly consolidated, or explicitly out of scope with a reason; it is not silently ignored.",
          },
          {
            id: "completion-handoff",
            requirement:
              "The completion reply truthfully identifies the work item, final task plan and preserved artifacts, accepting filenames scoped by an explicit directory; reported task, unique-branch, cross-cutting-question and validation-warning counts agree with the artifacts.",
          },
          {
            id: "planning-only",
            requirement:
              "The artifacts describe future work and do not claim code was implemented, tests ran, or issues or branches were created.",
          },
        ],
      }),
  },
  {
    id: `${SKILL}/invalid-snapshot`,
    tier: BEHAVIORAL_TIER,
    skill: SKILL,
    fixture: "clean",
    mutationPolicy: "read-only",
    budgetUsd: 1.0,
    wallClockMs: 300_000,
    intent:
      "Missing canonical Acceptance Criteria heading fails preflight before any plan is written",
    seed: (context) => {
      seedPlanningFiles(context, { [SOURCE_PATH]: INVALID_SNAPSHOT });
    },
    snapshotPaths: [FIXTURE_ROOT_PATH, ...OUTPUT_PATHS, SOURCE_PATH, HEAD_LOG],
    prompt: () =>
      `Use ${SKILL} with TICKET_KEY=${KEY}. Plan the work item from its snapshot.`,
    check: (observation) => {
      assertNoMutation(observation);
      assertNoPublicStatusLine(
        observation.finalText,
        "PLANNING",
        "Status",
        "Failure category",
      );
      const reply = normalizeReplyText(observation.finalText);
      assert.match(reply, /preflight/i);
      assert.match(reply, /Acceptance Criteria/);
      assert.match(
        reply,
        /(?:no (?:plan )?artifacts? (?:were )?written|(?:plan|file) (?:was )?not written)/i,
      );
      assert.ok(
        observation.toolCalls.some(
          (call) =>
            /(?:Agent|Task|delegate_task)$/.test(call.name) &&
            JSON.stringify(call.input).includes("stage-validator") &&
            JSON.stringify(call.input).includes("preflight"),
        ),
        "preflight must dispatch the independent stage-validator",
      );
      assert.equal(capturedText(observation, SOURCE_PATH), INVALID_SNAPSHOT);
      for (const path of OUTPUT_PATHS) assertFileAbsent(observation, path);
      return "preflight failure; canonical missing heading identified; no plans written";
    },
  },
] as const satisfies readonly EvalCase[];
