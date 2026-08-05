// Shared injection seam for the runner coordination suites: synthetic cases,
// stub services, and captured output channels, so no test spends a token or
// writes a report file.

import { Effect, Layer } from "effect";
import { vi } from "vitest";

import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import type { Observation } from "#/observation/observation-types.ts";
import type { CaseExecutionResult } from "#/orchestration/case-execution/execution.ts";
import type { Result } from "#/orchestration/report.ts";
import { runCli } from "#/orchestration/suite/coordination.ts";
import {
  RunnerCaseExecutionError,
  RunnerOutput,
  RunnerOutputError,
  RunnerReportWriteError,
  RunnerServices,
} from "#/orchestration/suite/services.ts";

interface CapturedOutput {
  readonly stderr: string[];
  readonly stdout: string[];
}

export function evalCase(id: string, tier: CaseTier): EvalCase {
  return {
    id,
    tier,
    fixture: "clean",
    intent: "runner coordination test",
    prompt: () => "unused prompt",
    budgetUsd: 0,
    wallClockMs: 0,
    check: () => "unused check",
  };
}

export function executionResult(
  selectedCase: EvalCase,
  resultOverrides: Partial<Result> = {},
  observationOverrides: Partial<Observation> = {},
): CaseExecutionResult {
  return {
    result: {
      id: selectedCase.id,
      // The stub echoes the case tier; the production CaseTier -> ReportTier
      // mapping is pinned by the case-execution tests, not modelled here.
      tier: `${selectedCase.tier}`,
      status: "PASS",
      observed: "ok",
      costUsd: 0,
      durationMs: 0,
      ...resultOverrides,
    },
    observation: {
      subtype: "success",
      isError: false,
      finalText: "",
      toolCalls: [],
      gitStatusBefore: { kind: "worktree", entries: "" },
      gitStatusAfter: { kind: "worktree", entries: "" },
      costUsd: 0,
      durationMs: 0,
      timedOut: false,
      ...observationOverrides,
    },
  };
}

/** Collects every rendered report so a test can assert on its rows. */
export function capturingWriteReport(
  writtenReports: string[],
): RunnerServices["writeReport"] {
  return (report) =>
    Effect.try({
      try: () => {
        writtenReports.push(report);
      },
      catch: (cause) => new RunnerReportWriteError({ cause }),
    });
}

export function createRunnerServices(
  overrides: Partial<RunnerServices> = {},
): RunnerServices {
  return {
    evalCases: overrides.evalCases ?? [],
    executeCase:
      overrides.executeCase ??
      vi.fn(() =>
        Effect.fail(
          new RunnerCaseExecutionError({
            cause: new Error("unexpected case execution"),
          }),
        ),
      ),
    writeReport:
      overrides.writeReport ?? vi.fn(() => Effect.succeed(undefined)),
  };
}

function outputLayer(capturedOutput: CapturedOutput) {
  const capture = (messages: string[], text: string) =>
    Effect.try({
      try: () => {
        messages.push(text);
      },
      catch: (cause) => new RunnerOutputError({ cause }),
    });

  return Layer.succeed(
    RunnerOutput,
    RunnerOutput.of({
      writeStdout: (text) => capture(capturedOutput.stdout, text),
      writeStdoutLine: (text) => capture(capturedOutput.stdout, `${text}\n`),
      writeStderrLine: (text) => capture(capturedOutput.stderr, `${text}\n`),
    }),
  );
}

/** Runs one CLI invocation against injected services and returns its output. */
export async function runInjectedCli(args: string[], services: RunnerServices) {
  const capturedOutput: CapturedOutput = { stdout: [], stderr: [] };
  const exitCode = await Effect.runPromise(
    runCli(args).pipe(
      Effect.provide(
        Layer.succeed(RunnerServices, RunnerServices.of(services)),
      ),
      Effect.provide(outputLayer(capturedOutput)),
    ),
  );

  return {
    exitCode,
    stdout: capturedOutput.stdout,
    stderr: capturedOutput.stderr,
  };
}
