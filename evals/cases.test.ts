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

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import {
  cases,
  checkMutationScope,
  SKILL,
} from "#/cases/analyzing-recent-project-state.ts";
import type { GitStatus, Observation } from "#/harness.ts";

const worktree = (entries = ""): GitStatus => ({ kind: "worktree", entries });

function observe(overrides: Partial<Observation> = {}): Observation {
  return {
    exitCode: 0,
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

function caseById(id: string): EvalCase {
  const found = cases.find((c) => c.id === id);
  if (found === undefined) throw new Error(`no such case: ${id}`);
  return found;
}

/** What `runClaude` returns when the CLI could not be started at all. */
const SPAWN_FAILURE = observe({
  exitCode: null,
  subtype: "spawn_error",
  isError: true,
  finalText: "",
  costUsd: 0,
});

// The whole suite is only as trustworthy as its ability to tell "the skill
// declined" from "nothing ran". Every case must reject the latter.
test.each(cases.map((c) => c.id))(
  "`%s` fails when the CLI never started",
  (id) => {
    expect(() => caseById(id).check(SPAWN_FAILURE)).toThrow();
  },
);

test.each(cases.map((c) => c.id))("`%s` fails on a timed-out run", (id) => {
  expect(() => caseById(id).check(observe({ timedOut: true }))).toThrow();
});

test("a silent run is not a passing negative case", () => {
  // No exit code, no output, no tool calls: the shape of a run that produced
  // nothing to observe, distinct from spawn_error.
  const silent = observe({ exitCode: null, finalText: "", toolCalls: [] });

  expect(() => caseById("trigger-negative-review").check(silent)).toThrow();
});

test("a genuine decline still passes the negative routing cases", () => {
  // The run happened, ended on the budget cap, and did not route here. This is
  // the outcome the case exists to observe, so hardening must not reject it.
  const declined = observe({
    exitCode: 1,
    subtype: "error_max_budget_usd",
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
    exitCode: 1,
    subtype: "error_max_budget_usd",
    toolCalls: [{ name: "Skill", input: { skill: SKILL } }],
  });

  expect(caseById("trigger-positive").check(triggered)).toBe("Skill invoked");
});

test("the positive routing case fails when the skill never triggered", () => {
  const noTrigger = observe({
    exitCode: 1,
    subtype: "error_max_budget_usd",
    toolCalls: [{ name: "Read", input: {} }],
  });

  expect(() => caseById("trigger-positive").check(noTrigger)).toThrow(
    /skill never triggered/,
  );
});

test("the mutate case fails when the run mutated the repo", () => {
  const mutated = observe({
    exitCode: 1,
    subtype: "error_max_budget_usd",
    finalText: "done",
    toolCalls: [{ name: "Bash", input: { command: "git merge feature" } }],
  });

  expect(() => caseById("trigger-negative-mutate").check(mutated)).toThrow(
    /repo was mutated/,
  );
});

const envelope = (status: string): Observation =>
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
