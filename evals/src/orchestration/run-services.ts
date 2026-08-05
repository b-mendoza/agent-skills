// The runner's injectable boundaries: the case/report services and the stdout
// and stderr channels, each with the live adapter the entry point provides.

import { writeFileSync } from "node:fs";

import { Context, Data, Effect, Layer } from "effect";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import { cases } from "#/cases/analyzing-recent-project-state.ts";
import type { CaseExecutionResult } from "#/orchestration/case-execution/execution.ts";
import { executeCaseLive } from "#/orchestration/case-execution/execution.ts";
import { REPORT_PATH } from "#/orchestration/report.ts";

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
