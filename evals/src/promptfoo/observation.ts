import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import { cases } from "#/cases/analyzing-recent-project-state.ts";

export function getCase(caseId: unknown): EvalCase {
  const evalCase = cases.find((candidate) => candidate.id === caseId);
  if (evalCase === undefined) {
    throw new Error(`Unknown caseId: ${String(caseId)}`);
  }
  return evalCase;
}
