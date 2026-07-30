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

import type { GitStatus } from "#/observation/harness.ts";
import { describeGitStatus, gitStatus } from "#/observation/harness.ts";

const tempDirectories: string[] = [];
const realPath = process.env["PATH"];

afterEach(() => {
  if (realPath === undefined) {
    delete process.env["PATH"];
  } else {
    process.env["PATH"] = realPath;
  }
  for (const tempDirectory of tempDirectories.splice(0)) {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});

function createTempDirectory(): string {
  const tempDirectory = mkdtempSync(join(tmpdir(), "git-status-"));
  tempDirectories.push(tempDirectory);
  return tempDirectory;
}

function createRepository(): string {
  const repositoryDirectory = createTempDirectory();
  execFileSync("git", ["init", "-q"], {
    cwd: repositoryDirectory,
    stdio: "ignore",
  });
  return repositoryDirectory;
}

test("a clean worktree reports its empty entry list", () => {
  expect(gitStatus(createRepository())).toStrictEqual({
    kind: "worktree",
    entries: "",
  });
});

test("a dirty worktree reports its entries", () => {
  const repositoryDirectory = createRepository();
  writeFileSync(join(repositoryDirectory, "a.txt"), "hello\n");

  expect(gitStatus(repositoryDirectory)).toStrictEqual({
    kind: "worktree",
    entries: "?? a.txt",
  });
});

test("a directory that is not a repo is a known state, not a failure", () => {
  // This is the `not-git` fixture. It must stay distinct from a failed sample
  // or that fixture's cases would start failing.
  expect(gitStatus(createTempDirectory())).toStrictEqual({
    kind: "no-worktree",
  });
});

test("a corrupt index is unreadable rather than clean", () => {
  // Exit 128 is git's generic fatal code, so this returns the same status as
  // "not a repository". Only the message separates them -- classifying by
  // exit code alone would file a corrupt repo as an expected empty state.
  const repositoryDirectory = createRepository();
  writeFileSync(join(repositoryDirectory, "f.txt"), "x");
  execFileSync("git", ["add", "f.txt"], {
    cwd: repositoryDirectory,
    stdio: "ignore",
  });
  writeFileSync(join(repositoryDirectory, ".git", "index"), "garbage");

  const status = gitStatus(repositoryDirectory);

  expect(status.kind).toBe("unreadable");
  if (status.kind !== "unreadable") {
    throw new Error("expected an unreadable git status");
  }
  expect(status.reason).not.toBe("");
});

test("a missing directory is unreadable", () => {
  const status = gitStatus(join(tmpdir(), "definitely-does-not-exist-xyz"));

  expect(status).toStrictEqual({ kind: "unreadable", reason: "ENOENT" });
});

test("a missing git binary is unreadable, not clean", () => {
  const repositoryDirectory = createRepository();
  process.env["PATH"] = createTempDirectory();

  expect(gitStatus(repositoryDirectory).kind).toBe("unreadable");
});

// A failure message that cannot tell these apart sends the reader hunting for
// a mutation that never happened.
test.each([
  [
    "a clean worktree renders as quoted empty entries",
    { kind: "worktree", entries: "" },
    '""',
  ],
  [
    "a non-worktree renders as an expected repository state",
    { kind: "no-worktree" },
    "(not a worktree)",
  ],
  [
    "an unreadable sample renders its diagnostic",
    { kind: "unreadable", reason: "ENOENT" },
    "(unreadable: ENOENT)",
  ],
] satisfies ReadonlyArray<readonly [string, GitStatus, string]>)(
  "%s",
  (_caseName, status, expectedText) => {
    expect(describeGitStatus(status)).toBe(expectedText);
  },
);
