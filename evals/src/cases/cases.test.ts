// Pins the case assertions themselves -- the checks that decide whether a paid
// run passed.
//
// These run against synthetic observations, so they cost nothing, and they
// cover the failure mode a case cannot catch about itself: passing by
// observing an absence. A negative routing case asserts "no Skill call was
// made", and a run that never started produces exactly that absence. The
// behavioral (tier-2) case assertions live in `cases-behavioral.test.ts`;
// shared synthetic fixtures live in `case-test-support.ts`.

import { describe, expect, test } from "vitest";

import { cases, SKILL } from "#/cases/analyzing-recent-project-state.ts";
import {
  assertRunHappened,
  BUDGET_STOP_SUBTYPE,
  checkMutationScope,
} from "#/cases/analyzing-recent-project-state-checks.ts";
import { caseById, observe } from "#/cases/case-test-support.ts";
import { QUERY_ERROR_SUBTYPE } from "#/observation/agent-query.ts";

/** What `observeClaude` yields when the query never produced a result message. */
const QUERY_FAILURE = observe({
  subtype: QUERY_ERROR_SUBTYPE,
  isError: true,
  finalText: "bundled CLI failed to start",
  costUsd: 0,
});

/** Authentication can report a `success` subtype with `is_error` and no work. */
const AUTH_FAILURE = observe({
  subtype: "success",
  isError: true,
  finalText:
    "Failed to authenticate: OAuth session expired and could not be refreshed",
  toolCalls: [],
  costUsd: 0,
});

const invalidRunScenarios = [
  { label: "when the query produced no result", observation: QUERY_FAILURE },
  { label: "on a timed-out run", observation: observe({ timedOut: true }) },
  // Expired login once passed all three negative cases because it did no work.
  {
    label: "when authentication failed",
    observation: AUTH_FAILURE,
    expectedError: /reported a failed run/,
  },
] as const;

// Every case must reject every invalid run shape.
const invalidRunChecks = cases.flatMap((evalCase) =>
  invalidRunScenarios.map((scenario) => ({ caseId: evalCase.id, ...scenario })),
);

describe("run validity", () => {
  test.each(invalidRunChecks)("`$caseId` fails $label", (invalidRunCheck) => {
    const runCheck = () =>
      caseById(invalidRunCheck.caseId).check(invalidRunCheck.observation);
    const expectedError =
      "expectedError" in invalidRunCheck
        ? invalidRunCheck.expectedError
        : undefined;
    expect(runCheck).toThrow(expectedError);
  });

  test("an error after the run did real work is left to the case to judge", () => {
    // Not every `is_error` means nothing happened. A run that already called
    // tools produced observations, so the case's own assertions decide it --
    // otherwise a late API hiccup would mask a genuine result.
    const lateFailure = observe({
      isError: true,
      subtype: "error_during_execution",
      finalText: "",
      toolCalls: [{ name: "Skill", input: { skill: SKILL } }],
    });

    expect(caseById("trigger-positive").check(lateFailure)).toBe(
      "Skill invoked",
    );
  });

  test("a cost-only late error is left to the case to judge", () => {
    const costOnlyLateFailure = observe({
      isError: true,
      subtype: "error_during_execution",
      finalText: "",
      toolCalls: [],
      costUsd: 0.01,
    });

    expect(() => {
      assertRunHappened(costOnlyLateFailure);
    }).not.toThrow();
    expect(caseById("trigger-negative-review").check(costOnlyLateFailure)).toBe(
      "no trigger",
    );
  });

  test("a silent run is not a passing negative case", () => {
    // No verdict, no output, no tool calls: a shape no real query produces --
    // every result message carries a subtype, and a query without a result maps
    // to QUERY_ERROR_SUBTYPE -- so it must not pass as a run that happened.
    const silent = observe({ subtype: "", finalText: "", toolCalls: [] });

    expect(() => caseById("trigger-negative-review").check(silent)).toThrow();
  });
});

describe("routing", () => {
  test.each([
    {
      label: "a line-by-line review request",
      caseId: "trigger-negative-review",
      expectedOutcome: "no trigger",
    },
    {
      label: "a mutating request",
      caseId: "trigger-negative-mutate",
      expectedOutcome: "no trigger; no mutation",
    },
    {
      label: "a session-handoff request",
      caseId: "trigger-negative-handoff",
      expectedOutcome: "no trigger",
    },
    {
      label: "a PR-review request",
      caseId: "trigger-negative-pr-review",
      expectedOutcome: "no trigger",
    },
  ] as const)(
    "a genuine decline still passes for $label",
    ({ caseId, expectedOutcome }) => {
      // The run happened, ended on the budget cap, and did not route here. This is
      // the outcome the case exists to observe, so hardening must not reject it.
      // `isError` is set: the SDK reports the budget cap as a failed run, so the
      // hardening above has to tolerate it or tier 1 could never pass.
      const declined = observe({
        subtype: BUDGET_STOP_SUBTYPE,
        isError: true,
        finalText: "I'll review the diff directly.",
        toolCalls: [{ name: "Read", input: { file_path: "/repo/a.txt" } }],
      });

      expect(caseById(caseId).check(declined)).toBe(expectedOutcome);
    },
  );

  test("a genuine trigger still passes the positive routing case", () => {
    const triggered = observe({
      subtype: BUDGET_STOP_SUBTYPE,
      isError: true,
      toolCalls: [{ name: "Skill", input: { skill: SKILL } }],
    });

    expect(caseById("trigger-positive").check(triggered)).toBe("Skill invoked");
  });

  test("a budget stop is a real decline even when it books nothing", () => {
    // The cap can bite before the SDK reports a cost or a tool call, which is
    // the one shape an auth failure and a deliberate stop share. The subtype is
    // all that separates them, so it has to be enough on its own.
    const stoppedEarly = observe({
      subtype: BUDGET_STOP_SUBTYPE,
      isError: true,
      finalText: "",
      toolCalls: [],
      costUsd: 0,
    });

    expect(caseById("trigger-negative-review").check(stoppedEarly)).toBe(
      "no trigger",
    );
  });

  test("the positive routing case fails when the skill never triggered", () => {
    const noTrigger = observe({
      subtype: BUDGET_STOP_SUBTYPE,
      toolCalls: [{ name: "Read", input: {} }],
    });

    expect(() => caseById("trigger-positive").check(noTrigger)).toThrow(
      /skill never triggered/,
    );
  });

  test("the mutate case fails when the run mutated the repo", () => {
    const mutated = observe({
      subtype: BUDGET_STOP_SUBTYPE,
      finalText: "done",
      toolCalls: [{ name: "Bash", input: { command: "git merge feature" } }],
    });

    expect(() => caseById("trigger-negative-mutate").check(mutated)).toThrow(
      /repo was mutated/,
    );
  });

  test("a routing-tier case rejects a full report", () => {
    const fullReport = observe({
      subtype: BUDGET_STOP_SUBTYPE,
      isError: true,
      finalText: "# Project State Snapshot\n\n## 1. Executive Summary",
      toolCalls: [],
      costUsd: 0,
    });

    expect(() => caseById("trigger-negative-review").check(fullReport)).toThrow(
      /unexpectedly produced a full report/,
    );
  });
});

describe("mutation scope", () => {
  test("mutation-scope fails when authentication failed", () => {
    // Derived from the tier-2 observations, so it inherits the same blind spot:
    // a run that never happened left no trace, and that must not read as proof
    // the read-only contract held.
    expect(() => checkMutationScope([AUTH_FAILURE])).toThrow();
  });

  test("mutation-scope passes when behavioral runs left no trace", () => {
    const clean = observe();

    expect(checkMutationScope([clean, clean])).toBe(
      "2 behavioral run(s) left no trace",
    );
  });

  test("mutation-scope rejects an empty observation list", () => {
    expect(() => checkMutationScope([])).toThrow(
      /requires at least one behavioral observation/,
    );
  });

  test("mutation-scope fails when any behavioral run left a trace", () => {
    const clean = observe();
    const traced = observe({
      toolCalls: [{ name: "Write", input: { file_path: "/repo/x" } }],
    });

    expect(() => checkMutationScope([clean, traced])).toThrow(
      /read-only contract violated/,
    );
  });

  test("mutation-scope fails when the evidence could not be collected", () => {
    // An unreadable sample is not a clean one; it must not read as no trace.
    const unsampled = observe({
      gitStatusBefore: { kind: "unreadable", reason: "ENOENT" },
      gitStatusAfter: { kind: "unreadable", reason: "ENOENT" },
    });

    expect(() => checkMutationScope([unsampled])).toThrow(
      /read-only contract violated/,
    );
  });
});
