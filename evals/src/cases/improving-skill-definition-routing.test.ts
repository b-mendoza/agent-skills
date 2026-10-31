import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  AUDIT_FACTS,
  cases,
  SKILL,
} from "#/cases/improving-skill-definition.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

function getCase(suffix: string) {
  const result = cases.find((entry) => entry.id.endsWith(`/${suffix}`));
  assert.ok(result !== undefined);
  return result;
}

describe("skill audit routing", () => {
  test("positive requires invocation; negative allows only its sibling", () => {
    const invoked = createObservation({
      toolCalls: [{ name: "Skill", input: { skill: SKILL } }],
    });
    expect(getCase("trigger-positive").check(invoked)).toBe("Skill invoked");
    expect(() =>
      getCase("trigger-positive").check(createObservation()),
    ).toThrow();
    expect(
      getCase("trigger-negative-diagram").check(
        createObservation({
          toolCalls: [
            { name: "Skill", input: { skill: "generate-flow-diagram" } },
          ],
        }),
      ),
    ).toBe("no trigger");
    expect(() => getCase("trigger-negative-diagram").check(invoked)).toThrow();
  });
});

test("seed creates a first-party package with its reference absent", () => {
  const entry = getCase("audit-approval");
  const fixture = makeFixture(
    entry.fixture,
    [SKILL],
    "seed" in entry ? entry.seed : undefined,
  );
  try {
    expect(
      readFileSync(join(fixture.cwd, AUDIT_FACTS.sourcePath), "utf8"),
    ).toBe(AUDIT_FACTS.content);
    expect(() =>
      readFileSync(join(fixture.cwd, AUDIT_FACTS.missingPath)),
    ).toThrow();
  } finally {
    fixture.cleanup();
  }
});
