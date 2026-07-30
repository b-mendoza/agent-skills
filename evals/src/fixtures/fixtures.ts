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

/**
 * Creates a fixture in a fresh temp directory.
 *
 * `skill` is copied into `.claude/skills/` so the agent can discover it. Each
 * call gets its own directory, which is what keeps cases in fresh context.
 */
export function makeFixture(kind: FixtureKind, skill: string): Fixture {
  const configuration = resolveFixtureConfiguration(kind);
  const fixtureRoot = mkdtempSync(join(tmpdir(), "agent-skills-eval-"));
  const repositoryPath = join(fixtureRoot, "repo");
  const notGitPath = join(fixtureRoot, "not-a-repo");

  mkdirSync(repositoryPath, { recursive: true });
  mkdirSync(notGitPath, { recursive: true });
  writeFileSync(join(notGitPath, "notes.txt"), "not a worktree\n");

  if (configuration.usesGit) {
    runGit(repositoryPath, "init", "-q");
    // Fixture-only identity; never reads the developer's git config.
    runGit(repositoryPath, "config", "user.email", "evals@example.invalid");
    runGit(repositoryPath, "config", "user.name", "Eval Fixture");
    runGit(repositoryPath, "config", "commit.gpgsign", "false");

    writeFileSync(join(repositoryPath, "a.txt"), "hello\n");
    runGit(repositoryPath, "add", "a.txt");
    runGit(repositoryPath, "commit", "-qm", "initial commit");

    if (configuration.receivesDirtyState) {
      writeFileSync(join(repositoryPath, "a.txt"), "hello\nmodified\n");
      writeFileSync(join(repositoryPath, "b.txt"), "new file\n");
      runGit(repositoryPath, "add", "b.txt");
      runGit(repositoryPath, "commit", "-qm", "add b.txt");
      writeFileSync(join(repositoryPath, "c.txt"), "untracked\n");
    }
  }

  // Copy the skill in so the agent can find it, then hide it from git status.
  const skillSourcePath = join(SKILLS_DIRECTORY_PATH, skill);
  const skillDestinationPath = join(repositoryPath, ".claude", "skills", skill);
  mkdirSync(join(repositoryPath, ".claude", "skills"), { recursive: true });
  cpSync(skillSourcePath, skillDestinationPath, { recursive: true });

  if (configuration.usesGit) {
    appendFileSync(
      join(repositoryPath, ".git", "info", "exclude"),
      "\n.claude/\n",
    );
  }

  return {
    cwd: repositoryPath,
    gitRepo: configuration.usesGit ? repositoryPath : undefined,
    missingPath: join(fixtureRoot, "definitely-does-not-exist"),
    notGitPath,
    cleanup: () => {
      rmSync(fixtureRoot, { recursive: true, force: true });
    },
  };
}
