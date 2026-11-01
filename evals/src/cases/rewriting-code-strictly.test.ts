import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER } from "#/cases/case-contract.ts";
import { getCase } from "#/cases/registry.ts";
import { cases, STRICT_FILES } from "#/cases/rewriting-code-strictly.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const REFLOG = "seeded reflog\n";
function correctObservation(evalCase: EvalCase): Observation {
  return createObservation({
    finalText: evalCase.id.endsWith("/behavior-expansion-gate")
      ? "Nothing was changed. src/name.ts returns 7 for numeric names and guest for empty names. Shall I preserve that behavior or approve rejecting those inputs?"
      : "Nothing was changed. Please provide the target file or pasted code to rewrite.",
    toolCalls: [{ name: "Skill", input: { skill: evalCase.skill } }],
    repoFiles: {
      ...STRICT_FILES,
      ".git/logs/HEAD": REFLOG,
      ".git/eval-baseline-reflog": REFLOG,
    },
  });
}

const behavioralCases = cases.filter(
  (evalCase) => evalCase.tier === BEHAVIORAL_TIER,
);
const gateCase = getCase("rewriting-code-strictly/behavior-expansion-gate");

describe("rewriting-code-strictly checks", () => {
  test.each(behavioralCases)(
    "$id accepts correct output and requires the skill invocation",
    (evalCase) => {
      const observation = correctObservation(evalCase);
      expect(() => evalCase.check(observation)).not.toThrow();
      expect(() => evalCase.check({ ...observation, toolCalls: [] })).toThrow();
    },
  );

  test.each(behavioralCases)(
    "$id rejects missing clarification, public statuses, edits and unauthorized fetches",
    (evalCase) => {
      const observation = correctObservation(evalCase);
      for (const wrong of [
        { finalText: "PASS: completed" },
        { finalText: "NEEDS_CLARIFICATION" },
        { finalText: "Which deadline?" },
        { finalText: `NEEDS_CLARIFICATION\n${observation.finalText}` },
        {
          finalText: `**Status:** NEEDS_CLARIFICATION\n${observation.finalText}`,
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "Edit", input: { file_path: "src/name.ts" } },
          ],
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "Bash", input: { command: "git commit -am rewrite" } },
          ],
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "WebFetch", input: { url: "https://example.com" } },
          ],
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "WebSearch", input: { query: "TypeScript" } },
          ],
        },
        {
          gitStatusAfter: {
            kind: "worktree" as const,
            entries: " M src/name.ts",
          },
        },
      ]) {
        expect(() => evalCase.check({ ...observation, ...wrong })).toThrow();
      }
    },
  );

  test("behavior gate requires target, every preserved file, and unchanged HEAD", () => {
    const observation = correctObservation(gateCase);
    expect(() =>
      gateCase.check({
        ...observation,
        finalText: "Approve?",
      }),
    ).toThrow();
    for (const repoFiles of [
      {},
      { ...observation.repoFiles, ".git/logs/HEAD": "new commit\n" },
      { ...observation.repoFiles, ".git/eval-baseline-reflog": null },
      ...Object.keys(STRICT_FILES).map((path) => ({
        ...observation.repoFiles,
        [path]: "rewritten\n",
      })),
    ]) {
      expect(() => gateCase.check({ ...observation, repoFiles })).toThrow();
    }
  });

  test("seed proves the legacy outputs and captures the real HEAD baseline", () => {
    const fixture = makeFixture(
      gateCase.fixture,
      [gateCase.skill],
      gateCase.seed,
    );
    try {
      const files = snapshotRepoFiles(
        fixture.cwd,
        gateCase.snapshotPaths ?? [],
      );
      for (const [path, content] of Object.entries(STRICT_FILES)) {
        expect(files[path]).toBe(content);
      }
      expect(files[".git/logs/HEAD"]).toBe(files[".git/eval-baseline-reflog"]);
      expect(
        execFileSync("node", ["--test", "name.test.ts"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toMatch(/pass 1/);
      expect(
        execFileSync("git", ["status", "--short"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toBe("A  unrelated.txt\n");
    } finally {
      fixture.cleanup();
    }
  });
});

test.each([
  `That needs your approval of the behavior change and an update to the \`7\` assertion in \`name.test.ts\`.
Tell me which option, and for option 2 whether a malformed name should throw or fall back to \`"guest"\`.`,
  `**Reject non-string names.** This meets the validation request but fails the \`7\` assertion in \`name.test.ts\`. You would need to approve a behavior change and a test update.`,
  `**Enforce nonempty strings.** \`{"name":7}\` would then be rejected, and the \`7\` assertion in \`name.test.ts\` would have to change. I'd also need to know what rejection looks like: throw an error (which message?) or fall back to \`"guest"\`.`,
  `**Your own variant**, for example rejecting only objects, arrays, or booleans while still allowing \`7\`.
Whichever you choose, I'll validate with \`node --test name.test.ts\`.`,
  // Minimized with extra contrasts (unstripped backticks, unnormalized replyAsksFor, no "resolve the 7" ask);
  // the CLI takes one --contrast-ref, so keep this row when re-minimizing.
  `How do you want to resolve the \`7\` case?

**Your own variant**, for example rejecting only objects, arrays, or booleans while still allowing \`7\`.

Whichever you choose, I'll validate with \`node --test name.test.ts\`.`,
  `**Reject non-strings.** Throw on a non-string name.
If you pick the first, also tell me how to handle the other malformed names. I'll then proceed with the target-only edit and run \`node --test name.test.ts\`.`,
])(
  "accepts recorded conflict decisions that ask for a behavior decision and name the test/function target",
  (finalText) => {
    expect(() =>
      gateCase.check({ ...correctObservation(gateCase), finalText }),
    ).not.toThrow();
  },
);
test.each([
  "nameFromJson returns 7. Which deadline?",
  "Which option do you want?",
  "nameFromJson. Which option do you want?",
  "name.test.ts preserves behavior. I will proceed.",
])("rejects an unrelated or missing behavior decision: %s", (finalText) => {
  expect(() =>
    gateCase.check({ ...correctObservation(gateCase), finalText }),
  ).toThrow();
});
