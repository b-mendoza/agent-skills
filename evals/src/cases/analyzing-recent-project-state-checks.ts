import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { QUERY_ERROR_SUBTYPE } from "#/observation/agent-query.ts";
import type { JudgeOutcome } from "#/observation/judge.ts";
import { mutationEvidence } from "#/observation/mutation-evidence.ts";
import type { Observation } from "#/observation/observation-types.ts";

// The skill's own deterministic validator is the normative shape definition;
// reusing it here means test-time and runtime check the same thing.
const OUTPUT_VALIDATOR_PATH = fileURLToPath(
  new URL(
    "../../../skills/analyzing-recent-project-state/scripts/validate-output.sh",
    import.meta.url,
  ),
);

export type ValidatorMode = "evidence" | "draft" | "verdict" | "envelope";

/** Runs the skill's validator; returns its findings, empty when conformant. */
export function runOutputValidator(
  mode: ValidatorMode,
  payload: string,
): string {
  try {
    execFileSync("sh", [OUTPUT_VALIDATOR_PATH, mode], {
      input: payload,
      encoding: "utf8",
    });
    return "";
  } catch (cause) {
    if (
      typeof cause === "object" &&
      cause !== null &&
      "stdout" in cause &&
      typeof cause.stdout === "string" &&
      cause.stdout !== ""
    ) {
      return cause.stdout.trim();
    }
    throw new Error(`output validator could not run: ${String(cause)}`, {
      cause,
    });
  }
}

/** The run must have invoked the skill's deterministic validator. */
export function assertValidatorInvoked(observation: Observation): void {
  const invoked = observation.toolCalls.some(
    (toolCall) =>
      toolCall.name === "Bash" &&
      typeof toolCall.input["command"] === "string" &&
      toolCall.input["command"].includes("validate-output.sh"),
  );
  assert.ok(
    invoked,
    "the deterministic validator was never invoked during the run",
  );
}

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

/**
 * The three-line escalation envelope shared by the PATH_ERROR/NOT_GIT routes.
 * Shape is graded by the skill's own validator; this adds only the expected
 * status token and the validator-invocation observable.
 */
export function assertEnvelope(
  observation: Observation,
  status: EnvelopeStatus,
): string {
  assertRunHappened(observation);
  assertValidatorInvoked(observation);
  const findings = runOutputValidator("envelope", observation.finalText);
  assert.equal(
    findings,
    "",
    `envelope shape invalid:\n${findings}\n---\n${observation.finalText}`,
  );
  const [firstLine = ""] = observation.finalText.trim().split("\n");
  assert.equal(
    firstLine.trim(),
    `RECENT_STATE: ${status}`,
    `expected a ${status} envelope, got: ${firstLine.trim()}`,
  );
  return `${status}, ${ENVELOPE_LINES}-line envelope`;
}

// --- Report-shape conformance --------------------------------------------
//
// The skill's contract makes section names canonical identifiers while order
// and numbering are presentation, so these matchers accept any heading level
// and any (or no) numbering but demand the canonical name verbatim. Exact-text
// assertions are reserved for machine-parsed boundaries: the envelope, the
// status lines, and the snapshot title.

export const FULL_REPORT_SECTIONS = [
  "Executive Summary",
  "Git State",
  "Change Themes",
  "Behavioral Impact",
  "Risks",
  "Test And Validation Review",
  "Dependency, Config, Tooling, And Security Notes",
  "Questions Before Merging",
  "Ranked Next Actions",
  "Final Developer Briefing",
] as const;

export const SHORT_FORM_SECTIONS = [
  "Executive Summary",
  "Git State",
  "Ranked Next Actions",
  "Final Developer Briefing",
] as const;

/** Sections whose presence in a quiet-state report means invented content. */
export const SHORT_FORM_OMITTED_SECTIONS = FULL_REPORT_SECTIONS.filter(
  (sectionName) =>
    !SHORT_FORM_SECTIONS.some((shortName) => shortName === sectionName),
);

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** The section's canonical name as a heading: any level, numbered or not. */
function sectionHeadingPattern(sectionName: string): RegExp {
  return new RegExp(
    `^#{1,6}\\s*(?:\\d+\\.\\s*)?${escapeForRegExp(sectionName)}\\s*$`,
    "im",
  );
}

export function assertSectionsPresent(
  finalText: string,
  sectionNames: readonly string[],
  shapeLabel: string,
): void {
  for (const sectionName of sectionNames) {
    assert.match(
      finalText,
      sectionHeadingPattern(sectionName),
      `${shapeLabel} omitted ${sectionName}`,
    );
  }
}

export function assertSectionsAbsent(
  finalText: string,
  sectionNames: readonly string[],
  shapeLabel: string,
): void {
  for (const sectionName of sectionNames) {
    assert.doesNotMatch(
      finalText,
      sectionHeadingPattern(sectionName),
      `${shapeLabel} included ${sectionName}, which it must omit`,
    );
  }
}

/** The disclosure contract's cardinality: each field appears exactly once. */
const REQUIRED_DISCLOSURE_LINE_COUNT = 1;

export function assertDisclosureLineOnce(
  finalText: string,
  linePrefix: string,
): void {
  const matchingLineCount = finalText
    .split("\n")
    .filter((line) => line.startsWith(linePrefix)).length;
  assert.equal(
    matchingLineCount,
    REQUIRED_DISCLOSURE_LINE_COUNT,
    `expected exactly one \`${linePrefix}\` line, found ${matchingLineCount}`,
  );
}

/**
 * The Output Contract strips every internal artifact from the final response;
 * a leaked status wrapper or inspection log is mishandled subagent output.
 */
export function assertNoInternalLeak(finalText: string): void {
  assert.doesNotMatch(
    finalText,
    /^(?:GIT_EVIDENCE|SNAPSHOT_WRITE|SNAPSHOT_VERIFY):/m,
    "internal status wrapper leaked into the final response",
  );
  assert.doesNotMatch(
    finalText,
    /^Inspected:\s*$/m,
    "the Inspected: log leaked into the final response",
  );
}

// --- Judge outcome -> assertion ------------------------------------------

/**
 * Fails on any cited violation; uncited complaints are reported in the
 * observed string but never fail, since their quotes did not survive
 * verification against the artifact.
 */
const QUOTE_PREVIEW_START = 0;
const QUOTE_PREVIEW_CHARS = 60;
const NO_UNCITED_COMPLAINTS = 0;

export function assertJudgeClean(outcome: JudgeOutcome): string {
  const [firstViolation] = outcome.citedViolations;
  if (firstViolation !== undefined) {
    const quotePreview = firstViolation.quote.slice(
      QUOTE_PREVIEW_START,
      QUOTE_PREVIEW_CHARS,
    );
    assert.fail(
      `judge: ${firstViolation.itemId} violated -- ${firstViolation.reason} (quote: ${quotePreview})`,
    );
  }
  return outcome.uncitedComplaints.length === NO_UNCITED_COMPLAINTS
    ? "judge: clean"
    : `judge: clean (${outcome.uncitedComplaints.length} uncited note(s) ignored)`;
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
