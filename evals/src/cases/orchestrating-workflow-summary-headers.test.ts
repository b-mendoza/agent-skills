import { existsSync, readFileSync } from "node:fs";
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

describe("human-only summary headers", () => {
  test.each([
    { header: "| Task | Branch |", row: "| 1 | N/A (human-only) |" },
    { header: "| Task | Branch |", row: "| 1 | n/a (Human-Only) |" },
    { header: "|Task|Branch|", row: "|1|N/A (human-only)|" },
    {
      header: "  | Task | Branch |",
      separator: "  | --- | --- |",
      row: "  | 1 | N/A (human-only) |",
    },
    {
      header: "| Title | Task | Branch |",
      row: "| Human approval | 1 | N/A (human-only) |",
    },
    { header: "| Branch | Task |", row: "| N/A (human-only) | 1 |" },
    {
      header: "|**Task**|`Branch name`|",
      row: "|**C** -> `Task 1`|N/A (human-only)|",
    },
    {
      header: "  |`Branch`|Title|**Task**|",
      separator: "  |---|---|---|",
      row: "  |N/A (human-only)|Human approval|`C` → **Task 1**|",
    },
    {
      header: "  |**Order**|`Task`|**Branch**|",
      separator: "  |---|---|---|",
      row: "  |1|**C** -> `Task 1`|N/A (human-only)|",
    },
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
    {
      header: "| **Task** | Branch |",
      row: "| 1 | N/A (human-only) |",
      after: "\n| `Task` | Branch |\n| --- | --- |\n| 2 | code |\n",
    },
    {
      header: "| **Task** | Branch |",
      row: "| 1 | N/A (human-only) |",
      after: "| 1 | code |\n",
    },
    {
      header: "| **Task** | Branch | `Branch` |",
      row: "| 1 | N/A (human-only) | code |",
    },
  ])(
    "preserves human-only summary metadata with header $header",
    ({
      header,
      row,
      separator = header.replace(/[^|]+/g, " --- "),
      after = "",
    }) => {
      const fixture = setup();
      try {
        const plan = `## Execution Order Summary\n\n${header}\n${separator}\n${row}\n${after}\n## Task 1: Human approval\n**Branch name:** stale-code\n## GitHub Task Issues\n`;
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
        });
        expect.soft(initialized.status).toBe(BLOCKED);
        expect
          .soft(initialized.stdout)
          .toContain("human-only task requires a human handoff");
        expect(existsSync(join(fixture.cwd, root, `${key}-progress.md`))).toBe(
          false,
        );
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
        "| Task | Branch |\n| --- | --- |\n| Code | N/A (human-only) |\n",
      reason: "unreadable summary Task cell 'Code' with human-only sentinel",
    },
    {
      summary: "| Order | Branch |\n| --- | --- |\n| 1 | N/A (human-only) |\n",
      reason: "unreadable summary Task cell '' with human-only sentinel",
    },
  ])(
    "rejects a sentinel row that names no task without writing: $summary",
    ({ summary, reason }) => {
      const fixture = setup();
      try {
        writeRepoFiles(fixture.cwd, {
          "docs/acme-app-42-tasks.md": `## Execution Order Summary\n\n${summary}\n## Task 1: Human approval\nBranch name: stale-code\n## GitHub Task Issues\n`,
        });
        for (const action of ["read", "initialize_task"]) {
          const result = fixture.run({ action, task_number: 1 });
          expect(result.status).toBe(BLOCKED);
          expect(result.stdout).toContain(reason);
          expect(
            existsSync(join(fixture.cwd, root, `${key}-progress.md`)),
          ).toBe(false);
        }
      } finally {
        fixture.cleanup();
      }
    },
  );
});
