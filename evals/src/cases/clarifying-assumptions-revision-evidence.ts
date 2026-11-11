import {
  CLARIFICATION_FACTS,
  COPY_EDIT_INPUTS,
} from "#/cases/clarifying-assumptions-fixtures.ts";
import { fixtureRelativePath } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

const DECISION_COLUMN_COUNT = 8;
const OUTCOME_COLUMN_INDEX = 4;

export function hasDecisionRecord(plan: string): boolean {
  const [, afterHeading = ""] = plan.split(/^## Decisions Log[ \t]*\r?$/m);
  const [log = ""] = afterHeading.split(/^#{1,2}[ \t]/m);
  // Check record structure here; the judge checks the freely worded decision.
  const hasLogEntry = log.split(/\r?\n/).some((row) => {
    const cells = row
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      // GFM writes a literal pipe inside a cell as \|.
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim());
    const outcome = cells[OUTCOME_COLUMN_INDEX] ?? "";
    return (
      cells.length === DECISION_COLUMN_COUNT &&
      /^(?:confirmed|revised|skipped|resolved|override|blocked)$/.test(outcome)
    );
  });
  const annotation =
    /\[DECISION [^\]\r\n]+ — (?:confirmed|revised|skipped|resolved|override|blocked): [^\]\r\n]+\]/;
  return hasLogEntry || annotation.test(plan);
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
