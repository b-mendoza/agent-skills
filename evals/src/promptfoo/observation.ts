import { Schema } from "effect";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import { cases } from "#/cases/analyzing-recent-project-state.ts";

const FIRST_REPEAT = 0;
const toolCallsSchema = Schema.mutable(
  Schema.Array(
    Schema.Struct({
      name: Schema.String,
      input: Schema.Record(Schema.String, Schema.Unknown),
    }),
  ),
);
const gitStatusSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("worktree"), entries: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("no-worktree") }),
  Schema.Struct({ kind: Schema.Literal("unreadable"), reason: Schema.String }),
]);
const observationSchema = Schema.Struct({
  subtype: Schema.String,
  isError: Schema.Boolean,
  finalText: Schema.String,
  toolCalls: toolCallsSchema,
  gitStatusBefore: gitStatusSchema,
  gitStatusAfter: gitStatusSchema,
  costUsd: Schema.Number,
  durationMs: Schema.Number,
  timedOut: Schema.Boolean,
});

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
