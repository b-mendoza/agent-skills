import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

import {
  APPROVED_PLAN,
  cases,
  PLAN_PATH,
} from "#/cases/creating-work-item-children.ts";
import { GH_LOG, ISSUE } from "#/cases/fetching-work-item-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const TABLE_HEADER =
  "Created/Linked Task Issues:\n| Task | Issue ref | Title | Write model | Dependencies | Priority | Outcome |\n| ---- | --------- | ----- | ----------- | ------------ | -------- | ------- |";
const SUCCESS_TEXT = `TASK_ISSUES: PASS
Validation: PASS
Parent: acme/app#42
ISSUE_SLUG: acme-app-42
Plan file: ${PLAN_PATH}
Write model: linked-issue
Capability: Verified body traceability
Tasks in plan: 1
Already linked: 1
Created now: 0
Failed creates: 0
Decisions Log: PRESENT
Reason: None
${TABLE_HEADER}
| 1 | acme/app#43 | Preserve empty export header | linked-issue | None | High | Already linked |
Warnings:
- None
Failures:
- None
`;
const BLOCKED_TEXT = `TASK_ISSUES: BLOCKED
Validation: NOT_RUN
Parent: acme/app#42
ISSUE_SLUG: acme-app-42
Plan file: not updated
Write model: unknown
Capability: not checked
Tasks in plan: 0
Already linked: 0
Created now: 0
Failed creates: 0
Decisions Log: MISSING
Reason: Mutation approval was declined.
${TABLE_HEADER}
Warnings:
- None
Failures:
- Approval declined
`;
const READ_LOG = `${JSON.stringify(["issue", "view", ISSUE.url])}\n${JSON.stringify(["issue", "view", "43", "--repo", "acme/app"])}\n`;
const SUCCESS = createObservation({
  finalText: SUCCESS_TEXT,
  repoFiles: { [PLAN_PATH]: APPROVED_PLAN, [GH_LOG]: READ_LOG },
});
const BLOCKED = createObservation({
  finalText: BLOCKED_TEXT,
  repoFiles: { [PLAN_PATH]: APPROVED_PLAN, [GH_LOG]: "" },
});

function getCase(suffix: string) {
  const evalCase = cases.find(
    (candidate) => candidate.id === `creating-work-item-children/${suffix}`,
  );
  assert.ok(evalCase !== undefined);
  return evalCase;
}

for (const suffix of ["trigger-positive", "trigger-negative-planning"]) {
  test(`${suffix} distinguishes invocation from noninvocation`, () => {
    const invoked = createObservation({
      toolCalls: [
        { name: "Skill", input: { skill: "creating-work-item-children" } },
      ],
    });
    const absent = createObservation();
    const positive = suffix === "trigger-positive";
    expect(() =>
      getCase(suffix).check(positive ? invoked : absent),
    ).not.toThrow();
    expect(() => getCase(suffix).check(positive ? absent : invoked)).toThrow();
    expect(() =>
      getCase(suffix).check(createObservation({ timedOut: true })),
    ).toThrow();
  });
}

for (const [suffix, observation] of [
  ["reuse-linked-plan", SUCCESS],
  ["approval-declined", BLOCKED],
] as const) {
  test(`${suffix} accepts the complete contract`, () => {
    expect(() => getCase(suffix).check(observation)).not.toThrow();
  });
  test.each([
    "TASK_ISSUES",
    "Validation",
    "Parent",
    "ISSUE_SLUG",
    "Plan file",
    "Write model",
    "Capability",
    "Tasks in plan",
    "Already linked",
    "Created now",
    "Failed creates",
    "Decisions Log",
    "Reason",
    "Created/Linked Task Issues",
    "Warnings",
    "Failures",
  ])(`${suffix} requires %s`, (field) => {
    expect(() =>
      getCase(suffix).check(
        createObservation({
          ...observation,
          finalText: observation.finalText.replace(`${field}:`, "Omitted:"),
        }),
      ),
    ).toThrow();
  });
  test.each([
    { [PLAN_PATH]: `${APPROVED_PLAN}\nchanged`, [GH_LOG]: READ_LOG },
    { [PLAN_PATH]: null, [GH_LOG]: READ_LOG },
    {
      [PLAN_PATH]: APPROVED_PLAN,
      [GH_LOG]: '["issue","create","--title","duplicate"]\n',
    },
  ])(
    `${suffix} rejects plan mutation and duplicate remote creation %#`,
    (repoFiles) => {
      expect(() =>
        getCase(suffix).check(createObservation({ ...observation, repoFiles })),
      ).toThrow();
    },
  );
  test(`${suffix} rejects file edits and malformed counts`, () => {
    expect(() =>
      getCase(suffix).check(
        createObservation({
          ...observation,
          toolCalls: [{ name: "Edit", input: { file_path: PLAN_PATH } }],
        }),
      ),
    ).toThrow();
    expect(() =>
      getCase(suffix).check(
        createObservation({
          ...observation,
          finalText: observation.finalText.replace(
            "Created now: 0",
            "Created now: 1",
          ),
        }),
      ),
    ).toThrow();
    expect(() =>
      getCase(suffix).check(
        createObservation({
          ...observation,
          finalText: observation.finalText.replace(
            "Failed creates: 0",
            "Failed creates: 1",
          ),
        }),
      ),
    ).toThrow();
  });
}

test.each([
  SUCCESS_TEXT.replace("Already linked: 1", "Already linked: 0"),
  SUCCESS_TEXT.replace("Tasks in plan: 1", "Tasks in plan: 2"),
  SUCCESS_TEXT.replace(
    "Write model: linked-issue",
    "Write model: native-sub-issue",
  ),
  SUCCESS_TEXT.replace("Decisions Log: PRESENT", "Decisions Log: MISSING"),
  SUCCESS_TEXT.replace("| 1 | acme/app#43", "| 1 | acme/app#99"),
])("reconciliation rejects incorrect linkage/counts %#", (finalText) => {
  expect(() =>
    getCase("reuse-linked-plan").check(
      createObservation({ ...SUCCESS, finalText }),
    ),
  ).toThrow();
});

test("reconciliation must observe the existing child", () => {
  expect(() =>
    getCase("reuse-linked-plan").check(
      createObservation({
        ...SUCCESS,
        repoFiles: {
          [PLAN_PATH]: APPROVED_PLAN,
          [GH_LOG]: `${JSON.stringify(["issue", "view", ISSUE.url])}\n`,
        },
      }),
    ),
  ).toThrow();
});

test.each([
  BLOCKED_TEXT.replace(
    "Reason: Mutation approval was declined.",
    "Reason: Unknown",
  ),
  BLOCKED_TEXT.replace("Already linked: 0", "Already linked: 1"),
  BLOCKED_TEXT.replace("Tasks in plan: 0", "Tasks in plan: 1"),
  BLOCKED_TEXT.replace("Plan file: not updated", `Plan file: ${PLAN_PATH}`),
  BLOCKED_TEXT.replace("Capability: not checked", "Capability: supported"),
  BLOCKED_TEXT.replace("Write model: unknown", "Write model: linked-issue"),
  BLOCKED_TEXT.replace("Decisions Log: MISSING", "Decisions Log: PRESENT"),
])("blocked summary requires exact blocked placeholders %#", (finalText) => {
  expect(() =>
    getCase("approval-declined").check(
      createObservation({ ...BLOCKED, finalText }),
    ),
  ).toThrow();
});

test("both behavioral seeds produce the committed approved plan and parent/task-traceable child", () => {
  for (const suffix of ["reuse-linked-plan", "approval-declined"]) {
    const evalCase = getCase(suffix);
    assert.ok("seed" in evalCase);
    const fixture = makeFixture("clean", [], evalCase.seed);
    try {
      expect(readFileSync(join(fixture.cwd, PLAN_PATH), "utf8")).toBe(
        APPROVED_PLAN,
      );
      expect(
        execFileSync("git", ["status", "--short"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toBe("");
      const child = execFileSync(
        join(fixture.binPath, "gh"),
        ["issue", "view", "43", "--repo", "acme/app"],
        { encoding: "utf8" },
      );
      expect(child).toContain(ISSUE.url);
      expect(child).toContain("Workflow task: **1**");
    } finally {
      fixture.cleanup();
    }
  }
});
