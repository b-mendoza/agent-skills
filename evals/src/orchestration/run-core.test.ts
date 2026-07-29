// Pins the runner's pure decision logic: flag parsing, check normalization,
// report escaping, and report rendering.
//
// These are contracts other tooling reads -- `--case=` selects what runs, the
// exit code gates CI, and report.md is committed so a behavior change shows up
// as a diff. Importing run.ts is safe because its entry point is guarded by
// `import.meta.main`; nothing here spends a token.
//
//   pnpm test

import { expect, test } from "vitest";

import type { Result } from "#/orchestration/run.ts";
import {
  escapeCell,
  evaluate,
  parseArgs,
  renderReport,
} from "#/orchestration/run.ts";

/** Mirrors MAX_OBSERVED_CHARS in run.ts: one report cell holds one line. */
const MAX_OBSERVED_CHARS = 160;
/** Comfortably longer than the cell width, so truncation must engage. */
const OVERLONG = 500;

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
    args.map((arg) => `unrecognized or malformed argument: ${arg}`),
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
  // value is an Error; a bare string must still become a row, not crash main().
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
