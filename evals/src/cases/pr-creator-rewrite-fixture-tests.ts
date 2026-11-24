import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { seedGithubFixture } from "#/cases/pr-creator-fixtures.ts";
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
