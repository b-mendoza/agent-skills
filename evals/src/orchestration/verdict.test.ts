// Pins how a case check's outcome becomes attempt data -- a returned string
// passes, a thrown value fails and is trimmed to fit one report cell -- and
// how a case's attempts fold into its scored report row.
//
// These pure-helper tests spend no tokens and write no report file.
//
//   pnpm test

import { expect, test } from "vitest";

import type { AttemptResult } from "#/orchestration/report.ts";
import {
  aggregateAttempts,
  evaluate,
  MAX_OBSERVED_CHARS,
  notRunResult,
} from "#/orchestration/verdict.ts";

/** Comfortably longer than the cell width, so truncation must engage. */
const OVERLONG = 500;

function injectThrownValue(value: unknown): never {
  const generator = (function* () {
    yield undefined;
  })();
  generator.next();
  while (true) generator.throw(value);
}

function attempt(overrides: Partial<AttemptResult> = {}): AttemptResult {
  return {
    id: "some-case",
    tier: "2",
    status: "PASS",
    observed: "ok",
    costUsd: 0,
    durationMs: 0,
    ...overrides,
  };
}

test("a passing check becomes a PASS attempt carrying its observed string", () => {
  expect(evaluate(() => "Skill invoked")).toStrictEqual({
    status: "PASS",
    observed: "Skill invoked",
  });
});

test("a thrown assertion becomes a FAIL attempt with its first line only", () => {
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

test("a thrown non-Error still produces a FAIL attempt", () => {
  // A case check is arbitrary user code, so the runner cannot assume the thrown
  // value is an Error; a bare string must still become a row, not crash runCli().
  expect(evaluate(() => injectThrownValue("bare string"))).toStrictEqual({
    status: "FAIL",
    observed: "bare string",
  });
});

test("attempts that all pass aggregate to PASS with a full score", () => {
  const aggregated = aggregateAttempts([
    attempt({ observed: "first", costUsd: 0.5, durationMs: 1000 }),
    attempt({ observed: "second", costUsd: 0.25, durationMs: 500 }),
  ]);

  expect(aggregated).toStrictEqual({
    id: "some-case",
    tier: "2",
    status: "PASS",
    score: 100,
    attemptsPassed: 2,
    attemptsRun: 2,
    observed: "second",
    costUsd: 0.75,
    durationMs: 1500,
  });
});

test("attempts that all fail aggregate to FAIL with a zero score and the first failure", () => {
  const aggregated = aggregateAttempts([
    attempt({ status: "FAIL", observed: "first failure" }),
    attempt({ status: "FAIL", observed: "second failure" }),
  ]);

  expect(aggregated).toMatchObject({
    status: "FAIL",
    score: 0,
    attemptsPassed: 0,
    attemptsRun: 2,
    observed: "first failure",
  });
});

test("mixed attempts aggregate to DEGRADED with a pass-rate score", () => {
  const aggregated = aggregateAttempts([
    attempt(),
    attempt({ status: "FAIL", observed: "flaked here" }),
    attempt(),
    attempt(),
    attempt(),
  ]);

  expect(aggregated).toMatchObject({
    status: "DEGRADED",
    score: 80,
    attemptsPassed: 4,
    attemptsRun: 5,
    // The first failure is what a reader of a flaky row needs to see.
    observed: "flaked here",
  });
});

// With enough attempts, rounding alone would show 100 for 199/200 or 0 for
// 1/201 -- a terminal score the DEGRADED status contradicts.
const NEARLY_ALL = 199;
const NEARLY_NONE = 200;
test("a DEGRADED score never rounds to a terminal 0 or 100", () => {
  const oneFlake = aggregateAttempts([
    ...Array.from({ length: NEARLY_ALL }, () => attempt()),
    attempt({ status: "FAIL", observed: "one flake" }),
  ]);
  const onePass = aggregateAttempts([
    attempt(),
    ...Array.from({ length: NEARLY_NONE }, () =>
      attempt({ status: "FAIL", observed: "failed" }),
    ),
  ]);

  expect(oneFlake).toMatchObject({ status: "DEGRADED", score: 99 });
  expect(onePass).toMatchObject({ status: "DEGRADED", score: 1 });
});

test("a single attempt aggregates to its own status", () => {
  expect(aggregateAttempts([attempt()])).toMatchObject({
    status: "PASS",
    score: 100,
    attemptsPassed: 1,
    attemptsRun: 1,
  });
});

test("aggregating zero attempts is a defect, not a quiet row", () => {
  expect(() => aggregateAttempts([])).toThrow(/at least one attempt/);
});

test("a NOT_RUN row carries a null score, not a zero one", () => {
  // 0 would read as "ran and failed every attempt"; an unexecuted case
  // measured nothing.
  expect(notRunResult("skipped-case", "1")).toStrictEqual({
    id: "skipped-case",
    tier: "1",
    status: "NOT_RUN",
    score: null,
    attemptsPassed: 0,
    attemptsRun: 0,
    observed: "not executed by this run",
    costUsd: 0,
    durationMs: 0,
  });
});
