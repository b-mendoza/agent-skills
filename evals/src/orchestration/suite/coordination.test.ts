// Pins the runner's free CLI coordination: selection, attempt sequencing,
// aggregation into scored rows, report writes, output channels, and exit codes.
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
import {
  DEFAULT_ATTEMPTS_PER_CASE,
  EXIT_CODES,
} from "#/orchestration/suite/coordination.ts";
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

/** Most tests pin per-case behavior, where one attempt keeps assertions flat. */
const SINGLE_ATTEMPT = "--attempts=1";

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
    args: [SINGLE_ATTEMPT],
    expectedCaseIds: ["tier-one-a", "tier-one-b", "tier-two-a", "tier-two-b"],
  },
  {
    label: "only the selected tier",
    args: ["--tier=1", SINGLE_ATTEMPT],
    expectedCaseIds: ["tier-one-a", "tier-one-b"],
  },
  {
    label: "only the selected case ID",
    args: ["--case=tier-two-a", SINGLE_ATTEMPT],
    expectedCaseIds: ["tier-two-a"],
  },
  {
    label: "the intersection of tier and case selectors",
    args: ["--tier=2", "--case=tier-two-b", SINGLE_ATTEMPT],
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

test("without --attempts every selected case executes five times", async () => {
  const singleCase = evalCase("repeated", ROUTING_TIER);
  const executeCase = vi.fn<RunnerServices["executeCase"]>((selectedCase) =>
    Effect.succeed(executionResult(selectedCase)),
  );
  const writtenReports: string[] = [];
  const services = createRunnerServices({
    evalCases: [singleCase],
    executeCase,
    writeReport: capturingWriteReport(writtenReports),
  });

  const { exitCode } = await runInjectedCli([], services);
  const [writtenReport = ""] = writtenReports;

  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(executeCase).toHaveBeenCalledTimes(DEFAULT_ATTEMPTS_PER_CASE);
  expect(writtenReport).toContain("| repeated | 1 | PASS | 100 | 5/5 |");
});

test("attempts execute sequentially and the report writes after completion", async () => {
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

  const { exitCode } = await runInjectedCli(["--attempts=2"], services);

  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(eventOrder).toStrictEqual([
    "start:first",
    "finish:first",
    "start:first",
    "finish:first",
    "start:second",
    "finish:second",
    "start:second",
    "finish:second",
    "write-report",
  ]);
  expect(writeReport).toHaveBeenCalledOnce();
});

test("a mixed run prints attempt lines, failure detail, case summaries, and the report confirmation", async () => {
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

  const { exitCode, stdout } = await runInjectedCli([SINGLE_ATTEMPT], services);

  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(stdout.join("")).toBe(
    [
      `· passing (tier ${ROUTING_TIER}) attempt 1/1 ... ${formatResultLine(passingExecution.result)}`,
      `· passing (tier ${ROUTING_TIER}) ... PASS score 100 (1/1 passed) 2s $0.25`,
      `· failing (tier ${ROUTING_TIER}) attempt 1/1 ... ${formatResultLine(failingExecution.result)}`,
      "    assertion failed",
      `· failing (tier ${ROUTING_TIER}) ... FAIL score 0 (0/1 passed) 3s $0.50`,
      // No behavioral attempt ran, so the derived row has nothing to measure.
      "· mutation-scope (derived) ... NOT_RUN",
      "",
      "Report written to evals/report.md",
      "",
    ].join("\n"),
  );
});

test("mixed attempt outcomes aggregate to DEGRADED and fail the run", async () => {
  const flakyCase = evalCase("flaky", ROUTING_TIER);
  const executeCase = vi
    .fn<RunnerServices["executeCase"]>()
    .mockReturnValueOnce(Effect.succeed(executionResult(flakyCase)))
    .mockReturnValue(
      Effect.succeed(
        executionResult(flakyCase, { status: "FAIL", observed: "flaked" }),
      ),
    );
  const writtenReports: string[] = [];
  const services = createRunnerServices({
    evalCases: [flakyCase],
    executeCase,
    writeReport: capturingWriteReport(writtenReports),
  });

  const { exitCode } = await runInjectedCli(["--attempts=2"], services);
  const [writtenReport = ""] = writtenReports;

  // A case that passes only sometimes is not one the run can vouch for.
  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(writtenReport).toContain(
    "| flaky | 1 | DEGRADED | 50 | 1/2 | flaked |",
  );
});

test("an unselected case appears in the report as NOT_RUN without executing", async () => {
  const selectedCase = evalCase("selected", ROUTING_TIER);
  const unselectedCase = evalCase("unselected", BEHAVIORAL_TIER);
  const executeCase = vi.fn<RunnerServices["executeCase"]>((chosenCase) =>
    Effect.succeed(executionResult(chosenCase)),
  );
  const writtenReports: string[] = [];
  const services = createRunnerServices({
    evalCases: [selectedCase, unselectedCase],
    executeCase,
    writeReport: capturingWriteReport(writtenReports),
  });

  const { exitCode } = await runInjectedCli(
    ["--case=selected", SINGLE_ATTEMPT],
    services,
  );
  const [writtenReport = ""] = writtenReports;

  // NOT_RUN records the gap without gating the exit code.
  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(executeCase).toHaveBeenCalledOnce();
  expect(writtenReport).toContain("| selected | 1 | PASS | 100 | 1/1 |");
  expect(writtenReport).toContain(
    "| unselected | 2 | NOT_RUN | — | — | not executed by this run |",
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

  const { exitCode } = await runInjectedCli([SINGLE_ATTEMPT], services);
  const [writtenReport = ""] = writtenReports;

  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(executeCase).toHaveBeenCalledOnce();
  expect(writtenReport).toContain("| mutation-scope | 2* | PASS | 100 | 1/1 |");
});

test("the derived row scores each attempt's behavioral runs as one repetition", async () => {
  const behavioralCase = evalCase("behavioral", BEHAVIORAL_TIER);
  // The second attempt mutates; the first stays clean. The derived row must
  // degrade rather than let either attempt speak for both.
  const executeCase = vi
    .fn<RunnerServices["executeCase"]>()
    .mockReturnValueOnce(Effect.succeed(executionResult(behavioralCase)))
    .mockReturnValue(
      Effect.succeed(
        executionResult(
          behavioralCase,
          {},
          {
            gitStatusAfter: { kind: "worktree", entries: "?? changed.txt" },
          },
        ),
      ),
    );
  const writtenReports: string[] = [];
  const services = createRunnerServices({
    evalCases: [behavioralCase],
    executeCase,
    writeReport: capturingWriteReport(writtenReports),
  });

  const { exitCode } = await runInjectedCli(["--attempts=2"], services);
  const [writtenReport = ""] = writtenReports;

  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(writtenReport).toContain(
    "| mutation-scope | 2* | DEGRADED | 50 | 1/2 | read-only contract violated: |",
  );
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

  const { exitCode } = await runInjectedCli([SINGLE_ATTEMPT], services);
  const [writtenReport = ""] = writtenReports;

  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(executeCase).toHaveBeenCalledTimes(injectedCases.length);
  expect(
    executeCase.mock.calls.map(([selectedCase]) => selectedCase.id),
  ).toStrictEqual(["routing", "behavioral"]);
  expect(writtenReport).toContain(
    "| mutation-scope | 2* | FAIL | 0 | 0/1 | read-only contract violated: |",
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

  const { exitCode } = await runInjectedCli([SINGLE_ATTEMPT], services);

  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(writeReport).toHaveBeenCalledOnce();
});
