import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

import { BEHAVIORAL_TIER } from "#/cases/case-contract.ts";
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

test("every behavioral case explicitly declares its mutation policy", () => {
  for (const evalCase of cases.filter(({ tier }) => tier === BEHAVIORAL_TIER)) {
    expect(["read-only", "allowed"]).toContain(evalCase.mutationPolicy);
  }
});
