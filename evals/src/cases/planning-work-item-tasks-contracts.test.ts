import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  it("validates lettered Stage 1 tasks without requiring premature branches", () => {
    expect(validate(stageOne, STAGE_ONE_NAME).status).toBe(SUCCESS);
  });
  it("still rejects a human-only Stage 1 task without a human owner", () => {
    expect(
      validate(stageOne.replace("**Owner:** Human", ""), STAGE_ONE_NAME).status,
    ).toBe(FAILURE);
  });
  it("does not let the Stage 1 shape bypass a final-plan check", () => {
    expect(validate(stageOne, "acme-app-42-tasks.md").status).toBe(FAILURE);
  });
  it("preserves the branch field without fabricating a human branch", () => {
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
    ],
    ["missing human owner", plan.replace("**Owner:** Human", "")],
    ["lost normal-run decision", plan.replace(decision, "Migrate provider")],
    [
      "no code branch",
      plan.replace(
        "feature/acme-app-42-task-1-update-timeout-validation",
        "N/A (human-only)",
      ),
    ],
  ])("rejects %s", (_label, text) => {
    expect(validate(text).status).toBe(FAILURE);
  });
});

it("does not certify settlement while a delayed producer can still write", async () => {
  const root = mkdtempSync(join(tmpdir(), "producer-settlement-"));
  const path = join(root, "late-write.txt");
  const child = spawn(
    process.execPath,
    [
      "-e",
      "process.stdin.once('data', () => { require('node:fs').writeFileSync(process.argv[1], 'done'); });",
      path,
    ],
    { stdio: ["pipe", "ignore", "ignore"] },
  );
  const exited = once(child, "exit");
  try {
    expect(child.pid).toBeDefined();
    const arguments_ = [
      "-I",
      join(scripts, "validate-settlement.py"),
      String(child.pid),
    ];
    expect(spawnSync("python3", arguments_, { encoding: "utf8" }).status).toBe(
      FAILURE,
    );
    child.stdin.end("finish");
    await exited;
    const settled = spawnSync("python3", arguments_, { encoding: "utf8" });
    expect(settled.status).toBe(SUCCESS);
    expect(readFileSync(path, "utf8")).toBe("done");
  } finally {
    child.kill();
    rmSync(root, { recursive: true, force: true });
  }
});
