import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { RESUME_ARTIFACTS } from "#/cases/orchestrating-workflow-fixtures.ts";
import {
  ARTIFACT_PLANNING_FILES,
  ARTIFACT_RESUME_ACTIONS,
  makeProgressFixture as setup,
  PROGRESS_KEY as key,
  PROGRESS_PHASE_NAMES as phases,
  PROGRESS_ROOT as root,
  TASK_ARTIFACT_RESUME_ACTIONS,
  TASK_PLANNING_FILES,
} from "#/cases/orchestrating-workflow-progress-cases.ts";
import { writeRepoFiles } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const BLOCKED = 1;

const FETCH = 1;
const PLAN_TASKS = 2;
const CHILDREN = 4;
const PLAN = 5;
const CRITIQUE = 6;
const EXECUTE = 7;

describe("shipped progress helper", () => {
  test("lazily initializes once and preserves phase rows and child identities", () => {
    const fixture = setup();
    try {
      fixture.populated();
      const result = fixture.run({ action: "initialize_task", task_number: 1 });
      expect(result.status).toBe(SUCCESS);
      expect(fixture.main()).toContain("acme/app#101");
      expect(fixture.main()).toContain("OPS-202");
      expect(fixture.main()).toMatch(/\| 1 \| Fetch work item \|.*Complete/);
      expect(fixture.main()).toMatch(/\| 2 \| Plan tasks \|.*Complete/);
      const before = fixture.main();
      const again = fixture.run({ action: "initialize_task", task_number: 1 });
      expect(again.status).toBe(BLOCKED);
      expect(again.stdout).toContain("task already initialized");
      expect(fixture.main()).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });

  test.each([
    [PLAN, "6/7 Critique", "Phase 6, Task 1", "active"],
    [CRITIQUE, "7/7 Execute", "Phase 7, Task 1", "active"],
    [EXECUTE, "7/7 Execute", "Phase 5 (task selection)", "complete"],
  ])(
    "phase %i completion has a distinct task status and resume point",
    (phase, label, resume, status) => {
      const fixture = setup();
      try {
        fixture.populated();
        expect(
          fixture.run({ action: "initialize_task", task_number: 1 }).status,
        ).toBe(SUCCESS);
        let result = fixture.run({ action: "read" });
        for (const completed of [PLAN, CRITIQUE, EXECUTE].filter(
          (value) => value <= phase,
        )) {
          result = fixture.run({
            action: "update_task",
            task_number: 1,
            phase: completed,
            status: "complete",
            summary: "done",
          });
          expect(result.status).toBe(SUCCESS);
        }
        expect(fixture.main()).toContain(label);
        const row = fixture
          .main()
          .split("\n")
          .find((line) => line.startsWith("| 1 | Code |"));
        expect(row).toContain(status === "active" ? "Active" : "Complete");
        expect(result.stdout).toContain(`Resume from: ${resume}`);
      } finally {
        fixture.cleanup();
      }
    },
  );

  test("skips an unstarted task without fabricated execution or dependency completion", () => {
    const fixture = setup();
    try {
      fixture.populated();
      const result = fixture.run({
        action: "skip_task",
        task_number: 2,
        reason: "User excluded manual verification; owned by Operations",
      });
      expect(result.status).toBe(SUCCESS);
      expect(fixture.main()).toMatch(
        /\| 2 \| Manual verification \| 1 \| Low \| OPS-202 \| — \|.*Skipped/,
      );
      expect(fixture.main()).toContain(
        "User excluded manual verification; owned by Operations",
      );
      expect(result.stdout).toContain("0/2 complete | 1 skipped | 1 remaining");
      expect(result.stdout).not.toMatch(/Resume from:.*Task 2/);
      expect(result.stdout).not.toMatch(/- Task 2 \|/);
    } finally {
      fixture.cleanup();
    }
  });

  test.each([
    { action: "create" },
    { action: "skip_task", task_number: 2, reason: "" },
    {
      action: "update_task",
      task_number: 2,
      phase: 5,
      status: "complete",
      summary: "not initialized",
    },
    {
      action: "update_task",
      task_number: 1,
      phase: 7,
      status: "complete",
      summary: "skipped prerequisites",
    },
    { action: "update", phase: 5, status: "complete", summary: "wrong action" },
  ])("rejects invalid input without changing progress: %j", (fields) => {
    const fixture = setup();
    try {
      fixture.populated();
      const before = fixture.main();
      const result = fixture.run(fields);
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toContain("PROGRESS: ERROR");
      expect(fixture.main()).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });

  test("populates the original no-tasks placeholder on a resumed Phase 4", () => {
    const fixture = setup();
    try {
      expect(
        fixture.run({
          action: "update",
          phase: FETCH,
          status: "complete",
          summary: "fetched",
        }).status,
      ).toBe(SUCCESS);
      const path = join(fixture.cwd, root, `${key}-progress.md`);
      writeFileSync(
        path,
        fixture
          .main()
          .replace(
            "_No tasks yet_",
            "_No tasks yet — populated after Phase 4 completes._",
          ),
      );
      const updated = fixture.run({
        action: "update",
        phase: CHILDREN,
        status: "complete",
        summary: "linked",
        tasks: [{ number: 1, title: "Code", child_item: "acme/app#101" }],
      });
      expect(updated.status).toBe(SUCCESS);
      expect(fixture.main()).toContain("acme/app#101");
    } finally {
      fixture.cleanup();
    }
  });
  test("reads and updates resumed progress without treating Phase 5 as task completion", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, RESUME_ARTIFACTS);
      const read = fixture.run({ action: "read" });
      expect(read.status).toBe(SUCCESS);
      expect(read.stdout).toContain("Resume from: Phase 6, Task 1");
      expect(read.stdout).toContain("0/1 complete");
      const updated = fixture.run({
        action: "update_task",
        task_number: 1,
        phase: 6,
        status: "complete",
        summary: "Critique done",
      });
      expect(updated.status).toBe(SUCCESS);
      expect(updated.stdout).toContain("Resume from: Phase 7, Task 1");
      expect(fixture.main()).toMatch(
        /\| 1 \|[^\n]+7\/7 Execute \|[^\n]+Active/,
      );
      expect(fixture.main()).toContain("Critique done");
    } finally {
      fixture.cleanup();
    }
  });
  test("rejects a phase past the current one and a Complete row before Phase 7", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, RESUME_ARTIFACTS);
      const before = fixture.main();
      const skipped = fixture.run({
        action: "update_task",
        task_number: 1,
        phase: EXECUTE,
        status: "complete",
        summary: "skipped critique",
      });
      expect(skipped.status).toBe(BLOCKED);
      expect(skipped.stdout).toContain("earlier task phases are not complete");
      expect(fixture.main()).toBe(before);
      writeFileSync(
        join(fixture.cwd, root, `${key}-progress.md`),
        before.replace("| 🔄 Active |", "| ✅ Complete |"),
      );
      const read = fixture.run({ action: "read" });
      expect(read.status).toBe(BLOCKED);
      expect(read.stdout).toContain("Task 1 completion lacks Phase 7 evidence");
    } finally {
      fixture.cleanup();
    }
  });
  test("infers missing progress from a snapshot without writing a file", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, { "docs/acme-app-42.md": "# Snapshot\n" });
      const result = fixture.run({ action: "read" });
      expect(result.status).toBe(SUCCESS);
      expect(result.stdout).toContain("Resume from: Phase 2");
      expect(existsSync(join(fixture.cwd, root, `${key}-progress.md`))).toBe(
        false,
      );
    } finally {
      fixture.cleanup();
    }
  });
  test("infers unfinished critique from existing planning files without inventing completion", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, {
        "docs/acme-app-42.md": "# Snapshot\n",
        "docs/acme-app-42-tasks.md":
          "## Task 1: Code\n**Dependencies:** None\n## GitHub Task Issues\n## Decisions Log\n",
        "docs/acme-app-42-upfront-critique.md": "# Critique\n",
        "docs/acme-app-42-task-1-brief.md": "# Brief\n",
        "docs/acme-app-42-task-1-execution-plan.md": "# Plan\n",
        "docs/acme-app-42-task-1-test-spec.md": "# Tests\n",
        "docs/acme-app-42-task-1-refactoring-plan.md": "# Refactoring\n",
      });
      const result = fixture.run({ action: "read" });
      expect(result.status).toBe(SUCCESS);
      expect(result.stdout).toContain("Resume from: Phase 6, Task 1");
      expect(result.stdout).toContain("0/1 complete");
      expect(existsSync(join(fixture.cwd, root, `${key}-progress.md`))).toBe(
        false,
      );
    } finally {
      fixture.cleanup();
    }
  });
  test("preserves snapshot progress after the next phase completion", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, { "docs/acme-app-42.md": "# Snapshot\n" });
      expect(fixture.run({ action: "read" }).stdout).toContain(
        "Resume from: Phase 2",
      );
      const updated = fixture.run({
        action: "update",
        phase: PLAN_TASKS,
        status: "complete",
        summary: "Tasks validated",
      });
      expect(updated.status).toBe(SUCCESS);
      expect(fixture.main()).toMatch(/\| 1 \| Fetch work item \|.*Complete/);
      expect(fixture.run({ action: "read" }).stdout).toContain(
        "Resume from: Phase 3",
      );
    } finally {
      fixture.cleanup();
    }
  });

  test.each(ARTIFACT_RESUME_ACTIONS)(
    "continues artifact-only planning with $action",
    ({ resume, ...action }) => {
      const fixture = setup();
      try {
        writeRepoFiles(fixture.cwd, ARTIFACT_PLANNING_FILES);
        expect(fixture.run({ action: "read" }).stdout).toContain(
          "Resume from: Phase 5 (task selection)",
        );
        expect(existsSync(join(fixture.cwd, root, `${key}-progress.md`))).toBe(
          false,
        );
        const result = fixture.run(action);
        expect(result.status).toBe(SUCCESS);
        for (const [index, name] of phases.entries()) {
          expect(fixture.main()).toMatch(
            new RegExp(`\\| ${index + FETCH} \\| ${name} \\|.*Complete`),
          );
        }
        expect(fixture.run({ action: "read" }).stdout).toContain(
          `Resume from: ${resume}`,
        );
        expect(fixture.main().includes("User excluded task")).toBe(
          action.action === "skip_task",
        );
      } finally {
        fixture.cleanup();
      }
    },
  );

  test.each(TASK_ARTIFACT_RESUME_ACTIONS)(
    "retains inferred task planning for $action with critique=$critique",
    ({ critique, resume, ...action }) => {
      const fixture = setup();
      try {
        writeRepoFiles(fixture.cwd, {
          ...ARTIFACT_PLANNING_FILES,
          ...TASK_PLANNING_FILES,
          ...(critique
            ? {
                "docs/acme-app-42-task-1-critique.md": "# Critique\n",
                "docs/acme-app-42-task-1-decisions.md": "# Decisions\n",
              }
            : {}),
        });
        const before = fixture.run({ action: "read" });
        expect(before.stdout).toContain(
          `Resume from: Phase ${critique ? EXECUTE : CRITIQUE}, Task 1`,
        );
        const result = fixture.run({
          ...action,
          task_number: 1,
          summary: "Validated continuation",
        });
        expect(result.status).toBe(SUCCESS);
        expect(fixture.main()).toMatch(
          /\| 4 \| Create child items \|.*Complete/,
        );
        expect(fixture.main()).toMatch(/\| 1 \| Code \|[^\n]+Active/);
        expect(fixture.run({ action: "read" }).stdout).toContain(
          `Resume from: ${resume}`,
        );
      } finally {
        fixture.cleanup();
      }
    },
  );

  test("creates baseline fresh progress after Phase 1 writes its snapshot", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, { "docs/acme-app-42.md": "# Snapshot\n" });
      const result = fixture.run({
        action: "update",
        phase: FETCH,
        status: "complete",
        summary: "fetched",
      });
      expect(result.status).toBe(SUCCESS);
      expect(
        fixture.main().replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/g, "<ts>"),
      ).toBe(
        "# acme-app-42 — Workflow Progress\n\n" +
          "| Phase | Name | Status | Completed at | Notes |\n" +
          "| --- | --- | --- | --- | --- |\n" +
          "| 1 | Fetch work item | ✅ Complete | <ts> | fetched |\n" +
          "| 2 | Plan tasks | ⬜ Pending | — | — |\n" +
          "| 3 | Clarify and critique | ⬜ Pending | — | — |\n" +
          "| 4 | Create child items | ⬜ Pending | — | — |\n\n" +
          "## Task Execution (Phases 5–7)\n\n_No tasks yet_\n\n" +
          "## Execution Log\n<ts> — Phase 1: complete — fetched\n",
      );
    } finally {
      fixture.cleanup();
    }
  });

  test("rejects task actions after a fresh read without artifacts", () => {
    const fixture = setup();
    try {
      expect(fixture.run({ action: "read" }).stdout).toContain("Fresh start");
      const result = fixture.run({ action: "initialize_task", task_number: 1 });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toContain("main progress file is missing");
      expect(existsSync(join(fixture.cwd, root, `${key}-progress.md`))).toBe(
        false,
      );
    } finally {
      fixture.cleanup();
    }
  });

  test("refuses path traversal without writes", () => {
    const fixture = setup();
    try {
      const result = fixture.run({
        action: "update",
        phase: FETCH,
        status: "complete",
        summary: "fetched",
        ticket_key: "../../outside",
      });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toContain("PROGRESS: ERROR");
      expect(existsSync(join(fixture.cwd, "docs"))).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });
});
