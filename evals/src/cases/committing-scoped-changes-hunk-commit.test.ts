import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

import {
  candidateScript,
  COLLECTOR_ERROR_EXIT,
  edited,
  expectFailure,
  git,
  hunkRepo,
  original,
  repo,
  script,
  scriptOutput,
  SUCCESS_EXIT,
} from "#/cases/committing-scoped-changes-test-support.ts";

const proofFailed = 3;
const refused = 4;
const diverged = 5;
const executable = 0o755;
const seriesTimeoutMs = 20_000;

function installHook(cwd: string, body: string) {
  const path = join(cwd, ".git/hooks/pre-commit");
  git(cwd, "config", "core.hooksPath", ".git/hooks");
  writeFileSync(path, `#!/bin/sh\nset -eu\n${body}\n`);
  chmodSync(path, executable);
}

function fixture() {
  const { cwd, base } = hunkRepo();
  writeFileSync(join(cwd, "a"), original.replace("old", "new"));
  writeFileSync(join(cwd, "other"), "staged");
  git(cwd, "add", "a", "other");
  writeFileSync(join(cwd, "a"), edited);
  writeFileSync(join(cwd, "other"), "unstaged");
  writeFileSync(join(cwd, "loose"), "untracked");
  return {
    cwd,
    base,
    collect: (...args: string[]) => scriptOutput(cwd, script, ...args),
    candidate: (...args: string[]) =>
      scriptOutput(cwd, candidateScript, ...args),
  };
}

test(
  "commits a mixed group then a later selection without consuming unrelated state",
  { timeout: seriesTimeoutMs },
  () => {
    const { cwd, base, collect, candidate } = fixture();
    unlinkSync(join(cwd, "b"));
    const first = ["a", "b", "--hunks", base, "a#2,4"];
    const second = ["a", "--hunks", base, "a#3+2,4"];
    const laterDigest = collect("group", ...second);
    for (const [args, paths, expected] of [
      [first, ["a", "b"], "anchor\nmiddle\nold\nend\nlast"],
      [second, ["a"], "anchor\nmiddle\nnew\nend\nlast"],
    ] as const) {
      expect(collect("group", ...second)).toBe(laterDigest);
      const before = collect("preserve", ...paths);
      const tree = candidate("build", "--no-export", ...args).trim();
      expect(collect("preserve", ...paths)).toBe(before);
      installHook(
        cwd,
        `test "$(git diff --cached --name-only)" = '${paths.join("\n")}'`,
      );
      const parent = git(cwd, "rev-parse", "HEAD").trim();
      const message = "- approved; $(literal)";
      const result = candidate("commit", tree, message, ...args);
      expect(result).toBe(
        `Commit: ${git(cwd, "rev-parse", "HEAD").trim()}\nTree: ${tree}=${tree}\n`,
      );
      expect(git(cwd, "log", "-1", "--format=%P%n%T%n%s")).toBe(
        `${parent}\n${tree}\n${message}\n`,
      );
      expect(git(cwd, "show", "HEAD:a")).toBe(expected);
      expect(git(cwd, "ls-tree", "HEAD", "b")).toBe("");
      expect(readFileSync(join(cwd, "a"), "utf8")).toBe(edited);
      expect(git(cwd, "status", "--porcelain", "--", "a")).toBe(" M a\n");
      expect(git(cwd, "show", ":other")).toBe("staged");
      expect(collect("preserve", ...paths)).toBe(before);
    }
    const tree = git(cwd, "rev-parse", "HEAD^{tree}").trim();
    expectFailure(
      cwd,
      candidateScript,
      diverged,
      "commit",
      tree,
      "replay",
      ...second,
    );
    expect(git(cwd, "rev-parse", "HEAD^{tree}").trim()).toBe(tree);
  },
);

test("refuses a group file that would replace a staged descendant", () => {
  const { cwd, base, candidate } = fixture();
  const args = ["a", "b", "--hunks", base, "a#1"];
  writeFileSync(join(cwd, "b"), "approved");
  const tree = candidate("build", "--no-export", ...args).trim();
  unlinkSync(join(cwd, "b"));
  mkdirSync(join(cwd, "b"));
  writeFileSync(join(cwd, "b/child"), "protected");
  git(cwd, "add", "b");
  rmSync(join(cwd, "b"), { recursive: true });
  writeFileSync(join(cwd, "b"), "approved");
  const staged = git(cwd, "ls-files", "--stage");
  expectFailure(
    cwd,
    candidateScript,
    COLLECTOR_ERROR_EXIT,
    "commit",
    tree,
    "approved",
    ...args,
  );
  expect(git(cwd, "rev-parse", "HEAD").trim()).toBe(base);
  expect(git(cwd, "ls-files", "--stage")).toBe(staged);
});

function hookFixture() {
  const { cwd, base, collect, candidate } = fixture();
  const args = ["a", "--hunks", base, "a#1"];
  const before = collect("preserve", "a");
  const tree = candidate("build", "--no-export", ...args).trim();
  return { cwd, base, args, before, tree, collect };
}

test("warns when replacing staged split content and cleans its private directory", () => {
  const { cwd, args, tree } = hookFixture();
  const scratch = join(repo(), "scratch");
  mkdirSync(scratch);
  const result = spawnSync(
    "python3",
    ["-I", candidateScript, "commit", tree, "approved", ...args],
    {
      cwd,
      env: { ...process.env, TMPDIR: scratch },
      encoding: "utf8",
    },
  );
  expect(result.status).toBe(SUCCESS_EXIT);
  expect(result.stderr).toMatch(/warning:.*staged.*a\b/i);
  expect(readdirSync(scratch)).toEqual([]);
});

test.each(["git add -- a", ""])(
  "leaves the commit in place after a hook rewrites the worktree (%s)",
  (stage) => {
    const { cwd, base, args, before, tree, collect } = hookFixture();
    installHook(cwd, `printf rewritten > a\n${stage}`);
    expectFailure(
      cwd,
      candidateScript,
      proofFailed,
      "commit",
      tree,
      "approved",
      ...args,
    );
    expect(git(cwd, "rev-parse", "HEAD^").trim()).toBe(base);
    expect(git(cwd, "show", "HEAD:a")).toBe(git(cwd, "show", ":a"));
    expect(collect("preserve", "a")).toBe(before);
  },
);

test.each(["reject", "wrong tree"])(
  "%s leaves HEAD, real index and worktree untouched",
  (scenario) => {
    const { cwd, base, args, before, tree, collect } = hookFixture();
    const index = git(cwd, "ls-files", "--stage", "a");
    installHook(
      cwd,
      "printf rejected > a\nprintf rejected > other\ngit add -- a\nexit 1",
    );
    const wrong = scenario === "wrong tree";
    expectFailure(
      cwd,
      candidateScript,
      wrong ? diverged : refused,
      "commit",
      wrong ? base : tree,
      "approved",
      ...args,
    );
    expect(git(cwd, "rev-parse", "HEAD").trim()).toBe(base);
    expect(git(cwd, "ls-files", "--stage", "a")).toBe(index);
    expect(readFileSync(join(cwd, "a"), "utf8")).toBe(edited);
    expect(collect("preserve", "a")).toBe(before);
  },
);
