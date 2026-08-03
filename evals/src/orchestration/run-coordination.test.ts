// Pins the runner's free CLI coordination: selection, sequencing, report writes,
// output channels, and exit codes.
//
// Cases and services are injected, so these tests spend no tokens and write no
// report file.
//
//   pnpm test

import { Effect, Layer } from "effect";
import { expect, test, vi } from "vitest";

import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import type { Observation } from "#/observation/observation-types.ts";
import type { CaseExecutionResult } from "#/orchestration/case-execution.ts";
import type { Result } from "#/orchestration/report.ts";
import {
  EXIT_CODES,
  runCli,
  RunnerCaseExecutionError,
  RunnerOutput,
  RunnerOutputError,
  RunnerReportWriteError,
  RunnerServices,
} from "#/orchestration/run.ts";

const ROUTING_CASE_TIER = 1;
const BEHAVIORAL_CASE_TIER = 2;
const BIGINT_DEFECT = 1n;
const DATE_DEFECT_ISO = "2020-01-02T03:04:05.000Z";

function evalCase(id: string, tier: CaseTier): EvalCase {
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

function executionResult(
  selectedCase: EvalCase,
  resultOverrides: Partial<Result> = {},
  observationOverrides: Partial<Observation> = {},
): CaseExecutionResult {
  return {
    result: {
      id: selectedCase.id,
      tier: selectedCase.tier === 1 ? "1" : "2",
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

function successfulEffect<A>(operation: () => A) {
  return Effect.try({
    try: operation,
    catch: (cause) => new RunnerCaseExecutionError({ cause }),
  });
}

function createRunnerServices(
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

interface CapturedOutput {
  readonly stderr: string[];
  readonly stdout: string[];
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

async function runInjectedCli(
  args: string[],
  services: RunnerServices,
  capturedOutput: CapturedOutput = { stdout: [], stderr: [] },
) {
  return Effect.runPromise(
    runCli(args).pipe(
      Effect.provide(
        Layer.succeed(RunnerServices, RunnerServices.of(services)),
      ),
      Effect.provide(outputLayer(capturedOutput)),
    ),
  );
}

test("usage errors execute no cases and write no report", async () => {
  const services = createRunnerServices({
    evalCases: [evalCase("routing", 1)],
  });
  const capturedOutput: CapturedOutput = { stdout: [], stderr: [] };

  const exitCode = await runInjectedCli(
    ["--tier=abc", "--unknown"],
    services,
    capturedOutput,
  );
  const capturedErrorOutput = capturedOutput.stderr.join("");

  expect(exitCode).toBe(EXIT_CODES.USAGE_ERROR);
  expect(services.executeCase).not.toHaveBeenCalled();
  expect(services.writeReport).not.toHaveBeenCalled();
  expect(capturedOutput.stdout).toStrictEqual([]);
  expect(capturedErrorOutput).toContain(
    "unrecognized or malformed argument: --tier=abc",
  );
  expect(capturedErrorOutput).toContain(
    "unrecognized or malformed argument: --unknown",
  );
  expect(capturedErrorOutput).toContain(
    "Usage: node evals/src/orchestration/run.ts",
  );
});

test("a numeric tier with no matches executes no cases and writes no report", async () => {
  const services = createRunnerServices({
    evalCases: [evalCase("routing", 1)],
  });
  const capturedOutput: CapturedOutput = { stdout: [], stderr: [] };

  const exitCode = await runInjectedCli(["--tier=0"], services, capturedOutput);

  expect(exitCode).toBe(EXIT_CODES.NO_CASES_MATCHED);
  expect(services.executeCase).not.toHaveBeenCalled();
  expect(services.writeReport).not.toHaveBeenCalled();
  expect(capturedOutput.stdout).toStrictEqual([]);
  expect(capturedOutput.stderr).toStrictEqual(["No cases matched.\n"]);
});

test.each([
  {
    label: "all cases when no selectors are present",
    args: [],
    expectedCaseIds: ["tier-one-a", "tier-one-b", "tier-two-a", "tier-two-b"],
  },
  {
    label: "only the selected tier",
    args: ["--tier=1"],
    expectedCaseIds: ["tier-one-a", "tier-one-b"],
  },
  {
    label: "only the selected case ID",
    args: ["--case=tier-two-a"],
    expectedCaseIds: ["tier-two-a"],
  },
  {
    label: "the intersection of tier and case selectors",
    args: ["--tier=2", "--case=tier-two-b"],
    expectedCaseIds: ["tier-two-b"],
  },
])("selection executes $label", async ({ args, expectedCaseIds }) => {
  const injectedCases = [
    evalCase("tier-one-a", 1),
    evalCase("tier-one-b", 1),
    evalCase("tier-two-a", BEHAVIORAL_CASE_TIER),
    evalCase("tier-two-b", BEHAVIORAL_CASE_TIER),
  ];
  const executeCase = vi.fn<RunnerServices["executeCase"]>((selectedCase) =>
    successfulEffect(() => executionResult(selectedCase)),
  );
  const services = createRunnerServices({
    evalCases: injectedCases,
    executeCase,
  });

  const exitCode = await runInjectedCli(args, services);

  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(
    executeCase.mock.calls.map(([selectedCase]) => selectedCase.id),
  ).toStrictEqual(expectedCaseIds);
});

test("cases execute sequentially and the report writes after completion", async () => {
  const firstCase = evalCase("first", 1);
  const secondCase = evalCase("second", 1);
  const eventOrder: string[] = [];
  const executeCase = vi.fn<RunnerServices["executeCase"]>((selectedCase) =>
    Effect.tryPromise({
      try: async () => {
        eventOrder.push(`start:${selectedCase.id}`);
        await Promise.resolve();
        eventOrder.push(`finish:${selectedCase.id}`);
        return executionResult(selectedCase);
      },
      catch: (cause) => new RunnerCaseExecutionError({ cause }),
    }),
  );
  const writeReport = vi.fn<RunnerServices["writeReport"]>(() =>
    Effect.try({
      try: () => {
        eventOrder.push("write-report");
      },
      catch: (cause) => new RunnerReportWriteError({ cause }),
    }),
  );
  const services = createRunnerServices({
    evalCases: [firstCase, secondCase],
    executeCase,
    writeReport,
  });

  const exitCode = await runInjectedCli([], services);

  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(eventOrder).toStrictEqual([
    "start:first",
    "finish:first",
    "start:second",
    "finish:second",
    "write-report",
  ]);
  expect(writeReport).toHaveBeenCalledOnce();
});

test("tier-2 observations add a derived mutation-scope row without another execution", async () => {
  const behavioralCase = evalCase("behavioral", BEHAVIORAL_CASE_TIER);
  const executeCase = vi.fn<RunnerServices["executeCase"]>((selectedCase) =>
    Effect.succeed(executionResult(selectedCase)),
  );
  const writtenReports: string[] = [];
  const writeReport = vi.fn<RunnerServices["writeReport"]>((report) =>
    Effect.try({
      try: () => {
        writtenReports.push(report);
      },
      catch: (cause) => new RunnerReportWriteError({ cause }),
    }),
  );
  const services = createRunnerServices({
    evalCases: [behavioralCase],
    executeCase,
    writeReport,
  });

  const exitCode = await runInjectedCli([], services);

  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(executeCase).toHaveBeenCalledOnce();
  expect(writtenReports[0]).toContain(
    "| mutation-scope | 2* | PASS | 1 behavioral run(s) left no trace |",
  );
});

test("tier-2 mutation evidence fails the derived row without executing another case", async () => {
  const routingCase = evalCase("routing", 1);
  const behavioralCase = evalCase("behavioral", BEHAVIORAL_CASE_TIER);
  const injectedCases = [routingCase, behavioralCase];
  const executeCase = vi.fn<RunnerServices["executeCase"]>((selectedCase) => {
    if (selectedCase.tier === 1) {
      // If tier 1 leaked into the derived check, this timeout would replace the
      // expected mutation-specific failure text.
      return Effect.succeed(
        executionResult(selectedCase, {}, { timedOut: true }),
      );
    }
    return Effect.succeed(
      executionResult(
        selectedCase,
        {},
        {
          gitStatusAfter: { kind: "worktree", entries: "?? changed.txt" },
        },
      ),
    );
  });
  const writtenReports: string[] = [];
  const services = createRunnerServices({
    evalCases: injectedCases,
    executeCase,
    writeReport: (report) =>
      Effect.try({
        try: () => {
          writtenReports.push(report);
        },
        catch: (cause) => new RunnerReportWriteError({ cause }),
      }),
  });

  const exitCode = await runInjectedCli([], services);
  const writtenReport = writtenReports[0] ?? "";

  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(executeCase).toHaveBeenCalledTimes(injectedCases.length);
  expect(
    executeCase.mock.calls.map(([selectedCase]) => selectedCase.id),
  ).toStrictEqual(["routing", "behavioral"]);
  expect(writtenReport).toContain(
    "| mutation-scope | 2* | FAIL | read-only contract violated: |",
  );
  expect(writtenReport).not.toContain("run exceeded its wall clock");
});

test("a failed case returns the case-failed exit code after writing the report", async () => {
  const failingCase = evalCase("failing", 1);
  const writeReport = vi.fn<RunnerServices["writeReport"]>(() =>
    Effect.succeed(undefined),
  );
  const services = createRunnerServices({
    evalCases: [failingCase],
    executeCase: (selectedCase) =>
      Effect.succeed(
        executionResult(selectedCase, {
          status: "FAIL",
          observed: "assertion failed",
        }),
      ),
    writeReport,
  });

  const exitCode = await runInjectedCli([], services);

  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(writeReport).toHaveBeenCalledOnce();
});

test("an unexpected executor failure returns the suite-error exit code", async () => {
  const writeReport = vi.fn<RunnerServices["writeReport"]>(() =>
    Effect.succeed(undefined),
  );
  const services = createRunnerServices({
    evalCases: [evalCase("broken", 1)],
    executeCase: () =>
      Effect.fail(
        new RunnerCaseExecutionError({ cause: new Error("executor broke") }),
      ),
    writeReport,
  });
  const capturedOutput: CapturedOutput = { stdout: [], stderr: [] };

  const exitCode = await runInjectedCli([], services, capturedOutput);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(writeReport).not.toHaveBeenCalled();
  expect(capturedOutput.stderr).toStrictEqual([
    "eval suite error: executor broke\n",
  ]);
});

test("a report-writer failure overrides an otherwise successful run", async () => {
  const services = createRunnerServices({
    evalCases: [evalCase("passing", 1)],
    executeCase: (selectedCase) =>
      Effect.succeed(executionResult(selectedCase)),
    writeReport: () =>
      Effect.fail(
        new RunnerReportWriteError({ cause: new Error("writer broke") }),
      ),
  });
  const capturedOutput: CapturedOutput = { stdout: [], stderr: [] };

  const exitCode = await runInjectedCli([], services, capturedOutput);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(capturedOutput.stderr).toStrictEqual([
    "eval suite error: writer broke\n",
  ]);
  expect(capturedOutput.stdout.join("")).not.toContain("Report written");
});

test("a non-Error executor failure retains String conversion", async () => {
  const services = createRunnerServices({
    evalCases: [evalCase("broken", 1)],
    executeCase: () =>
      Effect.fail(new RunnerCaseExecutionError({ cause: "bare failure" })),
  });
  const capturedOutput: CapturedOutput = { stdout: [], stderr: [] };

  const exitCode = await runInjectedCli([], services, capturedOutput);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(capturedOutput.stderr).toStrictEqual([
    "eval suite error: bare failure\n",
  ]);
});

test("a residual defect is contained by the suite-error exit", async () => {
  const services = createRunnerServices({
    evalCases: [evalCase("broken", 1)],
    executeCase: () => Effect.die(new Error("executor defect")),
  });
  const capturedOutput: CapturedOutput = { stdout: [], stderr: [] };

  const exitCode = await runInjectedCli([], services, capturedOutput);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(capturedOutput.stderr).toStrictEqual([
    "eval suite error: executor defect\n",
  ]);
});

test("a residual non-Error defect retains String conversion", async () => {
  const services = createRunnerServices({
    evalCases: [evalCase("broken", ROUTING_CASE_TIER)],
    executeCase: () => Effect.die("bare defect"),
  });
  const capturedOutput: CapturedOutput = { stdout: [], stderr: [] };

  const exitCode = await runInjectedCli([], services, capturedOutput);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(capturedOutput.stderr).toStrictEqual([
    "eval suite error: bare defect\n",
  ]);
});

test("a residual bigint defect retains its formatted suffix", async () => {
  const services = createRunnerServices({
    evalCases: [evalCase("broken", ROUTING_CASE_TIER)],
    executeCase: () => Effect.die(BIGINT_DEFECT),
  });
  const capturedOutput: CapturedOutput = { stdout: [], stderr: [] };

  const exitCode = await runInjectedCli([], services, capturedOutput);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(capturedOutput.stderr).toStrictEqual(["eval suite error: 1n\n"]);
});

test("a residual Date defect retains ISO formatting", async () => {
  const services = createRunnerServices({
    evalCases: [evalCase("broken", ROUTING_CASE_TIER)],
    executeCase: () => Effect.die(new Date(DATE_DEFECT_ISO)),
  });
  const capturedOutput: CapturedOutput = { stdout: [], stderr: [] };

  const exitCode = await runInjectedCli([], services, capturedOutput);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(capturedOutput.stderr).toStrictEqual([
    `eval suite error: ${DATE_DEFECT_ISO}\n`,
  ]);
});

test("a residual defect with throwing coercion is safely formatted", async () => {
  const throwingDefect = {
    toString: () => {
      throw new Error("coercion broke");
    },
  };
  const services = createRunnerServices({
    evalCases: [evalCase("broken", ROUTING_CASE_TIER)],
    executeCase: () => Effect.die(throwingDefect),
  });
  const capturedOutput: CapturedOutput = { stdout: [], stderr: [] };

  const exitCode = await runInjectedCli([], services, capturedOutput);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(capturedOutput.stderr).toStrictEqual([
    "eval suite error: [toString threw]\n",
  ]);
});
