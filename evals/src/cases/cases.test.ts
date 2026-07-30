// Pins the case assertions themselves -- the checks that decide whether a paid
// run passed.
//
// These run against synthetic observations, so they cost nothing, and they
// cover the failure mode a case cannot catch about itself: passing by
// observing an absence. A negative routing case asserts "no Skill call was
// made", and a run that never started satisfies that perfectly.
//
//   pnpm test

import { expect, test } from "vitest";

import type {
  CaseId,
  EnvelopeStatus,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import {
  BUDGET_STOP_SUBTYPE,
  cases,
  checkMutationScope,
  SKILL,
} from "#/cases/analyzing-recent-project-state.ts";
import type { GitStatus, Observation } from "#/observation/harness.ts";
import { QUERY_ERROR_SUBTYPE } from "#/observation/harness.ts";

const worktree = (entries = ""): GitStatus => ({ kind: "worktree", entries });

function observe(overrides: Readonly<Partial<Observation>> = {}): Observation {
  return {
    subtype: "success",
    isError: false,
    finalText: "",
    toolCalls: [],
    gitStatusBefore: worktree(),
    gitStatusAfter: worktree(),
    costUsd: 0.01,
    durationMs: 1000,
    timedOut: false,
    ...overrides,
  };
}

function caseById(caseId: CaseId): EvalCase {
  const matchingCase = cases.find((evalCase) => evalCase.id === caseId);
  if (matchingCase == null) throw new Error(`no such case: ${caseId}`);
  return matchingCase;
}

/** What `runClaude` returns when the query never produced a result message. */
const QUERY_FAILURE = observe({
  subtype: QUERY_ERROR_SUBTYPE,
  isError: true,
  finalText: "bundled CLI failed to start",
  costUsd: 0,
});

/**
 * What the SDK returns when the login has expired: a clean result, a `success`
 * subtype, and the auth message where the answer belongs. Nothing about this
 * shape says "no model was reached" except `is_error`.
 */
const AUTH_FAILURE = observe({
  subtype: "success",
  isError: true,
  finalText:
    "Failed to authenticate: OAuth session expired and could not be refreshed",
  toolCalls: [],
  costUsd: 0,
});

// The whole suite is only as trustworthy as its ability to tell "the skill
// declined" from "nothing ran". Every case must reject the latter.
test.each(cases.map((evalCase) => evalCase.id))(
  "`%s` fails when the query produced no result",
  (caseId) => {
    expect(() => caseById(caseId).check(QUERY_FAILURE)).toThrow();
  },
);

test.each(cases.map((evalCase) => evalCase.id))(
  "`%s` fails on a timed-out run",
  (caseId) => {
    expect(() => caseById(caseId).check(observe({ timedOut: true }))).toThrow();
  },
);

// The regression this file exists for, in its most dangerous form: an expired
// login once passed all three negative cases, because a run that reached no
// model calls no skill and mutates nothing.
test.each(cases.map((evalCase) => evalCase.id))(
  "`%s` fails when authentication failed",
  (caseId) => {
    expect(() => caseById(caseId).check(AUTH_FAILURE)).toThrow(
      /reported a failed run/,
    );
  },
);

test("mutation-scope fails when authentication failed", () => {
  // Derived from the tier-2 observations, so it inherits the same blind spot:
  // a run that never happened left no trace, and that must not read as proof
  // the read-only contract held.
  expect(() => checkMutationScope([AUTH_FAILURE])).toThrow();
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

  expect(caseById("trigger-positive").check(lateFailure)).toBe("Skill invoked");
});

test("a silent run is not a passing negative case", () => {
  // No verdict, no output, no tool calls: a shape no real query produces --
  // every result message carries a subtype, and a query without a result maps
  // to QUERY_ERROR_SUBTYPE -- so it must not pass as a run that happened.
  const silent = observe({ subtype: "", finalText: "", toolCalls: [] });

  expect(() => caseById("trigger-negative-review").check(silent)).toThrow();
});

test("a genuine decline still passes the negative routing cases", () => {
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

  expect(caseById("trigger-negative-review").check(declined)).toBe(
    "no trigger",
  );
  expect(caseById("trigger-negative-mutate").check(declined)).toBe(
    "no trigger; no mutation",
  );
});

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

const envelope = (status: EnvelopeStatus): Observation =>
  observe({
    finalText: `RECENT_STATE: ${status}\nReason: path does not exist\nNext step: supply a real path`,
  });

test("an envelope case passes on its exact three-line envelope", () => {
  expect(caseById("path-error").check(envelope("PATH_ERROR"))).toBe(
    "PATH_ERROR, 3-line envelope",
  );
  expect(caseById("gate-envelope").check(envelope("NOT_GIT"))).toBe(
    "NOT_GIT, 3-line envelope",
  );
});

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

test("mutation-scope fails when any behavioral run left a trace", () => {
  const clean = observe();
  const traced = observe({
    toolCalls: [{ name: "Write", input: { file_path: "/repo/x" } }],
  });

  expect(checkMutationScope([clean, clean])).toBe(
    "2 behavioral run(s) left no trace",
  );
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
