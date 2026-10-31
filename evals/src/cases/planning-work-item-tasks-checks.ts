import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  assertFileExists,
  assertFileMatches,
  assertRunHappened,
  fixtureRelativePath,
  seedFixtureRoot,
} from "#/cases/shared-checks.ts";
import type { SeedContext } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { mutationEvidence } from "#/observation/mutation-evidence.ts";

export const SEED_COMMIT = "seed planning inputs";
export const HEAD_LOG = ".git/logs/HEAD";

export function seedPlanningFiles(
  { repoPath }: SeedContext,
  files: Readonly<Record<string, string>>,
): void {
  seedFixtureRoot(repoPath);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(repoPath, path)), { recursive: true });
    writeFileSync(join(repoPath, path), content);
  }
  for (const args of [
    ["config", "status.showUntrackedFiles", "all"],
    ["add", "--", ...Object.keys(files)],
    ["commit", "-qm", SEED_COMMIT],
  ]) {
    execFileSync("git", args, { cwd: repoPath });
  }
}

/** Seeds request full untracked paths so a new docs/ directory cannot hide extras. */
export function assertPlanningWrites(
  observation: Observation,
  paths: readonly string[],
  inputs: Readonly<Record<string, string>>,
): void {
  assertRunHappened(observation);
  assert.deepEqual(observation.gitStatusBefore, {
    kind: "worktree",
    entries: "",
  });
  assert.ok(observation.gitStatusAfter.kind === "worktree");
  assert.deepEqual(
    observation.gitStatusAfter.entries
      .split("\n")
      .sort((first, second) => first.localeCompare(second)),
    paths
      .map((path) => `?? ${path}`)
      .sort((first, second) => first.localeCompare(second)),
    "only the declared unstaged artifacts may change",
  );
  for (const path of paths) assertFileExists(observation, path);
  for (const [path, content] of Object.entries(inputs)) {
    assert.equal(
      observation.repoFiles?.[path],
      content,
      `input changed: ${path}`,
    );
  }
  assertFileMatches(observation, HEAD_LOG, /commit: seed planning inputs\n?$/);
  // Check tools separately from the expected status delta; ignored-file writes still count.
  const otherCalls = observation.toolCalls.filter((call) => {
    if (call.name !== "Write" && call.name !== "Edit") return true;
    const path = call.input["file_path"];
    return !paths.some(
      (allowed) =>
        typeof path === "string" &&
        fixtureRelativePath(observation, path) === allowed,
    );
  });
  assert.deepEqual(
    mutationEvidence({
      ...observation,
      toolCalls: otherCalls,
      gitStatusAfter: observation.gitStatusBefore,
    }),
    [],
  );
  assert.ok(
    !observation.toolCalls.some(
      (call) =>
        call.name === "Bash" &&
        typeof call.input["command"] === "string" &&
        /\bgh\s/.test(call.input["command"]),
    ),
    "local planning must not call gh",
  );
}

export function assertOrderedHeadings(
  content: string,
  headings: readonly string[],
): void {
  let previous = -1;
  for (const heading of headings) {
    const position = content.indexOf(`\n${heading}\n`);
    assert.ok(
      position > previous,
      `missing or out-of-order heading: ${heading}`,
    );
    previous = position;
  }
}

export function capturedText(observation: Observation, path: string): string {
  assertFileExists(observation, path);
  const content = observation.repoFiles?.[path];
  assert.ok(typeof content === "string");
  return content;
}
