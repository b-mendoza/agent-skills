import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { EvalCase } from "#/cases/case-contract.ts";
import { behavioralDefaults } from "#/cases/case-contract.ts";
import {
  assertFileAbsent,
  assertFilesUnchanged,
  assertNoMutation,
  capturedFilesUnder,
  capturedText,
  fixtureRelativePath,
  seedFixtureRoot,
  withoutAllowedChanges,
} from "#/cases/shared-checks.ts";
import {
  BASELINE_REFLOG,
  commitRepoFiles,
  copyHeadReflog,
  HEAD_LOG,
  makeFixture,
} from "#/fixtures/fixtures.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

export const PROGRESS_KEY = "acme-app-42";
export const PROGRESS_SKILLS = [
  "fetching-work-item",
  "planning-work-item-tasks",
  "clarifying-assumptions",
  "creating-work-item-children",
  "planning-task-execution",
  "clarifying-assumptions",
  "executing-work-item-task",
];
export const PROGRESS_ROOT = "docs";
export const PROGRESS_PATH = `${PROGRESS_ROOT}/acme-app-42-progress.md`;
export const TASK_PROGRESS_PATH = `${PROGRESS_ROOT}/acme-app-42-task-1-progress.md`;
export const SKIP_REASON = "User excluded Task 2; Operations owns verification";
const CHILDREN = 4;
const CRITIQUE = 6;
const EXECUTE = 7;

export const ARTIFACT_PLANNING_FILES = {
  "docs/acme-app-42.md": "# Snapshot\n",
  "docs/acme-app-42-tasks.md":
    "## Task 1: Code\n## Decisions Log\n## GitHub Task Issues\n",
  "docs/acme-app-42-upfront-critique.md": "# Critique\n",
};
export const TASK_PLANNING_FILES = {
  "docs/acme-app-42-task-1-brief.md": "# Brief\n",
  "docs/acme-app-42-task-1-execution-plan.md": "# Plan\n",
  "docs/acme-app-42-task-1-test-spec.md": "# Tests\n",
  "docs/acme-app-42-task-1-refactoring-plan.md": "# Refactoring\n",
};
export const ARTIFACT_RESUME_ACTIONS = [
  { action: "initialize_task", task_number: 1, resume: "Phase 5, Task 1" },
  {
    action: "skip_task",
    task_number: 1,
    reason: "User excluded task",
    resume: "None (all tasks accounted for)",
  },
  { action: "initialize", resume: "Phase 5 (task selection)" },
  {
    action: "update",
    phase: CHILDREN,
    status: "complete",
    summary: "Children validated",
    tasks: [{ number: 1, title: "Code", child_item: "acme/app#101" }],
    resume: "Phase 5 (task selection)",
  },
];
export const TASK_ARTIFACT_RESUME_ACTIONS = [
  {
    critique: false,
    action: "initialize_task",
    resume: "Phase 6, Task 1",
    continuation: [],
  },
  {
    critique: false,
    action: "initialize",
    resume: "Phase 6, Task 1",
    continuation: [
      {
        action: "update_task",
        task_number: 1,
        phase: CRITIQUE,
        status: "active",
        summary: "Resumed",
      },
    ],
  },
  {
    critique: false,
    action: "update_task",
    phase: CRITIQUE,
    status: "complete",
    resume: "Phase 7, Task 1",
    continuation: [],
  },
  {
    critique: true,
    action: "update_task",
    phase: EXECUTE,
    status: "active",
    resume: "Phase 7, Task 1",
    continuation: [],
  },
  {
    critique: true,
    action: "initialize_task",
    resume: "Phase 7, Task 1",
    continuation: [],
  },
  {
    critique: true,
    action: "initialize",
    resume: "Phase 7, Task 1",
    continuation: [
      {
        action: "update_task",
        task_number: 1,
        phase: EXECUTE,
        status: "active",
        summary: "Resumed",
      },
    ],
  },
];

const seedFiles = {
  "fixture-facts.txt": "Local progress fixture; no remote work.\n",
};

const SUCCESS = 0;
const FIRST_CELL = 1;
const TRAILING_CELL = -1;
const TABLE_HEADING_LINES = 2;
const FIRST_INDEX = 0;
const TASK_COUNT = 2;
const FETCH = 1;
const PLAN = 2;
const CLARIFY = 3;

export function makeProgressFixture() {
  const fixture = makeFixture("clean", []);
  const script = fileURLToPath(
    new URL(
      "../../../skills/orchestrating-workflow/scripts/progress.py",
      import.meta.url,
    ),
  );
  const run = (fields: Readonly<Record<string, unknown>>) =>
    spawnSync("python3", [script], {
      cwd: fixture.cwd,
      input: JSON.stringify({ ticket_key: PROGRESS_KEY, ...fields }),
      encoding: "utf8",
    });
  const main = () => readFileSync(join(fixture.cwd, PROGRESS_PATH), "utf8");
  const task = () =>
    readFileSync(join(fixture.cwd, TASK_PROGRESS_PATH), "utf8");
  const populated = () => {
    for (const phase of [FETCH, PLAN, CLARIFY, CHILDREN]) {
      const result = run({
        action: "update",
        phase,
        status: "complete",
        summary: `phase ${phase}`,
        phase_skills: PROGRESS_SKILLS,
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
      assert.equal(result.status, SUCCESS, result.stdout);
    }
  };
  return { ...fixture, run, main, task, populated };
}

export function taskRows(
  content: string,
): Array<Readonly<Record<string, string>>> {
  const lines = content.split("\n");
  const index = lines.findIndex((line) => /^\|\s*Task\s*\|/.test(line));
  assert.ok(index >= FIRST_INDEX, "missing Task Execution table");
  const cells = (line: string) =>
    line
      .split("|")
      .slice(FIRST_CELL, TRAILING_CELL)
      .map((cell) => cell.trim());
  const columns = cells(lines[index] ?? "");
  assert.ok(columns.includes("Child item"), "missing Child item column");
  return lines
    .slice(index + TABLE_HEADING_LINES)
    .filter((line) => line.startsWith("|"))
    .map((line) => {
      const values = cells(line);
      assert.equal(values.length, columns.length, "misaligned task metadata");
      return Object.fromEntries(
        columns.map((column, position) => [column, values[position] ?? ""]),
      );
    });
}

function allowedProgressWrite(
  call: ToolCall,
  observation: Observation,
): boolean {
  if (!new Set(["Write", "Edit"]).has(call.name)) return false;
  const path = call.input["file_path"];
  if (typeof path !== "string") return false;
  return [PROGRESS_PATH, TASK_PROGRESS_PATH].includes(
    fixtureRelativePath(observation, path) ?? "",
  );
}

export function checkProgressProjection(observation: Observation): string {
  assertFilesUnchanged(observation, seedFiles, "fixture changed");
  assert.deepEqual(observation.gitStatusAfter, {
    kind: "worktree",
    entries: [PROGRESS_PATH, TASK_PROGRESS_PATH]
      .map((path) => `?? ${path}`)
      .sort((first, second) => first.localeCompare(second))
      .join("\n"),
  });
  assert.equal(
    capturedText(observation, HEAD_LOG),
    capturedText(observation, BASELINE_REFLOG),
  );
  assertNoMutation(
    withoutAllowedChanges(observation, (call) =>
      allowedProgressWrite(call, observation),
    ),
  );
  assert.deepEqual(
    Object.keys(capturedFilesUnder(observation, `${PROGRESS_ROOT}/`)).sort(
      (first, second) => first.localeCompare(second),
    ),
    [PROGRESS_PATH, TASK_PROGRESS_PATH].sort((first, second) =>
      first.localeCompare(second),
    ),
  );
  const main = capturedText(observation, PROGRESS_PATH);
  for (const phase of [FETCH, PLAN, CLARIFY, CHILDREN]) {
    assert.match(
      main,
      new RegExp(`\\| ${String(phase)} \\| [^|]+ \\|[^|]*Complete`),
    );
  }
  const rows = taskRows(main);
  assert.equal(rows.length, TASK_COUNT);
  const first = rows.find((row) => row["Task"] === "1");
  const second = rows.find((row) => row["Task"] === "2");
  assert.ok(first !== undefined);
  assert.ok(second !== undefined);
  assert.equal(first["Child item"], "acme/app#101");
  assert.match(first["Status"] ?? "", /Active/);
  assert.equal(first["Current Phase"], "7/7 Execute");
  assert.equal(second["Child item"], "task-list");
  assert.equal(second["Dependencies"], "1");
  assert.match(second["Status"] ?? "", /Skipped/);
  assert.ok(main.includes(SKIP_REASON));
  assertFileAbsent(
    observation,
    `${PROGRESS_ROOT}/acme-app-42-task-2-progress.md`,
  );
  const detail = capturedText(observation, TASK_PROGRESS_PATH);
  assert.match(detail, /\| 5 \|[^\n]+Complete/);
  assert.match(detail, /\| 6 \|[^\n]+Complete/);
  assert.match(detail, /\| 7 \|[^\n]+Pending/);
  assert.match(
    observation.finalText,
    /0\/2 complete\s*\|\s*1 skipped\s*\|\s*1 remaining/,
  );
  assert.match(observation.finalText, /Resume from: Phase 7, Task 1/);
  return "lazy phase progress preserved; Phase 5/6 do not complete task; child metadata retained; unstarted exclusion is terminal only locally";
}

export const progressCases = [
  {
    ...behavioralDefaults,
    skill: "orchestrating-workflow",
    id: "orchestrating-workflow/progress-state-and-unstarted-skip",
    mutationPolicy: "allowed",
    intent:
      "Exercise lazy progress creation, phase/task separation, child metadata and explicit unstarted exclusion through the shipped helper",
    seed: ({ repoPath }) => {
      seedFixtureRoot(repoPath);
      execFileSync("git", ["config", "status.showUntrackedFiles", "all"], {
        cwd: repoPath,
      });
      commitRepoFiles(repoPath, seedFiles, "seed progress fixture");
      copyHeadReflog(repoPath);
    },
    snapshotPaths: [
      ".git/eval-fixture-root",
      HEAD_LOG,
      BASELINE_REFLOG,
      `${PROGRESS_ROOT}/`,
      `${PROGRESS_ROOT}/acme-app-42-task-2-progress.md`,
      "docs/",
      ...Object.keys(seedFiles),
    ],
    prompt: () =>
      `Use only orchestrating-workflow's progress-tracker helper contract, not its full remote workflow. TICKET_KEY=acme-app-42. This is a local progress-projection fixture: phases 1-4 have already succeeded and been validated, but no progress file exists yet. Record each phase 1-4 complete with ACTION=update so earlier rows survive lazy creation. Phase 4 TASKS: Task 1 title Code, dependencies None, priority High, child_item acme/app#101; Task 2 title Manual verification, dependencies 1, priority Low, child_item task-list. Task 1 was selected and its Phase 5 readiness passed: initialize it, then record Phase 5 and Phase 6 complete. Phase 7 has NOT run. The current user's explicit exclusion is: ${SKIP_REASON}. Record Task 2 skipped without starting it. Return the helper's final read summary. Do not create or close any remote item, implement anything, or initialize Task 2.`,
    check: checkProgressProjection,
  },
] as const satisfies readonly EvalCase[];
