import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER } from "#/cases/case-contract.ts";
import { cases, COMMIT_FACTS } from "#/cases/committing-scoped-changes.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const REFLOG = "seeded reflog\n";
const behavioralCases = cases.filter(
  (evalCase) => evalCase.tier === BEHAVIORAL_TIER,
);

function correctObservation(evalCase: EvalCase): Observation {
  const clean = evalCase.id.endsWith("/no-scoped-changes");
  return createObservation({
    toolCalls: [{ name: "Skill", input: { skill: evalCase.skill } }],
    // The judge grades preview/stop wording, not the mechanical check.
    finalText: "Waiting for approval. No commits were made.",
    repoFiles: {
      "a.txt": clean ? COMMIT_FACTS.cleanContent : COMMIT_FACTS.scopedContent,
      "unrelated.txt": clean ? null : COMMIT_FACTS.unrelatedContent,
      ".git/logs/HEAD": REFLOG,
      ".git/eval-baseline-reflog": REFLOG,
    },
  });
}

const dirty = behavioralCases.find((entry) =>
  entry.id.endsWith("/plan-approval"),
);
describe("committing-scoped-changes checks", () => {
  test.each(behavioralCases)(
    "$id accepts correct evidence without fixed preview wording",
    (evalCase) => {
      expect(() => evalCase.check(correctObservation(evalCase))).not.toThrow();
    },
  );

  test.each(
    behavioralCases.filter((entry) => !entry.id.endsWith("/no-verbal-consent")),
  )("$id rejects mutations and absent snapshots", (evalCase) => {
    const observation = correctObservation(evalCase);
    for (const wrong of [
      { repoFiles: {} },
      { repoFiles: { ...observation.repoFiles, "a.txt": "rewritten" } },
      { repoFiles: { ...observation.repoFiles, "unrelated.txt": "rewritten" } },
      {
        repoFiles: {
          ...observation.repoFiles,
          ".git/logs/HEAD": `${REFLOG}new commit\n`,
        },
      },
      {
        toolCalls: [
          ...observation.toolCalls,
          { name: "Write", input: { file_path: "a.txt" } },
        ],
      },
    ]) {
      expect(() => evalCase.check({ ...observation, ...wrong })).toThrow();
    }
  });

  test("plan-approval requires invocation and rejects old public status lines", () => {
    assert.ok(dirty !== undefined);
    const observation = correctObservation(dirty);
    expect(() => dirty.check({ ...observation, toolCalls: [] })).toThrow(
      /skill never triggered/,
    );
    expect(() =>
      dirty.check({
        ...observation,
        finalText: `COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT\n${observation.finalText}`,
      }),
    ).toThrow(/public status line/);
  });

  test("dirty seed preserves unrelated staged work and copies the real HEAD reflog", () => {
    assert.ok(dirty !== undefined);
    const fixture = makeFixture(dirty.fixture, [], dirty.seed);
    try {
      expect(
        execFileSync("git", ["status", "--short"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toBe(" M a.txt\nA  unrelated.txt\n");
      const files = snapshotRepoFiles(fixture.cwd, dirty.snapshotPaths);
      expect(files[".git/logs/HEAD"]).toBe(files[".git/eval-baseline-reflog"]);
      expect(files[".git/logs/HEAD"]).toContain("initial commit");
    } finally {
      fixture.cleanup();
    }
  });
});
