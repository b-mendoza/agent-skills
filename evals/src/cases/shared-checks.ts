import assert from "node:assert/strict";

import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { QUERY_ERROR_SUBTYPE } from "#/observation/agent-query.ts";
import {
  mutationEvidence,
  skillInvocations,
} from "#/observation/mutation-evidence.ts";

const NO_TOOL_CALLS = 0;
const NO_SKILL_INVOCATIONS = 0;
const NO_COST_USD = 0;

/** The result subtype for a run stopped by the suite's configured budget cap. */
export const BUDGET_STOP_SUBTYPE = "error_max_budget_usd";

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
export function assertRunHappened(observation: Observation): void {
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
  if (!observation.isError) return;
  if (observation.subtype === BUDGET_STOP_SUBTYPE) return;
  assert.ok(
    observation.toolCalls.length > NO_TOOL_CALLS ||
      observation.costUsd > NO_COST_USD,
    `the SDK reported a failed run before it did anything (subtype: ${observation.subtype}): ${firstLine(observation.finalText)}`,
  );
}

/** Routing runs must be valid even when the budget stops them. */
export function assertRoutingRunEndedEarly(observation: Observation): void {
  assertRunHappened(observation);
}

/** Names the tools a run actually called, for failure messages. */
export function formatToolNames(toolCalls: readonly ToolCall[]): string {
  const names = toolCalls.map((toolCall) => toolCall.name).join(", ");
  return names === "" ? "none" : names;
}

export function checkPositiveRouting(
  observation: Observation,
  skill: string,
): string {
  assertRoutingRunEndedEarly(observation);
  assert.ok(
    skillInvocations(observation, skill).length > NO_SKILL_INVOCATIONS,
    `skill never triggered; tools called: ${formatToolNames(observation.toolCalls)}`,
  );
  return "Skill invoked";
}

export function checkNegativeRouting(
  observation: Observation,
  skill: string,
  failureMessage = `skill ${skill} unexpectedly triggered`,
): string {
  assertRoutingRunEndedEarly(observation);
  assert.equal(
    skillInvocations(observation, skill).length,
    NO_SKILL_INVOCATIONS,
    failureMessage,
  );
  return "no trigger";
}

/** No observed mutation, not proof against arbitrary shell writes. */
export function assertNoMutation(observation: Observation): void {
  assertRunHappened(observation);
  const evidence = mutationEvidence(observation);
  assert.deepEqual(
    evidence,
    [],
    `read-only contract violated:\n${evidence.join("\n")}`,
  );
}

/** Native per-attempt grading for read-only behavioral cases. */
export function checkMutationScope(observation: Observation): string {
  assertNoMutation(observation);
  return "1 behavioral run(s) left no trace";
}

/** Lexical command matches only; this does not prove successful execution. */
export function findBashCalls(
  observation: Observation,
  pattern: RegExp,
): ToolCall[] {
  return observation.toolCalls.filter(
    (toolCall) =>
      toolCall.name === "Bash" &&
      typeof toolCall.input["command"] === "string" &&
      new RegExp(pattern).test(toolCall.input["command"]),
  );
}
