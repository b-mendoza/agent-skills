import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import {
  assertFileExists,
  assertFileMatches,
  assertRunHappened,
  fixtureRelativePath,
  seedFixtureRoot,
  withoutAllowedChanges,
} from "#/cases/shared-checks.ts";
import type { SeedContext } from "#/fixtures/fixtures.ts";
import { commitRepoFiles, HEAD_LOG } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { mutationEvidence } from "#/observation/mutation-evidence.ts";

export const SEED_COMMIT = "seed planning inputs";

export function seedPlanningFiles(
  { repoPath }: SeedContext,
  files: Readonly<Record<string, string>>,
): void {
  seedFixtureRoot(repoPath);
  execFileSync("git", ["config", "status.showUntrackedFiles", "all"], {
    cwd: repoPath,
  });
  commitRepoFiles(repoPath, files, SEED_COMMIT);
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
  assert.deepEqual(
    mutationEvidence(
      withoutAllowedChanges(observation, (call) => {
        if (call.name !== "Write" && call.name !== "Edit") return false;
        const path = call.input["file_path"];
        return paths.some(
          (allowed) =>
            typeof path === "string" &&
            fixtureRelativePath(observation, path) === allowed,
        );
      }),
    ),
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
