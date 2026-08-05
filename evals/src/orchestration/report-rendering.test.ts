// Pins report rendering: measured totals, status counts, mean score, one row
// per result, and the cell escaping that keeps a stray `|` or line ending from
// breaking the table.
//
// These pure-helper tests spend no tokens and write no report file.
//
//   pnpm test

import { expect, test } from "vitest";

import type { Result } from "#/orchestration/report.ts";
import { formatCaseResultLine, renderReport } from "#/orchestration/report.ts";
import { notRunResult } from "#/orchestration/verdict.ts";

function result(overrides: Partial<Result> = {}): Result {
  return {
    id: "some-case",
    tier: "1",
    status: "PASS",
    score: 100,
    attemptsPassed: 1,
    attemptsRun: 1,
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
    "| some-case | 1 | PASS | 100 | 1/1 | lone return and paired return |",
  );
  expect(report).not.toContain("\r");
});

test("the report renders measured totals and one escaped row per result", () => {
  const report = renderReport([
    result({
      id: "a",
      tier: "2",
      status: "PASS",
      score: 100,
      attemptsPassed: 5,
      attemptsRun: 5,
      observed: "got | piped\ncontinued",
      costUsd: 0.014,
      durationMs: 1500,
    }),
    result({
      id: "mutation-scope",
      tier: "2*",
      status: "FAIL",
      score: 0,
      attemptsPassed: 0,
      attemptsRun: 5,
      observed: "scope | changed\nagain",
      costUsd: 0.006,
      durationMs: 2000,
    }),
  ]);

  expect(report).toContain(
    "2 cases · 1 pass · 0 degraded · 1 fail · 0 not run · mean score 50",
  );
  expect(report).toContain("$0.02");
  expect(report).toContain("4s");
  expect(report).toContain(
    "| a | 2 | PASS | 100 | 5/5 | got \\| piped continued |",
  );
  expect(report).toContain(
    "| mutation-scope | 2* | FAIL | 0 | 0/5 | scope \\| changed again |",
  );
  // Committed every run, so the stamp must not churn with sub-second noise.
  expect(report).toMatch(/Run: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
});

test("a degraded row renders its pass-rate score and counts", () => {
  const report = renderReport([
    result({
      id: "flaky",
      status: "DEGRADED",
      score: 60,
      attemptsPassed: 3,
      attemptsRun: 5,
      observed: "flaked on attempt 2",
    }),
  ]);

  expect(report).toContain(
    "1 cases · 0 pass · 1 degraded · 0 fail · 0 not run · mean score 60",
  );
  expect(report).toContain(
    "| flaky | 1 | DEGRADED | 60 | 3/5 | flaked on attempt 2 |",
  );
});

test("a NOT_RUN row renders empty score and runs cells and stays out of the mean", () => {
  const report = renderReport([
    result({ id: "executed", score: 100 }),
    notRunResult("skipped-case", "2"),
  ]);

  // The mean averages measured scores only; a null score is not a zero.
  expect(report).toContain(
    "2 cases · 1 pass · 0 degraded · 0 fail · 1 not run · mean score 100",
  );
  expect(report).toContain(
    "| skipped-case | 2 | NOT_RUN | — | — | not executed by this run |",
  );
});

test("a run with no scored rows renders an empty mean score", () => {
  const report = renderReport([notRunResult("skipped-case", "1")]);

  expect(report).toContain("mean score —");
});

test("the per-case summary line carries status, score, counts, and totals", () => {
  const summaryLine = formatCaseResultLine(
    result({
      status: "DEGRADED",
      score: 80,
      attemptsPassed: 4,
      attemptsRun: 5,
      costUsd: 1.25,
      durationMs: 10_000,
    }),
  );

  expect(summaryLine).toBe("DEGRADED score 80 (4/5 passed) 10s $1.25");
});

test("the summary line for a NOT_RUN row is its status alone", () => {
  expect(formatCaseResultLine(notRunResult("mutation-scope", "2*"))).toBe(
    "NOT_RUN",
  );
});
