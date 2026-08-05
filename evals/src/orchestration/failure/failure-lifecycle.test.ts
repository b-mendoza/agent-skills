// Pins the runner's failure channel: every unexpected outcome lands on the
// suite-error exit code with an exact stderr line.
//
// The residual-defect rows below are deliberately literal. They pin how
// `effect` formats a defect that is not an Error -- a bare string, a bigint --
// so a formatting regression fails here rather than in a paid run. The
// throwing-coercion case pins only the shape of that line: its wording belongs
// to `effect`'s formatter, but a defect whose `toString` throws must still land
// on one contained suite-error line.
//
//   pnpm test

import { Effect } from "effect";
import { expect, test, vi } from "vitest";

import { ROUTING_TIER } from "#/cases/analyzing-recent-project-state.ts";
import { PromptConstructionError } from "#/orchestration/case-execution/execution.ts";
import { EXIT_CODES } from "#/orchestration/run-coordination.ts";
import {
  createRunnerServices,
  evalCase,
  executionResult,
  runInjectedCli,
} from "#/orchestration/run-coordination-test-support.ts";
import type { RunnerServices } from "#/orchestration/suite/services.ts";
import {
  RunnerCaseExecutionError,
  RunnerReportWriteError,
} from "#/orchestration/suite/services.ts";

const BIGINT_DEFECT = 1n;
const THROWING_DEFECT = {
  toString: () => {
    throw new Error("coercion broke");
  },
};
const SUITE_ERROR_LINE_PATTERN = /^eval suite error: .+\n$/u;

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
    // The live path nests a case error inside the runner's boundary error, so
    // the reported message must come from the innermost cause.
    label: "a nested boundary failure reports the original cause",
    executeCase: () =>
      Effect.fail(
        new RunnerCaseExecutionError({
          cause: new PromptConstructionError({
            cause: new Error("prompt broke"),
          }),
        }),
      ),
    expectedStderr: "eval suite error: prompt broke\n",
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
])("$label", async ({ executeCase, expectedStderr }) => {
  const services = createRunnerServices({
    evalCases: [evalCase("broken", ROUTING_TIER)],
    executeCase,
  });

  const { exitCode, stderr } = await runInjectedCli([], services);

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(stderr).toStrictEqual([expectedStderr]);
});

test("a residual defect with throwing coercion is safely formatted", async () => {
  const services = createRunnerServices({
    evalCases: [evalCase("broken", ROUTING_TIER)],
    executeCase: () => Effect.die(THROWING_DEFECT),
  });

  const { exitCode, stderr } = await runInjectedCli([], services);

  // One line, and the coercion failure never escapes as the suite's outcome.
  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(stderr.join("")).toMatch(SUITE_ERROR_LINE_PATTERN);
});
