import { expect, test } from "vitest";

import { observe } from "#/cases/case-test-support.ts";

import { readResults, resultExitCode } from "./results.ts";

const FIRST = 0;
const SECOND = 1;
const LAST = -1;
const REPORT_ROWS = 11;
const SKIPPED_ROWS = 10;
const FAIL_CODE = 1;
const PASS_CODE = 0;

function row(caseId: string, repeatIndex: number, success = true) {
  return {
    testCase: { vars: { caseId } },
    success,
    failureReason: success ? PASS_CODE : FAIL_CODE,
    response: {
      metadata: {
        observation: observe({ costUsd: 0.05, durationMs: 1000 }),
        repeatIndex,
      },
    },
    gradingResult: {
      reason: "All assertions passed",
      componentResults: [
        { reason: success ? "Skill invoked" : "check failed" },
      ],
    },
  };
}

function report(rows: unknown[]) {
  return readResults({ results: { results: rows } });
}

test("groups attempts, retains canonical observed text and fills every skipped case", () => {
  const rows = report([
    row("trigger-positive", FIRST),
    row("trigger-positive", SECOND, false),
  ]);
  expect(rows).toHaveLength(REPORT_ROWS);
  expect(rows[FIRST]).toMatchObject({
    id: "trigger-positive",
    status: "DEGRADED",
    score: 50,
    attemptsPassed: 1,
    attemptsRun: 2,
    observed: "check failed",
    costUsd: 0.1,
    durationMs: 2000,
  });
  expect(rows.filter((result) => result.status === "NOT_RUN")).toHaveLength(
    SKIPPED_ROWS,
  );
  expect(report([row("trigger-positive", FIRST)])[FIRST]?.observed).toBe(
    "Skill invoked",
  );
});

test.each([
  { successes: [true, true], code: 0 },
  { successes: [false, false], code: 1 },
  { successes: [true, false], code: 1 },
  { successes: [], code: 2 },
])("maps executed attempts $successes to exit $code", ({ successes, code }) => {
  expect(
    resultExitCode(
      report(
        successes.map((pass, index) => row("trigger-positive", index, pass)),
      ),
    ),
  ).toBe(code);
});

test("derives mutation scope by repeat index despite out-of-order completion", () => {
  const dirty = row("snapshot-dirty", FIRST);
  dirty.response.metadata.observation.toolCalls = [
    { name: "Write", input: {} },
  ];
  const routing = row("trigger-positive", SECOND);
  routing.response.metadata.observation.toolCalls = [
    { name: "Write", input: {} },
  ];
  const rows = report([
    row("quiet-state", SECOND),
    dirty,
    row("quiet-state", FIRST),
    row("snapshot-dirty", SECOND),
    routing,
  ]);
  expect(rows.at(LAST)).toMatchObject({
    id: "mutation-scope",
    tier: "2*",
    status: "DEGRADED",
    score: 50,
    attemptsPassed: 1,
    attemptsRun: 2,
    costUsd: 0,
    durationMs: 0,
    observed: "read-only contract violated:",
  });
  expect(resultExitCode(rows)).toBe(FAIL_CODE);
});

test("provider errors abort report processing instead of becoming case failures", () => {
  expect(() =>
    report([
      {
        ...row("trigger-positive", FIRST),
        failureReason: 2,
        response: { error: "SDK failed" },
        error: "SDK failed",
      },
    ]),
  ).toThrow("SDK failed");
});

test.each([
  null,
  { results: { results: [row("unknown", FIRST)] } },
  {
    results: { results: [{ ...row("trigger-positive", FIRST), response: {} }] },
  },
  {
    results: {
      results: [{ ...row("trigger-positive", FIRST), gradingResult: {} }],
    },
  },
])("rejects invalid result data %#", (input) => {
  expect(() => readResults(input)).toThrow();
});
