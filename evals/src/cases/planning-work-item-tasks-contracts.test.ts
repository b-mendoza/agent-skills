import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SUCCESS = 0;
const FAILURE = 1;

const scripts = fileURLToPath(
  new URL("../../../skills/planning-work-item-tasks/scripts/", import.meta.url),
);
const decision = "Keep the current provider; no migration.";
const plan = `# Plan
## Assumptions and Constraints
User decision: ${decision}
## Task 1: Update timeout validation
**Branch name:** feature/acme-app-42-task-1-update-timeout-validation
## Task 2: Verify production approval
**Execution mode:** human-only
**Owner:** Human
**Branch name:** N/A (human-only)
`;

function validate(text: string, name = "plan.md") {
  const root = mkdtempSync(join(tmpdir(), "plan-contract-"));
  const path = join(root, name);
  writeFileSync(path, text);
  try {
    return spawnSync(
      "python3",
      ["-I", join(scripts, "validate-plan.py"), path, "acme-app-42", decision],
      { encoding: "utf8" },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const stageOne = plan
  .replace("## Task 1:", "### Task A:")
  .replace("## Task 2:", "### Task B:")
  .replaceAll(/^\*\*Branch name:\*\*[^\n]*\n/gm, "");
const STAGE_ONE_NAME = "acme-app-42-stage-1-detailed.md";

describe("planning task contracts", () => {
  it("accepts lettered Stage 1 tasks without code branches", () => {
    expect(validate(stageOne, STAGE_ONE_NAME).status).toBe(SUCCESS);
  });
  it("rejects Stage 1 human tasks without a human owner", () => {
    const result = validate(
      stageOne.replace("**Owner:** Human", ""),
      STAGE_ONE_NAME,
    );
    expect(result.status).toBe(FAILURE);
    expect(result.stderr).toMatch(/^PLAN: FAIL /);
  });
  it("rejects lettered tasks under a final-plan filename", () => {
    const result = validate(stageOne, "acme-app-42-tasks.md");
    expect(result.status).toBe(FAILURE);
    expect(result.stderr).toMatch(/^PLAN: FAIL /);
  });
  it("accepts real code branches and the human branch sentinel", () => {
    expect(validate(plan).status).toBe(SUCCESS);
  });
  it("accepts the bundled template's inline metadata and old-task annotation", () => {
    const templatePlan = plan
      .replace(
        "Task 1: Update timeout validation",
        "Task 1: Update timeout validation (was Task A)",
      )
      .replace(
        "**Branch name:** feature/acme-app-42-task-1-update-timeout-validation",
        "**Priority:** High **Branch name:** `feature/acme-app-42-task-1-update-timeout-validation` **Was:** Task A",
      );
    expect(validate(templatePlan).status).toBe(SUCCESS);
  });
  it.each([
    [
      "invented human branch",
      plan.replace("N/A (human-only)", "feature/manual"),
      "plan.md",
    ],
    ["missing human owner", plan.replace("**Owner:** Human", ""), "plan.md"],
    [
      "lost normal-run decision",
      plan.replace(decision, "Migrate provider"),
      "plan.md",
    ],
    [
      "no code branch",
      plan.replace(
        "feature/acme-app-42-task-1-update-timeout-validation",
        "N/A (human-only)",
      ),
      "plan.md",
    ],
    [
      "Stage 1 code branch",
      stageOne.replace(
        "### Task A: Update timeout validation\n",
        "### Task A: Update timeout validation\n**Branch name:** feature/premature\n",
      ),
      STAGE_ONE_NAME,
    ],
  ])("rejects %s", (_label, text, filename) => {
    const result = validate(text, filename);
    expect(result.status).toBe(FAILURE);
    expect(result.stderr).toMatch(/^PLAN: FAIL /);
  });
});
