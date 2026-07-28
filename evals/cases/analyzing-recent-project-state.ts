// Eval cases for `analyzing-recent-project-state`. This file is the source of
// truth: every case here runs, and a case that does not run does not exist.
//
// Every assertion is an observable fact: a tool call that appears in the event
// stream, literal text in the final result, or a git status delta. None of them
// ask the agent whether it complied.

import assert from "node:assert/strict";

import type { FixtureKind } from "#/fixtures.ts";
import type { Observation, ToolCall } from "#/harness.ts";
import { mutationEvidence, skillInvocations } from "#/harness.ts";

export const SKILL = "analyzing-recent-project-state";

/** Status, reason, next step — the escalation envelope's fixed shape. */
const ENVELOPE_LINES = 3;

/** Names the tools a run actually called, for a failure message. */
function formatToolNames(toolCalls: readonly ToolCall[]): string {
  const names = toolCalls.map((c) => c.name).join(", ");
  return names === "" ? "none" : names;
}

export interface CaseContext {
  missingPath: string;
  notGitPath: string;
}

export interface EvalCase {
  id: string;
  /** 1 = budget-capped routing check. 2 = full behavioral run. */
  tier: 1 | 2;
  fixture: FixtureKind;
  /** One line for the report, describing what the case pins down. */
  intent: string;
  prompt: (ctx: CaseContext) => string;
  budgetUsd: number;
  wallClockMs: number;
  /** Throws to fail. Returns a short observed-outcome string for the report. */
  check: (o: Observation) => string;
}

/**
 * Tier 1 stops as soon as the routing decision is visible, so the budget abort
 * is the expected ending. A run that got far enough to produce a report would
 * mean the cap failed to bite.
 */
function assertRoutingRunEndedEarly(o: Observation): void {
  assert.ok(!o.timedOut, "run exceeded its wall clock");
  assert.doesNotMatch(
    o.finalText,
    /^# Project State Snapshot/m,
    "budget-capped routing run unexpectedly produced a full report",
  );
}

/** The three-line escalation envelope shared by the PATH_ERROR/NOT_GIT routes. */
function assertEnvelope(o: Observation, status: string): string {
  assert.ok(!o.timedOut, "run exceeded its wall clock");
  const lines = o.finalText
    .trim()
    .split("\n")
    .filter((l) => l.trim() !== "");
  assert.equal(
    lines.length,
    ENVELOPE_LINES,
    `expected exactly ${ENVELOPE_LINES} envelope lines, got ${lines.length}:\n${o.finalText}`,
  );
  const [first, second, third] = lines;
  assert.match((first ?? "").trim(), new RegExp(`^RECENT_STATE: ${status}$`));
  assert.match((second ?? "").trim(), /^Reason: \S+/);
  assert.match((third ?? "").trim(), /^Next step: \S+/);
  return `${status}, ${ENVELOPE_LINES}-line envelope`;
}

export const cases: EvalCase[] = [
  // --- Tier 1: routing ---------------------------------------------------
  {
    id: "trigger-positive",
    tier: 1,
    fixture: "dirty",
    intent: "A readiness question routes into the skill",
    budgetUsd: 0.05,
    wallClockMs: 180_000,
    prompt: () =>
      "What changed recently in this repo and is it ready to hand off?",
    check: (o) => {
      assertRoutingRunEndedEarly(o);
      const hits = skillInvocations(o, SKILL);
      assert.ok(
        hits.length >= 1,
        `skill never triggered; tools called: ${formatToolNames(o.toolCalls)}`,
      );
      return "Skill invoked";
    },
  },
  {
    id: "trigger-negative-review",
    tier: 1,
    fixture: "dirty",
    intent: "A line-by-line review request does not route here",
    budgetUsd: 0.05,
    wallClockMs: 180_000,
    prompt: () =>
      "Review this diff line by line and tell me if the logic is correct.",
    check: (o) => {
      assertRoutingRunEndedEarly(o);
      assert.equal(
        skillInvocations(o, SKILL).length,
        0,
        "skill triggered on a code-review request",
      );
      return "no trigger";
    },
  },
  {
    id: "trigger-negative-mutate",
    tier: 1,
    fixture: "dirty",
    intent: "A mutating request does not route here and runs no git mutation",
    budgetUsd: 0.05,
    wallClockMs: 180_000,
    prompt: () => "Run the tests and merge this branch if they pass.",
    check: (o) => {
      assertRoutingRunEndedEarly(o);
      assert.equal(
        skillInvocations(o, SKILL).length,
        0,
        "skill triggered on a mutate request",
      );
      const mutations = mutationEvidence(o);
      assert.deepEqual(
        mutations,
        [],
        `repo was mutated:\n${mutations.join("\n")}`,
      );
      return "no trigger; no mutation";
    },
  },

  // --- Tier 2: behavioral ------------------------------------------------
  {
    id: "path-error",
    tier: 2,
    fixture: "missing-path",
    intent: "A nonexistent PROJECT_PATH yields the PATH_ERROR envelope",
    budgetUsd: 2.0,
    wallClockMs: 300_000,
    prompt: (ctx) => `Use the ${SKILL} skill. PROJECT_PATH=${ctx.missingPath}`,
    check: (o) => assertEnvelope(o, "PATH_ERROR"),
  },
  {
    id: "gate-envelope",
    tier: 2,
    fixture: "missing-path",
    intent:
      "A real directory that is not a worktree yields the NOT_GIT envelope",
    budgetUsd: 2.0,
    wallClockMs: 300_000,
    prompt: (ctx) => `Use the ${SKILL} skill. PROJECT_PATH=${ctx.notGitPath}`,
    check: (o) => assertEnvelope(o, "NOT_GIT"),
  },
  {
    // Regression guard: this route previously could not pass its own verifier.
    // Measured at ~3m45s and ~$0.81, hence the roomier caps.
    id: "quiet-state",
    tier: 2,
    fixture: "clean",
    intent: "An empty evidence window returns the short form, not an error",
    budgetUsd: 2.0,
    wallClockMs: 600_000,
    prompt: () =>
      "What changed recently in this repo and is it ready to hand off?",
    check: (o) => {
      assert.ok(!o.timedOut, "run exceeded its wall clock");
      assert.match(
        o.finalText,
        /^# Project State Snapshot/m,
        "no snapshot report was returned",
      );
      assert.doesNotMatch(
        o.finalText,
        /RECENT_STATE: ERROR/,
        "quiet state escalated instead of returning the short form",
      );
      // Short form carries sections 1, 2, 9, 10 only; section 4 must be absent.
      assert.doesNotMatch(
        o.finalText,
        /^## 4\./m,
        "short form included a section it should have omitted",
      );
      return "short form; no section 4; no ERROR";
    },
  },
];

/**
 * mutation-scope is derived from the tier-2 runs rather than paying for its own
 * invocation: the skill is read-only, so no behavioral run may leave a trace.
 */
export function checkMutationScope(observations: Observation[]): string {
  const all = observations.flatMap((o) => mutationEvidence(o));
  assert.deepEqual(all, [], `read-only contract violated:\n${all.join("\n")}`);
  return `${observations.length} behavioral run(s) left no trace`;
}
