// Coordinates one CLI run: select cases, execute them sequentially, append the
// derived row, write the report, and funnel every outcome to an exit code.

import type { Cause } from "effect";
import { Data, Effect } from "effect";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import { BEHAVIORAL_TIER } from "#/cases/analyzing-recent-project-state.ts";
import { checkMutationScope } from "#/cases/analyzing-recent-project-state-checks.ts";
import type { Observation } from "#/observation/observation-types.ts";
import { evaluate } from "#/orchestration/case-checks.ts";
import { describeSuiteFailure } from "#/orchestration/failure/boundary-errors.ts";
import { describeResidualCause } from "#/orchestration/failure/residual-cause.ts";
import {
  parseArgs,
  selectCases,
  USAGE,
} from "#/orchestration/invocation/arguments.ts";
import type { Result } from "#/orchestration/report.ts";
import { formatResultLine, renderReport } from "#/orchestration/report.ts";
import { RunnerOutput, RunnerServices } from "#/orchestration/suite/services.ts";

/** Exit codes are the machine-readable contract; see run.ts's header comment. */
export const EXIT_CODES = {
  ALL_PASSED: 0,
  CASE_FAILED: 1,
  NO_CASES_MATCHED: 2,
  SUITE_ERROR: 3,
  USAGE_ERROR: 4,
} as const;

/** The derived row is computed from runs already paid for, so it books neither. */
const NO_COST = 0;
const NO_DURATION = 0;

class UsageError extends Data.TaggedError("UsageError")<{
  readonly errors: readonly string[];
}> {}

class NoCasesMatchedError extends Data.TaggedError("NoCasesMatchedError")<{
  readonly message: "No cases matched.";
}> {}

function appendDerivedResult(
  reportResults: Result[],
  behavioralObservations: Observation[],
): Result["status"] | undefined {
  if (behavioralObservations.length === 0) return undefined;

  const { status, observed } = evaluate(() =>
    checkMutationScope(behavioralObservations),
  );
  reportResults.push({
    id: "mutation-scope",
    tier: "2*",
    status,
    observed,
    costUsd: NO_COST,
    durationMs: NO_DURATION,
  });
  return status;
}

function executeSelectedCases(selectedCases: readonly EvalCase[]) {
  return Effect.gen(function* () {
    const services = yield* RunnerServices;
    const output = yield* RunnerOutput;
    const reportResults: Result[] = [];
    const behavioralObservations: Observation[] = [];

    for (const evalCase of selectedCases) {
      yield* output.writeStdout(
        `· ${evalCase.id} (tier ${evalCase.tier}) ... `,
      );
      // Sequential execution is the documented design: each case starts a real
      // Agent SDK query, so parallelism would change spend and output ordering.
      const { result, observation } = yield* services.executeCase(evalCase);
      if (evalCase.tier === BEHAVIORAL_TIER) {
        behavioralObservations.push(observation);
      }
      reportResults.push(result);
      yield* output.writeStdoutLine(formatResultLine(result));
      if (result.status === "FAIL") {
        yield* output.writeStdoutLine(`    ${result.observed}`);
      }
    }

    const derivedStatus = appendDerivedResult(
      reportResults,
      behavioralObservations,
    );
    if (derivedStatus !== undefined) {
      yield* output.writeStdoutLine(
        `· mutation-scope (derived) ... ${derivedStatus}`,
      );
    }

    const report = renderReport(reportResults);
    yield* services.writeReport(report);
    yield* output.writeStdoutLine("\nReport written to evals/report.md");

    const hasFailedResult = reportResults.some(
      (result) => result.status === "FAIL",
    );
    return hasFailedResult ? EXIT_CODES.CASE_FAILED : EXIT_CODES.ALL_PASSED;
  });
}

function coordinateRun(argv: string[]) {
  return Effect.gen(function* () {
    const services = yield* RunnerServices;
    const parsedArguments = parseArgs(argv);
    if (parsedArguments.errors.length > 0) {
      return yield* new UsageError({ errors: parsedArguments.errors });
    }

    const selectedCases = selectCases(services.evalCases, parsedArguments);
    if (selectedCases.length === 0) {
      return yield* new NoCasesMatchedError({ message: "No cases matched." });
    }

    return yield* executeSelectedCases(selectedCases);
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
