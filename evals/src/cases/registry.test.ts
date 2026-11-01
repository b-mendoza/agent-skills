import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, ROUTING_TIER } from "#/cases/case-contract.ts";
import { cases, getCase } from "#/cases/registry.ts";
import { BUDGET_STOP_SUBTYPE } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { QUERY_ERROR_SUBTYPE } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

test("case ids are globally unique and prefixed by their skill", () => {
  expect(new Set(cases.map(({ id }) => id)).size).toBe(cases.length);
  for (const evalCase of cases) {
    expect(evalCase.id.startsWith(`${evalCase.skill}/`)).toBe(true);
    expect(evalCase.id.replace(`${evalCase.skill}/`, "")).not.toBe("");
    expect(getCase(evalCase.id)).toBe(evalCase);
  }
  expect(() => getCase("snapshot-dirty")).toThrow(/Unknown caseId/);
});

test("every requested first-party skill exists and has SKILL.md", () => {
  for (const evalCase of cases) {
    for (const skill of [evalCase.skill, ...(evalCase.extraSkills ?? [])]) {
      expect(skill).toMatch(/^[a-z0-9-]+$/);
      const directory = fileURLToPath(
        new URL(`../../../skills/${skill}/`, import.meta.url),
      );
      expect(statSync(directory).isDirectory()).toBe(true);
      expect(existsSync(`${directory}/SKILL.md`)).toBe(true);
    }
  }
});

const skillsDirectory = new URL("../../../skills/", import.meta.url);
const skills = readdirSync(skillsDirectory, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      existsSync(new URL(`${entry.name}/SKILL.md`, skillsDirectory)),
  )
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

test.each(skills)(
  "%s has positive, other routing, and behavioral coverage",
  (skill) => {
    const skillCases = cases.filter((evalCase) => evalCase.skill === skill);
    const routingIds = skillCases
      .filter(({ tier }) => tier === ROUTING_TIER)
      .map(({ id }) => id);
    const positiveId = `${skill}/trigger-positive`;
    expect(routingIds).toContain(positiveId);
    expect(routingIds.filter((id) => id !== positiveId)).not.toEqual([]);
    expect(
      skillCases.filter(({ tier }) => tier === BEHAVIORAL_TIER),
    ).not.toEqual([]);
  },
);

test("every behavioral case explicitly declares its mutation policy", () => {
  for (const evalCase of cases.filter(({ tier }) => tier === BEHAVIORAL_TIER)) {
    expect(["read-only", "allowed"]).toContain(evalCase.mutationPolicy);
  }
});

const routingCases = cases.filter(({ tier }) => tier === ROUTING_TIER);
const isPositiveRoute = ({ id, skill }: EvalCase) =>
  id === `${skill}/trigger-positive`;
const positiveRoutes = routingCases.filter((evalCase) =>
  isPositiveRoute(evalCase),
);
const negativeRoutes = routingCases.filter(
  (evalCase) => !isPositiveRoute(evalCase),
);
// Exact snapshot-suite routing results; every other route uses the shared defaults.
const SNAPSHOT = "analyzing-recent-project-state";
const negativeRouteFailures: Readonly<Record<string, string>> = {
  [`${SNAPSHOT}/trigger-negative-review`]:
    "skill triggered on a code-review request",
  [`${SNAPSHOT}/trigger-negative-mutate`]:
    "skill triggered on a mutate request",
  [`${SNAPSHOT}/trigger-negative-handoff`]:
    "skill triggered on a session-handoff request",
  [`${SNAPSHOT}/trigger-negative-pr-review`]:
    "skill triggered on a PR-review request",
};
const negativeRouteOutcomes: Readonly<Record<string, string>> = {
  [`${SNAPSHOT}/trigger-negative-mutate`]: "no trigger; no mutation",
};
const LATE_ERROR_COST_USD = 0.01;

function skillCall(skill: string): ToolCall {
  return { name: "Skill", input: { skill } };
}

/** A run the suite stopped at its routing budget, with nothing booked. */
function budgetStop(toolCalls: readonly ToolCall[]): Observation {
  return createObservation({
    subtype: BUDGET_STOP_SUBTYPE,
    isError: true,
    finalText: "",
    toolCalls: [...toolCalls],
    costUsd: 0,
  });
}

function lateError(overrides: Partial<Observation>): Observation {
  return createObservation({
    isError: true,
    subtype: "error_during_execution",
    finalText: "",
    ...overrides,
  });
}

describe("routing matrix", () => {
  test.each(positiveRoutes)(
    "$id passes when its own skill is invoked",
    (evalCase) => {
      const invoked = [skillCall(evalCase.skill)];
      expect(evalCase.check(budgetStop(invoked))).toBe("Skill invoked");
      expect(evalCase.check(createObservation({ toolCalls: invoked }))).toBe(
        "Skill invoked",
      );
      expect(evalCase.check(lateError({ toolCalls: invoked }))).toBe(
        "Skill invoked",
      );
    },
  );

  test.each(positiveRoutes)(
    "$id fails when its skill never triggered",
    (evalCase) => {
      const otherSkills = skills.filter((skill) => skill !== evalCase.skill);
      for (const toolCalls of [
        [],
        [{ name: "Read", input: {} }],
        otherSkills.map((skill) => skillCall(skill)),
      ]) {
        expect(() => evalCase.check(budgetStop(toolCalls))).toThrow(
          /skill never triggered/,
        );
      }
    },
  );

  test.each(negativeRoutes)(
    "$id rejects its own skill invocation",
    (evalCase) => {
      const failure =
        negativeRouteFailures[evalCase.id] ??
        `skill ${evalCase.skill} unexpectedly triggered`;
      expect(() =>
        evalCase.check(budgetStop([skillCall(evalCase.skill)])),
      ).toThrow(failure);
    },
  );

  test.each(negativeRoutes)(
    "$id passes a decline, including one that invokes its siblings",
    (evalCase) => {
      const outcome = negativeRouteOutcomes[evalCase.id] ?? "no trigger";
      const siblings = (evalCase.extraSkills ?? []).map((skill) =>
        skillCall(skill),
      );
      for (const observation of [
        budgetStop([]),
        budgetStop(siblings),
        createObservation({
          finalText: "I'll handle this request directly.",
          toolCalls: [{ name: "Read", input: { file_path: "/repo/a.txt" } }],
        }),
        lateError({ costUsd: LATE_ERROR_COST_USD }),
      ]) {
        expect(evalCase.check(observation)).toBe(outcome);
      }
    },
  );
});

function invalidRuns() {
  return [
    {
      observation: createObservation({ timedOut: true }),
      diagnostic: "run exceeded its wall clock",
    },
    {
      observation: createObservation({ subtype: QUERY_ERROR_SUBTYPE }),
      diagnostic: "the query produced no result",
    },
    {
      observation: createObservation({ subtype: "" }),
      diagnostic: "run carries no result verdict",
    },
    {
      observation: createObservation({
        isError: true,
        finalText: "Failed to authenticate: OAuth session expired",
      }),
      diagnostic: "reported a failed run before it did anything",
    },
  ] as const;
}

test.each(cases)(
  "$id rejects timeouts, missing-result, empty-verdict and zero-work runs",
  (evalCase) => {
    for (const { observation, diagnostic } of invalidRuns()) {
      expect(() => evalCase.check(observation)).toThrow(diagnostic);
    }
  },
);
