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
  test("binds directory symlink text, even with dangling targets", () => {
    const cwd = repo();
    mkdirSync(join(cwd, "one"));
    mkdirSync(join(cwd, "two"));
    symlinkSync("one", join(cwd, "link"));
    const before = digest(cwd, "group", "link");
    unlinkSync(join(cwd, "link"));
    symlinkSync("two", join(cwd, "link"));
    expect(digest(cwd, "group", "link")).not.toBe(before);
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
  });
  test("reports a missing gitlink directory as deleted", () => {
    const cwd = submoduleRepo();
    const before = digest(cwd, "preserve", "a");
    rmSync(join(cwd, "vendor/sub"), { recursive: true });
    expect(digest(cwd, "preserve", "a")).not.toBe(before);
  });
  test("fails without partial output for an initialized gitlink with an unborn HEAD", () => {
    const cwd = submoduleRepo();
    git(join(cwd, "vendor/sub"), "symbolic-ref", "HEAD", "refs/heads/unborn");
    for (const result of [
      collect(cwd, "group", "a", "vendor/sub"),
      collect(cwd, "preserve", "a"),
    ]) {
      expect(result.status).toBe(COLLECTOR_ERROR_EXIT);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("HEAD");
    }
  });
  test("refuses a gitlink reached through a symlink ancestor", () => {
    const cwd = submoduleRepo();
    const outside = repo();
    rmSync(join(cwd, "vendor"), { recursive: true });
    symlinkSync(outside, join(cwd, "vendor"));
    const result = collect(cwd, "group", "vendor/sub");
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
});
