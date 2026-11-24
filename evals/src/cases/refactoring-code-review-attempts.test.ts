import { expect, test } from "vitest";

import { HANDOFFS } from "#/cases/refactoring-code-regression-fixtures.ts";
import { lifecycleReportEvidence } from "#/cases/refactoring-code-validation-evidence.ts";
import type { ToolCall } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const run = `${HANDOFFS}amendment`;
const first = `${run}/review-1.txt`;
const second = `${run}/review-2.txt`;
const validator = ".claude/skills/refactoring-code/scripts/validate-report.py";

function dispatch(report: string, isError = false): ToolCall {
  return {
    name: "Agent",
    input: {
      subagent_type: "refactor-reviewer",
      prompt: `REPORT_PATH: ${report}`,
    },
    result: {
      content: isError ? "Agent type unavailable" : "review complete",
      isError,
      truncated: false,
    },
  };
}

function write(report: string): ToolCall {
  return { name: "Write", input: { file_path: report, content: "review" } };
}

function validate(report: string, status = "PASS"): ToolCall {
  return {
    name: "Bash",
    input: {
      command: `python3 ${validator} report refactor-reviewer ${report} ${run}`,
    },
    result: { content: status, isError: false, truncated: false },
  };
}

const retry: ToolCall = {
  name: "Bash",
  input: {
    command: `python3 ${validator} retry refactor-reviewer 0 report-transient`,
  },
  result: { content: "RETRY", isError: false, truncated: false },
};

function review(toolCalls: ToolCall[]) {
  return lifecycleReportEvidence(
    createObservation({
      toolCalls,
      repoFiles: { [first]: "review", [second]: "review" },
      finalText: "Dispatch method: inline",
    }),
  );
}

test("accepts validation continued on the next line after &&", () => {
  const pass = validate(second);
  const command = `true &&\n  ${String(pass.input["command"])}\n`;
  expect(review([write(second), { ...pass, input: { command } }]).report).toBe(
    second,
  );
});

test("accepts the parent revalidating an unchanged inline retry at a fresh path", () => {
  expect(
    review([
      write(first),
      validate(first, "ERROR"),
      retry,
      write(second),
      validate(second),
      validate(second),
    ]).report,
  ).toBe(second);
});

test("accepts a failed dispatch followed by a fresh validated inline retry", () => {
  const hostRetry = {
    ...retry,
    input: {
      command: `python3 ${validator} retry refactor-reviewer 0 host-transient`,
    },
  };
  expect(
    review([
      dispatch(first, true),
      write(first),
      hostRetry,
      write(second),
      validate(second),
    ]).report,
  ).toBe(second);
});

test("rejects a first validation that did not use its dispatched path even if the retry passes", () => {
  expect(() =>
    review([
      dispatch(`${run}/assigned.txt`),
      write(first),
      validate(first, "ERROR"),
      retry,
      dispatch(second),
      write(second),
      validate(second),
    ]),
  ).toThrow();
});

test("rejects a reused dispatched attempt even if the final attempt has a fresh path", () => {
  expect(() =>
    review([
      dispatch(first),
      write(first),
      validate(first, "ERROR"),
      retry,
      dispatch(first),
      write(first),
      validate(first, "FAIL"),
      { name: "Edit", input: { file_path: "src/a.js" } },
      dispatch(second),
      write(second),
      validate(second),
    ]),
  ).toThrow();
});

test("does not credit an earlier PASS when a later inline retry has no validated output", () => {
  expect(() =>
    review([write(first), validate(first), retry, write(second)]),
  ).toThrow();
});

test("rejects overwriting an incomplete inline report with no first validation", () => {
  expect(() =>
    review([write(first), retry, write(first), validate(first)]),
  ).toThrow();
});

test("rejects reusing the first inline report path after a transient retry", () => {
  expect(() =>
    review([
      write(first),
      validate(first, "ERROR"),
      retry,
      write(first),
      validate(first),
    ]),
  ).toThrow();
});
