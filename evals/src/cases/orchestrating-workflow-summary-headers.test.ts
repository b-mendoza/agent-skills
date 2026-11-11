import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  makeProgressFixture as setup,
  PROGRESS_KEY as key,
  PROGRESS_ROOT as root,
  PROGRESS_SKILLS as phases,
} from "#/cases/orchestrating-workflow-progress-cases.ts";
import { writeRepoFiles } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const BLOCKED = 1;

describe("human-only summary headers", () => {
  test.each([
    { header: "| Task | Branch |", row: "| 1 | N/A (human-only) |" },
    {
      header: "| Order | Task | Branch |",
      row: "| 1 | 1 | N/A (human-only) |",
    },
    { header: "| **Task** | Branch |", row: "| 1 | N/A (human-only) |" },
    { header: "| `Task` | Branch |", row: "| 1 | N/A (human-only) |" },
    {
      header: "| **Order** | Task | Branch |",
      row: "| 1 | 1 | N/A (human-only) |",
    },
    {
      header: "| `Order` | Task | Branch |",
      row: "| 1 | 1 | N/A (human-only) |",
    },
    { header: "| Task | **Branch** |", row: "| 1 | N/A (human-only) |" },
    { header: "| Task | `Branch` |", row: "| 1 | N/A (human-only) |" },
    {
      header: "| Order | Task | **Branch name** |",
      row: "| 1 | 1 | N/A (human-only) |",
    },
    {
      header: "| Order | Task | `Branch name` |",
      row: "| 1 | 1 | N/A (human-only) |",
    },
    {
      header: "| **Order** | `Task` | **Branch** |",
      row: "| 1 | **C** -> `Task 1` | N/A (human-only) |",
    },
    {
      header: "| `Order` | **Task** | `Branch name` |",
      row: "| 1 | `C` → **Task 1** | N/A (human-only) |",
    },
  ])(
    "preserves human-only summary metadata with header $header",
    ({ header, row }) => {
      const fixture = setup();
      try {
        const plan = `## Execution Order Summary\n\n${header}\n${header.replace(/[^|]+/g, " --- ")}\n${row}\n\n## Task 1: Human approval\n**Branch name:** stale-code\n`;
        writeRepoFiles(fixture.cwd, { "docs/acme-app-42-tasks.md": plan });
        const read = fixture.run({ action: "read" });
        expect(read.status).toBe(SUCCESS);
        expect.soft(read.stdout).toContain("Branch name: N/A (human-only)");
        expect(existsSync(join(fixture.cwd, root, `${key}-progress.md`))).toBe(
          false,
        );
        const initialized = fixture.run({
          action: "initialize_task",
          task_number: 1,
          phase_skills: phases,
        });
        expect.soft(initialized.status).toBe(BLOCKED);
        expect
          .soft(initialized.stdout)
          .toContain("human-only task requires a human handoff");
        expect(existsSync(join(fixture.cwd, root, `${key}-progress.md`))).toBe(
          false,
        );
        expect(
          existsSync(join(fixture.cwd, root, `${key}-task-1-progress.md`)),
        ).toBe(false);
        expect(
          readFileSync(join(fixture.cwd, root, `${key}-tasks.md`), "utf8"),
        ).toBe(plan);
      } finally {
        fixture.cleanup();
      }
    },
  );

  test.each([
    {
      summary:
        "| **Task** | Branch |\n| --- | --- |\n| 1 | N/A (human-only) |\n\n| `Task` | Branch |\n| --- | --- |\n| 2 | code |\n",
      reason: "duplicate Task table",
    },
    {
      summary:
        "| **Task** | Branch |\n| --- | --- |\n| 1 | N/A (human-only) |\n| 1 | code |\n",
      reason: "duplicate Task identity",
    },
    {
      summary: "| **Task** | Branch |\n| --- | --- |\n| 1 |\n",
      reason: "malformed Task row",
    },
    {
      summary:
        "| **Task** | Branch | `Branch` |\n| --- | --- | --- |\n| 1 | N/A (human-only) | code |\n",
      reason: "duplicate table columns",
    },
  ])(
    "rejects formatted summary with $reason without writing",
    ({ summary, reason }) => {
      const fixture = setup();
      try {
        writeRepoFiles(fixture.cwd, {
          "docs/acme-app-42-tasks.md": `## Execution Order Summary\n\n${summary}\n## Task 1: Human approval\nBranch name: stale-code\n`,
        });
        for (const action of ["read", "initialize_task"]) {
          const result = fixture.run({
            action,
            task_number: 1,
            phase_skills: phases,
          });
          expect(result.status).toBe(BLOCKED);
          expect(result.stdout).toContain(reason);
          expect(
            existsSync(join(fixture.cwd, root, `${key}-progress.md`)),
          ).toBe(false);
          expect(
            existsSync(join(fixture.cwd, root, `${key}-task-1-progress.md`)),
          ).toBe(false);
        }
      } finally {
        fixture.cleanup();
      }
    },
  );
});
