import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import {
  ARTIFACT_PLANNING_FILES,
  makeProgressFixture as setup,
  PROGRESS_KEY as key,
  PROGRESS_ROOT as root,
  PROGRESS_SKILLS as phases,
  TASK_PLANNING_FILES,
} from "#/cases/orchestrating-workflow-progress-cases.ts";
import { makeFixture, writeRepoFiles } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const PLAN = 5;
const BLOCKED = 1;
const CHILDREN = 4;
const CRITIQUE = 6;
const EXECUTE = 7;

const script = fileURLToPath(
  new URL(
    "../../../skills/orchestrating-workflow/scripts/progress.py",
    import.meta.url,
  ),
);

describe("artifact recovery guards", () => {
  test.each(["fresh", "artifact-recovered"])(
    "rejects uninitialized updates without task artifacts in %s progress",
    (origin) => {
      const fixture = setup();
      try {
        writeRepoFiles(
          fixture.cwd,
          origin === "fresh"
            ? { "docs/acme-app-42.md": "# Snapshot\n" }
            : ARTIFACT_PLANNING_FILES,
        );
        let initialized: number | null = SUCCESS;
        if (origin === "fresh") {
          fixture.populated();
        } else {
          initialized = fixture.run({
            action: "initialize",
            phase_skills: phases,
          }).status;
        }
        expect(initialized).toBe(SUCCESS);
        const before = fixture.main();
        const result = fixture.run({
          action: "update_task",
          task_number: 1,
          phase: PLAN,
          status: "complete",
          summary: "not initialized",
          phase_skills: phases,
        });
        expect(result.status).toBe(BLOCKED);
        expect(result.stdout).toContain("task has not been initialized");
        expect(fixture.main()).toBe(before);
        expect(
          existsSync(join(fixture.cwd, root, `${key}-task-1-progress.md`)),
        ).toBe(false);
      } finally {
        fixture.cleanup();
      }
    },
  );

  test.each(["fresh", "artifact-recovered"])(
    "rejects replacing a completed Phase 4 table in %s progress",
    (origin) => {
      const fixture = setup();
      try {
        writeRepoFiles(
          fixture.cwd,
          origin === "fresh"
            ? { "docs/acme-app-42.md": "# Snapshot\n" }
            : ARTIFACT_PLANNING_FILES,
        );
        let initialized: number | null = SUCCESS;
        if (origin === "fresh") {
          fixture.populated();
        } else {
          initialized = fixture.run({
            action: "initialize",
            phase_skills: phases,
          }).status;
        }
        expect(initialized).toBe(SUCCESS);
        const before = fixture.main();
        const result = fixture.run({
          action: "update",
          phase: CHILDREN,
          status: "complete",
          summary: "must not replace",
          tasks:
            origin === "fresh"
              ? [
                  { number: 1, title: "Retitled" },
                  { number: 2, title: "Retitled too" },
                ]
              : [{ number: 1, title: "Retitled" }],
        });
        expect(result.status).toBe(BLOCKED);
        expect(result.stdout).toContain(
          "Phase 4 task table already exists; reconcile explicitly, never reset progress",
        );
        expect(fixture.main()).toBe(before);
      } finally {
        fixture.cleanup();
      }
    },
  );

  test("reconciles an inferred table only before Phase 4 completes and preserves task state", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, {
        ...ARTIFACT_PLANNING_FILES,
        "docs/acme-app-42-tasks.md": "## Task 1: Code\n## Decisions Log\n",
      });
      expect(
        fixture.run({ action: "initialize", phase_skills: phases }).status,
      ).toBe(SUCCESS);
      expect(
        fixture.run({
          action: "skip_task",
          task_number: 1,
          reason: "User excluded task",
        }).status,
      ).toBe(SUCCESS);
      const result = fixture.run({
        action: "update",
        phase: CHILDREN,
        status: "complete",
        summary: "Children validated",
        tasks: [{ number: 1, title: "Code", child_item: "acme/app#101" }],
      });
      expect(result.status).toBe(SUCCESS);
      expect(fixture.main()).toMatch(/\| 1 \| Code \|[^\n]+Skipped/);
      expect(fixture.main()).toContain("User excluded task");
      expect(fixture.main()).toContain("acme/app#101");
      const before = fixture.main();
      expect(
        fixture.run({
          action: "update",
          phase: CHILDREN,
          status: "complete",
          summary: "Again",
          tasks: [{ number: 1, title: "Retitled" }],
        }).status,
      ).toBe(BLOCKED);
      expect(fixture.main()).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });

  test("reconstructs a missing task record from artifacts without an inference note", () => {
    const fixture = setup();
    try {
      fixture.populated();
      writeRepoFiles(fixture.cwd, TASK_PLANNING_FILES);
      const result = fixture.run({
        action: "update_task",
        task_number: 1,
        phase: CRITIQUE,
        status: "complete",
        summary: "Critique validated",
        phase_skills: phases,
      });
      expect(result.status).toBe(SUCCESS);
      expect(result.stdout).toContain("Resume from: Phase 7, Task 1");
      expect(fixture.task()).toMatch(
        /\| 5 \| planning-task-execution \|.*Complete/,
      );
      expect(fixture.task()).toMatch(/\| 7 \|[^\n]+Pending/);
    } finally {
      fixture.cleanup();
    }
  });

  test.each(Object.keys(TASK_PLANNING_FILES))(
    "requires initialization when task planning artifact %s is missing",
    (missing) => {
      const fixture = setup();
      try {
        fixture.populated();
        writeRepoFiles(
          fixture.cwd,
          Object.fromEntries(
            Object.entries(TASK_PLANNING_FILES).filter(
              ([path]) => path !== missing,
            ),
          ),
        );
        const before = fixture.main();
        const result = fixture.run({
          action: "update_task",
          task_number: 1,
          phase: CRITIQUE,
          status: "complete",
          summary: "Critique validated",
          phase_skills: phases,
        });
        expect(result.status).toBe(BLOCKED);
        expect(result.stdout).toContain("task has not been initialized");
        expect(fixture.main()).toBe(before);
        expect(
          existsSync(join(fixture.cwd, root, `${key}-task-1-progress.md`)),
        ).toBe(false);
      } finally {
        fixture.cleanup();
      }
    },
  );

  test("continues artifact-only execution and preserves a terminal exclusion", () => {
    const fixture = setup();
    try {
      const artifacts = {
        ...ARTIFACT_PLANNING_FILES,
        ...TASK_PLANNING_FILES,
        "docs/acme-app-42-tasks.md":
          "## Task 1: Code\n## Task 2: Documentation\n## Decisions Log\n## GitHub Task Issues\n",
        "docs/acme-app-42-task-1-critique.md": "# Critique\n",
        "docs/acme-app-42-task-1-decisions.md": "# Decisions\n",
      };
      writeRepoFiles(fixture.cwd, artifacts);
      const read = fixture.run({ action: "read" });
      expect(read.status).toBe(SUCCESS);
      expect(read.stdout).toContain("Resume from: Phase 7, Task 1");
      expect(existsSync(join(fixture.cwd, root, `${key}-progress.md`))).toBe(
        false,
      );
      expect(
        existsSync(join(fixture.cwd, root, `${key}-task-1-progress.md`)),
      ).toBe(false);
      expect(
        fixture.run({
          action: "update_task",
          task_number: 1,
          phase: EXECUTE,
          status: "complete",
          summary: "Execution validated",
        }).status,
      ).toBe(SUCCESS);
      expect(
        fixture.run({
          action: "skip_task",
          task_number: 2,
          reason: "User excluded documentation",
        }).status,
      ).toBe(SUCCESS);
      const before = fixture.main();
      const restarted = fixture.run({
        action: "initialize_task",
        task_number: 2,
        phase_skills: phases,
      });
      expect(restarted.status).toBe(BLOCKED);
      expect(restarted.stdout).toContain(
        "terminal task cannot be restarted implicitly",
      );
      expect(fixture.main()).toBe(before);
      expect(
        existsSync(join(fixture.cwd, root, `${key}-task-2-progress.md`)),
      ).toBe(false);
      expect(
        fixture.run({ action: "initialize", phase_skills: phases }).status,
      ).toBe(SUCCESS);
      const final = fixture.run({ action: "read" });
      expect(final.stdout).toContain(
        "Phases: 1 complete | 2 complete | 3 complete | 4 complete",
      );
      expect(final.stdout).toContain("1/2 complete | 1 skipped | 0 remaining");
      for (const [path, content] of Object.entries(artifacts)) {
        expect(readFileSync(join(fixture.cwd, path), "utf8")).toBe(content);
      }
    } finally {
      fixture.cleanup();
    }
  });
});

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
