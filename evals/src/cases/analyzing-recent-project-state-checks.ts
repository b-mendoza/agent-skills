import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { assertRunHappened } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

// The skill's own deterministic validator is the normative shape definition;
// reusing it here means test-time and runtime check the same thing.
const OUTPUT_VALIDATOR_PATH = fileURLToPath(
  new URL(
    "../../../skills/analyzing-recent-project-state/scripts/validate-output.sh",
    import.meta.url,
  ),
);

export type ValidatorMode = "evidence" | "draft" | "verdict" | "envelope";

const SUCCESS_EXIT_STATUS = 0;
const ENVELOPE_LINES = 3;
const HEREDOC_BODY =
  /(?<opening><<-?[ \t]*(?<quote>["']?)(?<delimiter>[^\s"'<>]+)\k<quote>(?:[ \t][^\n]*)?\n)(?:[^\n]*\n)*?\t*\k<delimiter>(?:\n|$)/g;
const COMMAND_SEGMENT = /(?:"[^"]*"|'[^']*'|[^;&|\n"'])+/g;

/** Runs the skill's validator; returns its findings, empty when conformant. */
export function runOutputValidator(
  mode: ValidatorMode,
  payload: string,
  ...projectPath: [] | [string]
): string {
  const result = spawnSync(
    "sh",
    [OUTPUT_VALIDATOR_PATH, mode, ...projectPath],
    {
      input: payload,
      encoding: "utf8",
    },
  );
  if (result.error !== undefined) {
    throw new Error(`output validator could not run: ${String(result.error)}`, {
      cause: result.error,
    });
  }
  if (result.status === SUCCESS_EXIT_STATUS) return "";

  const findings = result.stdout.trim();
  if (findings !== "") return findings;

  throw new Error(
    `output validator could not run: validator exited with status ${String(result.status)} without findings`,
  );
}

/** The run must have invoked the skill's deterministic validator. */
export function assertValidatorInvoked(observation: Observation): void {
  // Lexical: ignores quoted text and heredoc bodies; does not prove the script succeeded.
  const invoked = observation.toolCalls.some(
    (toolCall) =>
      toolCall.name === "Bash" &&
      typeof toolCall.input["command"] === "string" &&
      (
        toolCall.input["command"]
          .replace(HEREDOC_BODY, "$<opening>")
          .match(COMMAND_SEGMENT) ?? []
      ).some((command) => {
        const { script, mode } =
          /^[ \t]*(?:ba)?sh[ \t]+(?<script>"[^"\r\n]+"|'[^'\r\n]+'|[^\s"'<>]+)[ \t]+(?<mode>[^\s<>]+)/.exec(
            command,
          )?.groups ?? {};
        return (
          /^(?<quote>["']?)(?:[^"']*\/)?scripts\/validate-output\.sh\k<quote>$/.test(
            String(script),
          ) && /^(?:evidence|draft|verdict|report|envelope)$/.test(String(mode))
        );
      }),
  );
  assert.ok(
    invoked,
    "the deterministic validator was never invoked during the run",
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
export const SHORT_FORM_OMITTED_SECTIONS: ReadonlyArray<
  (typeof FULL_REPORT_SECTIONS)[number]
> = FULL_REPORT_SECTIONS.filter(
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
