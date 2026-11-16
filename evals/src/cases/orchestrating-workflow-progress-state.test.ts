import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  makeProgressFixture as setup,
  PROGRESS_KEY as key,
  PROGRESS_ROOT as root,
} from "#/cases/orchestrating-workflow-progress-cases.ts";
import { writeRepoFiles } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const BLOCKED = 1;

const FETCH = 1;
const PLAN_TASKS = 2;
const CLARIFY = 3;
const CHILDREN = 4;
const PLAN = 5;

const LEGACY_PHASES = `# acme-app-42 — Workflow Progress
| Phase | Skill | Status | Completed at | Notes |
| --- | --- | --- | --- | --- |
| 1 | fetch | ✅ Complete | now | — |
| 2 | plan | ✅ Complete | now | — |
| 3 | clarify | ✅ Complete | now | — |
| 4 | children | ✅ Complete | now | — |
## Task Execution (Phases 5–7)
`;

describe("progress state written before a failure", () => {
  test.each([
    {
      label: "an Active row without a current phase",
      tasks:
        "| Task | Title | Current Phase | Status |\n| --- | --- | --- | --- |\n| 1 | Code | — | 🔄 Active |\n| 2 | Docs | — | ⬜ Pending |\n",
      action: { action: "skip_task", task_number: 2, reason: "Excluded" },
    },
    {
      label: "a legacy table without a Current Phase column",
      tasks:
        "| Task | Title | Status |\n| --- | --- | --- |\n| 1 | Code | 🔄 Active |\n| 2 | Docs | ⬜ Pending |\n",
      action: { action: "initialize_task", task_number: 2 },
    },
  ])("rejects $label before writing", ({ tasks, action }) => {
    const fixture = setup();
    try {
      const content = `${LEGACY_PHASES}${tasks}## Execution Log\n`;
      writeRepoFiles(fixture.cwd, { [`${root}/${key}-progress.md`]: content });
      const result = fixture.run(action);
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toBe(
        "PROGRESS: ERROR\nReason: Task 1 has no current phase\n",
      );
      expect(fixture.main()).toBe(content);
    } finally {
      fixture.cleanup();
    }
  });

  test("a failed task phase keeps the task at that phase", () => {
    const fixture = setup();
    try {
      fixture.populated();
      fixture.run({ action: "initialize_task", task_number: 1 });
      const result = fixture.run({
        action: "update_task",
        task_number: 1,
        phase: PLAN,
        status: "failed",
        summary: "Planning failed",
      });
      expect(result.status).toBe(SUCCESS);
      expect(fixture.main()).toMatch(
        /\| 1 \| Code \|[^\n]+\| 5\/7 Plan \| ❌ Failed \|/,
      );
      expect(result.stdout).toContain("Resume from: Phase 5, Task 1");
    } finally {
      fixture.cleanup();
    }
  });

  test("refuses to read a symlinked progress file", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, { "outside.md": LEGACY_PHASES });
      mkdirSync(join(fixture.cwd, root));
      symlinkSync(
        join(fixture.cwd, "outside.md"),
        join(fixture.cwd, root, `${key}-progress.md`),
      );
      const result = fixture.run({ action: "read" });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toContain("progress file must not be a symlink");
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

  test.each([
    {
      label: "different task numbers while Phase 4 is unfinished",
      prepare: () => undefined,
      tasks: [
        { number: 1, title: "Code" },
        { number: 3, title: "New" },
      ],
    },
    {
      label: "a second completion once Phase 4 is complete",
      prepare: (fixture: ReturnType<typeof setup>) =>
        fixture.run({
          action: "update",
          phase: CHILDREN,
          status: "complete",
          summary: "Task 1 child created",
          tasks: tasks("acme/app#101"),
        }),
      tasks: tasks("acme/app#999"),
    },
  ])("rejects $label", ({ prepare, tasks: supplied }) => {
    const fixture = failedPhaseFour();
    try {
      prepare(fixture);
      const before = fixture.main();
      const result = fixture.run({
        action: "update",
        phase: CHILDREN,
        status: "complete",
        summary: "Replace",
        tasks: supplied,
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
