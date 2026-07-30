// Pins the runner's pure decision logic and free CLI coordination: flag parsing,
// selection, sequencing, check normalization, report escaping, and rendering.
//
// These are contracts other tooling reads -- `--case=` selects what runs, the
// exit code gates CI, and report.md is committed so a behavior change shows up
// as a diff. Importing run.ts is safe because its entry point is guarded by
// `import.meta.main`; the injected coordinator tests spend no tokens and write no
// report file.
//
//   pnpm test

import { afterEach, expect, test, vi } from "vitest";

import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import type { Observation } from "#/observation/harness.ts";
import type {
  CaseExecutionResult,
  Result,
  RunnerServices,
} from "#/orchestration/run.ts";
import {
  escapeCell,
  evaluate,
  EXIT_CODES,
  parseArgs,
  renderReport,
  resolveModel,
  runCli,
} from "#/orchestration/run.ts";

/** Mirrors MAX_OBSERVED_CHARS in run.ts: one report cell holds one line. */
const MAX_OBSERVED_CHARS = 160;
/** Comfortably longer than the cell width, so truncation must engage. */
const OVERLONG = 500;
const FIRST_UNDEFINED_TIER = 3;
const LARGE_NUMERIC_TIER = 99;
const USAGE_ERROR_LINE_COUNT = 3;
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

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    subtype: "success",
    isError: false,
    finalText: "",
    toolCalls: [],
    gitStatusBefore: { kind: "worktree", entries: "" },
    gitStatusAfter: { kind: "worktree", entries: "" },
    costUsd: 0,
    durationMs: 0,
    timedOut: false,
    ...overrides,
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
    observation: observation(observationOverrides),
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

test("no flags selects everything", () => {
  expect(parseArgs([])).toStrictEqual({ errors: [] });
});

test("--tier and --case parse into their fields", () => {
  expect(parseArgs(["--tier=1"])).toStrictEqual({ tier: 1, errors: [] });
  expect(parseArgs(["--case=path-error"])).toStrictEqual({
    caseId: "path-error",
    errors: [],
  });
  expect(parseArgs(["--tier=2", "--case=quiet-state"])).toStrictEqual({
    tier: 2,
    caseId: "quiet-state",
    errors: [],
  });
});

test("duplicate selectors use the last value", () => {
  expect(
    parseArgs([
      "--tier=1",
      "--case=first-case",
      "--tier=2",
      "--case=second-case",
    ]),
  ).toStrictEqual({ tier: 2, caseId: "second-case", errors: [] });
});

test.each([0, FIRST_UNDEFINED_TIER, LARGE_NUMERIC_TIER])(
  "numeric tier %i parses without a usage error",
  (tier) => {
    expect(parseArgs([`--tier=${tier}`])).toStrictEqual({ tier, errors: [] });
  },
);

// Malformed selectors must stay visible to the caller. Silently dropping one
// would remove the filter and turn a typo into an unconstrained paid run.
test.each([
  { label: "--tier=", args: ["--tier="] },
  { label: "--tier=abc", args: ["--tier=abc"] },
  { label: "--tier=1.5", args: ["--tier=1.5"] },
  { label: "--tier=-1", args: ["--tier=-1"] },
  { label: "--tier 1", args: ["--tier", "1"] },
  { label: "-tier=1", args: ["-tier=1"] },
  { label: "--case=", args: ["--case="] },
])("`$label` produces named parse errors", ({ args }) => {
  expect(parseArgs(args).errors).toStrictEqual(
    args.map((argument) => `unrecognized or malformed argument: ${argument}`),
  );
});

test("every unknown argument is reported while valid flags still parse", () => {
  expect(parseArgs(["--verbose", "extra", "--tier=1"])).toStrictEqual({
    tier: 1,
    errors: [
      "unrecognized or malformed argument: --verbose",
      "unrecognized or malformed argument: extra",
    ],
  });
});

test.each([
  { configuredModel: undefined, expectedModel: "sonnet" },
  { configuredModel: "", expectedModel: "sonnet" },
  { configuredModel: " ", expectedModel: " " },
  { configuredModel: "custom-model", expectedModel: "custom-model" },
])(
  "resolves configured model $configuredModel to $expectedModel",
  ({ configuredModel, expectedModel }) => {
    expect(resolveModel(configuredModel)).toBe(expectedModel);
  },
);

test("usage errors execute no cases and write no report", async () => {
  muteRunnerOutput();
  const executeCase = vi.fn<RunnerServices["executeCase"]>();
  const writeReport = vi.fn<RunnerServices["writeReport"]>();

  const exitCode = await runCli(["--tier=abc", "--unknown"], {
    evalCases: [evalCase("routing", 1)],
    executeCase,
    writeReport,
  });

  expect(exitCode).toBe(EXIT_CODES.USAGE_ERROR);
  expect(executeCase).not.toHaveBeenCalled();
  expect(writeReport).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledTimes(USAGE_ERROR_LINE_COUNT);
});

test("a numeric tier with no matches executes no cases and writes no report", async () => {
  muteRunnerOutput();
  const executeCase = vi.fn<RunnerServices["executeCase"]>();
  const writeReport = vi.fn<RunnerServices["writeReport"]>();

  const exitCode = await runCli(["--tier=0"], {
    evalCases: [evalCase("routing", 1)],
    executeCase,
    writeReport,
  });

  expect(exitCode).toBe(EXIT_CODES.NO_CASES_MATCHED);
  expect(executeCase).not.toHaveBeenCalled();
  expect(writeReport).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledWith("No cases matched.");
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

  const exitCode = await runCli([], {
    evalCases: [firstCase, secondCase],
    executeCase,
    writeReport,
  });

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

  const exitCode = await runCli([], {
    evalCases: [behavioralCase],
    executeCase,
    writeReport,
  });

  expect(exitCode).toBe(EXIT_CODES.ALL_PASSED);
  expect(executeCase).toHaveBeenCalledOnce();
  expect(writeReport).toHaveBeenCalledExactlyOnceWith(
    expect.stringContaining(
      "| mutation-scope | 2* | PASS | 1 behavioral run(s) left no trace |",
    ),
  );
});

test("a failed case returns the case-failed exit code after writing the report", async () => {
  muteRunnerOutput();
  const failingCase = evalCase("failing", 1);
  const writeReport = vi.fn<RunnerServices["writeReport"]>();

  const exitCode = await runCli([], {
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

  expect(exitCode).toBe(EXIT_CODES.CASE_FAILED);
  expect(writeReport).toHaveBeenCalledOnce();
});

test("an unexpected executor failure returns the suite-error exit code", async () => {
  muteRunnerOutput();
  const writeReport = vi.fn<RunnerServices["writeReport"]>();

  const exitCode = await runCli([], {
    evalCases: [evalCase("broken", 1)],
    executeCase: async () => {
      await Promise.resolve();
      throw new Error("executor broke");
    },
    writeReport,
  });

  expect(exitCode).toBe(EXIT_CODES.SUITE_ERROR);
  expect(writeReport).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledWith(
    "eval suite error: executor broke",
  );
});

test("a passing check becomes a PASS row carrying its observed string", () => {
  expect(evaluate(() => "Skill invoked")).toStrictEqual({
    status: "PASS",
    observed: "Skill invoked",
  });
});

test("a thrown assertion becomes a FAIL row with its first line only", () => {
  const { status, observed } = evaluate(() => {
    throw new Error("expected 3 lines, got 5\n  detail\n  more detail");
  });

  expect(status).toBe("FAIL");
  // A report cell holds one line; the rest would break the table.
  expect(observed).toBe("expected 3 lines, got 5");
});

test("a long failure message is truncated to the cell width", () => {
  const { observed } = evaluate(() => {
    throw new Error("x".repeat(OVERLONG));
  });

  expect(observed).toHaveLength(MAX_OBSERVED_CHARS);
});

test("a thrown non-Error still produces a FAIL row", () => {
  // A case check is arbitrary user code, so the runner cannot assume the thrown
  // value is an Error; a bare string must still become a row, not crash runCli().
  expect(
    evaluate(() => {
      // oxlint-disable-next-line typescript/only-throw-error -- Throwing a non-Error is the condition under test: this pins the `String(error)` fallback in `evaluate`.
      throw "bare string";
    }),
  ).toStrictEqual({ status: "FAIL", observed: "bare string" });
});

test("cell escaping protects the table structure", () => {
  // An unescaped `|` would split a column; a newline would end the row.
  expect(escapeCell("a | b")).toBe("a \\| b");
  expect(escapeCell("line1\nline2")).toBe("line1 line2");
  expect(escapeCell("plain")).toBe("plain");
});

function result(overrides: Partial<Result> = {}): Result {
  return {
    id: "some-case",
    tier: "1",
    status: "PASS",
    observed: "ok",
    costUsd: 0,
    durationMs: 0,
    ...overrides,
  };
}

test("the report renders measured totals and one escaped row per result", () => {
  const report = renderReport([
    result({
      id: "a",
      tier: "2",
      status: "PASS",
      observed: "got | piped\ncontinued",
      costUsd: 0.014,
      durationMs: 1500,
    }),
    result({
      id: "mutation-scope",
      tier: "2*",
      status: "FAIL",
      observed: "scope | changed\nagain",
      costUsd: 0.006,
      durationMs: 2000,
    }),
  ]);

  expect(report).toContain("2 cases · 1 pass · 1 fail");
  expect(report).toContain("$0.02");
  expect(report).toContain("4s");
  expect(report).toContain("| a | 2 | PASS | got \\| piped continued |");
  expect(report).toContain(
    "| mutation-scope | 2* | FAIL | scope \\| changed again |",
  );
  // Committed every run, so the stamp must not churn with sub-second noise.
  expect(report).toMatch(/Run: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
});
