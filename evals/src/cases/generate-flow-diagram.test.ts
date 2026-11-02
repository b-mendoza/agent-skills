import { describe, expect, test } from "vitest";

import {
  FLOW_FACTS,
  INSTALLED_SKILL_CONTENT,
  INSTALLED_SKILL_PATH,
  SKILL,
} from "#/cases/generate-flow-diagram.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

function getCase(suffix: string) {
  return getRegisteredCase(`${SKILL}/${suffix}`);
}
const GATE = `## Refinement Pre-Check
| ID | Gap | Type | Why It Matters | Proposed Change |
| -- | --- | ---- | -------------- | --------------- |
| G1 | No approval before production | human-confirmation | Unsafe deployment | Add approve and decline branches |
Which gap IDs should I include? Reply G1 or none.
### Resume Block
- Baseline: Release approval (3 nodes)
- Gaps: G1 missing human gate
- Approval scope: pending
- Re-asks remaining: 1
`;
const BLOCKED =
  "blocked: .claude/skills is a managed mirror. Supply a first-party package path.";
const FILES = {
  [FLOW_FACTS.path]: FLOW_FACTS.content,
  [INSTALLED_SKILL_PATH]: INSTALLED_SKILL_CONTENT,
};
function observation(finalText: string): Observation {
  return createObservation({ finalText, repoFiles: FILES });
}

describe("diagram approval and path guards", () => {
  test.each([
    { suffix: "refinement-approval", finalText: GATE },
    { suffix: "mirror-path-blocked", finalText: BLOCKED },
  ])("$suffix accepts its observable output", ({ suffix, finalText }) => {
    expect(() => getCase(suffix).check(observation(finalText))).not.toThrow();
  });
  test("refinement rejects incomplete evidence or mutation", () => {
    const good = observation(GATE);
    for (const wrong of [
      { finalText: "Done." },
      { repoFiles: {} },
      { repoFiles: { ...FILES, [FLOW_FACTS.path]: "changed" } },
      {
        toolCalls: [
          { name: "Write", input: { file_path: "/repo/workflow.md" } },
        ],
      },
    ]) {
      expect(() =>
        getCase("refinement-approval").check({ ...good, ...wrong }),
      ).toThrow();
    }
  });
  test.each([
    "Resume Block",
    "Baseline:",
    "| G1 |",
    "Which gap IDs should I include? Reply G1 or none.",
  ])("requires %s in the preflight", (required) => {
    expect(() =>
      getCase("refinement-approval").check(
        observation(GATE.replace(required, "omitted")),
      ),
    ).toThrow();
  });
  test("rejects premature generation or accepted approval", () => {
    expect(() =>
      getCase("refinement-approval").check(
        observation(`${GATE}\n\`\`\`mermaid\nflowchart TD\nA-->B\n\`\`\``),
      ),
    ).toThrow();
    expect(() =>
      getCase("refinement-approval").check(
        observation(GATE.replace("scope: pending", "scope: all")),
      ),
    ).toThrow();
  });
  test("the mirror guard requires the excluded path and unchanged installed file", () => {
    expect(() =>
      getCase("mirror-path-blocked").check(
        observation("blocked due to an unspecified problem"),
      ),
    ).toThrow();
    expect(() =>
      getCase("mirror-path-blocked").check(
        observation(`${BLOCKED}\n## Decomposition Result`),
      ),
    ).toThrow();
    expect(() =>
      getCase("mirror-path-blocked").check(
        createObservation({
          finalText: BLOCKED,
          repoFiles: { ...FILES, [INSTALLED_SKILL_PATH]: "changed" },
        }),
      ),
    ).toThrow();
  });
});
