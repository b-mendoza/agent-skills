import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { expect, test } from "vitest";

import {
  APPROVED_PLAN,
  PLAN_PATH,
} from "#/cases/creating-work-item-children.ts";
import { ISSUE } from "#/cases/fetching-work-item-fixtures.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import { GH_LOG, makeFixture } from "#/fixtures/fixtures.ts";
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
  return getRegisteredCase(`creating-work-item-children/${suffix}`);
}

test("reconciliation rejects old public status", () => {
  expect(() =>
    getCase("reuse-linked-plan").check({
      ...SUCCESS,
      finalText: `TASK_ISSUES: PASS\n${SUCCESS_TEXT}`,
    }),
  ).toThrow(/public status line/);
});
test.each([ISSUE.reference, PLAN_PATH])(
  "reconciliation preserves %s",
  (value) => {
    expect(() =>
      getCase("reuse-linked-plan").check({
        ...SUCCESS,
        finalText: SUCCESS_TEXT.replace(value, "omitted"),
      }),
    ).toThrow(/reply omitted/);
  },
);
test.each([
  {
    label: "plan mutation",
    files: { [PLAN_PATH]: `${APPROVED_PLAN}\nchanged`, [GH_LOG]: READ_LOG },
    error: /must remain byte-identical/,
  },
  {
    label: "duplicate remote creation",
    files: {
      [PLAN_PATH]: APPROVED_PLAN,
      [GH_LOG]: '["issue","create","--title","duplicate"]\n',
    },
    error: /remote write attempted/,
  },
])("reconciliation rejects $label", ({ files, error }) => {
  expect(() =>
    getCase("reuse-linked-plan").check({ ...SUCCESS, repoFiles: files }),
  ).toThrow(error);
});
test("reconciliation rejects file edits", () => {
  expect(() =>
    getCase("reuse-linked-plan").check({
      ...SUCCESS,
      toolCalls: [{ name: "Edit", input: { file_path: PLAN_PATH } }],
    }),
  ).toThrow(/read-only/);
});
test("reconciliation accepts padded tables and bold prose", () => {
  const finalText = SUCCESS_TEXT.replaceAll(" |", "     |").replace(
    "Reconciled",
    "**Reconciled**",
  );
  expect(() =>
    getCase("reuse-linked-plan").check({ ...SUCCESS, finalText }),
  ).not.toThrow();
});
test("reconciliation accepts the recorded prose rollup without its routing envelope", () => {
  const finalText = SUCCESS_TEXT.replace(
    "1 task: 1 already linked, 0 created now, and 0 failed creates.",
    "1 task, which was already linked. 0 issues were created and 0 creates failed.",
  );
  expect(() =>
    getCase("reuse-linked-plan").check({ ...SUCCESS, finalText }),
  ).not.toThrow();
});
test.each([
  SUCCESS_TEXT.replaceAll("linked-issue", "native-sub-issue"),
  SUCCESS_TEXT.replace("| 1 | acme/app#43", "| 1 | acme/app#99"),
])("reconciliation rejects incorrect structured linkage %#", (finalText) => {
  expect(() =>
    getCase("reuse-linked-plan").check({ ...SUCCESS, finalText }),
  ).toThrow();
});
test("reconciliation must observe the existing child", () => {
  expect(() =>
    getCase("reuse-linked-plan").check({
      ...SUCCESS,
      repoFiles: {
        [PLAN_PATH]: APPROVED_PLAN,
        [GH_LOG]: `${JSON.stringify(["issue", "view", ISSUE.url])}\n`,
      },
    }),
  ).toThrow();
});
test("declined approval accepts the canonical parent URL and concise unchanged-state prose", () => {
  const finalText = `ISSUE_URL=${ISSUE.url}\nPlan: ${PLAN_PATH}\nApproval was declined, so I did not dispatch reconciliation. I made no changes of any kind.`;
  expect(() =>
    getCase("approval-declined").check({ ...BLOCKED, finalText }),
  ).not.toThrow();
});
test("declined approval still rejects a fabricated linked-child table", () => {
  expect(() =>
    getCase("approval-declined").check({
      ...BLOCKED,
      finalText: `${BLOCKED_TEXT}\n| 1 | acme/app#43 |`,
    }),
  ).toThrow();
});
test("seed commits a clean plan and serves a parent/task-traceable child", () => {
  const evalCase = getCase("reuse-linked-plan");
  assert.ok("seed" in evalCase);
  const fixture = makeFixture("clean", [], evalCase.seed);
  try {
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
});
