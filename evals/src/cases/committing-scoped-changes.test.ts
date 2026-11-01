import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER } from "#/cases/case-contract.ts";
import { cases, COMMIT_FACTS } from "#/cases/committing-scoped-changes.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const PLAN = `## Group 1
**Message:** fix: update greeting
**Paths:** \`a.txt\`
- Expansions: none
- Verification: none
- Omissions: none
- Warnings: none

No commits have been made. The staged unrelated.txt is untouched.
Reply approve, revise: <what to change>, or stop.`;
const REFLOG = "seeded reflog\n";

function stoppedText(clean: boolean): string {
  return clean
    ? "No scoped changes in a.txt, so no commits were made. Nothing was changed; continue editing when ready."
    : "No commits were made because an explicit commit request is missing. Please provide a request to commit a.txt; unrelated staged work is untouched.";
}

function correctObservation(evalCase: EvalCase): Observation {
  const clean = evalCase.id.endsWith("/no-scoped-changes");
  const unchangedFiles = clean
    ? { "a.txt": COMMIT_FACTS.cleanContent, "unrelated.txt": null }
    : {
        "a.txt": COMMIT_FACTS.scopedContent,
        "unrelated.txt": COMMIT_FACTS.unrelatedContent,
      };
  const finalText = evalCase.id.endsWith("/plan-approval")
    ? PLAN
    : stoppedText(clean);
  return createObservation({
    toolCalls: [{ name: "Skill", input: { skill: evalCase.skill } }],
    finalText,
    repoFiles: {
      ...unchangedFiles,
      ".git/logs/HEAD": REFLOG,
      ".git/eval-baseline-reflog": REFLOG,
    },
  });
}

const behavioralCases = cases.filter(
  (evalCase) => evalCase.tier === BEHAVIORAL_TIER,
);

describe("committing-scoped-changes checks", () => {
  test.each(behavioralCases)(
    "$id accepts its correct observable and requires the skill invocation",
    (evalCase) => {
      const observation = correctObservation(evalCase);
      expect(() => evalCase.check(observation)).not.toThrow();
      expect(() => evalCase.check({ ...observation, toolCalls: [] })).toThrow();
    },
  );

  test.each(behavioralCases)(
    "$id rejects mutations and absent snapshots",
    (evalCase) => {
      const observation = correctObservation(evalCase);
      for (const wrong of [
        { repoFiles: {} },
        { repoFiles: { ...observation.repoFiles, "a.txt": "rewritten" } },
        {
          repoFiles: {
            ...observation.repoFiles,
            ".git/logs/HEAD": `${REFLOG}new commit\n`,
          },
        },
        {
          gitStatusAfter: {
            kind: "worktree" as const,
            entries: "M  unrelated.txt",
          },
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            {
              name: "Bash",
              input: { command: "git commit --only -m fix -- a.txt" },
            },
          ],
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "Write", input: { file_path: "a.txt" } },
          ],
        },
        { finalText: "COMMIT_SCOPED_CHANGES: SUCCESS" },
      ]) {
        expect(() => evalCase.check({ ...observation, ...wrong })).toThrow();
      }
    },
  );

  test.each(behavioralCases)(
    "$id rejects old public status lines",
    (evalCase) => {
      const observation = correctObservation(evalCase);
      expect(() =>
        evalCase.check({
          ...observation,
          finalText: `COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT\n${observation.finalText}`,
        }),
      ).toThrow(/public status line/);
    },
  );

  test.each(behavioralCases)(
    "$id delegates preview and stop wording to its judge",
    (evalCase) => {
      const observation = correctObservation(evalCase);
      let finalText =
        "a.txt matches HEAD. I left it alone and created no commit.";
      if (evalCase.id.endsWith("/plan-approval")) {
        finalText = `Planned commit (1 group)\n| Message | Paths | Expansions | Verification | Omissions | Warnings |\n| --- | --- | --- | --- | --- | --- |\n| update greeting | a.txt | none | none | none | none |\nThe staged unrelated.txt stays excluded. Reply approve, revise: changes, or stop.`;
      } else if (evalCase.id.endsWith("/no-verbal-consent")) {
        finalText =
          "I haven't made any commits or inspected the repository. Invocation doesn't count as permission. Please ask me to commit a.txt.";
      }
      expect(() => evalCase.check({ ...observation, finalText })).not.toThrow();
      expect(evalCase).toHaveProperty("judge", expect.any(Function));
    },
  );

  test.each(behavioralCases)(
    "$id seed snapshots match real git evidence",
    (evalCase) => {
      const fixture = makeFixture(
        evalCase.fixture,
        [evalCase.skill],
        evalCase.seed,
      );
      try {
        const files = snapshotRepoFiles(fixture.cwd, evalCase.snapshotPaths);
        expect(files[".git/logs/HEAD"]).toBe(
          files[".git/eval-baseline-reflog"],
        );
        expect(files["a.txt"]).toBe(
          evalCase.id.endsWith("/no-scoped-changes")
            ? COMMIT_FACTS.cleanContent
            : COMMIT_FACTS.scopedContent,
        );
        expect(
          readFileSync(join(fixture.cwd, ".git/logs/HEAD"), "utf8"),
        ).toContain("initial commit");
      } finally {
        fixture.cleanup();
      }
    },
  );
});
