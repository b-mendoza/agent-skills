import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { makeFixture, writeRepoFiles } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const PLAN = 5;
const BLOCKED = 1;

const script = fileURLToPath(
  new URL(
    "../../../skills/orchestrating-workflow/scripts/progress.py",
    import.meta.url,
  ),
);

describe("human-only progress guard", () => {
  test.each([
    {
      execution_mode: "human-only",
      human_owner: "Release team",
      branch_name: "legacy-branch",
    },
    {
      execution_mode: "code",
      human_owner: "Release team",
      branch_name: "N/A (human-only)",
    },
    {
      execution_mode: "code",
      human_owner: "Release team",
      branch_name: "legacy-branch",
      source_plan:
        "## Task 1: Human approval\n**Execution mode:** human-only\n**Owner:** Release team\n**Branch name:** N/A (human-only)\n",
    },
  ])("blocks initialization before any per-task file for %j", (metadata) => {
    const fixture = makeFixture("clean", []);
    const run = (fields: Readonly<Record<string, unknown>>) =>
      spawnSync("python3", [script], {
        cwd: fixture.cwd,
        input: JSON.stringify({ ticket_key: "acme-app-42", ...fields }),
        encoding: "utf8",
      });
    try {
      if ("source_plan" in metadata) {
        writeRepoFiles(fixture.cwd, {
          "docs/acme-app-42-tasks.md": metadata.source_plan,
        });
      }
      const populated = run({
        action: "update",
        phase: 4,
        status: "complete",
        summary: "linked",
        phase_skills: ["one", "two", "three", "four", "five", "six", "seven"],
        tasks: [{ number: 1, title: "Human approval", ...metadata }],
      });
      expect(populated.status).toBe(SUCCESS);
      const path = join(fixture.cwd, "docs/acme-app-42-progress.md");
      const before = readFileSync(path, "utf8");
      const result = run({
        action: "initialize_task",
        task_number: 1,
        phase_skills: ["one", "two", "three", "four", "five", "six", "seven"],
      });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toMatch(/human-only/);
      expect(readFileSync(path, "utf8")).toBe(before);
      expect(
        existsSync(join(fixture.cwd, "docs/acme-app-42-task-1-progress.md")),
      ).toBe(false);
      writeRepoFiles(fixture.cwd, {
        "docs/acme-app-42-task-1-progress.md":
          "# Legacy task progress\n| Phase | Skill | Status | Completed at | Notes |\n| --- | --- | --- | --- | --- |\n| 5 | five | Pending | — | — |\n| 6 | six | Pending | — | — |\n| 7 | seven | Pending | — | — |\n",
      });
      const resumed = run({
        action: "update_task",
        task_number: 1,
        phase: PLAN,
        status: "complete",
        summary: "must not resume human task",
      });
      expect(resumed.status).toBe(BLOCKED);
      expect(resumed.stdout).toMatch(/human-only/);
      const skip = run({
        action: "skip_task",
        task_number: 1,
        reason: "Human handoff to Release team",
      });
      expect(skip.status).toBe(SUCCESS);
      expect(skip.stdout).toContain("0/1 complete | 1 skipped | 0 remaining");
    } finally {
      fixture.cleanup();
    }
  });
});
