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

const DIGEST_LENGTH = 40;
const PLAN = `COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT
COMMIT_PLAN: PASS
Group: 1
Message: fix: update greeting
Paths: a.txt
Expansions: none
Verification: none
Digest: ${"a".repeat(DIGEST_LENGTH)}
Omissions: none
Warnings: none
Reply approve, revise: <what to change>, or stop.`;
const REFLOG = "seeded reflog\n";

function stoppedText(clean: boolean): string {
  const status = clean ? "NO_SCOPED_CHANGES" : "BLOCKED";
  const remaining = clean ? "none" : "a.txt";
  const nextStep = clean
    ? "nothing to commit"
    : "supply an explicit commit request";
  return `COMMIT_SCOPED_CHANGES: ${status}\nCommits: none\nLeft uncommitted in scope: ${remaining}\nUnrelated work untouched: preserved digest matched\nNext step: ${nextStep}`;
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
  test.each(cases)("$id accepts its correct observable", (evalCase) => {
    const observation =
      evalCase.tier === BEHAVIORAL_TIER
        ? correctObservation(evalCase)
        : createObservation({
            toolCalls: evalCase.id.endsWith("/trigger-positive")
              ? [{ name: "Skill", input: { skill: evalCase.skill } }]
              : [],
          });
    expect(() => evalCase.check(observation)).not.toThrow();
  });

  test.each(cases)("$id rejects missing runs and wrong routing", (evalCase) => {
    const observation = correctObservation(evalCase);
    expect(() => evalCase.check({ ...observation, timedOut: true })).toThrow();
    expect(() =>
      evalCase.check({
        ...observation,
        toolCalls: evalCase.id.endsWith("/trigger-negative-pr")
          ? [{ name: "Skill", input: { skill: evalCase.skill } }]
          : [],
      }),
    ).toThrow();
  });

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

  test.each(
    behavioralCases.filter(
      (evalCase) => !evalCase.id.endsWith("/plan-approval"),
    ),
  )("$id rejects missing, duplicate, or empty terminal fields", (evalCase) => {
    const observation = correctObservation(evalCase);
    for (const field of [
      "Commits:",
      "Left uncommitted in scope:",
      "Unrelated work untouched:",
      "Next step:",
    ]) {
      const lines = observation.finalText.split("\n");
      const matchingLine = lines.find((line) => line.startsWith(field)) ?? "";
      expect(matchingLine).not.toBe("");
      for (const finalText of [
        lines.filter((line) => !line.startsWith(field)).join("\n"),
        `${observation.finalText}\n${matchingLine}`,
        lines.map((line) => (line.startsWith(field) ? field : line)).join("\n"),
      ]) {
        expect(() => evalCase.check({ ...observation, finalText })).toThrow();
      }
    }
  });

  test("approval requires a valid complete scoped plan and all decision choices", () => {
    const evalCase = cases.find((candidate) =>
      candidate.id.endsWith("/plan-approval"),
    );
    expect(evalCase).toBeDefined();
    if (evalCase === undefined) throw new Error("missing plan case");
    const observation = correctObservation(evalCase);
    for (const finalText of [
      PLAN.replace("COMMIT_PLAN: PASS", "COMMIT_PLAN: ERROR"),
      PLAN.replace("a".repeat(DIGEST_LENGTH), "not-a-digest"),
      PLAN.replace("Paths: a.txt", "Paths: a.txt unrelated.txt"),
      PLAN.replace("Omissions: none", "Omissions: a.txt"),
      PLAN.replace("Expansions: none", "Expansions: a.txt"),
      PLAN.replace("approve, revise: <what to change>, or stop", "approve"),
    ]) {
      expect(() => evalCase.check({ ...observation, finalText })).toThrow();
    }
  });

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
