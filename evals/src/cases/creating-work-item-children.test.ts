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
const SUCCESS_TEXT = `Reconciled acme/app#42 against ${PLAN_PATH}, which is unchanged.
The plan contains 1 task: 1 already linked, 0 created now, and 0 failed creates. The linked-issue model has verified body traceability. Implementation has not begun.
${TABLE_HEADER}
| 1 | acme/app#43 | Preserve empty export header | linked-issue | None | High | Already linked |
No warnings or failures.
`;
const BLOCKED_TEXT = `Mutation approval was declined for acme/app#42. The plan ${PLAN_PATH} is unchanged. No remote writes, creates, or links occurred. Implementation has not begun. Approve the proposed tracker and plan changes before reconciliation can proceed.`;
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
  test.each(["TASK_ISSUES: PASS", "SUBTASKS: BLOCKED", "Validation: NOT_RUN"])(
    `${suffix} rejects old public status %s`,
    (status) => {
      expect(() =>
        getCase(suffix).check(
          createObservation({
            ...observation,
            finalText: `${status}\n${observation.finalText}`,
          }),
        ),
      ).toThrow(/public status line/);
    },
  );
  test.each([ISSUE.reference, PLAN_PATH])(`${suffix} preserves %s`, (value) => {
    expect(() =>
      getCase(suffix).check(
        createObservation({
          ...observation,
          finalText: observation.finalText.replace(value, "omitted"),
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
  test(`${suffix} rejects file edits`, () => {
    expect(() =>
      getCase(suffix).check(
        createObservation({
          ...observation,
          toolCalls: [{ name: "Edit", input: { file_path: PLAN_PATH } }],
        }),
      ),
    ).toThrow();
  });
}

test.each([
  ["0 created now", "1 created now"],
  ["0 failed creates", "1 failed creates"],
])("reconciliation rejects false mutation counts %s", (before, after) => {
  expect(() =>
    getCase("reuse-linked-plan").check(
      createObservation({
        ...SUCCESS,
        finalText: SUCCESS_TEXT.replace(before, after),
      }),
    ),
  ).toThrow();
});

test("accepts the recorded no-local-edits reconciliation wording", () => {
  const finalText = SUCCESS_TEXT.replace(
    `Reconciled acme/app#42 against ${PLAN_PATH}, which is unchanged.`,
    `Parent: acme/app#42\nPlan file: ${PLAN_PATH} (verified, no changes needed)\nI made no remote writes and no local edits, and the git working tree is still clean. Nothing is staged or committed.`,
  );
  expect(() =>
    getCase("reuse-linked-plan").check({ ...SUCCESS, finalText }),
  ).not.toThrow();
});

test("reconciliation rejects a missing unchanged-plan outcome", () => {
  expect(() =>
    getCase("reuse-linked-plan").check({
      ...SUCCESS,
      finalText: SUCCESS_TEXT.replace("which is unchanged", "which I updated"),
    }),
  ).toThrow();
});

test("reconciliation accepts padded tables and bold prose", () => {
  const finalText = SUCCESS_TEXT.replaceAll(" |", "     |").replace(
    "Reconciled",
    "**Reconciled**",
  );
  expect(() =>
    getCase("reuse-linked-plan").check(
      createObservation({ ...SUCCESS, finalText }),
    ),
  ).not.toThrow();
});

test("reconciliation accepts the recorded prose rollup without its routing envelope", () => {
  const finalText = SUCCESS_TEXT.replace(
    "1 task: 1 already linked, 0 created now, and 0 failed creates.",
    "1 task, which was already linked. 0 issues were created and 0 creates failed.",
  );
  expect(() =>
    getCase("reuse-linked-plan").check(
      createObservation({ ...SUCCESS, finalText }),
    ),
  ).not.toThrow();
});

test.each([
  SUCCESS_TEXT.replace("1 already linked", "0 already linked"),
  SUCCESS_TEXT.replace("1 task:", "2 tasks:"),
  SUCCESS_TEXT.replaceAll("linked-issue", "native-sub-issue"),
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
  BLOCKED_TEXT.replace("Mutation approval was declined", "Unknown problem"),
  BLOCKED_TEXT.replace("unchanged", "updated"),
  BLOCKED_TEXT.replace("No remote writes, creates, or links occurred.", ""),
  `${BLOCKED_TEXT}\n| 1 | acme/app#43 |`,
])("blocked summary must explain the approval boundary %#", (finalText) => {
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
