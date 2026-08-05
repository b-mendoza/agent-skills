// Coordinates one CLI run: select cases, execute each one's attempts
// sequentially, aggregate attempts into scored rows, append the derived row,
// list unexecuted cases as NOT_RUN, write the report, and funnel every outcome
// to an exit code.

import type { Cause } from "effect";
import { Data, Effect } from "effect";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import { BEHAVIORAL_TIER } from "#/cases/analyzing-recent-project-state.ts";
import { checkMutationScope } from "#/cases/analyzing-recent-project-state-checks.ts";
import type { Observation } from "#/observation/observation-types.ts";
import { REPORT_TIER_BY_CASE_TIER } from "#/orchestration/case-execution/execution.ts";
import { describeSuiteFailure } from "#/orchestration/failure/boundary-errors.ts";
import { describeResidualCause } from "#/orchestration/failure/residual-cause.ts";
import {
  parseArgs,
  selectCases,
  USAGE,
} from "#/orchestration/invocation/arguments.ts";
import type { AttemptResult, Result } from "#/orchestration/report.ts";
import {
  formatCaseResultLine,
  formatResultLine,
  renderReport,
} from "#/orchestration/report.ts";
import {
  RunnerOutput,
  RunnerServices,
} from "#/orchestration/suite/services.ts";
import {
  aggregateAttempts,
  evaluate,
  notRunResult,
} from "#/orchestration/verdict.ts";

/** Exit codes are the machine-readable contract; see run.ts's header comment. */
export const EXIT_CODES = {
  ALL_PASSED: 0,
  CASE_FAILED: 1,
  NO_CASES_MATCHED: 2,
  SUITE_ERROR: 3,
  USAGE_ERROR: 4,
} as const;

/**
 * One stochastic attempt proves little; five give the score a sample the run
 * can be judged on. `--attempts` overrides for cheaper smoke runs.
 */
export const DEFAULT_ATTEMPTS_PER_CASE = 5;

/** The derived row is computed from runs already paid for, so it books neither. */
const NO_COST = 0;
const NO_DURATION = 0;

/** Attempts are numbered 1..attemptsPerCase for humans reading progress lines. */
const FIRST_ATTEMPT_NUMBER = 1;
const NO_OBSERVATIONS = 0;
const NO_PARSE_ERRORS = 0;
const NO_SELECTED_CASES = 0;

const DERIVED_CASE_ID = "mutation-scope";
const DERIVED_TIER = "2*";

class UsageError extends Data.TaggedError("UsageError")<{
  readonly errors: readonly string[];
}> {}

class NoCasesMatchedError extends Data.TaggedError("NoCasesMatchedError")<{
  readonly message: "No cases matched.";
}> {}

/** A behavioral observation tagged with the attempt that produced it. */
interface BehavioralObservation {
  readonly attemptNumber: number;
  readonly observation: Observation;
}

/**
 * The derived check judges each attempt's behavioral runs as one repetition,
 * so its score aggregates the same way a case's does. With no behavioral
 * observation at all there is nothing to derive, and the row says so.
 */
function deriveMutationScopeResult(
  behavioralObservations: readonly BehavioralObservation[],
): Result {
  if (behavioralObservations.length === NO_OBSERVATIONS) {
    return notRunResult(DERIVED_CASE_ID, DERIVED_TIER);
  }

  const observationsByAttempt = new Map<number, Observation[]>();
  for (const { attemptNumber, observation } of behavioralObservations) {
    const observationsForAttempt =
      observationsByAttempt.get(attemptNumber) ?? [];
    observationsForAttempt.push(observation);
    observationsByAttempt.set(attemptNumber, observationsForAttempt);
  }

  const derivedAttempts: AttemptResult[] = [
    ...observationsByAttempt.values(),
  ].map((observationsForAttempt) => {
    const { status, observed } = evaluate(() =>
      checkMutationScope(observationsForAttempt),
    );
    return {
      id: DERIVED_CASE_ID,
      tier: DERIVED_TIER,
      status,
      observed,
      costUsd: NO_COST,
      durationMs: NO_DURATION,
    };
  });
  return aggregateAttempts(derivedAttempts);
}

function attemptNumbers(attemptsPerCase: number): number[] {
  return Array.from(
    { length: attemptsPerCase },
    (_, zeroBasedIndex) => zeroBasedIndex + FIRST_ATTEMPT_NUMBER,
  );
}

function executeSelectedCases(
  selectedCases: readonly EvalCase[],
  attemptsPerCase: number,
) {
  return Effect.gen(function* () {
    const services = yield* RunnerServices;
    const output = yield* RunnerOutput;
    const resultsByCaseId = new Map<string, Result>();
    const behavioralObservations: BehavioralObservation[] = [];

    for (const evalCase of selectedCases) {
      const caseAttempts: AttemptResult[] = [];
      for (const attemptNumber of attemptNumbers(attemptsPerCase)) {
        yield* output.writeStdout(
          `· ${evalCase.id} (tier ${evalCase.tier}) attempt ${attemptNumber}/${attemptsPerCase} ... `,
        );
        // Sequential execution is the documented design: each attempt starts a
        // real Agent SDK query, so parallelism would change spend and output
        // ordering.
        const { result, observation } = yield* services.executeCase(evalCase);
        if (evalCase.tier === BEHAVIORAL_TIER) {
          behavioralObservations.push({ attemptNumber, observation });
        }
        caseAttempts.push(result);
        yield* output.writeStdoutLine(formatResultLine(result));
        if (result.status === "FAIL") {
          yield* output.writeStdoutLine(`    ${result.observed}`);
        }
      }
      const caseResult = aggregateAttempts(caseAttempts);
      resultsByCaseId.set(evalCase.id, caseResult);
      yield* output.writeStdoutLine(
        `· ${evalCase.id} (tier ${evalCase.tier}) ... ${formatCaseResultLine(caseResult)}`,
      );
    }

    const derivedResult = deriveMutationScopeResult(behavioralObservations);
    yield* output.writeStdoutLine(
      `· ${DERIVED_CASE_ID} (derived) ... ${formatCaseResultLine(derivedResult)}`,
    );

    // The report always lists every known case: an unexecuted case is a
    // NOT_RUN row, not a silently dropped one, so a partial run's committed
    // report says what it did not measure.
    const reportResults = services.evalCases.map(
      (evalCase) =>
        resultsByCaseId.get(evalCase.id) ??
        notRunResult(evalCase.id, REPORT_TIER_BY_CASE_TIER[evalCase.tier]),
    );
    reportResults.push(derivedResult);

    const report = renderReport(reportResults);
    yield* services.writeReport(report);
    yield* output.writeStdoutLine("\nReport written to evals/report.md");

    // DEGRADED gates like FAIL: a case that passes only sometimes is not a
    // case the run can vouch for.
    const hasFailedResult = reportResults.some(
      (result) => result.status === "FAIL" || result.status === "DEGRADED",
    );
    return hasFailedResult ? EXIT_CODES.CASE_FAILED : EXIT_CODES.ALL_PASSED;
  });
}

function coordinateRun(argv: string[]) {
  return Effect.gen(function* () {
    const services = yield* RunnerServices;
    const parsedArguments = parseArgs(argv);
    if (parsedArguments.errors.length > NO_PARSE_ERRORS) {
      return yield* new UsageError({ errors: parsedArguments.errors });
    }

    const selectedCases = selectCases(services.evalCases, parsedArguments);
    if (selectedCases.length === NO_SELECTED_CASES) {
      return yield* new NoCasesMatchedError({ message: "No cases matched." });
    }

    return yield* executeSelectedCases(
      selectedCases,
      parsedArguments.attempts ?? DEFAULT_ATTEMPTS_PER_CASE,
    );
  });
}

function handleRunFailure(error: unknown) {
  return Effect.gen(function* () {
    const output = yield* RunnerOutput;

    if (error instanceof UsageError) {
      for (const message of error.errors) {
        yield* output.writeStderrLine(message);
      }
      yield* output.writeStderrLine(USAGE);
      return EXIT_CODES.USAGE_ERROR;
    }

    if (error instanceof NoCasesMatchedError) {
      yield* output.writeStderrLine(error.message);
      return EXIT_CODES.NO_CASES_MATCHED;
    }

    yield* output.writeStderrLine(
      `eval suite error: ${describeSuiteFailure(error)}`,
    );
    return EXIT_CODES.SUITE_ERROR;
  });
}

function handleResidualCause(cause: Cause.Cause<unknown>) {
  return Effect.gen(function* () {
    const output = yield* RunnerOutput;
    yield* output.writeStderrLine(
      `eval suite error: ${describeResidualCause(cause)}`,
    );
    return EXIT_CODES.SUITE_ERROR;
  });
}

export function runCli(argv: string[]) {
  return coordinateRun(argv).pipe(
    Effect.matchEffect({
      onFailure: handleRunFailure,
      onSuccess: Effect.succeed,
    }),
    Effect.matchCauseEffect({
      onFailure: handleResidualCause,
      onSuccess: Effect.succeed,
    }),
    Effect.matchCause({
      onFailure: () => EXIT_CODES.SUITE_ERROR,
      onSuccess: (exitCode) => exitCode,
    }),
  );
}
