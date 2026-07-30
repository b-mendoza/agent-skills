// Pins check normalization, report escaping, and report rendering.
//
// These pure-helper tests spend no tokens and write no report file.
//
//   pnpm test

import { expect, test } from "vitest";

import type { Result } from "#/orchestration/run.ts";
import { escapeCell, evaluate, renderReport } from "#/orchestration/run.ts";

/** Mirrors MAX_OBSERVED_CHARS in case-execution.ts: one report cell holds one line. */
const MAX_OBSERVED_CHARS = 160;
/** Comfortably longer than the cell width, so truncation must engage. */
const OVERLONG = 500;

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
