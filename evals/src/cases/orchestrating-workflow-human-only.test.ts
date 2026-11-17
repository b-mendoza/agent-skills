import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  ARTIFACT_PLANNING_FILES,
  makeProgressFixture as setup,
  PROGRESS_PATH,
  TASK_PLANNING_FILES,
} from "#/cases/orchestrating-workflow-progress-cases.ts";
import { writeRepoFiles } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const BLOCKED = 1;

const PLAN_TASKS = 2;
const CHILDREN = 4;
const PLAN = 5;
const CRITIQUE = 6;
const EXECUTE = 7;

const HUMAN_ONLY_REFUSAL = "human-only task requires a human handoff";

function summaryPlan(summary: string): string {
  return `## Execution Order Summary\n\n${summary}\n## Task 1: Human approval\n**Branch name:** stale-code\n## GitHub Task Issues\n`;
}

describe("artifact recovery", () => {
  test("infers progress from a snapshot without writing, and the next update keeps it", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, { "docs/acme-app-42.md": "# Snapshot\n" });
      const read = fixture.run({ action: "read" });
      expect(read.status).toBe(SUCCESS);
      expect(read.stdout).toContain("Resume from: Phase 2");
      expect(existsSync(join(fixture.cwd, PROGRESS_PATH))).toBe(false);
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

  test.each([
    {
      label: "all four Phase 5 artifacts",
      artifacts: TASK_PLANNING_FILES,
      resume: "Phase 6, Task 1",
    },
    // Each artifact gets its own row: a row that omits only one file is the
    // only thing that fails if the script stops requiring that file.
    ...Object.keys(TASK_PLANNING_FILES).map((missing) => ({
      label: `without ${missing}`,
      artifacts: Object.fromEntries(
        Object.entries(TASK_PLANNING_FILES).filter(
          ([path]) => path !== missing,
        ),
      ),
      resume: "Phase 5 (task selection)",
    })),
  ])(
    "infers a task's resume point from its planning artifacts: $label",
    ({ artifacts, resume }) => {
      const fixture = setup();
      try {
        writeRepoFiles(fixture.cwd, {
          ...ARTIFACT_PLANNING_FILES,
          ...artifacts,
        });
        const read = fixture.run({ action: "read" });
        expect(read.status).toBe(SUCCESS);
        expect(read.stdout).toContain("- Task 1 | Code |");
        expect(read.stdout).toContain(`Resume from: ${resume}`);
        expect(existsSync(join(fixture.cwd, PROGRESS_PATH))).toBe(false);
      } finally {
        fixture.cleanup();
      }
    },
  );

  test("infers no task rows until the plan shows Phase 4 complete", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, {
        ...ARTIFACT_PLANNING_FILES,
        "docs/acme-app-42-tasks.md": "## Task 1: Code\n## Decisions Log\n",
      });
      const read = fixture.run({ action: "read" });
      expect(read.stdout).toContain("Resume from: Phase 4");
      expect(read.stdout).not.toContain("Tasks:");
      const skipped = fixture.run({
        action: "skip_task",
        task_number: 1,
        reason: "User excluded task",
      });
      expect(skipped.status).toBe(BLOCKED);
      expect(skipped.stdout).toContain("missing Task 1");
      const result = fixture.run({
        action: "update",
        phase: CHILDREN,
        status: "complete",
        summary: "Children validated",
        tasks: [{ number: 1, title: "Code", child_item: "acme/app#101" }],
      });
      expect(result.status).toBe(SUCCESS);
      expect(fixture.main()).toMatch(
        /\| 1 \| Code \| None \| Unknown \| acme\/app#101 \| — \|[^\n]+Pending/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  test("requires initialize_task for a recorded pending task whatever artifacts exist", () => {
    const fixture = setup();
    try {
      fixture.populated();
      writeRepoFiles(fixture.cwd, TASK_PLANNING_FILES);
      const before = fixture.main();
      const result = fixture.run({
        action: "update_task",
        task_number: 1,
        phase: CRITIQUE,
        status: "complete",
        summary: "Critique validated",
      });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toContain("task has not been initialized");
      expect(fixture.main()).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });

  test("completes Phase 7 from artifact-only progress, keeps a skip terminal, and accounts for every task", () => {
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
      expect(existsSync(join(fixture.cwd, PROGRESS_PATH))).toBe(false);
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
      });
      expect(restarted.status).toBe(BLOCKED);
      expect(restarted.stdout).toContain(
        "terminal task cannot be restarted implicitly",
      );
      expect(fixture.main()).toBe(before);
      const final = fixture.run({ action: "read" });
      expect(final.stdout).toContain(
        "Phases: 1 complete | 2 complete | 3 complete | 4 complete",
      );
      expect(final.stdout).toContain("1/2 complete | 1 skipped | 0 remaining");
      expect(final.stdout).toContain(
        "Resume from: None (all tasks accounted for)",
      );
      for (const [path, content] of Object.entries(artifacts)) {
        expect(readFileSync(join(fixture.cwd, path), "utf8")).toBe(content);
      }
    } finally {
      fixture.cleanup();
    }
  });
});

describe("human-only guard", () => {
  test.each([
    {
      label: "the request execution mode",
      task: { execution_mode: "human-only" },
      plan: "## Task 1: Human approval\n",
    },
    {
      label: "the request branch sentinel",
      task: { branch_name: "N/A (human-only)" },
      plan: "## Task 1: Human approval\n",
    },
    {
      label: "the plan Execution mode marker",
      task: { execution_mode: "code", branch_name: "legacy-branch" },
      plan: "## Task 1: Human approval\n**Execution mode:** human-only\n",
    },
    {
      label: "the plan Branch name marker",
      task: { execution_mode: "code", branch_name: "legacy-branch" },
      plan: "## Task 1: Human approval\n- **Branch name:** N/A (human-only)\n",
    },
  ])(
    "blocks Phases 5-7 but allows skip_task for a task marked human-only by $label",
    ({ task, plan }) => {
      const fixture = setup();
      try {
        writeRepoFiles(fixture.cwd, { "docs/acme-app-42-tasks.md": plan });
        const populated = fixture.run({
          action: "update",
          phase: CHILDREN,
          status: "complete",
          summary: "linked",
          tasks: [{ number: 1, title: "Human approval", ...task }],
        });
        expect(populated.status).toBe(SUCCESS);
        const before = fixture.main();
        const started = fixture.run({
          action: "initialize_task",
          task_number: 1,
        });
        expect(started.status).toBe(BLOCKED);
        expect(started.stdout).toContain(HUMAN_ONLY_REFUSAL);
        expect(fixture.main()).toBe(before);
        const resumed = fixture.run({
          action: "update_task",
          task_number: 1,
          phase: PLAN,
          status: "complete",
          summary: "must not resume human task",
        });
        expect(resumed.status).toBe(BLOCKED);
        expect(resumed.stdout).toContain(HUMAN_ONLY_REFUSAL);
        const skipped = fixture.run({
          action: "skip_task",
          task_number: 1,
          reason: "Human handoff to Release team",
        });
        expect(skipped.status).toBe(SUCCESS);
        expect(skipped.stdout).toContain(
          "0/1 complete | 1 skipped | 0 remaining",
        );
      } finally {
        fixture.cleanup();
      }
    },
  );

  test("does not resume or update a saved Active task that the plan now marks human-only", () => {
    const fixture = setup();
    try {
      fixture.populated();
      const started = fixture.run({
        action: "initialize_task",
        task_number: 1,
      });
      expect(started.status).toBe(SUCCESS);
      writeRepoFiles(fixture.cwd, {
        "docs/acme-app-42-tasks.md":
          "## Task 1: Code\n**Execution mode:** human-only\n",
      });
      const read = fixture.run({ action: "read" });
      expect(read.status).toBe(SUCCESS);
      expect(read.stdout).toContain("Resume from: Phase 5 (task selection)");
      expect(read.stdout).not.toMatch(/Resume from:.*Task 1/);
      const before = fixture.main();
      const resumed = fixture.run({
        action: "update_task",
        task_number: 1,
        phase: PLAN,
        status: "complete",
        summary: "must not resume human task",
      });
      expect(resumed.status).toBe(BLOCKED);
      expect(resumed.stdout).toContain(HUMAN_ONLY_REFUSAL);
      expect(fixture.main()).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });

  test.each([
    {
      label: "a bare task number",
      summary:
        "| Order | Task | Branch |\n| --- | --- | --- |\n| 1 | 1 | N/A (human-only) |\n",
    },
    {
      label: "a sentinel row followed by a thematic break",
      summary:
        "| Order | Task | Branch |\n| --- | --- | --- |\n| C | 1 | N/A (human-only) |\n---\nNotes follow.\n",
    },
    {
      label: "a bold source mapped to a backticked Task N",
      summary:
        "| Order | Task | Branch |\n| --- | --- | --- |\n| 1 | **C** -> `Task 1` | N/A (human-only) |\n",
    },
    {
      label: "a sentinel in another letter case",
      summary:
        "| Order | Task | Branch |\n| --- | --- | --- |\n| 1 | 1 | n/a (Human-Only) |\n",
    },
    {
      label: "a backticked sentinel",
      summary:
        "| Order | Task | Branch |\n| --- | --- | --- |\n| 1 | 1 | `N/A (human-only)` |\n",
    },
    {
      label: "a compact, indented, emphasized, reordered header",
      summary:
        "  |`Branch`|Title|**Task**|\n  |:---|---|---:|\n  |N/A (human-only)|Human approval|`C` → **Task 1**|\n",
    },
    {
      label: "conflicting rows with a Task data cell",
      summary:
        "| Order | Task | Type | Branch name |\n| --- | --- | --- | --- |\n| 1 | 1 | Task | stale-code |\n| 2 | 1 | Task | N/A (human-only) |\n",
    },
  ])("blocks a task named by a summary sentinel row: $label", ({ summary }) => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, {
        "docs/acme-app-42-tasks.md": summaryPlan(summary),
      });
      const read = fixture.run({ action: "read" });
      expect(read.status).toBe(SUCCESS);
      expect(read.stdout).toContain("Branch name: N/A (human-only)");
      const started = fixture.run({
        action: "initialize_task",
        task_number: 1,
      });
      expect(started.status).toBe(BLOCKED);
      expect(started.stdout).toContain(HUMAN_ONLY_REFUSAL);
      expect(existsSync(join(fixture.cwd, PROGRESS_PATH))).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  test.each([
    {
      label: "trailing text",
      summary:
        "| Order | Task | Branch |\n| --- | --- | --- |\n| 1 | C -> 1 extra | N/A (human-only) |\n",
    },
    {
      label: "an empty mapping source",
      summary:
        "| Order | Task | Branch |\n| --- | --- | --- |\n| 1 | -> 1 | N/A (human-only) |\n",
    },
    {
      label: "a leading zero",
      summary:
        "| Order | Task | Branch |\n| --- | --- | --- |\n| 1 | 01 | N/A (human-only) |\n",
    },
    {
      label: "a header without a Task column",
      summary: "| Order | Branch |\n| --- | --- |\n| 1 | N/A (human-only) |\n",
    },
  ])(
    "refuses a summary sentinel row whose Task cell names no task: $label",
    ({ summary }) => {
      const fixture = setup();
      try {
        writeRepoFiles(fixture.cwd, {
          "docs/acme-app-42-tasks.md": summaryPlan(summary),
        });
        const started = fixture.run({
          action: "initialize_task",
          task_number: 1,
        });
        expect(started.status).toBe(BLOCKED);
        expect(started.stdout).toContain("unreadable summary Task cell");
        expect(existsSync(join(fixture.cwd, PROGRESS_PATH))).toBe(false);
      } finally {
        fixture.cleanup();
      }
    },
  );

  test("does not block the source task of a mapping that targets another task", () => {
    const fixture = setup();
    try {
      writeRepoFiles(fixture.cwd, {
        "docs/acme-app-42-tasks.md": summaryPlan(
          "| Order | Task | Branch |\n| --- | --- | --- |\n| 1 | 1 -> 3 | N/A (human-only) |\n",
        ),
      });
      const started = fixture.run({
        action: "initialize_task",
        task_number: 1,
      });
      expect(started.status).toBe(SUCCESS);
      expect(started.stdout).toContain("Task 1 started");
    } finally {
      fixture.cleanup();
    }
  });
});
