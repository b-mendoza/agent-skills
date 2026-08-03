import assert from "node:assert/strict";

import { QUERY_ERROR_SUBTYPE } from "#/observation/agent-query.ts";
import { mutationEvidence } from "#/observation/mutation-evidence.ts";
import type { Observation } from "#/observation/observation-types.ts";

/** The result subtype for a run stopped by the suite's configured budget cap. */
export const BUDGET_STOP_SUBTYPE = "error_max_budget_usd";

/** Status, reason, next step — the escalation envelope's fixed shape. */
const ENVELOPE_LINES = 3;

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
    observation.toolCalls.length > 0 || observation.costUsd > 0,
    `the SDK reported a failed run before it did anything (subtype: ${observation.subtype}): ${firstLine(observation.finalText)}`,
  );
}

/**
 * Tier 1 stops as soon as the routing decision is visible, so the budget abort
 * is the expected ending. A run that got far enough to produce a report would
 * mean the cap failed to bite.
 */
export function assertRoutingRunEndedEarly(observation: Observation): void {
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
export function assertEnvelope(
  observation: Observation,
  status: EnvelopeStatus,
): string {
  assertRunHappened(observation);
  const lines = observation.finalText
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  assert.equal(
    lines.length,
    ENVELOPE_LINES,
    `expected exactly ${ENVELOPE_LINES} envelope lines, got ${lines.length}:\n${observation.finalText}`,
  );
  const [first = "", second = "", third = ""] = lines;
  assert.match(first, new RegExp(`^RECENT_STATE: ${status}$`));
  assert.match(second, /^Reason: \S+/);
  assert.match(third, /^Next step: \S+/);
  return `${status}, ${ENVELOPE_LINES}-line envelope`;
}

/**
 * mutation-scope is derived from the tier-2 runs rather than paying for its own
 * invocation: the skill is read-only, so no behavioral run may leave a trace.
 */
export function checkMutationScope(
  observations: readonly Observation[],
): string {
  assert.ok(
    observations.length > 0,
    "mutation-scope requires at least one behavioral observation",
  );
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
