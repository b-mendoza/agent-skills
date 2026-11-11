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
    "4. Commit the database transaction after both inserts succeed.",
    "2. Push the validated event onto the retry queue.",
    "3. Reset the timeout input to its default.",
    "5. Stage the fixture rows in the temp table before the import runs.",
    "6. Rewrite the retry loop as a bounded for loop.",
    "Reset the state.",
    "Stage the fixture rows and commit the database transaction.",
    "Commit the database transaction after inserting the changed files into the table.",
    "Do not commit.",
  ])("accepts product work or a prohibition: %s", (action) => {
    const result = validate("plan", `## Implementation Approach\n${action}\n`);
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout.trim()).toBe("VALID");
  });
  test.each([
    "Stage and commit the change.",
    "Commit the changes with a conventional message.",
    "Push the branch to origin.",
    'Run `git commit -m "feat: x"`.',
    "Rebase onto main.",
    "Reset the branch to origin/main.",
    "Commit the change.",
    "Push the fix.",
    "Stage the files.",
    "Rewrite the commit history.",
    "Then commit the implementation.",
    "Finally, stage the named paths and commit the changes.",
    "Create a commit after tests pass.",
    "Make the commit after tests pass.",
    "Commit it.",
    "Commit this change.",
    "Stage src/timeout.js.",
    "Stage timeout.js.",
    "Push everything.",
    "Commit once tests pass.",
    "Reset to abc123.",
  ])("rejects Git work with conventional operands: %s", (action) => {
    const result = validate("plan", `## Implementation Approach\n${action}\n`);
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toMatch(/outside.*execution.*boundary/i);
  });
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
  ])("rejects explicit git %s commands", (command) => {
    const result = validate("plan", `Run git ${command}.\n`);
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toMatch(/outside.*execution.*boundary/i);
  });
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

describe("Git directives versus product objects and safety clauses", () => {
  test.each([
    "Reset the branch counter.",
    "Rewrite the branch selector.",
    "Commit the branch prediction.",
    "Reset the branch coverage threshold.",
    "Push the origin story to the CMS.",
    "Push the upstream response to the cache.",
    "Commit the upstream offsets.",
    "Reset the upstream connection.",
    "Reset the branch counter to zero.",
  ])(
    "accepts product objects headed by branch or remote names: %s",
    (payload) => {
      const result = validate("plan", `${payload}\n`);
      expect(result.status).toBe(SUCCESS);
      expect(result.stdout.trim()).toBe("VALID");
    },
  );
  test.each([
    "Push origin main.",
    "Push origin HEAD.",
    "Push the branch main to origin.",
    "Stage --all.",
    "Commit --amend.",
    "Reset --hard HEAD~1.",
    "Push upstream feature/task.",
    "Push origin main:release.",
    "Push the branch feature/task to origin.",
    "Stage -A.",
    "Reset the branch main to HEAD~1.",
    "Push upstream events to the queue.",
  ])("rejects Git operands or leading flags: %s", (payload) => {
    const result = validate("plan", `${payload}\n`);
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toMatch(/outside.*execution.*boundary/i);
  });
  test.each([
    "Do not stage and commit changes.",
    "Do not run git add and git commit.",
    "Never commit and push.",
    "Do not stage and commit changes and push.",
    "Do not run `git add src/a.ts` and `git commit -m fix`.",
    "Do not run git add . and git commit --amend and git push origin main.",
    "Never stage and never commit.",
  ])("accepts a shared prohibition: %s", (payload) => {
    const result = validate("plan", `${payload}\n`);
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout.trim()).toBe("VALID");
  });
  test.each([
    "Do not stage and run git add src/a.ts.",
    "Never commit and then push.",
    "Never commit and finally push.",
    "Do not commit but push.",
    "Do not commit; push.",
    "Do not commit, and push.",
    "Do not commit changes and push.",
    "Do not run git add . and push.",
    "Do not stage and validate the changes and push.",
    "Never commit. Push origin main.",
    "Never commit.\nPush origin main.",
  ])(
    "rejects an independent or ambiguous positive directive: %s",
    (payload) => {
      const result = validate("plan", `${payload}\n`);
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toMatch(/outside.*execution.*boundary/i);
    },
  );
  test.each([
    "Commit the database transaction.",
    "Reset the retry counter to zero after a successful request.",
    "Push the validated item onto the in-memory queue.",
    "Rewrite the parser to remove duplication.",
    "Reset the search index after the reindex job finishes.",
    "Push the request to the upstream service with a retry.",
    "Rewrite the facade to delegate to the new client.",
    "Reset the decade selector to its default.",
    "Reset the counter to 100000 before each run.",
    "Push the node to the head of the linked list.",
    "Reset the scroll origin when the route changes.",
    "Rewrite the user repository to use the new client.",
    "Reset the browser history stack in the test setup.",
    "Push the config to the remote cache.",
    "Push the commit event to the message bus.",
    "Commit the database transaction after both inserts succeed.",
    "Push the validated event onto the retry queue.",
    "Reset the timeout input to its default.",
    "Stage the fixture rows in the temp table before the import runs.",
    "Rewrite the retry loop as a bounded for loop.",
    "Do not stage, commit or push.",
    "Never commit; leave the changes uncommitted.",
    "Do not stage or commit files, and do not push.",
    "Do not run git add or git commit.",
    "Never rewrite history.",
    "Do not commit.",
    "Validate the event and push it onto the queue.",
    "Open the transaction, write both rows, then commit it.",
    "Add a test that the handler commits the transaction.",
    "Commit the transaction if both inserts succeed.",
    "Verify that nothing is staged and no commit was created.",
    "Add a commit hook test fixture.",
    "Create a commit hook.",
    "Rewrite the branch in the switch statement as a lookup table.",
    "Reset the head of the linked list.",
    "Rewrite the abcdefa label.",
    "Reset the 1234567 counter.",
    "Stage the fixture rows and commit the transaction.",
    "Stage the fixture rows but commit the transaction.",
  ])("accepts the product step or prohibition: %s", (payload) => {
    const result = validate("plan", `${payload}\n`);
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout.trim()).toBe("VALID");
  });
  test.each([
    "9. Commit with a conventional message.",
    "9. Commit using the message from the task brief.",
    "Once tests pass, create a signed commit for the task.",
    "Make one signed commit.",
    "Create a single commit with the message feat: x.",
    "Finally, commit the work.",
    "Run the tests, then commit the changes.",
    "Run the tests and commit the changes.",
    "Do not stage unrelated files, and run git add src/a.ts.",
    "Push to origin.",
    "Reset the branch to HEAD~1.",
    "Run git push origin main.",
    "Commit abc1234 follow-up fixes.",
    "Reset the branch to origin/main.",
    "Reset HEAD to the previous commit.",
    "Rewrite history so the commits are atomic.",
    "Reset the index.",
    "Stage src/a.ts.",
    "Commit once tests pass.",
    "Push.",
    "Commit.",
    "Stage and commit the change.",
    "Commit the changes with a conventional message.",
    "Push the branch to origin.",
    'Run `git commit -m "feat: x"`.',
    "Rebase onto main.",
    "Rebase the date range onto UTC.",
    "Push after the lock is released so the queue stays ordered.",
    "Stage the files in a temp directory before the import.",
    'Commit -m "feat: x".',
    "Reset the git index.",
    "Reset abc1234.",
    "Next, make one signed commit.",
    "Afterwards, push the branch.",
    "Do not commit; then push.",
    "Do not commit but run git add src/a.ts.",
    "Stage the fixture rows; commit the changes.",
    "Stage the fixture rows, and commit the changes.",
  ])("rejects the Git directive: %s", (payload) => {
    const result = validate("plan", `${payload}\n`);
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
