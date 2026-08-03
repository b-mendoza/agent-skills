// Pins the case assertions themselves -- the checks that decide whether a paid
// run passed.
//
// These run against synthetic observations, so they cost nothing, and they
// cover the failure mode a case cannot catch about itself: passing by
// observing an absence. A negative routing case asserts "no Skill call was
// made", and a run that never started satisfies that perfectly.

import { describe, expect, test } from "vitest";

import type {
  CaseId,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import { cases, SKILL } from "#/cases/analyzing-recent-project-state.ts";
import type { EnvelopeStatus } from "#/cases/analyzing-recent-project-state-checks.ts";
import {
  assertRunHappened,
  BUDGET_STOP_SUBTYPE,
  checkMutationScope,
} from "#/cases/analyzing-recent-project-state-checks.ts";
import { QUERY_ERROR_SUBTYPE } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import type { Observation } from "#/observation/observation-types.ts";

function observe(overrides: Readonly<Partial<Observation>> = {}): Observation {
  return createObservation({ costUsd: 0.01, durationMs: 1000, ...overrides });
}

function caseById(caseId: CaseId): EvalCase {
  const matchingCase = cases.find((evalCase) => evalCase.id === caseId);
  if (matchingCase == null) throw new Error(`no such case: ${caseId}`);
  return matchingCase;
}

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

const envelope = (status: EnvelopeStatus): Observation =>
  observe({
    finalText: `RECENT_STATE: ${status}\nReason: path does not exist\nNext step: supply a real path`,
  });

const QUIET_STATE_SNAPSHOT = `# Project State Snapshot

## 1. Executive Summary

No recent changes were found in the defined evidence window.

## 2. Git State

The working tree is clean and the evidence window contains no recent changes.

Assumptions: none
Execution mode: isolated

## 9. Ranked Next Actions

- nice-to-have: Continue normal development when new work is available.

## 10. Final Developer Briefing

There are no recent changes to review or hand off.`;

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

describe("envelope", () => {
  test.each([
    {
      caseId: "path-error",
      status: "PATH_ERROR",
      expectedOutcome: "PATH_ERROR, 3-line envelope",
    },
    {
      caseId: "gate-envelope",
      status: "NOT_GIT",
      expectedOutcome: "NOT_GIT, 3-line envelope",
    },
  ] as const)(
    "`$caseId` passes on its exact `$status` three-line envelope",
    ({ caseId, status, expectedOutcome }) => {
      expect(caseById(caseId).check(envelope(status))).toBe(expectedOutcome);
    },
  );

  test("an envelope case fails on the wrong status", () => {
    expect(() => caseById("path-error").check(envelope("NOT_GIT"))).toThrow();
  });

  test("an envelope case fails on a fourth line", () => {
    const chatty = observe({
      finalText:
        "RECENT_STATE: PATH_ERROR\nReason: missing\nNext step: fix it\nHope that helps!",
    });

    expect(() => caseById("path-error").check(chatty)).toThrow();
  });

  test.each([
    {
      label: "an empty Reason value",
      finalText:
        "RECENT_STATE: PATH_ERROR\nReason:\nNext step: supply a real path",
      expectedError: /Reason: \\S\+/,
    },
    {
      label: "the wrong first-line label",
      finalText:
        "STATE: PATH_ERROR\nReason: path does not exist\nNext step: supply a real path",
      expectedError: /RECENT_STATE: PATH_ERROR/,
    },
    {
      label: "swapped Reason and Next step lines",
      finalText:
        "RECENT_STATE: PATH_ERROR\nNext step: supply a real path\nReason: path does not exist",
      expectedError: /Reason: \\S\+/,
    },
    {
      label: "a missing Next step prefix",
      finalText:
        "RECENT_STATE: PATH_ERROR\nReason: path does not exist\nSupply a real path",
      expectedError: /Next step: \\S\+/,
    },
  ])("path-error rejects $label", ({ finalText, expectedError }) => {
    expect(() => caseById("path-error").check(observe({ finalText }))).toThrow(
      expectedError,
    );
  });
});

describe("quiet state", () => {
  test("quiet-state passes on the short-form snapshot", () => {
    const quietState = observe({ finalText: QUIET_STATE_SNAPSHOT });

    expect(caseById("quiet-state").check(quietState)).toBe(
      "short form; no section 4; no ERROR",
    );
  });

  test.each([
    {
      label: "an output missing the snapshot header",
      finalText: QUIET_STATE_SNAPSHOT.replace("# Project State Snapshot\n", ""),
      expectedError: /no snapshot report was returned/,
    },
    {
      label: "an output containing RECENT_STATE: ERROR",
      finalText: `${QUIET_STATE_SNAPSHOT}\n\nRECENT_STATE: ERROR`,
      expectedError: /quiet state escalated/,
    },
    {
      label: "a long-form section 4",
      finalText: `${QUIET_STATE_SNAPSHOT}\n\n## 4. Behavioral Impact`,
      expectedError: /short form included a section it should have omitted/,
    },
    {
      label: "a heading-only output",
      finalText: "# Project State Snapshot",
      expectedError: /short form omitted section 1/,
    },
  ])("quiet-state rejects $label", ({ finalText, expectedError }) => {
    expect(() => caseById("quiet-state").check(observe({ finalText }))).toThrow(
      expectedError,
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
