import {
  existsSync,
  readdirSync,
  realpathSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, ROUTING_TIER } from "#/cases/case-contract.ts";
import { cases, getCase } from "#/cases/registry.ts";
import {
  BUDGET_STOP_SUBTYPE,
  FIXTURE_ROOT_PATH,
} from "#/cases/shared-checks.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

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

describe("routing matrix", () => {
  test.each(positiveRoutes)(
    "$id accepts only its own invocation",
    (evalCase) => {
      expect(evalCase.check(budgetStop([skillCall(evalCase.skill)]))).toBe(
        "Skill invoked",
      );
      const others = skills
        .filter((skill) => skill !== evalCase.skill)
        .map(skillCall);
      for (const toolCalls of [[], others]) {
        expect(() => evalCase.check(budgetStop(toolCalls))).toThrow(
          /skill never triggered/,
        );
      }
    },
  );

  test.each(negativeRoutes)(
    "$id accepts a decline but rejects its own invocation",
    (evalCase) => {
      expect(() =>
        evalCase.check(budgetStop([skillCall(evalCase.skill)])),
      ).toThrow();
      expect(() => evalCase.check(budgetStop([]))).not.toThrow();
      for (const sibling of evalCase.extraSkills ?? []) {
        expect(() =>
          evalCase.check(budgetStop([skillCall(sibling)])),
        ).not.toThrow();
      }
    },
  );
});

test("every case rejects a timed-out run even after real work", () => {
  for (const evalCase of cases) {
    const observation = createObservation({
      timedOut: true,
      toolCalls: [
        skillCall(evalCase.skill),
        { name: "Read", input: { file_path: "/repo/a.txt" } },
      ],
      costUsd: 0.01,
    });
    expect(() => evalCase.check(observation)).toThrow(
      "run exceeded its wall clock",
    );
  }
});

const artifactFixtureCases = cases.filter(
  ({ seed, snapshotPaths }) =>
    seed !== undefined && snapshotPaths?.includes(FIXTURE_ROOT_PATH) === true,
);

test.each(artifactFixtureCases)(
  "$id seeds and captures lexical and canonical fixture roots",
  (entry) => {
    const { seed, snapshotPaths } = entry;
    if (seed === undefined || snapshotPaths === undefined) {
      throw new Error("missing case seed or snapshot paths");
    }
    const fixture = makeFixture(entry.fixture, [], (context) => {
      const lexical = join(dirname(context.repoPath), "linked-repo");
      symlinkSync(context.repoPath, lexical);
      seed({ ...context, repoPath: lexical });
    });
    try {
      const lexical = join(dirname(fixture.cwd), "linked-repo");
      expect(snapshotRepoFiles(lexical, snapshotPaths)[FIXTURE_ROOT_PATH]).toBe(
        `${lexical}\n${realpathSync(lexical)}`,
      );
    } finally {
      fixture.cleanup();
    }
  },
);
