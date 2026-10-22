import { Schema } from "effect";

import {
  BEHAVIORAL_TIER,
  cases,
} from "#/cases/analyzing-recent-project-state.ts";
import { checkMutationScope } from "#/cases/analyzing-recent-project-state-checks.ts";
import type { Observation } from "#/observation/observation-types.ts";
import type { AttemptResult, Result } from "#/orchestration/verdict.ts";
import {
  aggregateAttempts,
  evaluate,
  notRunResult,
} from "#/orchestration/verdict.ts";

import { decodeMetadata, getCase } from "./observation.ts";

const FAILURE = { NONE: 0, ASSERT: 1, ERROR: 2 } as const;
const REPORT_TIERS = { 1: "1", 2: "2" } as const;
const EMPTY = 0;
const rowSchema = Schema.Struct({
  testCase: Schema.Struct({ vars: Schema.Struct({ caseId: Schema.String }) }),
  success: Schema.Boolean,
  failureReason: Schema.Literals([FAILURE.NONE, FAILURE.ASSERT, FAILURE.ERROR]),
  error: Schema.optional(Schema.NullOr(Schema.String)),
  response: Schema.optional(Schema.Unknown),
  gradingResult: Schema.optional(Schema.Unknown),
});
const decodeExport = Schema.decodeUnknownSync(
  Schema.Struct({
    results: Schema.Struct({ results: Schema.Array(rowSchema) }),
  }),
);
const decodeResponse = Schema.decodeUnknownSync(
  Schema.Struct({ metadata: Schema.Unknown }),
);
const decodeGrade = Schema.decodeUnknownSync(
  Schema.Struct({
    componentResults: Schema.Array(Schema.Struct({ reason: Schema.String })),
  }),
);

interface ParsedAttempt extends AttemptResult {
  repeatIndex: number;
  observation: Observation;
}

function parseAttempt(row: typeof rowSchema.Type): ParsedAttempt {
  const evalCase = getCase(row.testCase.vars.caseId);
  const { observation, repeatIndex } = decodeMetadata(
    decodeResponse(row.response).metadata,
  );
  const [grade] = decodeGrade(row.gradingResult).componentResults;
  if (grade === undefined) {
    throw new Error(`Missing assertion result for ${evalCase.id}`);
  }
  return {
    id: evalCase.id,
    tier: REPORT_TIERS[evalCase.tier],
    status: row.success ? "PASS" : "FAIL",
    observed: grade.reason,
    costUsd: observation.costUsd,
    durationMs: observation.durationMs,
    repeatIndex,
    observation,
  };
}

function recordBehavioral(
  attempt: ParsedAttempt,
  observations: Map<number, Observation[]>,
): void {
  if (attempt.tier !== REPORT_TIERS[BEHAVIORAL_TIER]) return;
  const group = observations.get(attempt.repeatIndex) ?? [];
  group.push(attempt.observation);
  observations.set(attempt.repeatIndex, group);
}

function deriveMutationScope(observations: Map<number, Observation[]>): Result {
  const attempts = [...observations.entries()]
    .toSorted(([left], [right]) => left - right)
    .map(([, group]): AttemptResult => ({
      id: "mutation-scope",
      tier: "2*",
      ...evaluate(() => checkMutationScope(group)),
      costUsd: 0,
      durationMs: 0,
    }));
  return attempts.length === EMPTY
    ? notRunResult("mutation-scope", "2*")
    : aggregateAttempts(attempts);
}

export function readResults(input: unknown): Result[] {
  const rows = decodeExport(input).results.results;
  const error = rows.find((row) => row.failureReason === FAILURE.ERROR);
  if (error !== undefined) {
    throw new Error(error.error ?? "promptfoo provider error");
  }
  const attempts = rows
    .map(parseAttempt)
    .toSorted((left, right) => left.repeatIndex - right.repeatIndex);
  const observations = new Map<number, Observation[]>();
  attempts.forEach((attempt) => {
    recordBehavioral(attempt, observations);
  });
  const results = cases.map((evalCase) => {
    const group = attempts.filter((attempt) => attempt.id === evalCase.id);
    return group.length === EMPTY
      ? notRunResult(evalCase.id, REPORT_TIERS[evalCase.tier])
      : aggregateAttempts(group);
  });
  return [...results, deriveMutationScope(observations)];
}
