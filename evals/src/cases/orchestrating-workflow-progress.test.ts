import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import {
  RESUME_ARTIFACTS,
  RESUME_FACTS,
} from "#/cases/orchestrating-workflow-fixtures.ts";
import { makeFixture, writeRepoFiles } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const BLOCKED = 1;

const script = fileURLToPath(
  new URL(
    "../../../skills/orchestrating-workflow/scripts/progress.py",
    import.meta.url,
  ),
);
const FETCH = 1;
const PLAN_TASKS = 2;
const CLARIFY = 3;
const CHILDREN = 4;
const PLAN = 5;
const CRITIQUE = 6;
const EXECUTE = 7;

const key = "acme-app-42";
const root = "docs";
const phases = [
  "fetching-work-item",
  "planning-work-item-tasks",
  "clarifying-assumptions",
  "creating-work-item-children",
  "planning-task-execution",
  "clarifying-assumptions",
  "executing-work-item-task",
];

function setup() {
  const fixture = makeFixture("clean", []);
  const run = (fields: Readonly<Record<string, unknown>>) =>
    spawnSync("python3", [script], {
      cwd: fixture.cwd,
      input: JSON.stringify({ ticket_key: key, ...fields }),
      encoding: "utf8",
    });
  const main = () =>
    readFileSync(join(fixture.cwd, root, `${key}-progress.md`), "utf8");
  const task = () =>
    readFileSync(join(fixture.cwd, root, `${key}-task-1-progress.md`), "utf8");
  const populated = () => {
    for (const phase of [FETCH, PLAN_TASKS, CLARIFY, CHILDREN]) {
      const result = run({
        action: "update",
        phase,
        status: "complete",
        summary: `phase ${phase}`,
        phase_skills: phases,
        tasks: [
          {
            number: 1,
            title: "Code",
            dependencies: "None",
            priority: "High",
            child_item: "acme/app#101",
          },
          {
            number: 2,
            title: "Manual verification",
            dependencies: "1",
            priority: "Low",
            child_item: "OPS-202",
          },
        ],
      });
      expect(result.status).toBe(SUCCESS);
    }
  };
  return { ...fixture, run, main, task, populated };
}

describe("shipped progress helper", () => {
  test("lazily initializes once and preserves phase rows and child identities", () => {
    const fixture = setup();
    try {
      fixture.populated();
      const result = fixture.run({
        action: "initialize_task",
        task_number: 1,
        phase_skills: phases,
      });
      expect(result.status).toBe(SUCCESS);
      expect(fixture.main()).toContain("acme/app#101");
      expect(fixture.main()).toContain("OPS-202");
      expect(fixture.main()).toMatch(/\| 1 \| fetching-work-item \|.*Complete/);
      expect(fixture.main()).toMatch(
        /\| 2 \| planning-work-item-tasks \|.*Complete/,
      );
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
          fixture.run({
            action: "initialize_task",
            task_number: 1,
            phase_skills: phases,
          }).status,
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
        expect(fixture.task()).toMatch(
          new RegExp(`\\| ${phase} \\| [^|]+ \\|.*Complete`),
        );
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
      expect(
        existsSync(join(fixture.cwd, root, `${key}-task-2-progress.md`)),
      ).toBe(false);
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
        fixture.run({ action: "initialize", phase_skills: phases }).status,
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
  test("reads and updates legacy progress without treating Phase 5 as task completion", () => {
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
      expect(fixture.main()).toContain("Unknown (legacy)");
      expect(fixture.main()).toMatch(/\| 1 \|[^\n]+Active/);
      expect(
        readFileSync(join(fixture.cwd, RESUME_FACTS.taskProgressPath), "utf8"),
      ).toContain("Critique done");
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
  test("refuses path traversal without writes", () => {
    const fixture = setup();
    try {
      const result = fixture.run({
        action: "initialize",
        phase_skills: phases,
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
