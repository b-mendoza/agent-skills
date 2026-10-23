import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

import { BEHAVIORAL_TIER, ROUTING_TIER } from "#/cases/case-contract.ts";
import { cases } from "#/cases/registry.ts";
import { getCase } from "#/promptfoo/observation.ts";

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
