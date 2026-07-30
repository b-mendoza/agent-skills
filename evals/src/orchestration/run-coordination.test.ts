// Pins the runner's free CLI coordination: selection, sequencing, report writes,
// and exit codes.
//
// Cases are injected, so these tests spend no tokens and write no report file.
//
//   pnpm test

import { afterEach, expect, test, vi } from "vitest";

import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import type { Observation } from "#/observation/harness.ts";
import type { CaseExecutionResult } from "#/orchestration/case-execution.ts";
import type { Result } from "#/orchestration/report.ts";
import type { RunnerServices } from "#/orchestration/run.ts";
import { EXIT_CODES, runCli } from "#/orchestration/run.ts";

const BEHAVIORAL_CASE_TIER = 2;

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

function createRunnerServices(
  overrides: Partial<RunnerServices> = {},
): RunnerServices {
  return {
    evalCases: overrides.evalCases ?? [],
    executeCase:
      overrides.executeCase ?? vi.fn<RunnerServices["executeCase"]>(),
    writeReport:
      overrides.writeReport ?? vi.fn<RunnerServices["writeReport"]>(),
  };
}

function muteRunnerOutput(): void {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("usage errors execute no cases and write no report", async () => {
  muteRunnerOutput();
  const services = createRunnerServices({
    evalCases: [evalCase("routing", 1)],
  });

  const exitCode = await runCli(["--tier=abc", "--unknown"], services);
  const capturedErrorOutput = vi
    .mocked(console.error)
    .mock.calls.flat()
    .join("\n");

  expect(exitCode).toBe(EXIT_CODES.USAGE_ERROR);
  expect(services.executeCase).not.toHaveBeenCalled();
  expect(services.writeReport).not.toHaveBeenCalled();
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
  muteRunnerOutput();
  const services = createRunnerServices({
    evalCases: [evalCase("routing", 1)],
  });

  const exitCode = await runCli(["--tier=0"], services);

  expect(exitCode).toBe(EXIT_CODES.NO_CASES_MATCHED);
  expect(services.executeCase).not.toHaveBeenCalled();
  expect(services.writeReport).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledWith("No cases matched.");
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
  muteRunnerOutput();
  const injectedCases = [
    evalCase("tier-one-a", 1),
    evalCase("tier-one-b", 1),
    evalCase("tier-two-a", BEHAVIORAL_CASE_TIER),
    evalCase("tier-two-b", BEHAVIORAL_CASE_TIER),
  ];
  const executeCase = vi.fn<RunnerServices["executeCase"]>(
    async (selectedCase) => {
      await Promise.resolve();
      return executionResult(selectedCase);
    },
  );
  const services = createRunnerServices({
    evalCases: injectedCases,
    executeCase,
  });

  const exitCode = await runCli(args, services);

  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(
    executeCase.mock.calls.map(([selectedCase]) => selectedCase.id),
  ).toStrictEqual(expectedCaseIds);
});

test("cases execute sequentially and the report writes after completion", async () => {
  muteRunnerOutput();
  const firstCase = evalCase("first", 1);
  const secondCase = evalCase("second", 1);
  const eventOrder: string[] = [];
  const executeCase = vi.fn<RunnerServices["executeCase"]>(
    async (selectedCase) => {
      eventOrder.push(`start:${selectedCase.id}`);
      await Promise.resolve();
      eventOrder.push(`finish:${selectedCase.id}`);
      return executionResult(selectedCase);
    },
  );
  const writeReport = vi.fn<RunnerServices["writeReport"]>(() => {
    eventOrder.push("write-report");
  });
  const services = createRunnerServices({
    evalCases: [firstCase, secondCase],
    executeCase,
    writeReport,
  });

  const exitCode = await runCli([], services);

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
  muteRunnerOutput();
  const behavioralCase = evalCase("behavioral", BEHAVIORAL_CASE_TIER);
  const executeCase = vi.fn<RunnerServices["executeCase"]>(
    async (selectedCase) => {
      await Promise.resolve();
      return executionResult(selectedCase);
    },
  );
  const writeReport = vi.fn<RunnerServices["writeReport"]>();
  const services = createRunnerServices({
    evalCases: [behavioralCase],
    executeCase,
    writeReport,
  });

  const exitCode = await runCli([], services);

  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(executeCase).toHaveBeenCalledOnce();
  expect(writeReport).toHaveBeenCalledExactlyOnceWith(
    expect.stringContaining(
      "| mutation-scope | 2* | PASS | 1 behavioral run(s) left no trace |",
    ),
  );
});

test("tier-2 mutation evidence fails the derived row without executing another case", async () => {
  muteRunnerOutput();
  const routingCase = evalCase("routing", 1);
  const behavioralCase = evalCase("behavioral", BEHAVIORAL_CASE_TIER);
  const injectedCases = [routingCase, behavioralCase];
  const executeCase = vi.fn<RunnerServices["executeCase"]>(
    async (selectedCase) => {
      await Promise.resolve();
      if (selectedCase.tier === 1) {
        // This would fail assertRunHappened if a tier-1 observation leaked into
        // the derived check, making the expected mutation message a scope guard.
        return executionResult(selectedCase, {}, { timedOut: true });
      }
      return executionResult(
        selectedCase,
        {},
        {
          gitStatusAfter: { kind: "worktree", entries: "?? changed.txt" },
        },
      );
    },
  );
  const writeReport = vi.fn<RunnerServices["writeReport"]>();
  const services = createRunnerServices({
    evalCases: injectedCases,
    executeCase,
    writeReport,
  });

  const exitCode = await runCli([], services);
  const writtenReport = writeReport.mock.calls[0]?.[0] ?? "";

  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(executeCase).toHaveBeenCalledTimes(injectedCases.length);
  expect(
    executeCase.mock.calls.map(([selectedCase]) => selectedCase.id),
  ).toStrictEqual(["routing", "behavioral"]);
  expect(writeReport).toHaveBeenCalledOnce();
  expect(writtenReport).toContain(
    "| mutation-scope | 2* | FAIL | read-only contract violated: |",
  );
  expect(writtenReport).not.toContain("run exceeded its wall clock");
});

test("a failed case returns the case-failed exit code after writing the report", async () => {
  muteRunnerOutput();
  const failingCase = evalCase("failing", 1);
  const writeReport = vi.fn<RunnerServices["writeReport"]>();
  const services = createRunnerServices({
    evalCases: [failingCase],
    executeCase: async (selectedCase) => {
      await Promise.resolve();
      return executionResult(selectedCase, {
        status: "FAIL",
        observed: "assertion failed",
      });
    },
    writeReport,
  });

  const exitCode = await runCli([], services);

  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(writeReport).toHaveBeenCalledOnce();
});

test("an unexpected executor failure returns the suite-error exit code", async () => {
  muteRunnerOutput();
  const writeReport = vi.fn<RunnerServices["writeReport"]>();
  const services = createRunnerServices({
    evalCases: [evalCase("broken", 1)],
    executeCase: async () => {
      await Promise.resolve();
      throw new Error("executor broke");
    },
    writeReport,
  });

  const exitCode = await runCli([], services);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(writeReport).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledWith(
    "eval suite error: executor broke",
  );
});
