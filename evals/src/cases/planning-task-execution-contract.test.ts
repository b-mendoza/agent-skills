import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const SUCCESS = 0;
const BLOCKED = 1;

const script = fileURLToPath(
  new URL(
    "../../../skills/planning-task-execution/scripts/validate-output.py",
    import.meta.url,
  ),
);
function validate(mode: string, payload: string) {
  return spawnSync("python3", [script, mode], {
    input: payload,
    encoding: "utf8",
  });
}

describe("execution-plan action boundary", () => {
  test("accepts implementation, tests, read-only git and negative safety notes", () => {
    const result = validate(
      "plan",
      "## Implementation Approach\n1. Fix timeout parsing.\n2. Run node --test.\n3. Inspect git diff and git status.\nDo not stage, commit, push, rebase, or reset.\nNever run `git add .` or `git commit -m fix`.\n",
    );
    expect(result.status).toBe(SUCCESS);
  });
  test.each([
    "4. Stage the changed source and commit the implementation.",
    "4. Commit the changes once tests pass.",
    "4. Run `git add src/timeout.js && git commit -m fix`.",
    "```sh\ngit -C /repo add src/timeout.js\n```",
    "```sh\ngit --no-pager commit -m fix\n```",
    "```sh\ngit -c user.name=Tester push origin HEAD\n```",
    "4. Rebase the branch before handoff.",
    "git reset --hard HEAD~1",
    "git cherry-pick abc123",
    "Do not modify unrelated files; then git commit -am fix",
  ])("rejects executable plan action: %s", (action) => {
    const result = validate("plan", `## Implementation Approach\n${action}\n`);
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toMatch(/outside.*execution.*boundary/i);
  });
});

describe("planning summary grammar", () => {
  const summary =
    "PLAN: PASS\nExecution plan: .handoffs/planning-task-execution/run/acme-app-42-task-2-execution-plan.md\nRecommended skills: None\nReferences fetched: none\nApproach: Validate timeout bounds\nBlockers: None\n";
  test.each([
    [
      "PREP",
      "PREP: PASS\nTask: 2 - Validation\nBrief: .handoffs/run/brief.md\nDependencies: Satisfied\nQuestions: Resolved\nReferences fetched: none\nNotes: None\n",
    ],
    [
      "TEST_SPEC",
      "TEST_SPEC: PASS\nSpec: .handoffs/run/spec.md\nFramework: node:test\nReferences fetched: none\nCoverage: Boundaries\nBlockers: None\n",
    ],
    [
      "REFACTORING",
      "REFACTORING: PASS\nRefactoring plan: .handoffs/run/refactor.md\nVerdict: No refactoring needed\nReferences fetched: none\nSummary: Keep scope small\nBlockers: None\n",
    ],
  ])("validates %s and rejects a wrong field", (mode, payload) => {
    expect(validate(mode, payload).status).toBe(SUCCESS);
    expect(
      validate(mode, payload.replace("References fetched:", "Unknown field:"))
        .status,
    ).toBe(BLOCKED);
  });
  test("rejects contradictory readiness", () => {
    const payload =
      "PREP: PASS\nTask: 2 - Validation\nBrief: .handoffs/run/brief.md\nDependencies: Unsatisfied: Task 1\nQuestions: Resolved\nReferences fetched: none\nNotes: None\n";
    expect(validate("PREP", payload).status).toBe(BLOCKED);
  });
  test("accepts the declared status and fields", () => {
    expect(validate("PLAN", summary).status).toBe(SUCCESS);
  });
  test.each([
    summary.replace("PLAN: PASS", "PLAN: DONE"),
    summary.replace("Blockers: None\n", ""),
    summary.replace("Blockers: None", "Blockers: unresolved requirement"),
    summary.replace(
      "Execution plan: .handoffs/planning-task-execution/run/acme-app-42-task-2-execution-plan.md",
      "Execution plan: Not written",
    ),
  ])("rejects malformed or contradictory successful summaries", (payload) => {
    expect(validate("PLAN", payload).status).toBe(BLOCKED);
  });
});

describe("recorded negative safety note", () => {
  test("accepts the real scope sentence followed by a prohibition", () => {
    const recorded =
      "Keep work scoped to Task 2. Do not stage, commit, push, rewrite history, or mutate GitHub. Leave planning artifacts on disk, unstaged and uncommitted.";
    expect(validate("plan", recorded).status).toBe(SUCCESS);
  });
  test.each([
    "Stage the files. Do not commit yet.",
    "Do not stage unrelated files. git commit -am fix",
  ])(
    "still rejects an actionable sentence beside a prohibition: %s",
    (payload) => {
      expect(validate("plan", payload).status).toBe(BLOCKED);
    },
  );
});
