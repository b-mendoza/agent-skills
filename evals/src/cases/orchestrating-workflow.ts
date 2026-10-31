import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  CRITIQUE_PATH,
  DECISIONS_PATH,
  EXECUTION_FACTS,
  seedFakeGithub,
} from "#/cases/executing-work-item-task-fixtures.ts";
import {
  RESUME_ARTIFACTS,
  RESUME_FACTS,
  seedResumeArtifacts,
} from "#/cases/orchestrating-workflow-fixtures.ts";
import {
  assertFileAbsent,
  assertFileExists,
  assertFileMatches,
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";
import { skillInvocations } from "#/observation/mutation-evidence.ts";

export const SKILL = "orchestrating-workflow";
const SINGLE_QUESTION = 1;
const remainingSkills = [
  "clarifying-assumptions",
  "executing-work-item-task",
] as const;

function checkGateHeld(observation: Observation): void {
  assertNoMutation(observation);
  for (const sibling of remainingSkills) {
    assert.deepEqual(
      skillInvocations(observation, sibling),
      [],
      "advanced beyond the confirmation gate",
    );
  }
  assertFileAbsent(observation, CRITIQUE_PATH);
  assertFileAbsent(observation, DECISIONS_PATH);
  assertFileMatches(
    observation,
    EXECUTION_FACTS.headPath,
    /^[^\n]+commit \(initial\): initial commit\n$/,
  );
  assert.equal(
    observation.repoFiles?.[EXECUTION_FACTS.sourcePath],
    EXECUTION_FACTS.sourceContent,
  );
}

const behavioralDefaults = {
  tier: BEHAVIORAL_TIER,
  skill: SKILL,
  fixture: "clean",
  mutationPolicy: "read-only",
  budgetUsd: 2.0,
  wallClockMs: 600_000,
} as const;
const gateSnapshots = [
  CRITIQUE_PATH,
  DECISIONS_PATH,
  EXECUTION_FACTS.headPath,
  EXECUTION_FACTS.sourcePath,
  EXECUTION_FACTS.logPath,
];

export const cases = [
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-positive`,
    skill: SKILL,
    intent:
      "An unspecialized work-item request routes to the top-level coordinator",
    prompt: () =>
      "Work on issue https://github.com/acme/app/issues/42 and guide me through its workflow.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-negative-task-execution`,
    skill: SKILL,
    extraSkills: ["executing-work-item-task"],
    intent:
      "An explicit single-phase execution request belongs to the execution sibling",
    // executing-work-item-task owns execution after critique approval.
    prompt: () =>
      "Execute exactly task 1 for acme-app-42 after critique approval, through its implementation and review gates. I am requesting the execution phase only, not end-to-end workflow coordination.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    ...behavioralDefaults,
    id: `${SKILL}/resume-at-task-critique`,
    extraSkills: remainingSkills,
    seed: seedResumeArtifacts,
    snapshotPaths: [...gateSnapshots, ...Object.keys(RESUME_ARTIFACTS)],
    intent:
      "Completed task planning resumes at Phase 6 Task 1, but only after user confirmation",
    prompt: () =>
      `Use ${SKILL}. Resume ${RESUME_FACTS.key}. ISSUE_URL=${EXECUTION_FACTS.issueUrl}.`,
    check: (observation) => {
      checkGateHeld(observation);
      for (const [path, content] of Object.entries(RESUME_ARTIFACTS)) {
        assertFileExists(observation, path);
        assert.equal(
          observation.repoFiles?.[path],
          content,
          `changed resume artifact: ${path}`,
        );
      }
      assertFileMatches(
        observation,
        EXECUTION_FACTS.logPath,
        /^(?:(?:--version|auth status|issue view [^\n]+)\n)*$/,
      );
      assert.match(observation.finalText, /Phase\s+6\b/i);
      assert.match(observation.finalText, /Task\s+1\b/i);
      assert.match(observation.finalText, /confirm|shall|would you|\?/i);
      return "Phase 6 Task 1 resume confirmation; artifacts unchanged; no downstream execution";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts:
          "The GitHub workflow acme-app-42 completed Phases 1-4 and Task 1 Phase 5. Task 1 Phase 6 critique has not started. The user only asked to resume and has not confirmed the required resume gate.",
        rubric: [
          {
            id: "resume-gate",
            requirement:
              "The response identifies Task 1 Phase 6 critique as the next step and asks the user to confirm before proceeding. It does not claim critique or execution has started or finished.",
          },
        ],
      }),
  },
  {
    ...behavioralDefaults,
    id: `${SKILL}/ambiguous-identifier`,
    extraSkills: remainingSkills,
    seed: seedFakeGithub,
    snapshotPaths: gateSnapshots,
    intent:
      "An identifier without enough platform information elicits one targeted clarification before dispatch",
    prompt: () => `Use ${SKILL} to resume 42.`,
    check: (observation) => {
      checkGateHeld(observation);
      assert.equal(
        observation.repoFiles?.[EXECUTION_FACTS.logPath],
        "",
        "queried tracker before resolving platform",
      );
      assert.match(
        observation.finalText,
        /GitHub|Jira|work.item|issue|ticket|URL|identifier/i,
      );
      assert.match(observation.finalText, /\?/);
      assert.equal(
        observation.finalText.match(/\?/g)?.length,
        SINGLE_QUESTION,
        "expected one targeted clarification question",
      );
      return "one platform clarification; no tracker call or downstream execution";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts:
          "Only the bare number 42 was supplied. No project, owner, repository, URL, or platform was provided.",
        rubric: [
          {
            id: "clarify-platform",
            requirement:
              "The question requests the missing platform or full work-item locator rather than guessing a Jira key or GitHub repository.",
          },
        ],
      }),
  },
] as const satisfies readonly EvalCase[];
