// Pins the runner's failure channel: every unexpected outcome lands on the
// suite-error exit code with an exact stderr line.
//
// The residual-defect rows below are deliberately literal. They pin how
// `effect` formats a defect that is not an Error -- a bigint, a Date, a value
// whose `toString` throws -- so a formatting regression fails here rather than
// in a paid run.
//
//   pnpm test

import { Effect } from "effect";
import { expect, test, vi } from "vitest";

import { ROUTING_TIER } from "#/cases/analyzing-recent-project-state.ts";
import { EXIT_CODES } from "#/orchestration/run-coordination.ts";
import {
  createRunnerServices,
  evalCase,
  executionResult,
  runInjectedCli,
} from "#/orchestration/run-coordination-test-support.ts";
import type { RunnerServices } from "#/orchestration/run-services.ts";
import {
  RunnerCaseExecutionError,
  RunnerReportWriteError,
} from "#/orchestration/run-services.ts";

const BIGINT_DEFECT = 1n;
const DATE_DEFECT_ISO = "2020-01-02T03:04:05.000Z";
const THROWING_DEFECT = {
  toString: () => {
    throw new Error("coercion broke");
  },
};

test("an unexpected executor failure returns the suite-error exit code", async () => {
  const writeReport = vi.fn<RunnerServices["writeReport"]>(() =>
    Effect.succeed(undefined),
  );
  const services = createRunnerServices({
    evalCases: [evalCase("broken", ROUTING_TIER)],
    executeCase: () =>
      Effect.fail(
        new RunnerCaseExecutionError({ cause: new Error("executor broke") }),
      ),
    writeReport,
  });

  const { exitCode, stderr } = await runInjectedCli([], services);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(writeReport).not.toHaveBeenCalled();
  expect(stderr).toStrictEqual(["eval suite error: executor broke\n"]);
});

test("a report-writer failure overrides an otherwise successful run", async () => {
  const services = createRunnerServices({
    evalCases: [evalCase("passing", ROUTING_TIER)],
    executeCase: (selectedCase) =>
      Effect.succeed(executionResult(selectedCase)),
    writeReport: () =>
      Effect.fail(
        new RunnerReportWriteError({ cause: new Error("writer broke") }),
      ),
  });

  const { exitCode, stdout, stderr } = await runInjectedCli([], services);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(stderr).toStrictEqual(["eval suite error: writer broke\n"]);
  expect(stdout.join("")).not.toContain("Report written");
});

test.each<{
  label: string;
  executeCase: RunnerServices["executeCase"];
  expectedStderr: string;
}>([
  {
    label: "a non-Error executor failure retains String conversion",
    executeCase: () =>
      Effect.fail(new RunnerCaseExecutionError({ cause: "bare failure" })),
    expectedStderr: "eval suite error: bare failure\n",
  },
  {
    label: "a residual defect is contained by the suite-error exit",
    executeCase: () => Effect.die(new Error("executor defect")),
    expectedStderr: "eval suite error: executor defect\n",
  },
  {
    label: "a residual non-Error defect retains String conversion",
    executeCase: () => Effect.die("bare defect"),
    expectedStderr: "eval suite error: bare defect\n",
  },
  {
    label: "a residual bigint defect retains its formatted suffix",
    executeCase: () => Effect.die(BIGINT_DEFECT),
    expectedStderr: "eval suite error: 1n\n",
  },
  {
    label: "a residual Date defect retains ISO formatting",
    executeCase: () => Effect.die(new Date(DATE_DEFECT_ISO)),
    expectedStderr: `eval suite error: ${DATE_DEFECT_ISO}\n`,
  },
  {
    label: "a residual defect with throwing coercion is safely formatted",
    executeCase: () => Effect.die(THROWING_DEFECT),
    expectedStderr: "eval suite error: [toString threw]\n",
  },
])("$label", async ({ executeCase, expectedStderr }) => {
  const services = createRunnerServices({
    evalCases: [evalCase("broken", ROUTING_TIER)],
    executeCase,
  });

  const { exitCode, stderr } = await runInjectedCli([], services);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(stderr).toStrictEqual([expectedStderr]);
});
