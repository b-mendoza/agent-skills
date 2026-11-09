import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const SUCCESS = 0;
const BLOCKED = 1;
const INVALID = 2;

const script = fileURLToPath(
  new URL(
    "../../../skills/executing-work-item-task/scripts/check-task-mode.py",
    import.meta.url,
  ),
);
function check(plan: string, task = "1") {
  return spawnSync("python3", [script, task], {
    input: plan,
    encoding: "utf8",
  });
}

describe("human-only execution guard", () => {
  test.each([
    "**Execution mode:** human-only\n**Human owner:** Release team\n**Branch name:** N/A (human-only)",
    "Execution mode: human-only\nHuman owner: Release team\nBranch name: feature/legacy-name",
    "**Branch name**: `N/A (human-only)`",
  ])("blocks selected human task before branch work: %s", (fields) => {
    const result = check(`## Task 1: Production signoff\n${fields}\n`);
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toMatch(/BLOCKED.*human-only/i);
  });
  test("blocks a sentinel in the execution-order row even without task mode", () => {
    const result = check(
      "## Execution Order Summary\n| Task | Branch name |\n| --- | --- |\n| 1 | N/A (human-only) |\n## Task 1: Approval\n**Objective:** Human signoff\n",
    );
    expect(result.status).toBe(BLOCKED);
  });
  test("does not let a different human-only task block a code task", () => {
    const result = check(
      "## Task 1: Implement validation\n**Branch name:** feature/validation\n## Task 2: Approval\n**Execution mode:** human-only\n**Branch name:** N/A (human-only)\n",
    );
    expect(result.status).toBe(SUCCESS);
  });
  test("accepts a legacy code task without the new mode field", () => {
    expect(
      check(
        "## Task 1: Implement validation\n**Branch name:** feature/validation\n",
      ).status,
    ).toBe(SUCCESS);
  });
  test.each([
    "",
    "## Task 2: Not the selected task\n",
    "## Task 1: One\n## Task 1: Duplicate\n",
  ])("rejects missing or ambiguous selected-task identity", (plan) => {
    expect(check(plan).status).toBe(INVALID);
  });
  test("reports CLI usage errors rather than treating them as executable", () => {
    expect(check("## Task 1: Code\n", "zero").status).toBe(INVALID);
  });
});
