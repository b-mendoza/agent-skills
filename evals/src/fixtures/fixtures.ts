// Builds throwaway git repositories for eval cases.
//
// Two properties matter here. First, skills resolve from `<cwd>/.claude/skills/`,
// so the skill under test is copied in -- the repo's own `skills/` directory is
// not a discovery path. Second, that copied directory is hidden from
// `git status` via `.git/info/exclude`, so the mutation-scope assertion measures
// the skill's behavior instead of the fixture's own scaffolding.

import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Context, Effect, Layer } from "effect";

import type { FixtureProvisioningError } from "#/fixtures/fixture-errors.ts";
import {
  FixtureCleanupError,
  FixtureDirectoryCreationError,
  FixtureFileWriteError,
  FixtureGitCommandError,
  FixtureSkillCopyError,
  FixtureTempDirectoryError,
} from "#/fixtures/fixture-errors.ts";

export interface Fixture {
  /** Directory the agent runs in. Always a real git repo except for `not-git`. */
  readonly cwd: string;
  /** Repo sampled for the git delta; `undefined` when there is no worktree. */
  readonly gitRepo: string | undefined;
  /** A path guaranteed not to exist, for the PATH_ERROR case. */
  readonly missingPath: string;
  /** A real directory that is not a worktree, for the NOT_GIT case. */
  readonly notGitPath: string;
  readonly cleanup: () => void;
}

interface FixtureConfiguration {
  readonly usesGit: boolean;
  readonly receivesDirtyState: boolean;
}

// `missing-path` builds the same repo as `clean`; the two differ only in which
// Fixture field the case consumes -- `missingPath` rather than `cwd`.
const FIXTURE_CONFIGURATIONS = {
  clean: { usesGit: true, receivesDirtyState: false },
  dirty: { usesGit: true, receivesDirtyState: true },
  "not-git": { usesGit: false, receivesDirtyState: false },
  "missing-path": { usesGit: true, receivesDirtyState: false },
} as const satisfies Record<string, FixtureConfiguration>;

export type FixtureKind = keyof typeof FIXTURE_CONFIGURATIONS;

const SKILLS_DIRECTORY_PATH = fileURLToPath(
  new URL("../../../skills/", import.meta.url),
);
const FIXTURE_ROOT_PREFIX = "agent-skills-eval-";
const MISSING_PATH_NAME = "definitely-does-not-exist";


export interface FixtureProvisioner {
  readonly make: (
    kind: FixtureKind,
    skill: string,
  ) => Effect.Effect<Fixture, FixtureProvisioningError>;
  readonly cleanup: (
    fixture: Fixture,
  ) => Effect.Effect<void, FixtureCleanupError>;
}

export const FixtureProvisioner = Context.Service<FixtureProvisioner>(
  "evals/fixtures/FixtureProvisioner",
);

function isFixtureKind(value: string): value is FixtureKind {
  return Object.hasOwn(FIXTURE_CONFIGURATIONS, value);
}

function resolveFixtureConfiguration(kind: string): FixtureConfiguration {
  return isFixtureKind(kind)
    ? FIXTURE_CONFIGURATIONS[kind]
    : FIXTURE_CONFIGURATIONS.clean;
}

function runGit(repositoryPath: string, ...arguments_: string[]): void {
  execFileSync("git", arguments_, { cwd: repositoryPath, stdio: "ignore" });
}

function fixturePaths(fixtureRoot: string): {
  readonly repositoryPath: string;
  readonly notGitPath: string;
} {
  return {
    repositoryPath: join(fixtureRoot, "repo"),
    notGitPath: join(fixtureRoot, "not-a-repo"),
  };
}

function createFixtureValue(
  fixtureRoot: string,
  repositoryPath: string,
  notGitPath: string,
  usesGit: boolean,
): Fixture {
  return {
    cwd: repositoryPath,
    gitRepo: usesGit ? repositoryPath : undefined,
    missingPath: join(fixtureRoot, MISSING_PATH_NAME),
    notGitPath,
    cleanup: () => {
      rmSync(fixtureRoot, { recursive: true, force: true });
    },
  };
}

function createFixtureRoot() {
  return Effect.try({
    try: () => mkdtempSync(join(tmpdir(), FIXTURE_ROOT_PREFIX)),
    catch: (cause) => new FixtureTempDirectoryError({ cause }),
  });
}

function createDirectory(path: string) {
  return Effect.try({
    try: () => mkdirSync(path, { recursive: true }),
    catch: (cause) => new FixtureDirectoryCreationError({ cause, path }),
  });
}

function writeFixtureFile(path: string, contents: string) {
  return Effect.try({
    try: () => {
      writeFileSync(path, contents);
    },
    catch: (cause) => new FixtureFileWriteError({ cause, path }),
  });
}

function appendFixtureFile(path: string, contents: string) {
  return Effect.try({
    try: () => {
      appendFileSync(path, contents);
    },
    catch: (cause) => new FixtureFileWriteError({ cause, path }),
  });
}

function runGitEffect(repositoryPath: string, ...arguments_: string[]) {
  return Effect.try({
    try: () => {
      runGit(repositoryPath, ...arguments_);
    },
    catch: (cause) =>
      new FixtureGitCommandError({
        arguments: arguments_,
        cause,
        repositoryPath,
      }),
  });
}

function copySkill(sourcePath: string, destinationPath: string) {
  return Effect.try({
    try: () => {
      cpSync(sourcePath, destinationPath, { recursive: true });
    },
    catch: (cause) =>
      new FixtureSkillCopyError({ cause, destinationPath, sourcePath }),
  });
}

function provisionFixture(kind: FixtureKind, skill: string) {
  return Effect.gen(function* () {
    const configuration = resolveFixtureConfiguration(kind);
    const fixtureRoot = yield* createFixtureRoot();
    const { repositoryPath, notGitPath } = fixturePaths(fixtureRoot);

    yield* createDirectory(repositoryPath);
    yield* createDirectory(notGitPath);
    yield* writeFixtureFile(join(notGitPath, "notes.txt"), "not a worktree\n");

    if (configuration.usesGit) {
      yield* runGitEffect(repositoryPath, "init", "-q");
      yield* runGitEffect(
        repositoryPath,
        "config",
        "user.email",
        "evals@example.invalid",
      );
      yield* runGitEffect(
        repositoryPath,
        "config",
        "user.name",
        "Eval Fixture",
      );
      yield* runGitEffect(repositoryPath, "config", "commit.gpgsign", "false");
      yield* writeFixtureFile(join(repositoryPath, "a.txt"), "hello\n");
      yield* runGitEffect(repositoryPath, "add", "a.txt");
      yield* runGitEffect(repositoryPath, "commit", "-qm", "initial commit");

      if (configuration.receivesDirtyState) {
        yield* writeFixtureFile(
          join(repositoryPath, "a.txt"),
          "hello\nmodified\n",
        );
        yield* writeFixtureFile(join(repositoryPath, "b.txt"), "new file\n");
        yield* runGitEffect(repositoryPath, "add", "b.txt");
        yield* runGitEffect(repositoryPath, "commit", "-qm", "add b.txt");
        yield* writeFixtureFile(join(repositoryPath, "c.txt"), "untracked\n");
      }
    }

    const skillsPath = join(repositoryPath, ".claude", "skills");
    const skillSourcePath = join(SKILLS_DIRECTORY_PATH, skill);
    const skillDestinationPath = join(skillsPath, skill);
    yield* createDirectory(skillsPath);
    yield* copySkill(skillSourcePath, skillDestinationPath);

    if (configuration.usesGit) {
      yield* appendFixtureFile(
        join(repositoryPath, ".git", "info", "exclude"),
        "\n.claude/\n",
      );
    }

    return createFixtureValue(
      fixtureRoot,
      repositoryPath,
      notGitPath,
      configuration.usesGit,
    );
  });
}

function cleanupFixture(fixture: Fixture) {
  return Effect.try({
    try: fixture.cleanup,
    catch: (cause) => new FixtureCleanupError({ cause }),
  });
}

export const FixtureProvisionerLive = Layer.succeed(
  FixtureProvisioner,
  FixtureProvisioner.of({
    make: provisionFixture,
    cleanup: cleanupFixture,
  }),
);

