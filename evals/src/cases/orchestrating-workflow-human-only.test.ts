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
  TASK_PLANNING_FILES,
} from "#/cases/orchestrating-workflow-progress-cases.ts";
import { makeFixture, writeRepoFiles } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const PLAN = 5;
const BLOCKED = 1;
const CHILDREN = 4;
const CRITIQUE = 6;
const EXECUTE = 7;

const UNREADABLE = "PROGRESS: ERROR\nReason: unreadable summary Task cell";
const CELL_OUTCOMES = {
  blocked: {
    readStatus: SUCCESS,
    readText: "PROGRESS: OK",
    initStatus: BLOCKED,
    initText: "human-only task requires a human handoff",
    writes: false,
  },
  started: {
    readStatus: SUCCESS,
    readText: "PROGRESS: OK",
    initStatus: SUCCESS,
    initText: "Task 1 started",
    writes: true,
  },
  unreadable: {
    readStatus: BLOCKED,
    readText: UNREADABLE,
    initStatus: BLOCKED,
    initText: UNREADABLE,
    writes: false,
  },
} as const;

const script = fileURLToPath(
  new URL(
    "../../../skills/orchestrating-workflow/scripts/progress.py",
    import.meta.url,
  ),
);

function runProgress(cwd: string, fields: Readonly<Record<string, unknown>>) {
  return spawnSync("python3", [script], {
    cwd,
    input: JSON.stringify({ ticket_key: "acme-app-42", ...fields }),
    encoding: "utf8",
  });
}

describe("artifact recovery guards", () => {
  test.each(["fresh", "artifact-recovered"])(
    "rejects uninitialized updates without task artifacts in %s progress",
    (origin) => {
      const fixture = setup();
      const path = join(fixture.cwd, root, `${key}-progress.md`);
      const current = () => (existsSync(path) ? fixture.main() : null);
      try {
        writeRepoFiles(
          fixture.cwd,
          origin === "fresh"
            ? { "docs/acme-app-42.md": "# Snapshot\n" }
            : ARTIFACT_PLANNING_FILES,
        );
        if (origin === "fresh") fixture.populated();
        const before = current();
        expect(before === null).toBe(origin === "artifact-recovered");
        const result = fixture.run({
          action: "update_task",
          task_number: 1,
          phase: PLAN,
          status: "complete",
          summary: "not initialized",
        });
        expect(result.status).toBe(BLOCKED);
        expect(result.stdout).toContain("task has not been initialized");
        expect(current()).toBe(before);
      } finally {
        fixture.cleanup();
      }
    },
  );

  test.each(["fresh", "artifact-recovered"])(
    "rejects replacing a completed Phase 4 table in %s progress",
    (origin) => {
      const fixture = setup();
      const path = join(fixture.cwd, root, `${key}-progress.md`);
      const current = () => (existsSync(path) ? fixture.main() : null);
      try {
        writeRepoFiles(
          fixture.cwd,
          origin === "fresh"
            ? { "docs/acme-app-42.md": "# Snapshot\n" }
            : ARTIFACT_PLANNING_FILES,
        );
        if (origin === "fresh") fixture.populated();
        const before = current();
        expect(before === null).toBe(origin === "artifact-recovered");
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
        expect(current()).toBe(before);
      } finally {
        fixture.cleanup();
      }
    },
  );

  test("infers no tasks before Phase 4 and lets Phase 4 write the table once", () => {
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
      const before = fixture.main();
      const again = fixture.run({
        action: "update",
        phase: CHILDREN,
        status: "complete",
        summary: "Again",
        tasks: [{ number: 1, title: "Retitled" }],
      });
      expect(again.status).toBe(BLOCKED);
      expect(again.stdout).toContain("Phase 4 task table already exists");
      expect(fixture.main()).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });

  test("a pending task with all planning artifacts still requires initialize_task", () => {
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

  test.each(Object.keys(TASK_PLANNING_FILES))(
    "infers a pending task without a progress file when %s is missing",
    (missing) => {
      const fixture = setup();
      try {
        writeRepoFiles(fixture.cwd, {
          ...ARTIFACT_PLANNING_FILES,
          ...Object.fromEntries(
            Object.entries(TASK_PLANNING_FILES).filter(
              ([path]) => path !== missing,
            ),
          ),
        });
        const read = fixture.run({ action: "read" });
        expect(read.status).toBe(SUCCESS);
        expect(read.stdout).toContain("- Task 1 | Code |");
        expect(read.stdout).toContain("Status: pending");
        expect(read.stdout).toContain("Resume from: Phase 5 (task selection)");
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
    { cell: "1", outcome: "blocked" },
    { cell: "Task 1", outcome: "blocked" },
    { cell: "**1**", outcome: "blocked" },
    { cell: "**Task 1**", outcome: "blocked" },
    { cell: "`1`", outcome: "blocked" },
    { cell: "`Task 1`", outcome: "blocked" },
    { cell: "C -> 1", outcome: "blocked" },
    { cell: "**C -> 1**", outcome: "blocked" },
    { cell: "C -> **1**", outcome: "blocked" },
    { cell: "**C** -> `Task 1`", outcome: "blocked" },
    { cell: "`C` → **Task 1**", outcome: "blocked" },
    { cell: "**C → 1**", outcome: "blocked" },
    { cell: "`C → 1`", outcome: "blocked" },
    { cell: " ` C -> 1 ` ", outcome: "blocked" },
    { cell: "C → Task 1", outcome: "blocked" },
    { cell: "A -> C → 1", outcome: "blocked" },
    { cell: "3 -> 1", outcome: "blocked" },
    { cell: "1 -> 3", outcome: "started" },
    { cell: "Task 1 extra", outcome: "unreadable" },
    { cell: "C -> 1 extra", outcome: "unreadable" },
    { cell: "C -> 0", outcome: "unreadable" },
    { cell: "-> 1", outcome: "unreadable" },
    {
      cell: "C -> 1",
      outcome: "blocked",
      before: "| 2 | Task 1 | stale-code |\n",
    },
    {
      cell: "C -> 1",
      outcome: "blocked",
      after: "| 2 | Task 1 | stale-code |\n",
    },
  ] satisfies ReadonlyArray<{
    cell: string;
    outcome: keyof typeof CELL_OUTCOMES;
    before?: string;
    after?: string;
  }>)(
    "recognizes summary identity $cell before artifact-only initialization: %j",
    ({ cell, outcome, before, after }) => {
      const expected = CELL_OUTCOMES[outcome];
      const fixture = makeFixture("clean", []);
      const run = (fields: Readonly<Record<string, unknown>>) =>
        runProgress(fixture.cwd, fields);
      try {
        writeRepoFiles(fixture.cwd, {
          "docs/acme-app-42.md": "# Snapshot\n",
          "docs/acme-app-42-upfront-critique.md": "# Critique\n",
          "docs/acme-app-42-tasks.md": `## Execution Order Summary\n\n| Order | Task | Branch |\n| --- | --- | --- |\n${before ?? ""}| 1 | ${cell} | N/A (human-only) |\n${after ?? ""}\n## Task 1: Human approval\n**Branch name:** stale-code\n## Decisions Log\n## GitHub Task Issues\n`,
        });
        const read = run({ action: "read" });
        expect(read.status).toBe(expected.readStatus);
        expect(read.stdout).toContain(expected.readText);
        const result = run({ action: "initialize_task", task_number: 1 });
        expect(result.status).toBe(expected.initStatus);
        expect(result.stdout).toContain(expected.initText);
        expect(
          existsSync(join(fixture.cwd, "docs/acme-app-42-progress.md")),
        ).toBe(expected.writes);
      } finally {
        fixture.cleanup();
      }
    },
  );
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
    {
      execution_mode: "code",
      human_owner: "Release team",
      branch_name: "legacy-branch",
      source_plan:
        "## Task 1: Human approval\n- **Branch name:** N/A (human-only)\n",
    },
  ])("blocks initialization of a human-only task for %j", (metadata) => {
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
        tasks: [{ number: 1, title: "Human approval", ...metadata }],
      });
      expect(populated.status).toBe(SUCCESS);
      const path = join(fixture.cwd, "docs/acme-app-42-progress.md");
      const before = readFileSync(path, "utf8");
      const result = run({ action: "initialize_task", task_number: 1 });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toMatch(/human-only/);
      expect(readFileSync(path, "utf8")).toBe(before);
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

  test("reads a summary row with a Task cell as data, not as a header", () => {
    const fixture = setup();
    try {
      fixture.populated();
      writeRepoFiles(fixture.cwd, {
        "docs/acme-app-42-tasks.md":
          "## Execution Order Summary\n| Order | Task | Type | Owner | Branch name |\n| --- | --- | --- | --- | --- |\n| 1 | 1 | Task | dev | feat/one |\n| 2 | 2 | Task | Ops | N/A (human-only) |\n## Task 1: One\n## Task 2: Two\n",
      });
      const before = fixture.main();
      const result = fixture.run({ action: "initialize_task", task_number: 2 });
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toContain(
        "human-only task requires a human handoff",
      );
      expect(fixture.main()).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });
});
