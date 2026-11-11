import {
  CLARIFICATION_FACTS,
  COPY_EDIT_INPUTS,
} from "#/cases/clarifying-assumptions-fixtures.ts";
import { fixtureRelativePath } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

export function hasDecisionRecord(plan: string): boolean {
  const [, afterHeading = ""] = plan.split(/^## Decisions Log[ \t]*\r?$/m);
  const [log = ""] = afterHeading.split(/^#{1,2}[ \t]/m);
  // Check record structure here; the judge checks the freely worded decision.
  const hasLogEntry =
    /^\|.*\|\s*(?:confirmed|revised|skipped|resolved|override|blocked)\s*\|.*\|[ \t]*\r?$/m.test(
      log,
    );
  const hasAnnotation =
    /\[DECISION [^\]\r\n]+ — (?:confirmed|revised|skipped|resolved|override|blocked): [^\]\r\n]+\]/.test(
      plan,
    );
  return hasLogEntry || hasAnnotation;
}

const PLANNING_PATHS = Object.keys(COPY_EDIT_INPUTS).filter((path) =>
  path.endsWith(".md"),
);
const REVISION_PATHS = new Set([
  CLARIFICATION_FACTS.critiquePath,
  ...PLANNING_PATHS,
]);

export function isCritiqueWrite(
  call: ToolCall,
  observation: Observation,
): boolean {
  if (!["Write", "Edit"].includes(call.name)) return false;
  const path = call.input["file_path"];
  return (
    typeof path === "string" &&
    fixtureRelativePath(observation, path) === CLARIFICATION_FACTS.critiquePath
  );
}

export function isRevisionWrite(
  call: ToolCall,
  observation: Observation,
): boolean {
  if (!["Write", "Edit"].includes(call.name)) return false;
  const path = call.input["file_path"];
  if (typeof path !== "string") return false;
  return REVISION_PATHS.has(fixtureRelativePath(observation, path) ?? "");
}
