import { Schema } from "effect";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases } from "#/cases/registry.ts";
import { observationSchema } from "#/observation/agent-query.ts";

const FIRST_REPEAT = 0;
export const metadataSchema = Schema.Struct({
  observation: observationSchema,
  repeatIndex: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(FIRST_REPEAT),
  ),
});
export const decodeMetadata = Schema.decodeUnknownSync(metadataSchema);

export function getCase(caseId: unknown): EvalCase {
  const evalCase = cases.find((candidate) => candidate.id === caseId);
  if (evalCase === undefined) {
    throw new Error(`Unknown caseId: ${String(caseId)}`);
  }
  return evalCase;
}
