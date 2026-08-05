// Pins the runner's free CLI coordination: selection, sequencing, report writes,
// output channels, and exit codes.
//
// Cases and services are injected, so these tests spend no tokens and write no
// report file.
//
//   pnpm test

import { Effect } from "effect";
import { expect, test, vi } from "vitest";

import {
  BEHAVIORAL_TIER,
  ROUTING_TIER,
} from "#/cases/analyzing-recent-project-state.ts";
import { formatResultLine } from "#/orchestration/report.ts";
import { EXIT_CODES } from "#/orchestration/suite/coordination.ts";
import type { RunnerServices } from "#/orchestration/suite/services.ts";
import {
  RunnerCaseExecutionError,
  RunnerReportWriteError,
} from "#/orchestration/suite/services.ts";
import {
  capturingWriteReport,
  createRunnerServices,
  evalCase,
  executionResult,
  runInjectedCli,
} from "#/orchestration/suite/test-support.ts";

const PASSING_CASE_COST_USD = 0.25;
const PASSING_CASE_DURATION_MS = 1500;
const FAILING_CASE_COST_USD = 0.5;
const FAILING_CASE_DURATION_MS = 3000;

test("usage errors execute no cases and write no report", async () => {
  const services = createRunnerServices({
    evalCases: [evalCase("routing", ROUTING_TIER)],
  });

  const { exitCode, stdout, stderr } = await runInjectedCli(
    ["--tier=abc", "--unknown"],
    services,
  );
  const capturedErrorOutput = stderr.join("");

  expect(exitCode).toBe(EXIT_CODES.USAGE_ERROR);
  expect(services.executeCase).not.toHaveBeenCalled();
  expect(services.writeReport).not.toHaveBeenCalled();
  expect(stdout).toStrictEqual([]);
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
    evalCases: [evalCase("routing", ROUTING_TIER)],
  });

  const { exitCode, stdout, stderr } = await runInjectedCli(
    ["--tier=0"],
    services,
  );

  expect(exitCode).toBe(EXIT_CODES.NO_CASES_MATCHED);
  expect(services.executeCase).not.toHaveBeenCalled();
  expect(services.writeReport).not.toHaveBeenCalled();
  expect(stdout).toStrictEqual([]);
  expect(stderr).toStrictEqual(["No cases matched.\n"]);
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
    evalCase("tier-one-a", ROUTING_TIER),
    evalCase("tier-one-b", ROUTING_TIER),
    evalCase("tier-two-a", BEHAVIORAL_TIER),
    evalCase("tier-two-b", BEHAVIORAL_TIER),
  ];
  const executeCase = vi.fn<RunnerServices["executeCase"]>((selectedCase) =>
    Effect.succeed(executionResult(selectedCase)),
  );
  const services = createRunnerServices({
    evalCases: injectedCases,
    executeCase,
  });

  const { exitCode } = await runInjectedCli(args, services);

  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(
    executeCase.mock.calls.map(([selectedCase]) => selectedCase.id),
  ).toStrictEqual(expectedCaseIds);
});

test("cases execute sequentially and the report writes after completion", async () => {
  const firstCase = evalCase("first", ROUTING_TIER);
  const secondCase = evalCase("second", ROUTING_TIER);
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

  const { exitCode } = await runInjectedCli([], services);

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

test("a mixed run prints every progress line, the failure detail, and the report confirmation", async () => {
  const passingCase = evalCase("passing", ROUTING_TIER);
  const failingCase = evalCase("failing", ROUTING_TIER);
  const passingExecution = executionResult(passingCase, {
    costUsd: PASSING_CASE_COST_USD,
    durationMs: PASSING_CASE_DURATION_MS,
  });
  const failingExecution = executionResult(failingCase, {
    status: "FAIL",
    observed: "assertion failed",
    costUsd: FAILING_CASE_COST_USD,
    durationMs: FAILING_CASE_DURATION_MS,
  });
  const services = createRunnerServices({
    evalCases: [passingCase, failingCase],
    executeCase: (selectedCase) =>
      Effect.succeed(
        selectedCase.id === passingCase.id
          ? passingExecution
          : failingExecution,
      ),
  });

  const { exitCode, stdout } = await runInjectedCli([], services);

  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(stdout.join("")).toBe(
    [
      `· passing (tier ${ROUTING_TIER}) ... ${formatResultLine(passingExecution.result)}`,
      `· failing (tier ${ROUTING_TIER}) ... ${formatResultLine(failingExecution.result)}`,
      "    assertion failed",
      "",
      "Report written to evals/report.md",
      "",
    ].join("\n"),
  );
});

test("tier-2 observations add a derived mutation-scope row without another execution", async () => {
  const behavioralCase = evalCase("behavioral", BEHAVIORAL_TIER);
  const executeCase = vi.fn<RunnerServices["executeCase"]>((selectedCase) =>
    Effect.succeed(executionResult(selectedCase)),
  );
  const writtenReports: string[] = [];
  const writeReport = vi.fn<RunnerServices["writeReport"]>(
    capturingWriteReport(writtenReports),
  );
  const services = createRunnerServices({
    evalCases: [behavioralCase],
    executeCase,
    writeReport,
  });

  const { exitCode } = await runInjectedCli([], services);

  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(executeCase).toHaveBeenCalledOnce();
  expect(writtenReports[0]).toContain("| mutation-scope | 2* | PASS |");
});

test("tier-2 mutation evidence fails the derived row without executing another case", async () => {
  const routingCase = evalCase("routing", ROUTING_TIER);
  const behavioralCase = evalCase("behavioral", BEHAVIORAL_TIER);
  const injectedCases = [routingCase, behavioralCase];
  const executeCase = vi.fn<RunnerServices["executeCase"]>((selectedCase) => {
    if (selectedCase.tier === ROUTING_TIER) {
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
    writeReport: capturingWriteReport(writtenReports),
  });

  const { exitCode } = await runInjectedCli([], services);
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
  const failingCase = evalCase("failing", ROUTING_TIER);
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

  const { exitCode } = await runInjectedCli([], services);

  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(writeReport).toHaveBeenCalledOnce();
});
