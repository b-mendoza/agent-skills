import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import { join } from "node:path";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  DECISIONS_PATH,
  EXECUTION_ARTIFACTS,
  EXECUTION_FACTS,
  seedExecutionArtifacts,
} from "#/cases/executing-work-item-task-fixtures.ts";
import {
  assertFileExists,
  assertFileMatches,
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

export const SKILL = "executing-work-item-task";
const FINAL_HEADINGS = [
  "Status",
  "Task",
  "Summary",
  "Evidence Checked",
  "Retry Counts",
  "Implementation Artifacts",
  "Category A Tracking",
  "Tracker Updates",
  "Blockers or Unresolved Items",
  "Next Required Action",
] as const;
const RETRY_LABELS = [
  "Requirements fixes",
  "Clean-code fixes",
  "Architecture fixes",
  "Security fixes",
] as const;
const snapshotPaths = [
  ...Object.keys(EXECUTION_ARTIFACTS),
  EXECUTION_FACTS.sourcePath,
  EXECUTION_FACTS.logPath,
  EXECUTION_FACTS.headPath,
];

function checkUnchangedFiles(
  observation: Observation,
  missingDecisions: boolean,
): void {
  const files = observation.repoFiles;
  assert.ok(files !== undefined, "missing file snapshots");
  const expectedArtifacts = {
    ...EXECUTION_ARTIFACTS,
    ...(missingDecisions ? { [DECISIONS_PATH]: null } : {}),
  };
  for (const [path, content] of Object.entries(expectedArtifacts)) {
    assert.equal(files[path], content, `changed input: ${path}`);
  }
  assertFileExists(observation, EXECUTION_FACTS.sourcePath);
  assert.equal(
    files[EXECUTION_FACTS.sourcePath],
    EXECUTION_FACTS.sourceContent,
  );
  assertFileMatches(
    observation,
    EXECUTION_FACTS.headPath,
    /^[^\n]+commit \(initial\): initial commit\n$/,
  );
  assertFileMatches(
    observation,
    EXECUTION_FACTS.logPath,
    /^(?:(?:--version|auth status|issue view [^\n]+)\n)*$/,
  );
}

const SINGLE_REPORT = 1;

function checkReportShape(text: string): void {
  assert.equal(
    text.match(/^## Final Task Report\s*$/gm)?.length,
    SINGLE_REPORT,
    "expected one final task report",
  );
  for (const heading of FINAL_HEADINGS) {
    assert.match(text, new RegExp(`^### ${heading}\\s*$`, "m"));
  }
  for (const label of RETRY_LABELS) {
    assert.match(text, new RegExp(`^- ${label}: 0\\s*$`, "m"));
  }
}

function checkReadinessStop(
  observation: Observation,
  expectedStatus: "BLOCKED" | "STOPPED_FOR_USER_INPUT",
  missingDecisions: boolean,
): string {
  assertNoMutation(observation);
  checkUnchangedFiles(observation, missingDecisions);
  const text = observation.finalText;
  checkReportShape(text);
  assert.match(
    text,
    new RegExp(`^### Status\\s*\\n+${expectedStatus}\\s*$`, "m"),
  );
  assert.match(text, /Work item:.*acme-app-42/);
  assert.match(text, /Platform:.*github/);
  assert.match(text, /Task:.*`?1`?(?:\s|-|$)/m);
  if (missingDecisions) {
    assert.ok(
      text.includes(DECISIONS_PATH),
      "missing artifact was not identified",
    );
    assert.match(
      text,
      /clarifying-assumptions|Phase 6/i,
      "missing upstream recovery route",
    );
  } else {
    assert.match(text, /approv|confirm/i, "missing execution approval gate");
  }
  return `${expectedStatus}; one task report; no kickoff, artifact, or tracker mutation`;
}

const behavioralDefaults = {
  tier: BEHAVIORAL_TIER,
  skill: SKILL,
  fixture: "clean",
  mutationPolicy: "read-only",
  budgetUsd: 2.0,
  wallClockMs: 600_000,
  snapshotPaths,
} as const;

export const cases = [
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-positive`,
    skill: SKILL,
    intent:
      "An explicit single-task implementation request selects the execution skill",
    prompt: () =>
      "Execute task 1 for acme-app-42 through kickoff, implementation, verification, and review gates. The task has been planned and critiqued.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-negative-planning`,
    skill: SKILL,
    intent: "Planning a task does not start its execution pipeline",
    // planning-task-execution owns pre-implementation planning artifacts.
    prompt: () =>
      "Prepare the execution brief, implementation plan, test spec, and refactoring plan for task 1 of acme-app-42. Do not implement it yet.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    ...behavioralDefaults,
    id: `${SKILL}/approval-before-kickoff`,
    seed: seedExecutionArtifacts,
    intent:
      "A complete Phase 1-6 handoff without explicit execution approval stops before kickoff",
    prompt: () =>
      `Use ${SKILL}. TICKET_KEY=${EXECUTION_FACTS.key} TASK_NUMBER=1 ISSUE_URL=${EXECUTION_FACTS.issueUrl}. Check readiness for this planned task.`,
    check: (observation) =>
      checkReadinessStop(observation, "STOPPED_FOR_USER_INPUT", false),
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts:
          "Task 1 has all eight required artifacts and a passing critique. Its decisions record explicitly says execution approval is PENDING. No kickoff, implementation, tests, reviews, or tracker writes have happened.",
        rubric: [
          {
            id: "approval-gate",
            requirement:
              "The report asks for explicit execution approval, does not treat a passing critique as approval, and does not claim implementation, verification, or reviews ran.",
          },
        ],
      }),
  },
  {
    ...behavioralDefaults,
    id: `${SKILL}/missing-decisions`,
    seed: (seedContext) => {
      seedExecutionArtifacts(seedContext);
      unlinkSync(join(seedContext.repoPath, DECISIONS_PATH));
    },
    intent:
      "A missing required Phase 6 decisions artifact blocks before any execution mutation",
    prompt: () =>
      `Use ${SKILL}. TICKET_KEY=${EXECUTION_FACTS.key} TASK_NUMBER=1 ISSUE_URL=${EXECUTION_FACTS.issueUrl}. I approve executing the planned task once readiness is validated.`,
    check: (observation) => checkReadinessStop(observation, "BLOCKED", true),
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: `Only ${DECISIONS_PATH} is missing from the eight required artifacts. Task 1 is pending and its branch is consistent. The user approved execution, but that does not waive required handoff artifacts. Nothing ran.`,
        rubric: [
          {
            id: "missing-handoff",
            requirement:
              "The blocker identifies the absent decisions artifact, directs recovery to Phase 6 or clarifying-assumptions, and does not claim kickoff, implementation, tests, or review gates ran.",
          },
        ],
      }),
  },
] as const satisfies readonly EvalCase[];
