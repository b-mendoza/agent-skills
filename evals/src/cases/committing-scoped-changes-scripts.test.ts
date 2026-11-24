import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, test } from "vitest";

import {
  COLLECTOR_ERROR_EXIT,
  git,
  repo,
  script,
  SUCCESS_EXIT,
} from "#/cases/committing-scoped-changes-test-support.ts";

const validator = resolve(
  "../skills/committing-scoped-changes/scripts/validate-output.sh",
);
const INVALID_EXIT = 1;
const START_INDEX = 0;
const DIGEST_LENGTH = 40;
const EXECUTABLE_MODE = 0o755;
function submoduleRepo(): string {
  const source = repo();
  const cwd = repo();
  git(
    cwd,
    "-c",
    "protocol.file.allow=always",
    "submodule",
    "add",
    "--quiet",
    source,
    "vendor/sub",
  );
  git(cwd, "commit", "-qm", "add submodule");
  return cwd;
}
function collect(cwd: string, mode: string, ...paths: string[]) {
  return spawnSync("python3", ["-I", script, mode, ...paths], {
    cwd,
    encoding: "utf8",
  });
}
function digest(cwd: string, mode: string, ...paths: string[]): string {
  const result = collect(cwd, mode, ...paths);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(SUCCESS_EXIT);
  expect(result.stdout.trim()).toMatch(/^[0-9a-f]{40}$/);
  return result.stdout;
}
describe("shipped scoped state collector", () => {
  test("core.filemode=false predicts index modes and nonexecutable new files", () => {
    const cwd = repo();
    git(cwd, "update-index", "--chmod=+x", "b");
    git(cwd, "commit", "-qm", "executable baseline");
    git(cwd, "config", "core.filemode", "false");
    writeFileSync(join(cwd, "a"), "changed tracked nonexecutable\n");
    chmodSync(join(cwd, "a"), EXECUTABLE_MODE);
    writeFileSync(join(cwd, "b"), "changed tracked executable\n");
    const nonexecutableMode = 0o644;
    chmodSync(join(cwd, "b"), nonexecutableMode);
    writeFileSync(join(cwd, "new"), "new executable filesystem bit\n");
    chmodSync(join(cwd, "new"), EXECUTABLE_MODE);
    const prediction = collect(cwd, "blobs", "a", "b", "new");
    expect(prediction.status).toBe(SUCCESS_EXIT);
    expect(prediction.stdout).toMatch(
      /^100644 [a-f0-9]{40} a\n100755 [a-f0-9]{40} b\n100644 [a-f0-9]{40} new\n$/,
    );
    git(cwd, "add", "-N", "new");
    git(
      cwd,
      "commit",
      "--only",
      "-qm",
      "filemode ignored",
      "--",
      "a",
      "b",
      "new",
    );
    const committed = git(cwd, "ls-tree", "HEAD", "--", "a", "b", "new")
      .replaceAll(" blob ", " ")
      .replaceAll("\t", " ");
    expect(prediction.stdout).toBe(committed);
  });
  test("binds directory symlink text, even with dangling targets, and predicts its committed blob", () => {
    const cwd = repo();
    mkdirSync(join(cwd, "one"));
    mkdirSync(join(cwd, "two"));
    symlinkSync("one", join(cwd, "link"));
    const before = digest(cwd, "group", "link");
    unlinkSync(join(cwd, "link"));
    symlinkSync("two", join(cwd, "link"));
    expect(digest(cwd, "group", "link")).not.toBe(before);
    const blobs = collect(cwd, "blobs", "link");
    expect(blobs.status).toBe(SUCCESS_EXIT);
    git(cwd, "add", "-N", "link");
    git(cwd, "commit", "--only", "-qm", "link", "--", "link");
    expect(blobs.stdout).toContain(git(cwd, "rev-parse", "HEAD:link").trim());
    unlinkSync(join(cwd, "link"));
    symlinkSync("missing", join(cwd, "link"));
    expect(digest(cwd, "group", "link")).not.toBe(before);
  });
  test.each(["sh", "bash", "zsh"])(
    "%s passes two literal arguments without word splitting",
    (shell) => {
      const cwd = repo();
      const command = 'python3 -I "$1" group "$2" "$3"';
      const args = ["-c", command, "collector", script, "a", "b"];
      const run = () => execFileSync(shell, args, { cwd, encoding: "utf8" });
      const before = run();
      writeFileSync(join(cwd, "a"), "changed a\n");
      expect(run()).not.toBe(before);
      const middle = run();
      writeFileSync(join(cwd, "b"), "changed b\n");
      expect(run()).not.toBe(middle);
    },
  );
  test("binds index-only changes, deletion, executable mode, and unrelated untracked bytes", () => {
    const cwd = repo();
    const original = digest(cwd, "group", "a");
    writeFileSync(join(cwd, "a"), "staged\n");
    git(cwd, "add", "a");
    writeFileSync(join(cwd, "a"), "a\n");
    expect(digest(cwd, "group", "a")).not.toBe(original);
    git(cwd, "restore", "--staged", "a");
    chmodSync(join(cwd, "a"), EXECUTABLE_MODE);
    expect(digest(cwd, "group", "a")).not.toBe(original);
    unlinkSync(join(cwd, "a"));
    expect(digest(cwd, "group", "a")).not.toBe(original);
    writeFileSync(join(cwd, "loose"), "one");
    const preserved = digest(cwd, "preserve", "a");
    writeFileSync(join(cwd, "loose"), "two");
    expect(digest(cwd, "preserve", "a")).not.toBe(preserved);
  });
  test("preserves a stat-dirty staged path across a group commit without rewriting the index", () => {
    const cwd = repo();
    writeFileSync(join(cwd, "a"), "new a");
    writeFileSync(join(cwd, "b"), "unrelated staged");
    git(cwd, "add", "b");
    const before = digest(cwd, "preserve", "a");
    const older = new Date("2000-01-01");
    utimesSync(join(cwd, "b"), older, older);
    const index = join(cwd, ".git/index");
    const statDirtyIndex = readFileSync(index);
    expect(digest(cwd, "preserve", "a")).toBe(before);
    expect(readFileSync(index)).toEqual(statDirtyIndex);
    git(cwd, "commit", "--only", "-qm", "a", "--", "a");
    expect(digest(cwd, "preserve", "a")).toBe(before);
    expect(readFileSync(join(cwd, "b"), "utf8")).toBe("unrelated staged");
    writeFileSync(join(cwd, "b"), "unrelated edit");
    expect(digest(cwd, "preserve", "a")).not.toBe(before);
  });
  test("preserve launches the same number of Git processes as the tree grows", () => {
    const cwd = repo();
    git(cwd, "config", "core.filemode", "false");
    const processCount = (size: number) => {
      for (const index of Array.from({ length: size }).keys()) {
        writeFileSync(join(cwd, `file-${index}`), "tracked");
      }
      git(cwd, "add", ".");
      git(cwd, "commit", "-qm", `track ${size} files`);
      const trace = join(cwd, ".git", `trace-${size}`);
      execFileSync("python3", ["-I", script, "preserve", "a"], {
        cwd,
        env: { ...process.env, GIT_TRACE2_EVENT: trace },
      });
      return readFileSync(trace, "utf8")
        .split("\n")
        .filter((line) => line.includes('"event":"start"')).length;
    };
    const smallSize = 5;
    const largeSize = 50;
    const smallCount = processCount(smallSize);
    expect(smallCount).toBeTruthy();
    expect(processCount(largeSize)).toBe(smallCount);
  });
  test("distinguishes intent-to-add from a staged empty file", () => {
    const cwd = repo();
    writeFileSync(join(cwd, "empty"), "");
    git(cwd, "add", "-N", "empty");
    const intent = digest(cwd, "preserve", "a");
    git(cwd, "add", "empty");
    expect(digest(cwd, "preserve", "a")).not.toBe(intent);
    git(cwd, "restore", "--staged", "empty");
    git(cwd, "add", "-N", "empty");
    expect(digest(cwd, "preserve", "a")).toBe(intent);
  });
  test("hashes bytes even when assume-unchanged hides a worktree edit", () => {
    const cwd = repo();
    const before = digest(cwd, "preserve", "a");
    git(cwd, "update-index", "--assume-unchanged", "b");
    expect(digest(cwd, "preserve", "a")).toBe(before);
    writeFileSync(join(cwd, "b"), "hidden edit");
    expect(git(cwd, "status", "--porcelain")).toBe("");
    const hidden = digest(cwd, "preserve", "a");
    expect(hidden).not.toBe(before);
    git(cwd, "update-index", "--no-assume-unchanged", "b");
    expect(digest(cwd, "preserve", "a")).not.toBe(hidden);
    writeFileSync(join(cwd, "b"), "b\n");
    expect(digest(cwd, "preserve", "a")).toBe(before);
  });
  test("binds the cleaned content of a dirty file and fails closed if conversion fails", () => {
    const cwd = repo();
    writeFileSync(join(cwd, ".git/info/attributes"), "b filter=checked\n");
    writeFileSync(join(cwd, "b"), "dirty\n");
    git(cwd, "config", "filter.checked.clean", "tr a-z A-Z");
    const before = digest(cwd, "preserve", "a");
    git(cwd, "config", "filter.checked.clean", "tr a-z 0-9");
    expect(digest(cwd, "preserve", "a")).not.toBe(before);
    git(cwd, "config", "filter.checked.clean", "false");
    git(cwd, "config", "filter.checked.required", "true");
    const failure = collect(cwd, "preserve", "a");
    expect(failure.status).toBe(COLLECTOR_ERROR_EXIT);
    expect(failure.stdout).toBe("");
  });
  test("does not inspect an excluded gitlink's broken Git directory", () => {
    const cwd = submoduleRepo();
    const before = digest(cwd, "preserve", "vendor/sub");
    writeFileSync(join(cwd, "vendor/sub/.git"), "gitdir: missing\n");
    expect(digest(cwd, "preserve", "vendor/sub")).toBe(before);
  });
  test("protects children and prefixed siblings of a supplied directory name", () => {
    const cwd = repo();
    mkdirSync(join(cwd, "dir"));
    const paths = ["dir/child", "dir-extra"];
    for (const path of paths) writeFileSync(join(cwd, path), "original");
    const before = digest(cwd, "preserve", "dir", "a");
    writeFileSync(join(cwd, "a"), "approved edit");
    expect(digest(cwd, "preserve", "dir", "a")).toBe(before);
    for (const path of paths) {
      writeFileSync(join(cwd, path), "protected edit");
      expect(digest(cwd, "preserve", "dir", "a")).not.toBe(before);
      writeFileSync(join(cwd, path), "original");
    }
  });
  test("preserves an uninitialized gitlink across an unrelated commit", () => {
    const cwd = submoduleRepo();
    git(cwd, "submodule", "deinit", "--force", "vendor/sub");
    writeFileSync(join(cwd, "a"), "new a\n");
    const before = digest(cwd, "preserve", "a");
    git(cwd, "commit", "--only", "-qm", "a", "--", "a");
    expect(digest(cwd, "preserve", "a")).toBe(before);
  });
  test("predicts the index OID for an uninitialized gitlink", () => {
    const cwd = submoduleRepo();
    const oid = git(cwd, "rev-parse", ":vendor/sub").trim();
    git(cwd, "submodule", "deinit", "--force", "vendor/sub");
    const result = collect(cwd, "blobs", "vendor/sub");
    expect(result.status).toBe(SUCCESS_EXIT);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`160000 ${oid} vendor/sub\n`);
  });
  test("detects an initialized submodule HEAD moving away from its index OID", () => {
    const cwd = submoduleRepo();
    const submodule = join(cwd, "vendor/sub");
    const indexedOid = git(cwd, "rev-parse", ":vendor/sub").trim();
    const before = digest(cwd, "preserve", "a");
    git(
      submodule,
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "-qm",
      "move submodule HEAD",
    );
    const head = git(submodule, "rev-parse", "HEAD").trim();
    expect(head).not.toBe(indexedOid);
    expect(digest(cwd, "preserve", "a")).not.toBe(before);
    const result = collect(cwd, "blobs", "vendor/sub");
    expect(result.status).toBe(SUCCESS_EXIT);
    expect(result.stdout).toBe(`160000 ${head} vendor/sub\n`);
  });
  test("reports a missing gitlink directory as deleted", () => {
    const cwd = submoduleRepo();
    const before = digest(cwd, "preserve", "a");
    rmSync(join(cwd, "vendor/sub"), { recursive: true });
    const result = collect(cwd, "blobs", "vendor/sub");
    expect(result.status).toBe(SUCCESS_EXIT);
    expect(result.stdout).toBe("000000 - vendor/sub\n");
    expect(digest(cwd, "preserve", "a")).not.toBe(before);
  });
  test("fails without partial output for an initialized gitlink with an unborn HEAD", () => {
    const cwd = submoduleRepo();
    git(join(cwd, "vendor/sub"), "symbolic-ref", "HEAD", "refs/heads/unborn");
    const result = collect(cwd, "blobs", "a", "vendor/sub");
    expect(result.status).toBe(COLLECTOR_ERROR_EXIT);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("HEAD");
  });
  test("hashes a gitlink replaced by a symlink without following its target", () => {
    const cwd = submoduleRepo();
    rmSync(join(cwd, "vendor/sub"), { recursive: true });
    symlinkSync("../..", join(cwd, "vendor/sub"));
    const oid = execFileSync("git", ["hash-object", "--stdin"], {
      cwd,
      input: "../..",
      encoding: "utf8",
    }).trim();
    const result = collect(cwd, "blobs", "vendor/sub");
    expect(result.status).toBe(SUCCESS_EXIT);
    expect(result.stdout).toBe(`120000 ${oid} vendor/sub\n`);
  });
  test("refuses a gitlink reached through a symlink ancestor", () => {
    const cwd = submoduleRepo();
    const outside = repo();
    rmSync(join(cwd, "vendor"), { recursive: true });
    symlinkSync(outside, join(cwd, "vendor"));
    const result = collect(cwd, "blobs", "vendor/sub");
    expect(result.status).toBe(COLLECTOR_ERROR_EXIT);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("symlink ancestor");
  });
  test.each(
    [
      [],
      ["missing"],
      ["a b"],
      ["../a"],
      [resolve("absolute-path")],
      ["a", "a"],
    ].map((paths) => ({ paths })),
  )("fails closed for invalid group paths $paths", ({ paths }) => {
    const result = collect(repo(), "group", ...paths);
    expect(result.status).not.toBe(SUCCESS_EXIT);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toBe("");
  });
  test("a failed Git command yields no partial digest", () => {
    const cwd = repo();
    rmSync(join(cwd, ".git"), { recursive: true });
    const result = collect(cwd, "group", "a");
    expect(result.status).not.toBe(SUCCESS_EXIT);
    expect(result.stdout).toBe("");
  });
  test("a hashing failure after an earlier path succeeds emits no partial blob receipt", () => {
    const cwd = repo();
    writeFileSync(join(cwd, ".gitattributes"), "b filter=broken\n");
    git(cwd, "config", "filter.broken.clean", "false");
    git(cwd, "config", "filter.broken.required", "true");
    const result = collect(cwd, "blobs", "a", "b");
    expect(result.status).not.toBe(SUCCESS_EXIT);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("filter");
  });
  test("ignored tracked staged deletion still predicts commit --only content", () => {
    const cwd = repo();
    writeFileSync(join(cwd, ".gitignore"), "a\n");
    git(cwd, "add", ".gitignore");
    git(cwd, "commit", "-qm", "ignore");
    git(cwd, "rm", "--cached", "a");
    writeFileSync(join(cwd, "a"), "new ignored content\n");
    const result = collect(cwd, "blobs", "a");
    expect(result.status).toBe(SUCCESS_EXIT);
    git(cwd, "commit", "--only", "-qm", "ignored", "--", "a");
    expect(result.stdout).toContain(git(cwd, "rev-parse", "HEAD:a").trim());
  });
});

const plan = `COMMIT_PLAN: PASS\nGroup: 1\nMessage: fix: change a\nPaths: a\nExpansions: none\nVerification: none\nDigest: ${"a".repeat(DIGEST_LENGTH)}\nOmissions: none\nWarnings: none\n`;
const receipt = `COMMIT_EXECUTE: PASS\nCommit: abcdef0 fix: change a\nPaths: a\nPreserved: ${"b".repeat(DIGEST_LENGTH)}=${"b".repeat(DIGEST_LENGTH)}\nVerification: python3 check.py\nVerification exit: 0\nVerification evidence: 3 assertions passed\nVerification scope: shared worktree; not an isolated commit tree\n`;
function validate(mode: string, input: string) {
  return spawnSync("sh", [validator, mode], { input, encoding: "utf8" });
}
describe("shipped envelope validator", () => {
  test("accepts a real digest but rejects the historical empty-input hash", () => {
    expect(validate("plan", plan).status).toBe(SUCCESS_EXIT);
    expect(
      validate(
        "plan",
        plan.replace(
          "a".repeat(DIGEST_LENGTH),
          "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
        ),
      ).status,
    ).toBe(INVALID_EXIT);
  });
  test("requires successful receipts to disclose verification evidence and scope", () => {
    expect(validate("execute", receipt).status).toBe(SUCCESS_EXIT);
    expect(
      validate("execute", receipt.split("Verification:")[START_INDEX] ?? "")
        .status,
    ).toBe(INVALID_EXIT);
    expect(
      validate(
        "execute",
        receipt.replace("Verification exit: 0", "Verification exit: 1"),
      ).status,
    ).toBe(INVALID_EXIT);
    expect(
      validate(
        "execute",
        receipt.replace(
          "shared worktree; not an isolated commit tree",
          "isolated commit tree",
        ),
      ).status,
    ).toBe(INVALID_EXIT);
  });
  test("post-verification commit and hook failures retain the observed check evidence", () => {
    const evidence = `Verification: python3 check.py\nVerification exit: 0\nVerification evidence: 3 assertions passed\nVerification scope: shared worktree; not an isolated commit tree\n`;
    for (const header of [
      "COMMIT_EXECUTE: COMMIT_ERROR\nReason: rejected\n",
      "COMMIT_EXECUTE: HOOK_MUTATION\nReason: changed tree\nCommit: abcdef0 fix: change a\n",
    ]) {
      expect(validate("execute", header + evidence).status).toBe(SUCCESS_EXIT);
      expect(validate("execute", header).status).toBe(INVALID_EXIT);
    }
    expect(
      validate(
        "execute",
        `COMMIT_EXECUTE: ERROR\nReason: collection failed after verification\n${evidence}`,
      ).status,
    ).toBe(SUCCESS_EXIT);
  });
  test("none and failed checks have explicit, consistent receipts", () => {
    const none = receipt
      .replace("python3 check.py", "none")
      .replace("Verification exit: 0", "Verification exit: not-run")
      .replace("3 assertions passed", "not run");
    expect(validate("execute", none).status).toBe(SUCCESS_EXIT);
    expect(validate("execute", none.replace("not-run", "0")).status).toBe(
      INVALID_EXIT,
    );
    const failed = `COMMIT_EXECUTE: VERIFY_FAILED\nReason: checker failed\nVerification: python3 check.py\nVerification exit: 1\nVerification evidence: assertion failed\nVerification scope: shared worktree; not an isolated commit tree\n`;
    expect(validate("execute", failed).status).toBe(SUCCESS_EXIT);
    expect(
      validate("execute", failed.replace("exit: 1", "exit: 0")).status,
    ).toBe(INVALID_EXIT);
  });
});
