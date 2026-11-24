import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it } from "vitest";

import {
  GITHUB_FACTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";

export function commands(
  seed: NonNullable<Parameters<typeof seedGithubFixture>[1]>,
) {
  const fixture = makeFixture("clean", [], (context) => {
    seedGithubFixture(context, seed);
  });
  const options = {
    cwd: fixture.cwd,
    env: {
      ...process.env,
      PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
    },
    encoding: "utf8" as const,
  };
  const run = (command: string, ...args: string[]) =>
    execFileSync(command, args, { ...options, stdio: "pipe" }).trim();
  const gh = (...args: string[]) => run("gh", ...args);
  const git = (...args: string[]) => run("git", ...args);
  const capture = (name: string): unknown =>
    JSON.parse(
      readFileSync(join(fixture.cwd, `.git/eval-${name}.json`), "utf8"),
    );
  return { ...fixture, gh, git, capture };
}

const published = `origin/${GITHUB_FACTS.branch}`;
const ref = `refs/heads/${GITHUB_FACTS.branch}`;
const timeout = 30000;
function series(git: ReturnType<typeof commands>["git"], local = "HEAD") {
  const range = (tip: string) =>
    `${git("merge-base", "origin/main", tip)}..${tip}`;
  return git(
    "range-diff",
    "--no-color",
    "--no-patch",
    range(published),
    range(local),
  ).split("\n");
}
export function testRewriteFixtures() {
  it.for(["on-base", "base-moved", "remote-only-commit"] as const)(
    "compares the %s series",
    { timeout },
    (localRewrite, { onTestFinished }) => {
      const fixture = commands({ localRewrite });
      onTestFinished(fixture.cleanup);
      const { git } = fixture;
      const base = git("rev-parse", "origin/main");
      expect(git("merge-base", "HEAD", base) === base).toBe(
        localRewrite !== "base-moved",
      );
      const rows = series(git);
      const signs = rows.map(
        (row) => / (?<sign>[=<>!]) /u.exec(row)?.groups?.["sign"] ?? "unknown",
      );
      expect(
        signs.toSorted((left, right) => left.localeCompare(right)),
      ).toEqual(
        localRewrite === "remote-only-commit" ? ["<", "=", ">"] : ["=", ">"],
      );
      if (localRewrite === "on-base") {
        git("switch", "--detach", "HEAD^");
        git("commit", "--amend", "-qm", "Reword pricing change");
        expect(series(git)).toEqual([expect.stringContaining(" ! ")]);
      }
    },
  );
  it.for([false, true])(
    "reset --keep respects worktree changes, conflict=%s",
    { timeout },
    (conflict, { onTestFinished }) => {
      const fixture = commands({
        baseAhead: true,
        templates: { "base-note.txt": "Initial base note.\n" },
        uncommittedChange: "unrelated",
      });
      onTestFinished(fixture.cleanup);
      const { git, cwd } = fixture;
      const original = git("rev-parse", "HEAD");
      const other = join(cwd, ".git", "rebase-worktree");
      git("worktree", "add", "--detach", other, original);
      git("-C", other, "rebase", "origin/main");
      const tip = git("-C", other, "rev-parse", "HEAD");
      expect(tip).not.toBe(original);
      const path = join(cwd, "a.txt");
      const dirty = readFileSync(path);
      expect(git("diff", "--name-only")).toBe("a.txt");
      if (conflict) writeFileSync(join(cwd, "base-note.txt"), "user data\n");
      const status = git("status", "--porcelain");
      const tree = git("write-tree");
      const reset = () => git("reset", "--keep", tip);
      if (conflict) {
        expect(reset).toThrow();
        expect(git("write-tree")).toBe(tree);
        expect(readFileSync(join(cwd, "base-note.txt"), "utf8")).toBe(
          "user data\n",
        );
      } else reset();
      expect(git("rev-parse", ref)).toBe(conflict ? original : tip);
      expect(git("symbolic-ref", "HEAD")).toBe(ref);
      expect(readFileSync(path)).toEqual(dirty);
      expect(git("status", "--porcelain")).toBe(status);
    },
  );
  it(
    "publishes the rewritten head and its annotated tag to the logged URL",
    ({ onTestFinished }) => {
      const fixture = commands({
        localRewrite: "on-base",
        allowPush: true,
        followedTag: true,
      });
      onTestFinished(fixture.cleanup);
      const { git } = fixture;
      const old = git("rev-parse", published);
      const tip = git("rev-parse", "HEAD");
      const url = `file://${join(fixture.cwd, ".git/fixture-origin.git")}`;
      git("remote", "set-url", "--push", "origin", url);
      const tag = git("tag", "--points-at", tip);
      expect(git("cat-file", "-t", `refs/tags/${tag}`)).toBe("tag");
      git(
        "push",
        `--force-with-lease=${ref}:${old}`,
        "origin",
        `${tip}:${ref}`,
      );
      expect([fixture.capture("push-1"), fixture.capture("push-2")]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            old,
            new: tip,
            ref,
            fastForward: false,
            accepted: true,
            url,
          }),
          expect.objectContaining({
            ref: `refs/tags/${tag}`,
            new: git("rev-parse", `refs/tags/${tag}`),
            accepted: true,
            url,
          }),
        ]),
      );
    },
    timeout,
  );
  it(
    "refuses a single branch refspec on a mirror without updating any refs",
    ({ onTestFinished }) => {
      const fixture = commands({ localRewrite: "on-base", allowPush: true });
      onTestFinished(fixture.cleanup);
      const { git } = fixture;
      const before = git("ls-remote", "origin");
      git("config", "remote.origin.mirror", "true");
      expect(() => git("push", "origin", `HEAD:${ref}`)).toThrow(/mirror/u);
      expect(git("ls-remote", "origin")).toBe(before);
      expect(
        readdirSync(join(fixture.cwd, ".git")).filter((name) =>
          name.startsWith("eval-push-"),
        ),
      ).toEqual([]);
    },
    timeout,
  );
}
