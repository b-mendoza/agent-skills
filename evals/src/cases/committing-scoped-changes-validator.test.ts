import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  script,
  SUCCESS_EXIT,
} from "#/cases/committing-scoped-changes-test-support.ts";

const validator = join(dirname(script), "validate-output.sh");
const INVALID_EXIT = 1;
const START_INDEX = 0;
const DIGEST_LENGTH = 40;
const oid = "c".repeat(DIGEST_LENGTH);
const shared = "shared worktree; not an isolated commit tree";
const candidate = `candidate tree ${oid}; ignored files linked from the worktree`;
const plan = `COMMIT_PLAN: PASS\nGroup: 1\nMessage: fix: change a\nPaths: a\nHunks: none\nExpansions: none\nVerification: none\nDigest: ${"a".repeat(DIGEST_LENGTH)}\nChecks: worktree\nOmissions: none\nWarnings: none\n`;
const receipt = `COMMIT_EXECUTE: PASS\nCommit: abcdef0 fix: change a\nPaths: a\nPreserved: ${"b".repeat(DIGEST_LENGTH)}=${"b".repeat(DIGEST_LENGTH)}\nTree: ${oid}=${oid}\nVerification: python3 check.py\nVerification exit: 0\nVerification evidence: 3 assertions passed\nVerification scope: shared worktree; not an isolated commit tree\n`;
function validate(mode: string, input: string) {
  return spawnSync("sh", [validator, mode], { input, encoding: "utf8" });
}
const execute = (input: string) => validate("execute", input).status;
describe("shipped envelope validator", () => {
  test.each([
    ["10 9", SUCCESS_EXIT],
    ["9 10", INVALID_EXIT],
  ])("compares numeric-looking paths %s bytewise", (paths, expected) => {
    expect(
      validate("plan", plan.replace("Paths: a", `Paths: ${paths}`)).status,
    ).toBe(expected);
  });
  test("accepts a real digest but rejects the historical empty-input hash", () => {
    expect(validate("plan", plan).status).toBe(SUCCESS_EXIT);
    const emptyBlob = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
    const invalid = plan.replace("a".repeat(DIGEST_LENGTH), emptyBlob);
    expect(validate("plan", invalid).status).toBe(INVALID_EXIT);
  });
  test("requires successful receipts to disclose verification evidence and scope", () => {
    expect(execute(receipt)).toBe(SUCCESS_EXIT);
    for (const invalid of [
      receipt.split("Verification:")[START_INDEX] ?? "",
      receipt.replace("exit: 0", "exit: 1"),
      receipt.replace("shared worktree; not an ", ""),
    ]) {
      expect(execute(invalid)).toBe(INVALID_EXIT);
    }
  });
  test("post-verification commit and hook failures retain the observed check evidence", () => {
    const evidence = `Verification: python3 check.py\nVerification exit: 0\nVerification evidence: 3 assertions passed\nVerification scope: shared worktree; not an isolated commit tree\n`;
    for (const header of [
      "COMMIT_EXECUTE: COMMIT_ERROR\nReason: rejected\n",
      "COMMIT_EXECUTE: HOOK_MUTATION\nReason: changed tree\nCommit: abcdef0 fix: change a\n",
    ]) {
      const failed = header + evidence.replace("exit: 0", "exit: 9");
      expect(execute(header + evidence)).toBe(SUCCESS_EXIT);
      expect(execute(failed)).toBe(INVALID_EXIT);
      expect(execute(header)).toBe(INVALID_EXIT);
    }
  });
  test("accepts an ERROR receipt that retains check evidence", () => {
    const error =
      "COMMIT_EXECUTE: ERROR\nReason: candidate export cleanup failed after the check failed\n";
    const failedCheck = `${error}Verification: npm test\nVerification exit: 9\nVerification evidence: 2 tests failed\nVerification scope: shared worktree; not an isolated commit tree\n`;
    const withExit = (code: string) =>
      failedCheck.replace("exit: 9", `exit: ${code}`);
    for (const code of ["9", "0", "09"]) {
      expect(execute(withExit(code))).toBe(SUCCESS_EXIT);
    }
    expect(execute(withExit("unknown"))).toBe(INVALID_EXIT);
    expect(execute(error)).toBe(SUCCESS_EXIT);
    const notRun = `${error}Verification: none\nVerification exit: not-run\nVerification evidence: not run\nVerification scope: shared worktree; not an isolated commit tree\n`;
    expect(execute(notRun)).toBe(SUCCESS_EXIT);
  });
  test("none and failed checks have explicit, consistent receipts", () => {
    const none = receipt
      .replace("python3 check.py", "none")
      .replace("Verification exit: 0", "Verification exit: not-run")
      .replace("3 assertions passed", "not run");
    expect(execute(none)).toBe(SUCCESS_EXIT);
    expect(execute(none.replace("not-run", "0"))).toBe(INVALID_EXIT);
    const failed = `COMMIT_EXECUTE: VERIFY_FAILED\nReason: checker failed\nVerification: python3 check.py\nVerification exit: 1\nVerification evidence: assertion failed\nVerification scope: shared worktree; not an isolated commit tree\n`;
    expect(execute(failed)).toBe(SUCCESS_EXIT);
    expect(execute(failed.replace("exit: 1", "exit: 0"))).toBe(INVALID_EXIT);
  });
});

function series(checks: string, ...commands: string[]): string {
  const firstGroup = 1;
  const groups = commands.map((command, index) =>
    [
      `Group: ${index + firstGroup}`,
      `Message: change file ${index}`,
      `Paths: file${index}`,
      "Hunks: none",
      "Expansions: none",
      `Verification: ${command}`,
      `Digest: ${oid}`,
    ].join("\n"),
  );
  return [
    "COMMIT_PLAN: PASS",
    ...groups,
    `Checks: ${checks}`,
    "Omissions: none",
    "Warnings: none",
  ].join("\n");
}

const hunkPlan = series("candidate", "test", "test", "test")
  .replace("file0\nHunks: none", `a#x b extra\nHunks: ${oid} a#x#2,10 b#1`)
  .replace("file1\nHunks: none", `a#x\nHunks: ${oid} a#x#1+2,10`)
  .replace("file2\nHunks: none", `a#x b\nHunks: ${oid} a#x#3+1,2,10 b#3+1`)
  .replace("Omissions: none", "Omissions: omitted");

describe("hunk group boundaries", () => {
  test("accepts interleaved split paths, a whole path and separate omissions", () => {
    expect(validate("plan", hunkPlan).status).toBe(SUCCESS_EXIT);
  });
  test.each([
    ["missing seventh line", `Hunks: ${oid} a#x#1+2,10\n`, ""],
    ["symbolic base", oid, "HEAD"],
    ["base without token", `${oid} a#x#1+2,10`, oid],
    [
      "different base",
      `${oid} a#x#1+2,10`,
      `${"a".repeat(DIGEST_LENGTH)} a#x#1+2,10`,
    ],
    ["unsorted paths", "a#x#2,10 b#1", "b#1 a#x#2,10"],
    ["duplicate path", "a#x#2,10 b#1", "a#x#2 a#x#10 b#1"],
    ["nonmember path", "b#1", "other#1"],
    ["zero", "b#1", "b#0"],
    ["leading zero", "b#1", "b#01"],
    ["empty new", "b#1", "b#+1"],
    ["unsorted new", "2,10", "10,2"],
    ["duplicate number", "2,10", "2,2"],
    ["unsorted prior", "+2,10", "+10,2"],
    ["overlap", "3+1,2,10", "2+1,2,10"],
    ["unexpected prior", "b#1", "b#1+2"],
    ["missing prior", "3+1,2,10", "3+1,10"],
    ["wrong prior", "3+1,2,10", "3+1,2,11"],
    ["whole then split", "a#x#2,10 b#1", "b#1"],
    ["split then whole", "a#x#3+1,2,10 b#3+1", "b#3+1"],
    ["omitted group path", "Omissions: omitted", "Omissions: extra omitted"],
  ])("rejects %s", (_reason, original, replacement) => {
    expect(
      validate("plan", hunkPlan.replace(original, replacement)).status,
    ).toBe(INVALID_EXIT);
  });
  test("rejects a repeated whole file", () => {
    expect(
      validate(
        "plan",
        series("candidate", "none", "none").replace("file1", "file0"),
      ).status,
    ).toBe(INVALID_EXIT);
  });
  test("rejects the old six-line group", () => {
    expect(validate("plan", plan.replace("Hunks: none\n", "")).status).toBe(
      INVALID_EXIT,
    );
  });
});

describe("series verification", () => {
  test.each([
    ["worktree", "lint", "test", "same as group 2", "same as group 1"],
    ["worktree", "none", "none"],
    ["candidate", "test", "test", "none"],
  ])("accepts %j and its groups", (checks, ...commands) => {
    expect(validate("plan", series(checks, ...commands)).status).toBe(
      SUCCESS_EXIT,
    );
  });
  test.each([
    series("worktree"),
    series("each", "test"),
    plan.replace("Checks: worktree\n", ""),
    plan.replace(
      "Checks: worktree\nOmissions: none",
      "Omissions: none\nChecks: worktree",
    ),
    plan.replace("Message: fix: change a\n", ""),
    series("worktree", "test", "test"),
    series("candidate", "test", "same as group 1"),
    series("worktree", "same as group 2", "test"),
    series("worktree", "same as group 1"),
    series("worktree", "none", "same as group 1"),
    series("worktree", "test", "same as group 1", "same as group 2"),
    series("worktree", "test", "same as group 0"),
  ])("rejects inconsistent plan %s", (invalid) => {
    expect(validate("plan", invalid).status).toBe(INVALID_EXIT);
  });
});

const reuse = receipt
  .replace("python3 check.py", "same as group 1")
  .replace("exit: 0", "exit: reused")
  .replace(
    "3 assertions passed",
    "not re-run; group 1 ran it before its commit",
  );
const failedCandidate = `COMMIT_EXECUTE: VERIFY_FAILED\nReason: failure\nVerification: lint\nVerification exit: 1\nVerification evidence: failed lint\nVerification scope: ${candidate}`;

describe("verification scope and commit tree", () => {
  test.each([
    receipt,
    receipt.replace(shared, candidate),
    reuse,
    failedCandidate,
  ])("accepts receipt %s", (payload) => {
    expect(execute(payload)).toBe(SUCCESS_EXIT);
  });
  test.each([
    receipt.replace(`Tree: ${oid}=${oid}\n`, ""),
    `${receipt}extra\n`,
    receipt.replace(`=${oid}`, `=${"a".repeat(DIGEST_LENGTH)}`),
    receipt.replace(`Tree: ${oid}=${oid}`, "Tree: abc=abc"),
    receipt.replace(shared, candidate.replace(oid, "a".repeat(DIGEST_LENGTH))),
    failedCandidate.replace(oid, "abc"),
    failedCandidate.replace("; ignored files linked from the worktree", ""),
    reuse.replace(shared, candidate),
    reuse.replace("exit: reused", "exit: 0"),
    reuse.replace("same as group 1", "lint"),
    reuse.replace("same as group 1", "none"),
    reuse.replace("group 1 ran", "group 2 ran"),
    failedCandidate
      .replace(
        "lint\nVerification exit: 1",
        "same as group 1\nVerification exit: reused",
      )
      .replace(candidate, shared),
  ])("rejects inconsistent receipt %s", (payload) => {
    expect(execute(payload)).toBe(INVALID_EXIT);
  });
});

function examplePayloads(file: string): string[] {
  const markdown = readFileSync(join(dirname(dirname(script)), file), "utf8");
  const fences = markdown.matchAll(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm);
  const firstBodyLine = 1;
  const closingFence = -1;
  return Array.from(fences, ([block]) =>
    block.split("\n").slice(firstBodyLine, closingFence).join("\n").trim(),
  ).filter((body) => body.startsWith("COMMIT_"));
}

test("the shipped validator accepts every fenced envelope example", () => {
  const expectedCounts = {
    "SKILL.md": 4,
    "references/hunk-groups.md": 0,
    "state-machine.md": 0,
    "subagents/commit-boundary-planner.md": 1,
    "subagents/scoped-commit-executor.md": 1,
  };
  for (const [file, count] of Object.entries(expectedCounts)) {
    const examples = examplePayloads(file);
    expect(examples).toHaveLength(count);
    for (const payload of examples) {
      const result = validateExample(payload);
      expect(result.status, `${file}: ${result.stdout}`).toBe(SUCCESS_EXIT);
    }
  }
});

function validateExample(payload: string) {
  return validate(
    payload.startsWith("COMMIT_PLAN:") ? "plan" : "execute",
    payload,
  );
}
