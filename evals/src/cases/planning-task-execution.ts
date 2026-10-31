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

export const SKILL = "planning-task-execution";
export const KEY = "acme-timer-42";
export const TITLE = "Reject invalid timeout values";
export const TASK_NUMBER = 2;
export const INPUT_PATH = `docs/${KEY}-tasks.md`;
export const ARTIFACTS = [
  {
    path: `docs/${KEY}-task-2-brief.md`,
    title: "Execution Brief",
    headings: [
      "Objective",
      "Relevant Requirements and Context",
      "Implementation Notes",
      "Definition of Done",
      "Likely Files / Artifacts Affected",
      "Resolved Questions and Decisions",
      "Constraints",
    ],
  },
  {
    path: `docs/${KEY}-task-2-execution-plan.md`,
    title: "Execution Plan",
    headings: [
      "Codebase Summary",
      "Recommended Skills",
      "Implementation Approach",
      "File-Level Strategy",
      "Risks and Considerations",
      "User Impact Assessment",
      "Blockers / Ambiguities",
    ],
  },
  {
    path: `docs/${KEY}-task-2-test-spec.md`,
    title: "Test Specification",
    headings: [
      "Test Framework and Conventions",
      "Test Groups",
      "Definition of Done Coverage",
      "Notes for Task Executor",
      "Blockers / Ambiguities",
    ],
  },
  {
    path: `docs/${KEY}-task-2-refactoring-plan.md`,
    title: "Refactoring Recommendation",
    headings: [
      "Verdict",
      "Before Implementation",
      "During Implementation",
      "Out of Scope",
      "Impact on Existing Tests",
      "Blockers / Ambiguities",
    ],
  },
] as const;
const [, , , REFACTORING_ARTIFACT] = ARTIFACTS;
export const OUTPUT_PATHS = ARTIFACTS.map(({ path }) => path);
export const OTHER_TASK_PATH = `docs/${KEY}-task-3-brief.md`;
export const SOURCE_CODE =
  "export function timeoutSeconds(value) {\n  if (value === undefined) return 30;\n  const seconds = Number(value);\n  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Invalid timeout');\n  return seconds;\n}\n";
export const EXISTING_TEST =
  "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { timeoutSeconds } from '../src/timeout.js';\ntest('missing timeout defaults to 30', () => { assert.equal(timeoutSeconds(undefined), 30); });\n";
export const TASK_PLAN = `# ${KEY} task plan
## Task 1: Establish timeout default
**Status:** Complete
**Objective:** Keep the existing 30-second default.
## Task 2: ${TITLE}
**Priority:** High
**Objective:** Reject supplied timeout values unless they are whole seconds from 1 through 300 inclusive.
**Relevant requirements and context:** Preserve timeoutSeconds(undefined) === 30 and the exported function name. Do not add dependencies.
**Questions to answer before starting:** None.
**Implementation notes:** Update src/timeout.js and extend the node:test tests in test/timeout.test.js. Preserve numeric-string inputs when they represent a valid whole number.
**Definition of done:**
- Missing input returns 30.
- 1 and 300, as numbers or numeric strings, are accepted.
- Zero, negative, fractional, non-numeric and greater-than-300 values throw Invalid timeout.
**Likely files / artifacts affected:** src/timeout.js, test/timeout.test.js.
**Dependencies / prerequisites:** Task 1, marked Complete above.
## Task 3: Redesign the settings screen
**Status:** Not started
**Objective:** Change the visual layout. This is unrelated future work.
`;
export const BLOCKED_PLAN = TASK_PLAN.replace(
  "**Status:** Complete",
  "**Status:** Not started",
);
export const INPUT_FILES = {
  [INPUT_PATH]: TASK_PLAN,
  "src/timeout.js": SOURCE_CODE,
  "test/timeout.test.js": EXISTING_TEST,
  "package.json": '{"type":"module","scripts":{"test":"node --test"}}\n',
} as const;

function groupedArtifactFilenames(reply: string): string[] {
  const listing =
    /Artifacts[^\n]*\b(?:in|under) docs\/[^\n]*\n(?<files>[\s\S]*)/i.exec(reply)
      ?.groups?.["files"] ?? "";
  return listing.split("\n").map((line) => line.trim());
}

function checkPlanningCompleted(observation: Observation): string {
  assertPlanningWrites(observation, OUTPUT_PATHS, INPUT_FILES);
  assertFileAbsent(observation, OTHER_TASK_PATH);
  assertNoPublicStatusLine(
    observation.finalText,
    "PREP",
    "PLAN",
    "TEST_SPEC",
    "REFACTORING",
    "Completion",
    "Completion state",
    "Status",
  );
  const reply = normalizeReplyText(observation.finalText);
  const groupedFiles = groupedArtifactFilenames(reply);
  for (const artifact of ARTIFACTS) {
    const content = capturedText(observation, artifact.path);
    const [titleLine] = content.split("\n");
    assert.equal(
      titleLine,
      `# ${artifact.title} - ${KEY} Task ${TASK_NUMBER}: ${TITLE}`,
    );
    assertOrderedHeadings(
      content,
      artifact.headings.map((heading) => `## ${heading}`),
    );
    assert.ok(
      reply.includes(artifact.path) ||
        groupedFiles.includes(artifact.path.slice("docs/".length)),
      "handoff omitted an artifact",
    );
  }
  const refactoring = capturedText(observation, REFACTORING_ARTIFACT.path);
  assert.match(
    refactoring,
    /(?:Refactor before|Refactor during|No refactoring needed)/,
  );
  assert.match(reply, /\b(?:completed?|ready|produced|written|planned)\b/i);
  assert.doesNotMatch(
    reply,
    /(?:not complete|incomplete|Completion(?: state)?:\s*(?:FAIL|BLOCKED|ERROR))/i,
  );
  assert.match(reply, /References fetched:\s*(?:none|https?:\/\/\S+)/i);
  assert.ok(reply.includes(TITLE));
  return "four template-conforming Task 2 artifacts; original code and plan unchanged; no Task 3 artifact";
}

export const cases = [
  {
    id: `${SKILL}/trigger-positive`,
    ...routingDefaults,
    skill: SKILL,
    intent:
      "Plan execution for one selected task rather than decomposing the work item",
    prompt: () =>
      `Prepare the execution brief, implementation plan, test specification, and refactoring recommendation for Task 2 of docs/${KEY}-tasks.md.`,
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // Sibling boundary: planning-work-item-tasks owns Phase 2 decomposition.
    id: `${SKILL}/trigger-negative-decomposition`,
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["planning-work-item-tasks"],
    intent: "Whole-issue decomposition belongs to planning-work-item-tasks",
    prompt: () =>
      `Decompose the Phase 1 GitHub snapshot docs/${KEY}.md into numbered implementation tasks with priorities, dependencies, and deterministic branch names. No task has been selected yet.`,
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    id: `${SKILL}/selected-task-artifacts`,
    tier: BEHAVIORAL_TIER,
    skill: SKILL,
    fixture: "clean",
    mutationPolicy: "allowed",
    budgetUsd: 2.0,
    wallClockMs: 600_000,
    intent:
      "Write only the four selected-task planning artifacts, with behavior-focused tests",
    seed: (context) => {
      seedPlanningFiles(context, INPUT_FILES);
    },
    snapshotPaths: [
      FIXTURE_ROOT_PATH,
      ...OUTPUT_PATHS,
      ...Object.keys(INPUT_FILES),
      OTHER_TASK_PATH,
      HEAD_LOG,
    ],
    prompt: () =>
      `Use ${SKILL}. This is a direct standalone invocation: TICKET_KEY=${KEY}, TASK_NUMBER=2. Plan this task only; do not implement it.`,
    check: checkPlanningCompleted,
    judge: async (observation) =>
      judgeLive({
        artifact: ARTIFACTS.map(
          ({ path }) => `${path}\n${capturedText(observation, path)}`,
        ).join("\n\n"),
        knownFacts: `${TASK_PLAN}\nExisting source:\n${SOURCE_CODE}\nExisting test:\n${EXISTING_TEST}`,
        rubric: [
          {
            id: "scope",
            requirement:
              "All four artifacts concern only Task 2 timeout validation. They preserve the missing-value default and function name and do not propose the unrelated Task 3 screen redesign or new dependencies.",
          },
          {
            id: "behavior-tests",
            requirement:
              "The test specification maps the definition of done to observable tests for undefined returning 30, accepted boundaries 1 and 300 and numeric strings, and rejection of fractions, non-numeric values, nonpositive values, and values above 300.",
          },
          {
            id: "honest-plan",
            requirement:
              "The implementation strategy identifies the current parser's missing integer and upper-bound validation. It does not claim implementation, test execution, commits, or tracker changes already occurred.",
          },
        ],
      }),
  },
  {
    id: `${SKILL}/unfinished-dependency`,
    tier: BEHAVIORAL_TIER,
    skill: SKILL,
    fixture: "clean",
    mutationPolicy: "read-only",
    budgetUsd: 1.0,
    wallClockMs: 300_000,
    intent:
      "Stop at readiness when selected Task 2 depends on unfinished Task 1",
    seed: (context) => {
      seedPlanningFiles(context, {
        ...INPUT_FILES,
        [INPUT_PATH]: BLOCKED_PLAN,
      });
    },
    snapshotPaths: [
      FIXTURE_ROOT_PATH,
      ...OUTPUT_PATHS,
      INPUT_PATH,
      OTHER_TASK_PATH,
    ],
    prompt: () =>
      `Use ${SKILL}. Direct standalone invocation: TICKET_KEY=${KEY}, TASK_NUMBER=2. Prepare this task for execution.`,
    check: (observation) => {
      assertNoMutation(observation);
      assertNoPublicStatusLine(
        observation.finalText,
        "PREP",
        "PLAN",
        "TEST_SPEC",
        "REFACTORING",
        "Completion",
        "Completion state",
        "Status",
      );
      const reply = normalizeReplyText(observation.finalText);
      assert.match(reply, /Task 1/i);
      assert.match(
        reply,
        /(?:cannot|could not|not ready|stopped|blocked|not (?:written|created)|no artifacts)/i,
      );
      assert.match(
        reply,
        /(?:unsatisfied|not (?:started|complete)|incomplete|unfinished|dependency)/i,
      );
      assert.equal(capturedText(observation, INPUT_PATH), BLOCKED_PLAN);
      for (const path of [...OUTPUT_PATHS, OTHER_TASK_PATH]) {
        assertFileAbsent(observation, path);
      }
      return "unfinished prerequisite reported; no execution-planning artifacts written";
    },
  },
] as const satisfies readonly EvalCase[];
