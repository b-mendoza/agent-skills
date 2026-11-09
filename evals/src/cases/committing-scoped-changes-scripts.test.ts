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
});
