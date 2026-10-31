import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import { cases } from "#/cases/generate-handoff-document.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const SKILL = "generate-handoff-document";
const skillCall = { name: "Skill", input: { skill: SKILL } };
function getCase(suffix: string) {
  const result = cases.find((entry) => entry.id.endsWith(`/${suffix}`));
  assert.ok(result !== undefined);
  return result;
}

describe("handoff routing", () => {
  it("accepts an invoked skill, but not a missed trigger", () => {
    const evalCase = getCase("trigger-positive");
    expect(() =>
      evalCase.check(createObservation({ toolCalls: [skillCall] })),
    ).not.toThrow();
    expect(() => evalCase.check(createObservation())).toThrow();
  });

  it("leaves a git-state report to its sibling", () => {
    const evalCase = getCase("trigger-negative-git-state");
    expect(() => evalCase.check(createObservation())).not.toThrow();
    expect(() =>
      evalCase.check(createObservation({ toolCalls: [skillCall] })),
    ).toThrow();
  });
});
