import { existsSync, mkdirSync, readdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vitest";

import { RESUME_ARTIFACTS } from "#/cases/orchestrating-workflow-fixtures.ts";
import {
  makeProgressFixture as setup,
  PROGRESS_PATH,
} from "#/cases/orchestrating-workflow-progress-cases.ts";
import { writeRepoFiles } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const BLOCKED = 1;

const FETCH = 1;
const PLAN_TASKS = 2;
const CLARIFY = 3;
const CHILDREN = 4;
const PLAN = 5;
const CRITIQUE = 6;
const EXECUTE = 7;

const LEGACY_PHASES = `# acme-app-42 — Workflow Progress
| Phase | Skill | Status | Completed at | Notes |
| --- | --- | --- | --- | --- |
| 1 | fetch | ✅ Complete | now | — |
| 2 | plan | ✅ Complete | now | — |
| 3 | clarify | ✅ Complete | now | — |
| 4 | children | ✅ Complete | now | — |
## Task Execution (Phases 5–7)
`;

describe("progress file lifecycle", () => {
  test("creates the documented progress file on the first update", () => {
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

  test("starts a task once, retries a failed phase, and completes the task only at Phase 7", () => {
    const taskStep = (phase: number, status: string) => ({
      action: "update_task",
      task_number: 1,
      phase,
      status,
      summary: `Phase ${String(phase)} ${status}`,
    });
    const fixture = setup();
    try {
      fixture.populated();
      const started = fixture.run({
        action: "initialize_task",
        task_number: 1,
      });
      expect(started.status).toBe(SUCCESS);
      const initialized = fixture.main();
      const again = fixture.run({ action: "initialize_task", task_number: 1 });
      expect(again.status).toBe(BLOCKED);
      expect(again.stdout).toContain("task already initialized");
      expect(fixture.main()).toBe(initialized);

      const failed = fixture.run(taskStep(PLAN, "failed"));
      expect(failed.status).toBe(SUCCESS);
      expect(fixture.main()).toContain("| 5/7 Plan | ❌ Failed |");
      expect(failed.stdout).toContain("Resume from: Phase 5, Task 1");

      const planned = fixture.run(taskStep(PLAN, "complete"));
      expect(planned.status).toBe(SUCCESS);
      expect(fixture.main()).toContain("| 6/7 Critique | 🔄 Active |");
      expect(planned.stdout).toContain("Resume from: Phase 6, Task 1");

      const critiqued = fixture.run(taskStep(CRITIQUE, "complete"));
      expect(critiqued.status).toBe(SUCCESS);
      expect(fixture.main()).toContain("| 7/7 Execute | 🔄 Active |");
      expect(critiqued.stdout).toContain("Resume from: Phase 7, Task 1");

      const executed = fixture.run(taskStep(EXECUTE, "complete"));
      expect(executed.status).toBe(SUCCESS);
      expect(fixture.main()).toContain(
        "| 1 | Code | None | High | acme/app#101 | 7/7 Execute | ✅ Complete |",
      );
      expect(executed.stdout).toContain(
        "Phases: 1 complete | 2 complete | 3 complete | 4 complete",
      );
      expect(executed.stdout).toContain(
        "Resume from: Phase 5 (task selection)",
      );
    } finally {
      fixture.cleanup();
    }
  });

  test("skips an unstarted task and drops it from the remaining list and the resume target", () => {
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

  test("resumes the saved seed at Phase 6, Task 1 and refuses a jump to Phase 7", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, RESUME_ARTIFACTS);
      const read = fixture.run({ action: "read" });
      expect(read.status).toBe(SUCCESS);
      expect(read.stdout).toContain("Resume from: Phase 6, Task 1");
      expect(read.stdout).toContain("0/1 complete");
      const before = fixture.main();
      const jumped = fixture.run({
        action: "update_task",
        task_number: 1,
        phase: EXECUTE,
        status: "complete",
        summary: "skipped critique",
      });
      expect(jumped.status).toBe(BLOCKED);
      expect(jumped.stdout).toContain("earlier task phases are not complete");
      expect(fixture.main()).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("refusals", () => {
  test.each([
    {
      label: "unknown action",
      request: { action: "create" },
      reason: "unknown action",
    },
    {
      label: "empty skip reason",
      request: { action: "skip_task", task_number: 2, reason: "" },
      reason: "reason must be one nonempty line",
    },
    {
      label: "skip reason with a newline",
      request: {
        action: "skip_task",
        task_number: 2,
        reason: "Excluded\n| 3 | Forged |",
      },
      reason: "reason must be one nonempty line",
    },
    {
      label: "update for Phase 5",
      request: {
        action: "update",
        phase: 5,
        status: "complete",
        summary: "wrong action",
      },
      reason: "update accepts only phases 1-4",
    },
  ])(
    "refuses an invalid request without writing: $label",
    ({ request, reason }) => {
      const fixture = setup();
      try {
        fixture.populated();
        const before = fixture.main();
        const result = fixture.run(request);
        expect(result.status).toBe(BLOCKED);
        expect(result.stdout).toContain(reason);
        expect(fixture.main()).toBe(before);
      } finally {
        fixture.cleanup();
      }
    },
  );

  test.each([
    {
      label: "an Active row in a table without a Current Phase column",
      tasks:
        "| Task | Title | Status |\n| --- | --- | --- |\n| 1 | Code | 🔄 Active |\n| 2 | Docs | ⬜ Pending |\n",
      reason: "Task 1 has no current phase",
    },
    {
      label: "a Complete row before Phase 7",
      tasks:
        "| Task | Title | Current Phase | Status |\n| --- | --- | --- | --- |\n| 1 | Code | 6/7 Critique | ✅ Complete |\n| 2 | Docs | — | ⬜ Pending |\n",
      reason: "Task 1 completion lacks Phase 7 evidence",
    },
  ])(
    "refuses inconsistent saved task state before writing: $label",
    ({ tasks, reason }) => {
      const fixture = setup();
      try {
        const content = `${LEGACY_PHASES}${tasks}## Execution Log\n`;
        writeRepoFiles(fixture.cwd, { [PROGRESS_PATH]: content });
        const result = fixture.run({
          action: "skip_task",
          task_number: 2,
          reason: "Excluded",
        });
        expect(result.status).toBe(BLOCKED);
        expect(result.stdout).toContain(reason);
        expect(fixture.main()).toBe(content);
      } finally {
        fixture.cleanup();
      }
    },
  );

  test("refuses task actions when no progress file or planning artifact exists", () => {
    const fixture = setup();
    try {
      expect(fixture.run({ action: "read" }).stdout).toContain("Fresh start");
      const result = fixture.run({ action: "initialize_task", task_number: 1 });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toContain("main progress file is missing");
      expect(existsSync(join(fixture.cwd, PROGRESS_PATH))).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  test("refuses an unsafe ticket_key without writing", () => {
    const fixture = setup();
    try {
      const result = fixture.run({
        action: "update",
        phase: FETCH,
        status: "complete",
        summary: "fetched",
        ticket_key: "../outside",
      });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toContain("unsafe ticket_key");
      expect(existsSync(join(fixture.cwd, "docs"))).toBe(false);
      expect(existsSync(join(fixture.cwd, "outside-progress.md"))).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  test.each([
    { label: "docs", link: "docs", target: "outside" },
    {
      label: "progress file",
      link: PROGRESS_PATH,
      target: "outside/progress.md",
    },
  ])("refuses a symlinked $label before writing", ({ label, link, target }) => {
    const fixture = setup();
    try {
      mkdirSync(join(fixture.cwd, "outside"));
      mkdirSync(dirname(join(fixture.cwd, link)), { recursive: true });
      symlinkSync(join(fixture.cwd, target), join(fixture.cwd, link));
      const result = fixture.run({
        action: "update",
        phase: FETCH,
        status: "complete",
        summary: "fetched",
      });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toContain(`${label} must not be a symlink`);
      expect(readdirSync(join(fixture.cwd, "outside"))).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("Phase 4 rerun", () => {
  const tasks = (firstChild: string) => [
    { number: 1, title: "Code", child_item: firstChild },
    { number: 2, title: "Manual verification", child_item: "OPS-202" },
  ];
  function failedPhaseFour() {
    const fixture = setup();
    const steps = [
      ...[FETCH, PLAN_TASKS, CLARIFY].map((phase) => ({
        action: "update",
        phase,
        status: "complete",
        summary: "ok",
      })),
      {
        action: "update",
        phase: CHILDREN,
        status: "complete",
        summary: "Task 1 child not created",
        tasks: tasks("Not Created"),
      },
      { action: "initialize_task", task_number: 1 },
      { action: "skip_task", task_number: 2, reason: "Operations owns it" },
      {
        action: "update",
        phase: CHILDREN,
        status: "failed",
        summary: "Rerunning for Task 1",
      },
    ];
    try {
      for (const step of steps) {
        expect(fixture.run(step).status).toBe(SUCCESS);
      }
    } catch (setupError) {
      fixture.cleanup();
      throw setupError;
    }
    return fixture;
  }

  test("refreshes a Not Created child item and keeps task state", () => {
    const fixture = failedPhaseFour();
    try {
      const result = fixture.run({
        action: "update",
        phase: CHILDREN,
        status: "complete",
        summary: "Task 1 child created",
        tasks: tasks("acme/app#101"),
      });
      expect(result.status).toBe(SUCCESS);
      expect(fixture.main()).toMatch(
        /\| 1 \| Code \| None \| Unknown \| acme\/app#101 \| 5\/7 Plan \| 🔄 Active \|/,
      );
      expect(fixture.main()).toMatch(
        /\| 2 \| Manual verification \|[^\n]+⏭️ Skipped \| Operations owns it \|/,
      );
      expect(fixture.main()).not.toContain("Not Created");
    } finally {
      fixture.cleanup();
    }
  });

  test("refuses a second Phase 4 completion once Phase 4 is complete", () => {
    const fixture = setup();
    try {
      fixture.populated();
      const before = fixture.main();
      const result = fixture.run({
        action: "update",
        phase: CHILDREN,
        status: "complete",
        summary: "Replace",
        tasks: [
          { number: 1, title: "Retitled" },
          { number: 2, title: "Retitled too" },
        ],
      });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toContain(
        "Phase 4 task table already exists; reconcile explicitly, never reset progress",
      );
      expect(fixture.main()).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });

  test("refuses a Phase 4 rerun that changes the task numbers", () => {
    const fixture = failedPhaseFour();
    try {
      const before = fixture.main();
      const result = fixture.run({
        action: "update",
        phase: CHILDREN,
        status: "complete",
        summary: "Replace",
        tasks: [
          { number: 1, title: "Code" },
          { number: 3, title: "New" },
        ],
      });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toContain(
        "Phase 4 task table already exists; reconcile explicitly, never reset progress",
      );
      expect(fixture.main()).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });
});
