// Pins how a `git status` sample is classified.
//
// The mutation-scope guarantee rests entirely on this: "the worktree is clean"
// and "the sample failed" were once the same empty string, so two failed
// samples compared equal and the read-only assertion passed on evidence that
// was never collected. These run offline against local `git`.
//
//   pnpm test

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test } from "vitest";

import { describeGitStatus, gitStatus } from "#/observation/harness.ts";

const temps: string[] = [];
const realPath = process.env["PATH"];

afterEach(() => {
  if (realPath === undefined) {
    delete process.env["PATH"];
  } else {
    process.env["PATH"] = realPath;
  }
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "git-status-"));
  temps.push(dir);
  return dir;
}

function repo(): string {
  const dir = tempDir();
  execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "ignore" });
  return dir;
}

test("a clean worktree reports its empty entry list", () => {
  expect(gitStatus(repo())).toStrictEqual({ kind: "worktree", entries: "" });
});

test("a dirty worktree reports its entries", () => {
  const dir = repo();
  writeFileSync(join(dir, "a.txt"), "hello\n");

  expect(gitStatus(dir)).toStrictEqual({
    kind: "worktree",
    entries: "?? a.txt",
  });
});

test("a directory that is not a repo is a known state, not a failure", () => {
  // This is the `not-git` fixture. It must stay distinct from a failed sample
  // or that fixture's cases would start failing.
  expect(gitStatus(tempDir())).toStrictEqual({ kind: "no-worktree" });
});

test("a corrupt index is unreadable rather than clean", () => {
  // Exit 128 is git's generic fatal code, so this returns the same status as
  // "not a repository". Only the message separates them -- classifying by
  // exit code alone would file a corrupt repo as an expected empty state.
  const dir = repo();
  writeFileSync(join(dir, "f.txt"), "x");
  execFileSync("git", ["add", "f.txt"], { cwd: dir, stdio: "ignore" });
  writeFileSync(join(dir, ".git", "index"), "garbage");

  const status = gitStatus(dir);

  expect(status.kind).toBe("unreadable");
  expect(describeGitStatus(status)).toContain("index file");
});

test("a missing directory is unreadable", () => {
  const status = gitStatus(join(tmpdir(), "definitely-does-not-exist-xyz"));

  expect(status).toStrictEqual({ kind: "unreadable", reason: "ENOENT" });
});

test("a missing git binary is unreadable, not clean", () => {
  const dir = repo();
  process.env["PATH"] = tempDir();

  expect(gitStatus(dir).kind).toBe("unreadable");
});

test("every state renders distinguishably in a failure message", () => {
  // A failure message that cannot tell these apart sends the reader hunting
  // for a mutation that never happened.
  expect(describeGitStatus({ kind: "worktree", entries: "" })).toBe('""');
  expect(describeGitStatus({ kind: "no-worktree" })).toBe("(not a worktree)");
  expect(describeGitStatus({ kind: "unreadable", reason: "ENOENT" })).toBe(
    "(unreadable: ENOENT)",
  );
});
