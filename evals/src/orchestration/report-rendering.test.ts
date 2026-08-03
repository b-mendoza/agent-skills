// Pins report rendering: measured totals, one row per result, and the cell
// escaping that keeps a stray `|` or line ending from breaking the table.
//
// These pure-helper tests spend no tokens and write no report file.
//
//   pnpm test

import { expect, test } from "vitest";

import type { Result } from "#/orchestration/report.ts";
import { renderReport } from "#/orchestration/report.ts";

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

test("carriage-return line endings render inside a single report cell", () => {
  const report = renderReport([
    result({ observed: "lone\rreturn and paired\r\nreturn" }),
  ]);

  expect(report).toContain(
    "| some-case | 1 | PASS | lone return and paired return |",
  );
  expect(report).not.toContain("\r");
});

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
