// Eval cases for `analyzing-recent-project-state`. This file is the source of
// truth: every case here runs, and a case that does not run does not exist.
//
// Every assertion is an observable fact: a tool call that appears in the event
// stream, literal text in the final result, or a git status delta. None of them
// ask the agent whether it complied.

import assert from "node:assert/strict";

import type { FixtureKind } from "#/fixtures/fixtures.ts";
import type { Observation, ToolCall } from "#/observation/harness.ts";
import {
  mutationEvidence,
  QUERY_ERROR_SUBTYPE,
  skillInvocations,
} from "#/observation/harness.ts";

export const SKILL = "analyzing-recent-project-state";
/** The result subtype for a run stopped by the suite's configured budget cap. */
export const BUDGET_STOP_SUBTYPE = "error_max_budget_usd";

/** Status, reason, next step — the escalation envelope's fixed shape. */
const ENVELOPE_LINES = 3;

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
// oxlint-disable-next-line no-magic-numbers -- The literals ARE the tier names, and the report prints them verbatim; aliasing them to constants would hide the only values this type permits.
export type CaseTier = 1 | 2;

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

/** Whether the run got far enough to do anything that costs money. */
function didWork(observation: Observation): boolean {
  return observation.toolCalls.length > 0 || observation.costUsd > 0;
}

/** Keeps a failure message to the single line the report cell can hold. */
function firstLine(text: string): string {
  const [line = ""] = text.trim().split("\n");
  return line === "" ? "(no output)" : line;
}

/**
 * Fails when the agent never actually ran.
 *
 * A negative case passes by observing an absence -- no Skill call, no report --
 * and a run that never started produces exactly that absence. Without this,
 * a query that failed before reaching a model reads as "the skill correctly
 * declined", which is a green check that means nothing. Every case calls this
 * first.
 */
function assertRunHappened(observation: Observation): void {
  assert.ok(!observation.timedOut, "run exceeded its wall clock");
  assert.notEqual(
    observation.subtype,
    QUERY_ERROR_SUBTYPE,
    `the query produced no result, so this run observed nothing: ${firstLine(observation.finalText)}`,
  );
  // Defensive: every real result message carries a subtype, and the harness's
  // synthetic failure carries QUERY_ERROR_SUBTYPE. An empty subtype is a shape
  // no run produces, so it must not pass as one.
  assert.notEqual(observation.subtype, "", "run carries no result verdict");
  // A query that concludes is not a run that happened. An expired login
  // returns in milliseconds with `is_error` set, a `success` subtype, and the
  // auth message where the answer belongs -- so the SDK started, reported, and
  // ended clean, satisfying the checks above while reaching no model at all.
  // What it leaves behind is silence, which is also what a passing negative
  // case looks like, so an expired login turns those green on evidence never
  // collected.
  //
  // Tolerated in two cases, because neither is a run that failed to happen: a
  // stop the suite asked for by capping the budget, and an error that arrived
  // after the run had already spent money or called a tool, where the case's
  // own assertions can judge what was observed.
  assert.ok(
    !observation.isError ||
      observation.subtype === BUDGET_STOP_SUBTYPE ||
      didWork(observation),
    `the SDK reported a failed run before it did anything (subtype: ${observation.subtype === "" ? "none" : observation.subtype}): ${firstLine(observation.finalText)}`,
  );
}

/**
 * Tier 1 stops as soon as the routing decision is visible, so the budget abort
 * is the expected ending. A run that got far enough to produce a report would
 * mean the cap failed to bite.
 */
function assertRoutingRunEndedEarly(observation: Observation): void {
  assertRunHappened(observation);
  assert.doesNotMatch(
    observation.finalText,
    /^# Project State Snapshot/m,
    "budget-capped routing run unexpectedly produced a full report",
  );
}

/** The escalation statuses these cases can assert on. */
export type EnvelopeStatus = "PATH_ERROR" | "NOT_GIT";

/** The three-line escalation envelope shared by the PATH_ERROR/NOT_GIT routes. */
function assertEnvelope(
  observation: Observation,
  status: EnvelopeStatus,
): string {
  assertRunHappened(observation);
  const lines = observation.finalText
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "");
  assert.equal(
    lines.length,
    ENVELOPE_LINES,
    `expected exactly ${ENVELOPE_LINES} envelope lines, got ${lines.length}:\n${observation.finalText}`,
  );
  const [first, second, third] = lines;
  assert.match((first ?? "").trim(), new RegExp(`^RECENT_STATE: ${status}$`));
  assert.match((second ?? "").trim(), /^Reason: \S+/);
  assert.match((third ?? "").trim(), /^Next step: \S+/);
  return `${status}, ${ENVELOPE_LINES}-line envelope`;
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

/**
 * mutation-scope is derived from the tier-2 runs rather than paying for its own
 * invocation: the skill is read-only, so no behavioral run may leave a trace.
 */
export function checkMutationScope(
  observations: readonly Observation[],
): string {
  // The guarantee is "these runs wrote nothing", which can only be read off
  // runs that happened. A run that reached no model also leaves no trace, so
  // without this the row reports a read-only contract it never tested.
  for (const observation of observations) assertRunHappened(observation);

  const allMutationEvidence = observations.flatMap((observation) =>
    mutationEvidence(observation),
  );
  assert.deepEqual(
    allMutationEvidence,
    [],
    `read-only contract violated:\n${allMutationEvidence.join("\n")}`,
  );
  return `${observations.length} behavioral run(s) left no trace`;
}
