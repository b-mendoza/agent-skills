#!/usr/bin/env node
// Entry point for the local eval suite.
//
//   node evals/src/orchestration/run.ts                    every case
//   node evals/src/orchestration/run.ts --tier=1           routing cases only (fast, cents)
//   node evals/src/orchestration/run.ts --case=path-error  one case
//
// Cases run sequentially: they spend real tokens and the wall-clock cost of
// parallelism is not worth the token burn on a suite this small.
//
// Exit codes: 0 all pass · 1 a case failed · 2 no cases matched · 3 suite error · 4 usage error

import { writeFileSync } from "node:fs";

import { Cause, Context, Data, Effect, Formatter, Layer } from "effect";

import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import { cases } from "#/cases/analyzing-recent-project-state.ts";
import { checkMutationScope } from "#/cases/analyzing-recent-project-state-checks.ts";
import type { Observation } from "#/observation/harness.ts";
import type { CaseExecutionResult } from "#/orchestration/case-execution.ts";
import {
  CaseFixtureAcquisitionError,
  CaseFixtureCleanupError,
  evaluate,
  executeCaseLive,
  ObservationRunError,
  PromptConstructionError,
} from "#/orchestration/case-execution.ts";
import type { Result } from "#/orchestration/report.ts";
import { renderReport, REPORT_PATH } from "#/orchestration/report.ts";

/** Exit codes are the machine-readable contract; see the header comment. */
export const EXIT_CODES = {
  ALL_PASSED: 0,
  CASE_FAILED: 1,
  NO_CASES_MATCHED: 2,
  SUITE_ERROR: 3,
  USAGE_ERROR: 4,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

const MS_PER_SECOND = 1000;
const COST_DECIMALS = 2;
const WHOLE_SECONDS = 0;
const ROUTING_TIER = 1;
/** Only tier-2 runs are behavioral, so only they feed the derived scope check. */
const BEHAVIORAL_TIER = 2;
/** `process.argv` starts with the node binary and this script. */
const ARGV_START = 2;
/** The derived row is computed from runs already paid for, so it books neither. */
const NO_COST = 0;
const NO_DURATION = 0;
const SINGLE_REASON_COUNT = 1;
const USAGE =
  "Usage: node evals/src/orchestration/run.ts [--tier=<integer>] [--case=<id>]";
const ERROR_NAME_PREFIX = /^[A-Za-z]*Error(?: \[[^\]]+\])?: /;
const UNKNOWN_CAUSE_DESCRIPTION = "An unknown error occurred";

export interface ParsedArguments {
  tier?: number;
  caseId?: string;
  errors: string[];
}

export class RunnerCaseExecutionError extends Data.TaggedError(
  "RunnerCaseExecutionError",
)<{
  readonly cause: unknown;
}> {}

export class RunnerReportWriteError extends Data.TaggedError(
  "RunnerReportWriteError",
)<{
  readonly cause: unknown;
}> {}

export class RunnerOutputError extends Data.TaggedError("RunnerOutputError")<{
  readonly cause: unknown;
}> {}

class ArgumentsParsingError extends Data.TaggedError("ArgumentsParsingError")<{
  readonly cause: unknown;
}> {}

class CaseSelectionError extends Data.TaggedError("CaseSelectionError")<{
  readonly cause: unknown;
}> {}

class ReportRenderingError extends Data.TaggedError("ReportRenderingError")<{
  readonly cause: unknown;
}> {}

class CaseResultFormattingError extends Data.TaggedError(
  "CaseResultFormattingError",
)<{
  readonly cause: unknown;
}> {}

class UsageError extends Data.TaggedError("UsageError")<{
  readonly errors: readonly string[];
}> {}

class NoCasesMatchedError extends Data.TaggedError("NoCasesMatchedError")<{
  readonly message: "No cases matched.";
}> {}

export interface RunnerServices {
  readonly evalCases: readonly EvalCase[];
  readonly executeCase: (
    evalCase: EvalCase,
  ) => Effect.Effect<CaseExecutionResult, RunnerCaseExecutionError>;
  readonly writeReport: (
    report: string,
  ) => Effect.Effect<void, RunnerReportWriteError>;
}

export const RunnerServices = Context.Service<RunnerServices>(
  "evals/orchestration/RunnerServices",
);

export interface RunnerOutput {
  readonly writeStdout: (
    text: string,
  ) => Effect.Effect<void, RunnerOutputError>;
  readonly writeStdoutLine: (
    text: string,
  ) => Effect.Effect<void, RunnerOutputError>;
  readonly writeStderrLine: (
    text: string,
  ) => Effect.Effect<void, RunnerOutputError>;
}

export const RunnerOutput = Context.Service<RunnerOutput>(
  "evals/orchestration/RunnerOutput",
);

export function parseArgs(argv: string[]): ParsedArguments {
  const parsedArguments: ParsedArguments = { errors: [] };
  for (const argument of argv) {
    const tierArgumentValue = /^--tier=(?<tier>\d+)$/.exec(argument)?.groups?.[
      "tier"
    ];
    if (tierArgumentValue != null) {
      parsedArguments.tier = Number(tierArgumentValue);
      continue;
    }

    const caseIdArgumentValue = /^--case=(?<caseId>.+)$/.exec(argument)
      ?.groups?.["caseId"];
    if (caseIdArgumentValue != null) {
      parsedArguments.caseId = caseIdArgumentValue;
      continue;
    }

    parsedArguments.errors.push(
      `unrecognized or malformed argument: ${argument}`,
    );
  }
  return parsedArguments;
}

function isCaseTier(value: number): value is CaseTier {
  return value === ROUTING_TIER || value === BEHAVIORAL_TIER;
}

function selectCases(
  evalCases: readonly EvalCase[],
  { tier, caseId }: ParsedArguments,
): EvalCase[] {
  if (tier != null && !isCaseTier(tier)) return [];

  return evalCases.filter(
    (evalCase) =>
      (tier == null || evalCase.tier === tier) &&
      (caseId == null || evalCase.id === caseId),
  );
}

function writeStdout(text: string) {
  return Effect.try({
    try: () => {
      process.stdout.write(text);
    },
    catch: (cause) => new RunnerOutputError({ cause }),
  });
}

function writeStdoutLine(text: string) {
  return Effect.try({
    try: () => {
      console.log(text);
    },
    catch: (cause) => new RunnerOutputError({ cause }),
  });
}

function writeStderrLine(text: string) {
  return Effect.try({
    try: () => {
      console.error(text);
    },
    catch: (cause) => new RunnerOutputError({ cause }),
  });
}

export const RunnerOutputLive = Layer.succeed(
  RunnerOutput,
  RunnerOutput.of({
    writeStdout,
    writeStdoutLine,
    writeStderrLine,
  }),
);

export const RunnerServicesLive = Layer.succeed(
  RunnerServices,
  RunnerServices.of({
    evalCases: cases,
    executeCase: (evalCase) =>
      executeCaseLive(evalCase).pipe(
        Effect.matchEffect({
          onFailure: (cause) =>
            Effect.fail(new RunnerCaseExecutionError({ cause })),
          onSuccess: Effect.succeed,
        }),
      ),
    writeReport: (report) =>
      Effect.try({
        try: () => {
          writeFileSync(REPORT_PATH, report);
        },
        catch: (cause) => new RunnerReportWriteError({ cause }),
      }),
  }),
);

function parseArguments(argv: string[]) {
  return Effect.try({
    try: () => parseArgs(argv),
    catch: (cause) => new ArgumentsParsingError({ cause }),
  });
}

function selectRequestedCases(
  evalCases: readonly EvalCase[],
  parsedArguments: ParsedArguments,
) {
  return Effect.try({
    try: () => selectCases(evalCases, parsedArguments),
    catch: (cause) => new CaseSelectionError({ cause }),
  });
}

function formatCaseResult(result: Result) {
  return Effect.try({
    try: () =>
      `${result.status} ${(result.durationMs / MS_PER_SECOND).toFixed(WHOLE_SECONDS)}s $${result.costUsd.toFixed(COST_DECIMALS)}`,
    catch: (cause) => new CaseResultFormattingError({ cause }),
  });
}

function renderReportEffect(reportResults: Result[]) {
  return Effect.try({
    try: () => renderReport(reportResults),
    catch: (cause) => new ReportRenderingError({ cause }),
  });
}

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
      yield* output.writeStdoutLine(yield* formatCaseResult(result));
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

    const report = yield* renderReportEffect(reportResults);
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
    const parsedArguments = yield* parseArguments(argv);
    if (parsedArguments.errors.length > 0) {
      return yield* new UsageError({ errors: parsedArguments.errors });
    }

    const selectedCases = yield* selectRequestedCases(
      services.evalCases,
      parsedArguments,
    );
    if (selectedCases.length === 0) {
      return yield* new NoCasesMatchedError({ message: "No cases matched." });
    }

    return yield* executeSelectedCases(selectedCases);
  });
}

type RunnerBoundaryError =
  | ArgumentsParsingError
  | CaseSelectionError
  | ReportRenderingError
  | CaseResultFormattingError
  | RunnerCaseExecutionError
  | RunnerReportWriteError
  | RunnerOutputError;

type CaseBoundaryError =
  | CaseFixtureAcquisitionError
  | CaseFixtureCleanupError
  | PromptConstructionError
  | ObservationRunError;

function isRunnerBoundaryError(error: unknown): error is RunnerBoundaryError {
  return (
    error instanceof ArgumentsParsingError ||
    error instanceof CaseSelectionError ||
    error instanceof ReportRenderingError ||
    error instanceof CaseResultFormattingError ||
    error instanceof RunnerCaseExecutionError ||
    error instanceof RunnerReportWriteError ||
    error instanceof RunnerOutputError
  );
}

function isCaseBoundaryError(error: unknown): error is CaseBoundaryError {
  return (
    error instanceof CaseFixtureAcquisitionError ||
    error instanceof CaseFixtureCleanupError ||
    error instanceof PromptConstructionError ||
    error instanceof ObservationRunError
  );
}

function unwrapBoundaryCause(error: unknown): unknown {
  return isRunnerBoundaryError(error) || isCaseBoundaryError(error)
    ? unwrapBoundaryCause(error.cause)
    : error;
}

function describeSuiteFailure(error: unknown): string {
  const originalCause = unwrapBoundaryCause(error);
  return originalCause instanceof Error
    ? originalCause.message
    : String(originalCause);
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

function safelyDescribeCause(cause: Cause.Cause<unknown>): string {
  try {
    return String(cause);
  } catch (causeConversionError) {
    return new Error(UNKNOWN_CAUSE_DESCRIPTION, {
      cause: causeConversionError,
    }).message;
  }
}

function describeFormattedDefect(formattedDefect: string): string {
  const errorMessage = formattedDefect.replace(ERROR_NAME_PREFIX, "");
  if (errorMessage !== formattedDefect) return errorMessage;

  try {
    const defectValue: unknown = JSON.parse(formattedDefect);
    return String(defectValue);
  } catch (parseError) {
    return parseError instanceof SyntaxError
      ? formattedDefect
      : String(parseError);
  }
}

function describeDefect(cause: Cause.Cause<unknown>, defect: unknown): string {
  try {
    return describeFormattedDefect(Formatter.format(defect));
  } catch (defectFormattingError) {
    return new Error(safelyDescribeCause(cause), {
      cause: defectFormattingError,
    }).message;
  }
}

function describeResidualCause(cause: Cause.Cause<unknown>): string {
  const [reason] = cause.reasons;
  if (cause.reasons.length !== SINGLE_REASON_COUNT || reason == null) {
    return safelyDescribeCause(cause);
  }

  return Cause.isDieReason(reason)
    ? describeDefect(cause, reason.defect)
    : safelyDescribeCause(cause);
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
  const typedFailureHandled = coordinateRun(argv).pipe(
    Effect.matchEffect({
      onFailure: handleRunFailure,
      onSuccess: Effect.succeed,
    }),
  );
  const causeHandled = typedFailureHandled.pipe(
    Effect.matchCauseEffect({
      onFailure: handleResidualCause,
      onSuccess: Effect.succeed,
    }),
  );

  return causeHandled.pipe(
    Effect.matchCause({
      onFailure: () => EXIT_CODES.SUITE_ERROR,
      onSuccess: (exitCode) => exitCode,
    }),
  );
}

// Only a direct `node run.ts` spends money. Importing this module -- which the
// offline tests do, to reach the pure helpers above -- must never start a run.
if (import.meta.main) {
  const exitCode = await Effect.runPromise(
    runCli(process.argv.slice(ARGV_START)).pipe(
      Effect.provide(RunnerServicesLive),
      Effect.provide(RunnerOutputLive),
    ),
  );
  process.exit(exitCode);
}
