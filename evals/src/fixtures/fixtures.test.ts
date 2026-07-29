// Pins the fixture invariants every paid observation rests on.
//
// If a fixture silently stops being a git repo, stops hiding `.claude/` from
// `git status`, or leaks state between cases, the suite keeps reporting results
// that no longer mean what the case says they mean. These run offline against
// local `git`; they never invoke the agent CLI.
//
//   pnpm test

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, expect, test } from "vitest";

import type { Fixture, FixtureKind } from "#/fixtures/fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";

const SKILL = "analyzing-recent-project-state";

// Cleanup runs even when an assertion throws, so a failing test cannot leave a
// temp tree behind.
const open: Fixture[] = [];

function fixture(kind: FixtureKind): Fixture {
  const fx = makeFixture(kind, SKILL);
  open.push(fx);
  return fx;
}

afterEach(() => {
  while (open.length > 0) open.pop()?.cleanup();
});

// Only the trailing newline is stripped: the leading column of `git status
// --short` is significant (" M" is modified-unstaged), so a full trim would
// corrupt the very thing being asserted.
function status(repo: string): string {
  return execFileSync("git", ["status", "--short"], {
    cwd: repo,
    encoding: "utf8",
  }).replace(/\n$/, "");
}

test.each<FixtureKind>(["clean", "dirty", "not-git", "missing-path"])(
  "%s: the skill is copied in where the agent looks for it",
  (kind) => {
    const fx = fixture(kind);

    // Skills resolve from `<cwd>/.claude/skills/`, not the repo's own skills/.
    expect(existsSync(join(fx.cwd, ".claude", "skills", SKILL))).toBe(true);
    expect(
      existsSync(join(fx.cwd, ".claude", "skills", SKILL, "SKILL.md")),
    ).toBe(true);
  },
);

test.each<FixtureKind>(["clean", "dirty", "missing-path"])(
  "%s: is a real worktree and reports itself as the git repo",
  (kind) => {
    const fx = fixture(kind);

    expect(existsSync(join(fx.cwd, ".git"))).toBe(true);
    expect(fx.gitRepo).toBe(fx.cwd);
  },
);

test("not-git: has no worktree and declares no git repo", () => {
  const fx = fixture("not-git");

  expect(existsSync(join(fx.cwd, ".git"))).toBe(false);
  // `undefined` is what makes run.ts fall back to cwd for the status sample.
  expect(fx.gitRepo).toBeUndefined();
});

test("clean: has a commit and a quiet status", () => {
  const fx = fixture("clean");

  // The quiet-state case depends on this being an empty evidence window.
  expect(status(fx.cwd)).toBe("");
  expect(existsSync(join(fx.cwd, "a.txt"))).toBe(true);
});

test("dirty: carries exactly the intended modified and untracked entries", () => {
  const fx = fixture("dirty");

  // Sorted so the assertion does not depend on git's output ordering.
  expect(
    status(fx.cwd)
      .split("\n")
      .sort((a, b) => a.localeCompare(b)),
  ).toStrictEqual([" M a.txt", "?? c.txt"]);
  // b.txt was committed, so it must NOT appear as a pending change.
  expect(existsSync(join(fx.cwd, "b.txt"))).toBe(true);
});

test("the copied skill is excluded from git status", () => {
  const fx = fixture("clean");

  // Without this, every mutation-scope assertion would see the fixture's own
  // scaffolding and read as a violation.
  expect(status(fx.cwd)).not.toContain(".claude");
  expect(
    readFileSync(join(fx.cwd, ".git", "info", "exclude"), "utf8"),
  ).toContain(".claude/");
});

test("missingPath does not exist and notGitPath is a real non-worktree", () => {
  const fx = fixture("missing-path");

  expect(existsSync(fx.missingPath)).toBe(false);

  expect(existsSync(fx.notGitPath)).toBe(true);
  expect(existsSync(join(fx.notGitPath, ".git"))).toBe(false);
  // A directory with content, so the skill fails on "not a worktree" rather
  // than on "empty directory".
  expect(existsSync(join(fx.notGitPath, "notes.txt"))).toBe(true);
});

test("each call gets an isolated tree", () => {
  const a = fixture("dirty");
  const b = fixture("dirty");

  expect(a.cwd).not.toBe(b.cwd);

  // Writing through one fixture must not be visible in the other.
  execFileSync("git", ["config", "user.name", "Only A"], { cwd: a.cwd });
  const bName = execFileSync("git", ["config", "user.name"], {
    cwd: b.cwd,
    encoding: "utf8",
  }).trim();

  expect(bName).toBe("Eval Fixture");
});

test("cleanup removes the whole temp tree", () => {
  // Registered too: an assertion that throws before the explicit cleanup below
  // must not leak the temp tree this test exists to prove is removable.
  const fx = fixture("dirty");
  const { cwd, notGitPath } = fx;

  expect(existsSync(cwd)).toBe(true);
  fx.cleanup();

  expect(existsSync(cwd)).toBe(false);
  // The sibling non-repo lives under the same root and must go too.
  expect(existsSync(notGitPath)).toBe(false);
});

test("cleanup is safe to call twice", () => {
  const fx = fixture("clean");
  fx.cleanup();

  // `finally` in runCase can race a failed run; a second call must not throw.
  expect(() => {
    fx.cleanup();
  }).not.toThrow();
});
