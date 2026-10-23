import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileAbsent,
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

const SKILL = "council-of-advisors";

export const COUNCIL_FACTS = {
  subject: "paid support pilot",
  outcome: "five paying teams",
  constraints: "two engineers, six weeks, $8,000 maximum spend",
  lean: "undecided",
  handoffPath: "council-handoff-paid-support-pilot.md",
} as const;

function checkWaiting(observation: Observation): void {
  checkPositiveRouting(observation, SKILL);
  assertNoMutation(observation);
  assertFileAbsent(observation, COUNCIL_FACTS.handoffPath);
  assert.ok(
    observation.toolCalls.every(
      (call) => call.name !== "Agent" && call.name !== "Task",
    ),
    "a seat was dispatched before the user confirmed the packet",
  );
  assert.doesNotMatch(
    observation.finalText,
    /^(?:final_recommendation|chair_recommendation)\s*:/im,
  );
}

const behavioralDefaults = {
  tier: BEHAVIORAL_TIER,
  skill: SKILL,
  fixture: "clean",
  mutationPolicy: "read-only",
  budgetUsd: 0.7,
  wallClockMs: 180_000,
  snapshotPaths: [COUNCIL_FACTS.handoffPath],
} as const;

export const cases = [
  {
    id: "council-of-advisors/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent:
      "A strategic decision requesting adversarial perspectives invokes the council",
    prompt: () =>
      "Stress-test whether we should launch a paid support tier. I want independent skeptical and optimistic perspectives and a reversible-versus-irreversible decision assessment.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // Sibling boundary: validate-implementation-plan audits an existing implementation plan.
    id: "council-of-advisors/trigger-negative-plan-audit",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["validate-implementation-plan"],
    intent:
      "Auditing task ordering and requirement coverage belongs to the plan validator",
    prompt: () =>
      "Audit my existing implementation plan for missing requirements and incorrect task dependencies: first migrate the database, then add the API endpoint, then write tests. I need a plan audit, not a strategic business decision.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    // The first observable output is mandatory framing confirmation, not nine-seat analysis.
    id: "council-of-advisors/confirm-framing",
    ...behavioralDefaults,
    intent:
      "Restate the supplied packet and wait for explicit confirmation before analysis or writes",
    prompt: () =>
      `Use the ${SKILL} skill. DECISION_SUBJECT="${COUNCIL_FACTS.subject}". DESIRED_OUTCOME="${COUNCIL_FACTS.outcome}". CONSTRAINTS="${COUNCIL_FACTS.constraints}". CURRENT_LEAN="${COUNCIL_FACTS.lean}". HANDOFF_PATH="${COUNCIL_FACTS.handoffPath}". This is my initial request, not confirmation of a paraphrased packet.`,
    check: (observation) => {
      checkWaiting(observation);
      assert.match(
        observation.finalText,
        /(?:confirm|is this[^?]*correct|does this[^?]*(?:capture|look right))/i,
      );
      assert.match(observation.finalText, /paid support (?:pilot|trial)/i);
      assert.match(observation.finalText, /(?:five|5) paying teams/i);
      assert.match(observation.finalText, /(?:six|6)[ -]weeks?/i);
      assert.match(observation.finalText, /(?:8,000|8000)/);
      return "packet restated; confirmation requested; no seat dispatch or mutation";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: JSON.stringify(COUNCIL_FACTS),
        rubric: [
          {
            id: "framing",
            requirement:
              "The response accurately restates the supplied decision, outcome, constraints and undecided lean; it asks the user to confirm the framing. Missing facts are unstated or questions, not invented premises.",
          },
          {
            id: "gate",
            requirement:
              "No substantive council verdict or recommendation has been reached. This is an unconfirmed draft packet, not a completed deliberation.",
          },
        ],
      }),
  },
  {
    id: "council-of-advisors/missing-subject",
    ...behavioralDefaults,
    intent:
      "An absent decision subject asks for the missing input without inventing a decision",
    prompt: () =>
      `Use the ${SKILL} skill. I have not supplied a decision subject or objective yet. HANDOFF_PATH="${COUNCIL_FACTS.handoffPath}".`,
    check: (observation) => {
      checkWaiting(observation);
      assert.match(
        observation.finalText,
        /(?:what|which|provide|share|specify|tell me)[\s\S]*(?:decision|subject|objective)/i,
      );
      assert.match(observation.finalText, /\?/);
      return "missing subject requested; no deliberation or handoff";
    },
  },
] as const satisfies readonly EvalCase[];
