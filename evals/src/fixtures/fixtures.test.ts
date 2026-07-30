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

const FIXTURE_SKILL_NAME = "analyzing-recent-project-state";
const FIXTURE_KIND_SET = {
  clean: true,
  dirty: true,
  "not-git": true,
  "missing-path": true,
} satisfies Record<FixtureKind, true>;
const FIXTURE_KINDS = Object.keys(FIXTURE_KIND_SET).filter(
  (kind): kind is FixtureKind => Object.hasOwn(FIXTURE_KIND_SET, kind),
);
const GIT_FIXTURE_KINDS = FIXTURE_KINDS.filter((kind) => kind !== "not-git");

// Cleanup runs even when an assertion throws, so a failing test cannot leave a
// temp tree behind.
const openFixtures: Fixture[] = [];

function createFixture(kind: FixtureKind): Fixture {
  const fixture = makeFixture(kind, FIXTURE_SKILL_NAME);
  openFixtures.push(fixture);
  return fixture;
}

afterEach(() => {
  while (openFixtures.length > 0) openFixtures.pop()?.cleanup();
});

// Only the trailing newline is stripped: the leading column of `git status
// --short` is significant (" M" is modified-unstaged), so a full trim would
// corrupt the very thing being asserted.
function readGitStatus(repositoryPath: string): string {
  return execFileSync("git", ["status", "--short"], {
    cwd: repositoryPath,
    encoding: "utf8",
  }).replace(/\n$/, "");
}

test.each<FixtureKind>(FIXTURE_KINDS)(
  "%s: the skill is copied in where the agent looks for it",
  (kind) => {
    const fixture = createFixture(kind);

    // Skills resolve from `<cwd>/.claude/skills/`, not the repo's own skills/.
    expect(
      existsSync(join(fixture.cwd, ".claude", "skills", FIXTURE_SKILL_NAME)),
    ).toBe(true);
    expect(
      existsSync(
        join(fixture.cwd, ".claude", "skills", FIXTURE_SKILL_NAME, "SKILL.md"),
      ),
    ).toBe(true);
  },
);

test.each<FixtureKind>(GIT_FIXTURE_KINDS)(
  "%s: is a real worktree and reports itself as the git repo",
  (kind) => {
    const fixture = createFixture(kind);

    expect(existsSync(join(fixture.cwd, ".git"))).toBe(true);
    expect(fixture.gitRepo).toBe(fixture.cwd);
  },
);

test("not-git: has no worktree and declares no git repo", () => {
  const fixture = createFixture("not-git");

  expect(existsSync(join(fixture.cwd, ".git"))).toBe(false);
  // `undefined` is what makes run.ts fall back to cwd for the status sample.
  expect(fixture.gitRepo).toBeUndefined();
});

test("clean: has a commit and a quiet status", () => {
  const fixture = createFixture("clean");

  // The quiet-state case depends on this being an empty evidence window.
  expect(readGitStatus(fixture.cwd)).toBe("");
  expect(existsSync(join(fixture.cwd, "a.txt"))).toBe(true);
});

test("dirty: carries exactly the intended modified and untracked entries", () => {
  const fixture = createFixture("dirty");

  // Sorted so the assertion does not depend on git's output ordering.
  expect(
    readGitStatus(fixture.cwd)
      .split("\n")
      .sort((firstEntry, secondEntry) => firstEntry.localeCompare(secondEntry)),
  ).toStrictEqual([" M a.txt", "?? c.txt"]);
  // b.txt was committed, so it must NOT appear as a pending change.
  expect(existsSync(join(fixture.cwd, "b.txt"))).toBe(true);
});

test("the copied skill is excluded from git status", () => {
  const fixture = createFixture("clean");

  // Without this, every mutation-scope assertion would see the fixture's own
  // scaffolding and read as a violation.
  expect(readGitStatus(fixture.cwd)).not.toContain(".claude");
  expect(
    readFileSync(join(fixture.cwd, ".git", "info", "exclude"), "utf8"),
  ).toContain(".claude/");
});

test("missingPath does not exist and notGitPath is a real non-worktree", () => {
  const fixture = createFixture("missing-path");

  expect(existsSync(fixture.missingPath)).toBe(false);

  expect(existsSync(fixture.notGitPath)).toBe(true);
  expect(existsSync(join(fixture.notGitPath, ".git"))).toBe(false);
  // A directory with content, so the skill fails on "not a worktree" rather
  // than on "empty directory".
  expect(existsSync(join(fixture.notGitPath, "notes.txt"))).toBe(true);
});

test("each call gets an isolated tree", () => {
  const firstFixture = createFixture("dirty");
  const secondFixture = createFixture("dirty");

  expect(firstFixture.cwd).not.toBe(secondFixture.cwd);

  // Writing through one fixture must not be visible in the other.
  execFileSync("git", ["config", "user.name", "Only A"], {
    cwd: firstFixture.cwd,
  });
  const secondFixtureUserName = execFileSync("git", ["config", "user.name"], {
    cwd: secondFixture.cwd,
    encoding: "utf8",
  }).trim();

  expect(secondFixtureUserName).toBe("Eval Fixture");
});

test("cleanup removes the whole temp tree", () => {
  // Registered too: an assertion that throws before the explicit cleanup below
  // must not leak the temp tree this test exists to prove is removable.
  const fixture = createFixture("dirty");
  const { cwd, notGitPath } = fixture;

  expect(existsSync(cwd)).toBe(true);
  fixture.cleanup();

  expect(existsSync(cwd)).toBe(false);
  // The sibling non-repo lives under the same root and must go too.
  expect(existsSync(notGitPath)).toBe(false);
});

test("cleanup is safe to call twice", () => {
  const fixture = createFixture("clean");
  fixture.cleanup();

  // `finally` in runCase can race a failed run; a second call must not throw.
  expect(() => {
    fixture.cleanup();
  }).not.toThrow();
});
