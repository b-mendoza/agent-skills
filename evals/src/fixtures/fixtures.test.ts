// Pins the fixture invariants every paid observation rests on.
//
// If a fixture silently stops being a git repo, stops hiding `.claude/` from
// `git status`, or leaks state between cases, the suite keeps reporting results
// that no longer mean what the case says they mean. These run offline against
// local `git`; they never invoke the agent CLI.
//
//   pnpm test

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

import { afterEach, expect, test } from "vitest";

import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import type { Fixture, FixtureKind } from "#/fixtures/fixtures.ts";
import {
  DIRTY_FIXTURE_FACTS,
  HOSTILE_FIXTURE_FACTS,
  makeFixture,
} from "#/fixtures/fixtures.ts";

const FIXTURE_SKILL_NAME = "analyzing-recent-project-state";
const FIXTURE_KIND_SET = {
  clean: true,
  dirty: true,
  hostile: true,
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

test("make fails when the skill does not exist", () => {
  // Failed provisioning intentionally leaves its partial temp root behind.
  expect(() => makeFixture("clean", "no-such-skill")).toThrow();
});
