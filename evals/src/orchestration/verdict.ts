// Turns the outcome of a case check -- a returned string or a thrown assertion
// -- into attempt data, and folds a case's attempts into the row the report
// expects.

import type { Observation } from "#/observation/observation-types.ts";
import type {
  AttemptResult,
  AttemptStatus,
  ReportTier,
  Result,
  Status,
} from "#/orchestration/report.ts";

/** A report cell holds one line; a longer assertion message is truncated. */
export const MAX_OBSERVED_CHARS = 160;
const FIRST_CHARACTER_INDEX = 0;
const LAST_ATTEMPT_INDEX = -1;
const NONE_PASSED = 0;
const INITIAL_TOTAL = 0;
const PERCENT_SCALE = 100;
/**
 * A mixed outcome must never display the terminal score its status
 * contradicts: with enough attempts, rounding alone would show 100 for
 * 199/200 or 0 for 1/201.
 */
const DEGRADED_SCORE_FLOOR = 1;
const DEGRADED_SCORE_CEILING = 99;
const UNKNOWN_ERROR_MESSAGE = "An unknown error occurred";

function describeNonErrorCheckFailure(cause: unknown): string {
  try {
    return String(cause);
  } catch (stringConversionError) {
    return new Error(UNKNOWN_ERROR_MESSAGE, {
      cause: stringConversionError,
    }).message;
  }
}

function normalizeCheckFailure(cause: unknown): {
  status: AttemptStatus;
  observed: string;
} {
  const failureMessage =
    cause instanceof Error
      ? cause.message
      : describeNonErrorCheckFailure(cause);
  const [firstLine = ""] = failureMessage.split("\n");

  return {
    status: "FAIL",
    observed: firstLine.slice(FIRST_CHARACTER_INDEX, MAX_OBSERVED_CHARS),
  };
}

/** Runs a check, turning a thrown assertion into a FAIL attempt. */
export function evaluate(check: () => string): {
  status: AttemptStatus;
  observed: string;
} {
  try {
    return { status: "PASS", observed: check() };
  } catch (cause) {
    return normalizeCheckFailure(cause);
  }
}

/**
 * Runs a case's optional judge after its mechanical check passed, folding the
 * verdict -- or the judge's own failure -- into the same attempt shape. Never
 * rejects: a thrown judge error becomes a FAIL attempt whose message names
 * the judge, so grading trouble is visible without failing the whole suite.
 */
export async function evaluateWithJudge(
  judge: (observation: Observation) => Promise<string>,
  observation: Observation,
  mechanicalObserved: string,
): Promise<{ status: AttemptStatus; observed: string }> {
  try {
    const judgeObserved = await judge(observation);
    return {
      status: "PASS",
      observed: `${mechanicalObserved}; ${judgeObserved}`,
    };
  } catch (cause) {
    return normalizeCheckFailure(cause);
  }
}

function aggregateStatus(passedCount: number, attemptCount: number): Status {
  if (passedCount === attemptCount) return "PASS";
  if (passedCount === NONE_PASSED) return "FAIL";
  return "DEGRADED";
}

function aggregateScore(
  passedCount: number,
  attemptCount: number,
  status: Status,
): number {
  const roundedScore = Math.round((passedCount / attemptCount) * PERCENT_SCALE);
  return status === "DEGRADED"
    ? Math.min(
        DEGRADED_SCORE_CEILING,
        Math.max(DEGRADED_SCORE_FLOOR, roundedScore),
      )
    : roundedScore;
}

function aggregateObserved(
  attempts: readonly AttemptResult[],
  firstAttempt: AttemptResult,
  status: Status,
): string {
  const lastAttempt = attempts.at(LAST_ATTEMPT_INDEX) ?? firstAttempt;
  const firstFailedAttempt =
    attempts.find((attempt) => attempt.status === "FAIL") ?? firstAttempt;
  return status === "PASS" ? lastAttempt.observed : firstFailedAttempt.observed;
}

/**
 * Folds every attempt at one case into its report row. The score is the
 * percent of attempts that passed -- a pass rate over repetitions of one
 * binary check, not a weighted rubric -- and the status derives from the same
 * count, so the two can never disagree. A failing row shows the first
 * failure's message: with a flaky case, the earliest observed defect is the
 * one worth reading.
 */
export function aggregateAttempts(attempts: readonly AttemptResult[]): Result {
  const [firstAttempt] = attempts;
  if (firstAttempt === undefined) {
    throw new Error("aggregateAttempts requires at least one attempt");
  }

  const passedCount = attempts.filter(
    (attempt) => attempt.status === "PASS",
  ).length;
  const status = aggregateStatus(passedCount, attempts.length);
  const score = aggregateScore(passedCount, attempts.length, status);
  const observed = aggregateObserved(attempts, firstAttempt, status);

  return {
    id: firstAttempt.id,
    tier: firstAttempt.tier,
    status,
    score,
    attemptsPassed: passedCount,
    attemptsRun: attempts.length,
    observed,
    costUsd: attempts.reduce(
      (total, attempt) => total + attempt.costUsd,
      INITIAL_TOTAL,
    ),
    durationMs: attempts.reduce(
      (total, attempt) => total + attempt.durationMs,
      INITIAL_TOTAL,
    ),
  };
}

/**
 * The row for a case this run never executed. The score is null, not 0: an
 * unexecuted case measured nothing, and 0 would read as "failed every attempt".
 */
export function notRunResult(id: string, tier: ReportTier): Result {
  return {
    id,
    tier,
    status: "NOT_RUN",
    score: null,
    attemptsPassed: 0,
    attemptsRun: 0,
    observed: "not executed by this run",
    costUsd: 0,
    durationMs: 0,
  };
}
