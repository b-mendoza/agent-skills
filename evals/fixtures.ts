// Builds throwaway git repositories for eval cases.
//
// Two properties matter here. First, skills resolve from `<cwd>/.claude/skills/`,
// so the skill under test is copied in -- the repo's own `skills/` directory is
// not a discovery path. Second, that copied directory is hidden from
// `git status` via `.git/info/exclude`, so the mutation-scope assertion measures
// the skill's behavior instead of the fixture's own scaffolding.

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// `missing-path` builds the same repo as `clean`; the two differ only in which
// Fixture field the case consumes -- `missingPath` rather than `cwd`.
export type FixtureKind = "clean" | "dirty" | "not-git" | "missing-path";

export interface Fixture {
  /** Directory the CLI runs in. Always a real git repo except for `not-git`. */
  cwd: string;
  /** Repo sampled for the git delta; `undefined` when there is no worktree. */
  gitRepo: string | undefined;
  /** A path guaranteed not to exist, for the PATH_ERROR case. */
  missingPath: string;
  /** A real directory that is not a worktree, for the NOT_GIT case. */
  notGitPath: string;
  cleanup: () => void;
}

const SKILLS_DIR = fileURLToPath(new URL("../skills/", import.meta.url));

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

/**
 * Creates a fixture in a fresh temp directory.
 *
 * `skill` is copied into `.claude/skills/` so the CLI can discover it. Each
 * call gets its own directory, which is what keeps cases in fresh context.
 */
export function makeFixture(kind: FixtureKind, skill: string): Fixture {
  const root = mkdtempSync(join(tmpdir(), "agent-skills-eval-"));
  const repo = join(root, "repo");
  const notGitPath = join(root, "not-a-repo");

  mkdirSync(repo, { recursive: true });
  mkdirSync(notGitPath, { recursive: true });
  writeFileSync(join(notGitPath, "notes.txt"), "not a worktree\n");

  if (kind !== "not-git") {
    git(repo, "init", "-q");
    // Fixture-only identity; never reads the developer's git config.
    git(repo, "config", "user.email", "evals@example.invalid");
    git(repo, "config", "user.name", "Eval Fixture");
    git(repo, "config", "commit.gpgsign", "false");

    writeFileSync(join(repo, "a.txt"), "hello\n");
    git(repo, "add", "a.txt");
    git(repo, "commit", "-qm", "initial commit");

    if (kind === "dirty") {
      writeFileSync(join(repo, "a.txt"), "hello\nmodified\n");
      writeFileSync(join(repo, "b.txt"), "new file\n");
      git(repo, "add", "b.txt");
      git(repo, "commit", "-qm", "add b.txt");
      writeFileSync(join(repo, "c.txt"), "untracked\n");
    }
  }

  // Copy the skill in so the CLI can find it, then hide it from git status.
  const skillSrc = join(SKILLS_DIR, skill);
  const skillDest = join(repo, ".claude", "skills", skill);
  mkdirSync(join(repo, ".claude", "skills"), { recursive: true });
  cpSync(skillSrc, skillDest, { recursive: true });

  if (kind !== "not-git") {
    appendFileSync(join(repo, ".git", "info", "exclude"), "\n.claude/\n");
  }

  return {
    cwd: repo,
    gitRepo: kind === "not-git" ? undefined : repo,
    missingPath: join(root, "definitely-does-not-exist"),
    notGitPath,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
