import assert from "node:assert/strict";

import {
  assertNoGithubWrites,
  assertPlantedStatePreserved,
} from "#/cases/pr-creator-checks.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { RESPONSE_REPORT } from "#/cases/responding-to-pr-review-comments-fixtures.ts";
import {
  assertFileAbsent,
  assertNoMutation,
  assertRunHappened,
  capturedText,
  fixtureRelativePath,
  withoutAllowedChanges,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

function withoutReportWrites(
  observation: Observation,
  reportPath: string,
): Observation {
  return withoutAllowedChanges(observation, (call) => {
    if (!["Write", "Edit", "NotebookEdit"].includes(call.name)) return false;
    const path = call.input["file_path"];
    return (
      typeof path === "string" &&
      fixtureRelativePath(observation, path) === reportPath
    );
  });
}

export function checkDefaultResponseReport(observation: Observation): string {
  assertRunHappened(observation);
  assert.deepEqual(observation.gitStatusBefore, {
    kind: "worktree",
    entries: "",
  });
  assert.deepEqual(observation.gitStatusAfter, {
    kind: "worktree",
    entries: `?? ${RESPONSE_REPORT}`,
  });
  assertNoMutation(withoutReportWrites(observation, RESPONSE_REPORT));
  assertPlantedStatePreserved(observation);
  assertNoGithubWrites(observation);
  assertFileAbsent(observation, GITHUB_FACTS.report);
  const report = capturedText(observation, RESPONSE_REPORT);
  assert.match(report, /^# PR 17 Review Comment Assessment\r?$/m);
  assert.match(report, /Posting status: not-posted/);
  assert.match(report, /review-comment-reply:701/);
  return "Response-specific default report written; no old-default file or GitHub write";
}

export function checkExplicitCollision(observation: Observation): string {
  assertNoMutation(observation);
  assertPlantedStatePreserved(observation);
  assertNoGithubWrites(observation);
  assert.equal(
    capturedText(observation, "chosen-responses.md"),
    GITHUB_FACTS.existingReport,
  );
  assertFileAbsent(observation, RESPONSE_REPORT);
  assertFileAbsent(observation, GITHUB_FACTS.report);
  return "Explicit output collision asks before changing the user's file";
}
