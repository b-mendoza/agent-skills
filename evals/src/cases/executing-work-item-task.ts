import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { behavioralDefaults, routingDefaults } from "#/cases/case-contract.ts";
import {
  artifactsWithout,
  DECISIONS_PATH,
  EXECUTION_ARTIFACTS,
  EXECUTION_FACTS,
  seedExecutionArtifacts,
} from "#/cases/executing-work-item-task-fixtures.ts";
import {
  assertFileExists,
  assertFileMatches,
  assertFilesUnchanged,
  assertNoMutation,
  assertNoPublicStatusLine,
  assertOnlyInitialCommit,
  checkNegativeRouting,
  checkPositiveRouting,
  normalizeReplyText,
  replyAsksFor,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

export const SKILL = "executing-work-item-task";
const FINAL_HEADINGS = [
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
  assertOnlyInitialCommit(observation);
  assertFileMatches(
    observation,
    EXECUTION_FACTS.logPath,
    /^(?:(?:--version|auth status|issue view [^\n]+)\n)*$/,
  );
}

const TASK_PLAN_PATH = `docs/${EXECUTION_FACTS.key}-tasks.md`;
export const HUMAN_TASK_ARTIFACTS = {
  ...EXECUTION_ARTIFACTS,
  [TASK_PLAN_PATH]: (EXECUTION_ARTIFACTS[TASK_PLAN_PATH] ?? "").replace(
    `**Branch name:** ${EXECUTION_FACTS.branch}`,
    "**Execution mode:** human-only\n**Human owner:** Release team\n**Branch name:** N/A (human-only)",
  ),
};

function checkHumanOnlyStop(observation: Observation): string {
  assertNoMutation(observation);
  assertFilesUnchanged(
    observation,
    HUMAN_TASK_ARTIFACTS,
    "changed human-only input",
  );
  assert.equal(
    observation.repoFiles?.[EXECUTION_FACTS.sourcePath],
    EXECUTION_FACTS.sourceContent,
  );
  assert.equal(
    observation.repoFiles[EXECUTION_FACTS.logPath],
    "",
    "queried tracker before human-only guard",
  );
  assertOnlyInitialCommit(observation);
  assert.ok(
    !observation.toolCalls.some((call) =>
      ["Agent", "Task"].includes(call.name),
    ),
    "dispatched a worker for a human-only task",
  );
  const text = normalizeReplyText(observation.finalText);
  checkReportShape(text);
  assert.match(text, /human.only/i);
  assert.match(text, /Release team/);
  assert.match(
    text,
    /before kickoff|not (?:started|attempted)|did not (?:start|run)/i,
  );
  assertNoPublicStatusLine(
    observation.finalText,
    "FINAL_TASK_REPORT",
    "Status",
  );
  return "human-only task blocked before branch checkout, worker dispatch, tracker calls, or file edits";
}

const SINGLE_REPORT = 1;
const NO_RETRIES = 0;
const LAST_WORD = -1;
const LINE_START = 0;

function sectionMarker(line: string, heading: string): boolean {
  return new RegExp(`^${heading}(?:\\s*:.*)?$`, "i").test(line);
}

function counterValues(lines: readonly string[], pattern: RegExp): number[] {
  return lines.flatMap((line) => {
    const value = pattern.exec(line.trim())?.groups?.["count"];
    return value === undefined ? [] : [Number(value)];
  });
}

function reportLine(line: string): string {
  const trimmed = line.trim();
  const closing = trimmed.split(/\s+/).at(LAST_WORD) ?? "";
  return /^#+$/.test(closing)
    ? trimmed.slice(LINE_START, -closing.length).trimEnd()
    : trimmed;
}

function checkReportShape(text: string): void {
  const lines = text.split(/\r?\n/).map(reportLine);
  assert.equal(
    lines.filter((line) => sectionMarker(line, "Final Task Report")).length,
    SINGLE_REPORT,
    "expected one final task report",
  );
  for (const heading of FINAL_HEADINGS) {
    assert.ok(
      lines.some((line) => sectionMarker(line, heading)),
      `missing required report section: ${heading}`,
    );
  }
  const compact = lines
    .filter((line) => sectionMarker(line, "Retry Counts"))
    .flatMap((line) => line.replace(/^Retry Counts\s*:/i, "").split(","));
  for (const label of RETRY_LABELS) {
    const short = label.replace(/ fixes$/, "");
    const values = [
      ...counterValues(
        lines,
        new RegExp(`^${label}\\s*:\\s*(?<count>\\d+)\\s*\\.?$`, "i"),
      ),
      ...counterValues(
        compact,
        new RegExp(`^${short}(?:\\s*:\\s*|\\s+)(?<count>\\d+)\\s*\\.?$`, "i"),
      ),
    ];
    assert.notDeepEqual(values, [], `missing retry counter: ${label}`);
    for (const value of values) {
      assert.equal(value, NO_RETRIES, `wrong retry counter: ${label}`);
    }
  }
}

function checkReadinessStop(
  observation: Observation,
  missingDecisions: boolean,
): string {
  assertNoMutation(observation);
  checkUnchangedFiles(observation, missingDecisions);
  assert.ok(
    !observation.toolCalls.some((call) =>
      ["Agent", "Task"].includes(call.name),
    ),
    "dispatched before readiness passed",
  );
  assertNoPublicStatusLine(
    observation.finalText,
    "FINAL_TASK_REPORT",
    "Status",
    "Readiness",
  );
  const text = normalizeReplyText(observation.finalText);
  assert.doesNotMatch(
    text,
    /^(?:Status|COMPLETE|BLOCKED|STOPPED_FOR_USER_INPUT|ESCALATED)\s*$/m,
    "leaked internal report status",
  );
  checkReportShape(text);
  assert.match(
    text,
    /stopp|before kickoff|not (?:started|attempted)|did not (?:start|run)/i,
    "missing readiness-stop explanation",
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
      /clarifying-assumptions|Phase 6|(?:post[- ]?)?critique[^.\n]*(?:decision|confirmation)|decision[- ](?:recording|confirmation)/i,
      "missing upstream recovery route",
    );
  } else {
    assert.ok(
      replyAsksFor(text, /approv|confirm/i),
      "missing execution approval request",
    );
  }
  return "readiness stop; one task report; no kickoff, artifact, or tracker mutation";
}

const suiteDefaults = {
  ...behavioralDefaults,
  skill: SKILL,
  mutationPolicy: "read-only",
  snapshotPaths,
} as const;

export const cases = [
  {
    ...suiteDefaults,
    id: `${SKILL}/human-only-before-kickoff`,
    seed: (context) => {
      seedExecutionArtifacts(context, HUMAN_TASK_ARTIFACTS);
    },
    intent:
      "Refuse human-only execution and its N/A branch sentinel before checkout or mutations, even when execution was requested",
    prompt: () =>
      `Use ${SKILL}. TICKET_KEY=${EXECUTION_FACTS.key} TASK_NUMBER=1 ISSUE_URL=${EXECUTION_FACTS.issueUrl}. I approve execution if this is a code task. Inspect the selected task's execution mode and branch before doing any work.`,
    check: checkHumanOnlyStop,
  },
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
    ...suiteDefaults,
    id: `${SKILL}/approval-before-kickoff`,
    seed: seedExecutionArtifacts,
    intent:
      "A complete Phase 1-6 handoff without explicit execution approval stops before kickoff",
    prompt: () =>
      `Use ${SKILL}. TICKET_KEY=${EXECUTION_FACTS.key} TASK_NUMBER=1 ISSUE_URL=${EXECUTION_FACTS.issueUrl}. Check readiness for this planned task.`,
    check: (observation) => checkReadinessStop(observation, false),
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
    ...suiteDefaults,
    id: `${SKILL}/missing-decisions`,
    seed: (seedContext) => {
      seedExecutionArtifacts(seedContext, artifactsWithout(DECISIONS_PATH));
    },
    intent:
      "A missing required Phase 6 decisions artifact blocks before any execution mutation",
    prompt: () =>
      `Use ${SKILL}. TICKET_KEY=${EXECUTION_FACTS.key} TASK_NUMBER=1 ISSUE_URL=${EXECUTION_FACTS.issueUrl}. I approve executing the planned task once readiness is validated.`,
    check: (observation) => checkReadinessStop(observation, true),
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: `Only ${DECISIONS_PATH} is missing from the eight required artifacts. Task 1 is pending and its branch is consistent. The user approved execution, but that does not waive required handoff artifacts. Nothing ran.`,
        rubric: [
          {
            id: "missing-handoff",
            requirement:
              "The blocker identifies the absent decisions artifact, directs recovery to Phase 6, clarifying-assumptions, or the upstream critique/decision-recording step, and does not claim kickoff, implementation, tests, or review gates ran.",
          },
        ],
      }),
  },
] as const satisfies readonly EvalCase[];
