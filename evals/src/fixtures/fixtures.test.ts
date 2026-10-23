// Real fixtures must match the states the paid observations claim to inspect.
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

import { afterEach, expect, test, vi } from "vitest";

import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import type { Fixture, FixtureKind } from "#/fixtures/fixtures.ts";
import {
  DIRTY_FIXTURE_FACTS,
  HOSTILE_FIXTURE_FACTS,
  makeFixture,
} from "#/fixtures/fixtures.ts";

const openFixtures: Fixture[] = [];

function createFixture(kind: FixtureKind): Fixture {
  const fixture = makeFixture(kind, SKILL);
  openFixtures.push(fixture);
  return fixture;
}

afterEach(() => {
  let fixture = openFixtures.pop();
  while (fixture !== undefined) {
    fixture.cleanup();
    fixture = openFixtures.pop();
  }
});

// Preserve the leading status column, which distinguishes unstaged edits.
function readGitStatus(repositoryPath: string): string {
  return execFileSync("git", ["status", "--short"], {
    cwd: repositoryPath,
    encoding: "utf8",
  }).replace(/\n$/, "");
}

test("clean: provisions a discoverable skill in a committed quiet worktree", () => {
  const fixture = createFixture("clean");
  expect(
    existsSync(join(fixture.cwd, ".claude", "skills", SKILL, "SKILL.md")),
  ).toBe(true);
  expect(fixture.gitRepo).toBe(fixture.cwd);
  expect(
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: fixture.cwd,
      encoding: "utf8",
    }).trim(),
  ).toBe(realpathSync(fixture.cwd));
  expect(
    execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: fixture.cwd,
      encoding: "utf8",
    }).trim(),
  ).toMatch(/^[\da-f]{40}$/);
  // The copied skill must not appear as untracked fixture noise.
  expect(readGitStatus(fixture.cwd)).toBe("");
});

test("dirty: provisions a discoverable skill with exactly the planted edits and commit", () => {
  const fixture = createFixture("dirty");
  expect(
    existsSync(join(fixture.cwd, ".claude", "skills", SKILL, "SKILL.md")),
  ).toBe(true);
  expect(fixture.gitRepo).toBe(fixture.cwd);
  expect(
    readGitStatus(fixture.cwd)
      .split("\n")
      .sort((firstEntry, secondEntry) => firstEntry.localeCompare(secondEntry)),
  ).toStrictEqual([
    ` M ${DIRTY_FIXTURE_FACTS.modifiedTrackedFile}`,
    `?? ${DIRTY_FIXTURE_FACTS.untrackedFile}`,
  ]);
  expect(
    execFileSync(
      "git",
      ["log", "-1", "--format=%s", "--", DIRTY_FIXTURE_FACTS.committedFile],
      {
        cwd: fixture.cwd,
        encoding: "utf8",
      },
    ).trim(),
  ).toBe(DIRTY_FIXTURE_FACTS.committedSubject);
});

test("hostile: provisions a discoverable skill and both planted injection channels", () => {
  const fixture = createFixture("hostile");
  expect(
    existsSync(join(fixture.cwd, ".claude", "skills", SKILL, "SKILL.md")),
  ).toBe(true);
  expect(fixture.gitRepo).toBe(fixture.cwd);
  expect(
    readFileSync(
      join(fixture.cwd, HOSTILE_FIXTURE_FACTS.hostileTrackedFile),
      "utf8",
    ),
  ).toContain(HOSTILE_FIXTURE_FACTS.plantedCompliancePhrase);
  expect(
    execFileSync(
      "git",
      [
        "log",
        "-1",
        "--format=%s",
        "--",
        HOSTILE_FIXTURE_FACTS.hostileTrackedFile,
      ],
      {
        cwd: fixture.cwd,
        encoding: "utf8",
      },
    ).trim(),
  ).toBe(HOSTILE_FIXTURE_FACTS.hostileCommitSubject);
  expect(
    execFileSync(
      "git",
      ["ls-files", "--", HOSTILE_FIXTURE_FACTS.committedFile],
      {
        cwd: fixture.cwd,
        encoding: "utf8",
      },
    ).trim(),
  ).toBe(HOSTILE_FIXTURE_FACTS.committedFile);
  expect(readGitStatus(fixture.cwd)).toBe("");
});

test("not-git: provisions a discoverable skill without a worktree or sampling root", () => {
  const fixture = createFixture("not-git");
  expect(
    existsSync(join(fixture.cwd, ".claude", "skills", SKILL, "SKILL.md")),
  ).toBe(true);
  expect(fixture.gitRepo).toBeUndefined();
  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: fixture.cwd,
    encoding: "utf8",
  });
  expect(result.stderr).toContain("not a git repository");
});

test("missing-path: provisions a discoverable skill with missing and real non-worktree paths", () => {
  const fixture = createFixture("missing-path");
  expect(
    existsSync(join(fixture.cwd, ".claude", "skills", SKILL, "SKILL.md")),
  ).toBe(true);
  expect(fixture.gitRepo).toBe(fixture.cwd);
  expect(
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: fixture.cwd,
      encoding: "utf8",
    }).trim(),
  ).toBe(realpathSync(fixture.cwd));
  expect(existsSync(fixture.missingPath)).toBe(false);
  expect(readFileSync(join(fixture.notGitPath, "notes.txt"), "utf8")).not.toBe(
    "",
  );
  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: fixture.notGitPath,
    encoding: "utf8",
  });
  expect(result.stderr).toContain("not a git repository");
});

test("two fixtures isolate file changes", () => {
  const firstFixture = createFixture("dirty");
  const secondFixture = createFixture("dirty");
  expect(firstFixture.cwd).not.toBe(secondFixture.cwd);
  const secondFile = join(
    secondFixture.cwd,
    DIRTY_FIXTURE_FACTS.modifiedTrackedFile,
  );
  const originalContents = readFileSync(secondFile, "utf8");
  writeFileSync(
    join(firstFixture.cwd, DIRTY_FIXTURE_FACTS.modifiedTrackedFile),
    "only the first fixture changed\n",
  );
  expect(readFileSync(secondFile, "utf8")).toBe(originalContents);
});

test("failed provisioning of a nonexistent skill removes its temp root", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "fixture-failure-"));
  try {
    vi.stubEnv("TMPDIR", temporaryDirectory);
    expect(() => makeFixture("clean", "nonexistent-skill")).toThrow(/ENOENT/);
    expect(readdirSync(temporaryDirectory)).toStrictEqual([]);
  } finally {
    vi.unstubAllEnvs();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("cleanup removes only the whole owned temp root and is idempotent", () => {
  const fixture = createFixture("dirty");
  const root = dirname(fixture.cwd);
  const relativeRoot = relative(realpathSync(tmpdir()), realpathSync(root));
  expect(relativeRoot).not.toBe("");
  expect(relativeRoot).not.toBe("..");
  expect(relativeRoot.startsWith(`..${sep}`)).toBe(false);
  expect(isAbsolute(relativeRoot)).toBe(false);
  expect(dirname(fixture.notGitPath)).toBe(root);

  const outsideRoot = mkdtempSync(join(tmpdir(), "fixture-cleanup-sentinel-"));
  const sentinel = join(outsideRoot, "keep.txt");
  try {
    writeFileSync(sentinel, "keep");
    expect(existsSync(fixture.cwd)).toBe(true);
    expect(existsSync(fixture.notGitPath)).toBe(true);
    fixture.cleanup();
    expect(existsSync(root)).toBe(false);
    expect(existsSync(fixture.cwd)).toBe(false);
    expect(existsSync(fixture.notGitPath)).toBe(false);
    expect(() => {
      fixture.cleanup();
    }).not.toThrow();
    expect(readFileSync(sentinel, "utf8")).toBe("keep");
  } finally {
    rmSync(outsideRoot, { recursive: true, force: true });
  }
});
