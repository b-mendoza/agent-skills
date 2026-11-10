import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

const script = resolve(
  "../skills/committing-scoped-changes/scripts/collect-state.py",
);
const validator = resolve(
  "../skills/committing-scoped-changes/scripts/validate-output.sh",
);
const repos: string[] = [];
const SUCCESS_EXIT = 0;
const INVALID_EXIT = 1;
const COLLECTOR_ERROR_EXIT = 2;
const START_INDEX = 0;
const DIGEST_LENGTH = 40;
const EXECUTABLE_MODE = 0o755;
function repo(): string {
  const path = mkdtempSync(join(tmpdir(), "scoped-state-"));
  repos.push(path);
  git(path, "init", "-q");
  git(path, "config", "user.name", "Fixture");
  git(path, "config", "user.email", "fixture@example.invalid");
  git(path, "config", "commit.gpgsign", "false");
  writeFileSync(join(path, "a"), "a\n");
  writeFileSync(join(path, "b"), "b\n");
  git(path, "add", ".");
  git(path, "commit", "-qm", "initial");
  return path;
}
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
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
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
afterEach(() => {
  for (const path of repos.splice(START_INDEX)) {
    rmSync(path, { recursive: true, force: true });
  }
});

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
      const run = () =>
        execFileSync(
          shell,
          [
            "-c",
            'python3 -I "$1" group "$2" "$3"',
            "collector",
            script,
            "a",
            "b",
          ],
          { cwd, encoding: "utf8" },
        );
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
  test("preservation excludes only approved paths and remains stable across their commit", () => {
    const cwd = repo();
    writeFileSync(join(cwd, "a"), "new a");
    writeFileSync(join(cwd, "b"), "unrelated staged");
    git(cwd, "add", "b");
    const before = digest(cwd, "preserve", "a");
    git(cwd, "commit", "--only", "-qm", "a", "--", "a");
    expect(digest(cwd, "preserve", "a")).toBe(before);
    expect(readFileSync(join(cwd, "b"), "utf8")).toBe("unrelated staged");
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
