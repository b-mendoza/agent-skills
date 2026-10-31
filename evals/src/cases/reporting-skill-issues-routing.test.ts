import assert from "node:assert/strict";

import { describe, expect, test } from "vitest";

import { cases, SKILL } from "#/cases/reporting-skill-issues.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

function getCase(suffix: string) {
  const result = cases.find((entry) => entry.id.endsWith(`/${suffix}`));
  assert.ok(result !== undefined);
  return result;
}

describe("routing", () => {
  test("positive requires the skill, sibling negative rejects it", () => {
    const invoked = createObservation({
      toolCalls: [{ name: "Skill", input: { skill: SKILL } }],
    });
    expect(() => getCase("trigger-positive").check(invoked)).not.toThrow();
    expect(() =>
      getCase("trigger-positive").check(createObservation()),
    ).toThrow();
    expect(() =>
      getCase("trigger-negative-application-bug").check(createObservation()),
    ).not.toThrow();
    expect(() =>
      getCase("trigger-negative-application-bug").check(invoked),
    ).toThrow();
  });
  test.each(cases)("$id rejects missing observations", (entry) => {
    expect(() => entry.check(createObservation({ timedOut: true }))).toThrow(
      /wall clock/,
    );
  });
});
