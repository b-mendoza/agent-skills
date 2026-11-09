import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { markdownPlanGroups } from "#/cases/committing-scoped-changes-approval.ts";
import { COMMIT_SCOPE } from "#/cases/committing-scoped-changes-fixtures.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

export interface PlanFacts {
  readonly message: string;
  readonly paths: readonly string[];
  readonly verification: string;
}
const VALIDATOR = fileURLToPath(
  new URL(
    "../../../skills/committing-scoped-changes/scripts/validate-output.sh",
    import.meta.url,
  ),
);
const SUCCESS = 0;
const HEADER_LINES = 1;
const TRAILER_LINES = 2;
const GROUP_LINES = 6;
const MESSAGE_OFFSET = 1;
const PATHS_OFFSET = 2;
const VERIFICATION_OFFSET = 4;

const ENVELOPE_HEADER = "COMMIT_PLAN: PASS\n";
const NOT_FOUND = -1;
function finishEnvelope(suffix: string): string[] {
  const lines = suffix.split("\n");
  const end = lines.findIndex((line) => line.startsWith("Warnings:"));
  if (end === NOT_FOUND) return [];
  return [
    ENVELOPE_HEADER + lines.slice(SUCCESS, end + HEADER_LINES).join("\n"),
  ];
}
function envelopes(text: string): string[] {
  return text
    .split(ENVELOPE_HEADER)
    .slice(HEADER_LINES)
    .flatMap(finishEnvelope);
}
function scoped(groups: readonly PlanFacts[]): boolean {
  const paths = groups.flatMap((group) => [...group.paths]);
  return (
    paths.length === COMMIT_SCOPE.length &&
    COMMIT_SCOPE.every((path) => paths.includes(path))
  );
}
function parseEnvelope(payload: string): PlanFacts[] | undefined {
  const validation = spawnSync("sh", [VALIDATOR, "plan"], {
    input: payload,
    encoding: "utf8",
  });
  if (validation.status !== SUCCESS) return undefined;
  const lines = payload.split("\n");
  const groups: PlanFacts[] = [];
  for (
    let index = HEADER_LINES;
    index < lines.length - TRAILER_LINES;
    index += GROUP_LINES
  ) {
    groups.push({
      message: String(lines[index + MESSAGE_OFFSET]).slice("Message: ".length),
      paths: String(lines[index + PATHS_OFFSET])
        .slice("Paths: ".length)
        .split(" "),
      verification: String(lines[index + VERIFICATION_OFFSET]).slice(
        "Verification: ".length,
      ),
    });
  }
  return scoped(groups) ? groups : undefined;
}
function successfulValidator(call: ToolCall): boolean {
  if (call.name !== "Bash") return false;
  if (call.result?.isError !== false) return false;
  return isPlanCommand(String(call.input["command"]));
}
function isPlanCommand(command: string): boolean {
  return /validate-output\.sh["']?\s+plan\b/.test(command);
}
export function capturedPlanGroups(
  observation: Observation,
): PlanFacts[] | undefined {
  const calls = observation.toolCalls.filter(successfulValidator).toReversed();
  for (const call of calls) {
    const payloads = envelopes(String(call.input["command"]));
    for (const payload of payloads.toReversed()) {
      const groups = parseEnvelope(payload);
      if (groups !== undefined) return groups;
    }
  }
  return undefined;
}
function plain(text: string): string {
  return text.replaceAll(/[*`]/g, "").replaceAll(/\s+/g, " ");
}
function visibleGroup(text: string, group: PlanFacts): boolean {
  return (
    text.includes(group.message) &&
    group.paths.every((path) => text.includes(path)) &&
    text.includes(group.verification)
  );
}
function equalGroup(left: PlanFacts, right: PlanFacts): boolean {
  return (
    left.message === right.message &&
    left.verification === right.verification &&
    equalPaths(left.paths, right.paths)
  );
}
function equalPaths(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length && left.every((path) => right.includes(path))
  );
}
function equalPlans(
  left: readonly PlanFacts[],
  right: readonly PlanFacts[],
): boolean {
  return (
    left.length === right.length &&
    left.every((group, index) => {
      const displayed = right.at(index);
      return displayed !== undefined && equalGroup(group, displayed);
    })
  );
}
/** Machine envelopes supply facts; the public preview must still show those exact facts. */
export function approvalFacts(
  observation: Observation,
): PlanFacts[] | undefined {
  const groups = capturedPlanGroups(observation);
  if (groups === undefined) return markdownPlanGroups(observation.finalText);
  return publicMatches(groups, observation.finalText) ? groups : undefined;
}
function publicMatches(
  groups: readonly PlanFacts[],
  finalText: string,
): boolean {
  const displayed = markdownPlanGroups(finalText);
  if (displayed !== undefined) return equalPlans(groups, displayed);
  const text = plain(finalText);
  return (
    groups.length === HEADER_LINES &&
    groups.every((group) => visibleGroup(text, group))
  );
}
