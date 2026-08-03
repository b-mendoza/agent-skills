// Eval cases for `analyzing-recent-project-state`. This file is the source of
// truth: every case here runs, and a case that does not run does not exist.
//
// Every assertion is an observable fact: a tool call that appears in the event
// stream, literal text in the final result, or a git status delta. None of them
// ask the agent whether it complied.

import assert from "node:assert/strict";

import {
  assertEnvelope,
  assertRoutingRunEndedEarly,
  assertRunHappened,
} from "#/cases/analyzing-recent-project-state-checks.ts";
import type { FixtureKind } from "#/fixtures/fixtures.ts";
import {
  mutationEvidence,
  skillInvocations,
} from "#/observation/mutation-evidence.ts";
import type { Observation, ToolCall } from "#/observation/observation-types.ts";

export const SKILL = "analyzing-recent-project-state";

/** Names the tools a run actually called, for a failure message. */
function formatToolNames(toolCalls: readonly ToolCall[]): string {
  const names = toolCalls.map((toolCall) => toolCall.name).join(", ");
  return names === "" ? "none" : names;
}

export interface CaseContext {
  readonly missingPath: string;
  readonly notGitPath: string;
}

/** 1 = budget-capped routing check. 2 = full behavioral run. */
export type CaseTier = 1 | 2;

export const ROUTING_TIER = 1;
/** Only tier-2 runs are behavioral, so only they feed the derived scope check. */
export const BEHAVIORAL_TIER = 2;

export interface EvalCase {
  readonly id: string;
  readonly tier: CaseTier;
  readonly fixture: FixtureKind;
  /**
   * What this case pins down, for whoever reads or changes it. Documentation
   * only -- nothing reads it at runtime, so it is the one part of a case the
   * suite cannot keep honest for you.
   */
  readonly intent: string;
  readonly prompt: (caseContext: CaseContext) => string;
  readonly budgetUsd: number;
  readonly wallClockMs: number;
  /** Throws to fail. Returns a short observed-outcome string for the report. */
  readonly check: (observation: Observation) => string;
}

export const cases = [
  // --- Tier 1: routing ---------------------------------------------------
  {
    id: "trigger-positive",
    tier: 1,
    fixture: "dirty",
    intent: "A readiness question routes into the skill",
    budgetUsd: 0.05,
    wallClockMs: 180_000,
    prompt: () =>
      "What changed recently in this repo and is it ready to hand off?",
    check: (observation) => {
      assertRoutingRunEndedEarly(observation);
      const matchingSkillInvocations = skillInvocations(observation, SKILL);
      assert.ok(
        matchingSkillInvocations.length >= 1,
        `skill never triggered; tools called: ${formatToolNames(observation.toolCalls)}`,
      );
      return "Skill invoked";
    },
  },
  {
    id: "trigger-negative-review",
    tier: 1,
    fixture: "dirty",
    intent: "A line-by-line review request does not route here",
    budgetUsd: 0.05,
    wallClockMs: 180_000,
    prompt: () =>
      "Review this diff line by line and tell me if the logic is correct.",
    check: (observation) => {
      assertRoutingRunEndedEarly(observation);
      assert.equal(
        skillInvocations(observation, SKILL).length,
        0,
        "skill triggered on a code-review request",
      );
      return "no trigger";
    },
  },
  {
    id: "trigger-negative-mutate",
    tier: 1,
    fixture: "dirty",
    intent: "A mutating request does not route here and runs no git mutation",
    budgetUsd: 0.05,
    wallClockMs: 180_000,
    prompt: () => "Run the tests and merge this branch if they pass.",
    check: (observation) => {
      assertRoutingRunEndedEarly(observation);
      assert.equal(
        skillInvocations(observation, SKILL).length,
        0,
        "skill triggered on a mutate request",
      );
      const observedMutations = mutationEvidence(observation);
      assert.deepEqual(
        observedMutations,
        [],
        `repo was mutated:\n${observedMutations.join("\n")}`,
      );
      return "no trigger; no mutation";
    },
  },

  // --- Tier 2: behavioral ------------------------------------------------
  {
    id: "path-error",
    tier: 2,
    fixture: "missing-path",
    intent: "A nonexistent PROJECT_PATH yields the PATH_ERROR envelope",
    budgetUsd: 2.0,
    wallClockMs: 300_000,
    prompt: (caseContext) =>
      `Use the ${SKILL} skill. PROJECT_PATH=${caseContext.missingPath}`,
    check: (observation) => assertEnvelope(observation, "PATH_ERROR"),
  },
  {
    id: "gate-envelope",
    tier: 2,
    fixture: "missing-path",
    intent:
      "A real directory that is not a worktree yields the NOT_GIT envelope",
    budgetUsd: 2.0,
    wallClockMs: 300_000,
    prompt: (caseContext) =>
      `Use the ${SKILL} skill. PROJECT_PATH=${caseContext.notGitPath}`,
    check: (observation) => assertEnvelope(observation, "NOT_GIT"),
  },
  {
    // Regression guard: this route previously could not pass its own verifier.
    // Measured at ~3m45s and ~$0.81, hence the roomier caps.
    id: "quiet-state",
    tier: 2,
    fixture: "clean",
    intent: "An empty evidence window returns the short form, not an error",
    budgetUsd: 2.0,
    wallClockMs: 600_000,
    prompt: () =>
      "What changed recently in this repo and is it ready to hand off?",
    check: (observation) => {
      assertRunHappened(observation);
      assert.match(
        observation.finalText,
        /^# Project State Snapshot/m,
        "no snapshot report was returned",
      );
      assert.match(
        observation.finalText,
        /^## 1\. Executive Summary$/m,
        "short form omitted section 1",
      );
      assert.match(
        observation.finalText,
        /^## 2\. Git State$/m,
        "short form omitted section 2",
      );
      assert.match(
        observation.finalText,
        /^Assumptions:/m,
        "short form omitted assumptions",
      );
      assert.match(
        observation.finalText,
        /^Execution mode:/m,
        "short form omitted execution mode",
      );
      assert.match(
        observation.finalText,
        /^## 9\. Ranked Next Actions$/m,
        "short form omitted section 9",
      );
      assert.match(
        observation.finalText,
        /^## 10\. Final Developer Briefing$/m,
        "short form omitted section 10",
      );
      assert.doesNotMatch(
        observation.finalText,
        /RECENT_STATE: ERROR/,
        "quiet state escalated instead of returning the short form",
      );
      // Short form carries sections 1, 2, 9, 10 only; section 4 must be absent.
      assert.doesNotMatch(
        observation.finalText,
        /^## 4\./m,
        "short form included a section it should have omitted",
      );
      return "short form; no section 4; no ERROR";
    },
  },
] as const satisfies readonly EvalCase[];

export type CaseId = (typeof cases)[number]["id"];
