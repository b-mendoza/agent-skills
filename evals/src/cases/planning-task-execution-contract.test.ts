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
  test.each([
    "add",
    "stage",
    "commit",
    "push",
    "rebase",
    "reset",
    "cherry-pick",
    "revert",
    "merge",
    "am",
    "filter-branch",
    "filter-repo",
  ])("rejects forbidden git subcommand %s", (command) => {
    const result = validate("plan", `Run git ${command}.\n`);
    expect(result.status).toBe(BLOCKED);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/^line \d+: git /m);
    expect(result.stdout).toContain(`git ${command}`);
  });
  test.each([
    ["-C", "```sh\ngit -C /repo add src/timeout.js\n```"],
    ["-c", "```sh\ngit -c user.name=Tester push origin HEAD\n```"],
    ["--no-pager", "```sh\ngit --no-pager commit -m fix\n```"],
    ["--git-dir", "```sh\ngit --git-dir /srv/repo push\n```"],
    ["--work-tree", "```sh\ngit --work-tree /srv/repo commit -m fix\n```"],
    ["--config-env", "```sh\ngit --config-env user.name=AUTHOR_NAME push\n```"],
    ["--namespace", "```sh\ngit --namespace review push\n```"],
    ["--attr-source", "```sh\ngit --attr-source HEAD push\n```"],
  ])("rejects forbidden commands after %s", (_label, payload) => {
    const result = validate("plan", `${payload}\n`);
    expect(result.status).toBe(BLOCKED);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/^line \d+: git /m);
  });
  test.each([
    ["semicolon", "Don't run `git status`; run `git push origin main`."],
    ["and", "Do not run git add and git commit."],
    ["but", "Do not commit but run git add src/a.ts."],
    ["sentence end", "Do not stage unrelated files. git commit -am fix"],
    ["then", "Do not run git status then git commit -am fix."],
  ])("rejects commands after a prohibition ends at %s", (_label, payload) => {
    const result = validate("plan", `${payload}\n`);
    expect(result.status).toBe(BLOCKED);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/^line \d+: git /m);
  });
  test.each([
    [
      "prose between the prohibition and the command",
      "No review is needed, so run git push origin main.",
    ],
    ["a comma after prose", "Do not wait for CI, git push origin main."],
    ["or after prose", "Do not wait for CI or git push origin main."],
    ["a verb other than run or use", "Do not skip `git push`."],
    ["a later command without or", "Never run git status before you git push."],
    ["punctuation after the prohibition word", "No, run git push."],
    [
      "a comma-joined prohibition list",
      "Do not run `git add`, `git commit`, or `git push`.",
    ],
    [
      "a prohibition word inside an earlier quoted operand",
      'Run `git log --grep="a; never"` `git push`.',
    ],
  ])(
    "rejects a command that a prohibition does not govern: %s",
    (_label, payload) => {
      const result = validate("plan", `${payload}\n`);
      expect(result.status).toBe(BLOCKED);
      expect(result.stderr).toBe("");
      expect(result.stdout).toMatch(/^line \d+: git /m);
    },
  );
  test.each([
    [
      "a later command on the same line",
      "Run `git status; git push origin main`.",
    ],
    [
      "a quoted operand",
      'Inspect `git log --grep="git commit and git push" --oneline`.',
    ],
    ["a backticked command without a prohibition", "Run `git push`."],
    ["a sentence beginning with Now", "Now run git push."],
    ["a subcommand wrapped in markup", "Run **git push**."],
    ["a capitalized command", "Run `Git Push`."],
  ])("rejects forbidden commands in %s", (_label, payload) => {
    const result = validate("plan", `${payload}\n`);
    expect(result.status).toBe(BLOCKED);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/^line \d+: git /m);
  });
  test.each([
    [
      "read-only commands with action-like operands",
      "Inspect `git diff -- before and commit then push but reset`.",
    ],
    [
      "don't prohibition",
      "Don't run `git commit -m fix`; inspect `git status`.",
    ],
    ["or-joined prohibition", "Do not run git add or git commit."],
    ["bulleted prohibition", "- Never run `git push`."],
    [
      "a separator inside an earlier quoted operand",
      'Never run `git commit -m "a and b"` or `git push`.',
    ],
    ["an emphasized prohibition", "**Do not** run `git push`."],
  ])("accepts %s in an execution plan", (_label, payload) => {
    const result = validate("plan", `${payload}\n`);
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout.trim()).toBe("VALID");
  });
  test("leaves prose directives to model review", () => {
    const result = validate("plan", "Stage and commit the change.\n");
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout.trim()).toBe("VALID");
  });
});

describe("planning summary grammar", () => {
  const prepSummary =
    "PREP: PASS\nTask: 2 - Validation\nBrief: .handoffs/run/brief.md\nDependencies: Satisfied\nQuestions: Resolved\nReferences fetched: none\nNotes: None\n";
  const planSummary =
    "PLAN: PASS\nExecution plan: .handoffs/planning-task-execution/run/acme-app-42-task-2-execution-plan.md\nRecommended skills: None\nReferences fetched: none\nApproach: Validate timeout bounds\nBlockers: None\n";
  const testSpecSummary =
    "TEST_SPEC: PASS\nSpec: .handoffs/run/spec.md\nFramework: node:test\nReferences fetched: none\nCoverage: Boundaries\nBlockers: None\n";
  const refactoringSummary =
    "REFACTORING: PASS\nRefactoring plan: .handoffs/run/refactor.md\nVerdict: No refactoring needed\nReferences fetched: none\nSummary: Keep scope small\nBlockers: None\n";
  test.each([
    ["PREP", prepSummary],
    ["PLAN", planSummary],
    ["TEST_SPEC", testSpecSummary],
    ["REFACTORING", refactoringSummary],
  ])(
    "accepts the %s summary schema and rejects renamed fields",
    (mode, validPayload) => {
      const accepted = validate(mode, validPayload);
      expect(accepted.status).toBe(SUCCESS);
      expect(accepted.stdout.trim()).toBe("VALID");
      const rejected = validate(
        mode,
        validPayload.replace("References fetched:", "Unknown field:"),
      );
      expect(rejected.status).toBe(BLOCKED);
      expect(rejected.stderr).toBe("");
      expect(rejected.stdout).toContain(`${mode}:`);
    },
  );
  test.each([
    ["unknown status", "PLAN", planSummary.replace("PLAN: PASS", "PLAN: DONE")],
    ["missing line", "PLAN", planSummary.replace("Blockers: None\n", "")],
    [
      "unresolved blocker",
      "PLAN",
      planSummary.replace("Blockers: None", "Blockers: unresolved requirement"),
    ],
    [
      "unwritten artifact",
      "PLAN",
      planSummary.replace(
        ".handoffs/planning-task-execution/run/acme-app-42-task-2-execution-plan.md",
        "Not written",
      ),
    ],
    [
      "unsatisfied PREP dependency",
      "PREP",
      prepSummary.replace(
        "Dependencies: Satisfied",
        "Dependencies: Unsatisfied: Task 1",
      ),
    ],
    [
      "invalid REFACTORING verdict",
      "REFACTORING",
      refactoringSummary.replace(
        "Verdict: No refactoring needed",
        "Verdict: Maybe",
      ),
    ],
  ])("rejects %s summaries", (_label, mode, payload) => {
    const result = validate(mode, payload);
    expect(result.status).toBe(BLOCKED);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`${mode}:`);
  });
});
