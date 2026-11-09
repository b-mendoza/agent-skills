import { describe, expect, test } from "vitest";

import {
  approveCommitPlan,
  checkApprovedCommits,
  checkDeniedDispatch,
  checkFailedExecution,
  checkKnownFailurePlan,
} from "#/cases/committing-scoped-changes-checks.ts";
import {
  COMMIT_SCOPE,
  COMMIT_TARGETS,
  EXPECTED_MANIFEST,
} from "#/cases/committing-scoped-changes-fixtures.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const MESSAGE =
  "update client defaults, exchange guide and policy content, and refresh checksums";
const PREVIEW = `## Group 1\nMessage: ${MESSAGE}\nPaths: checksums.txt client.js guide.md policy.md\nVerification: sh check.sh format && sh check.sh behavior\nReply approve, revise: changes, or stop.`;
const INDEX = "100644 deadbeef 0\tunrelated.txt\n";
const SKILL = { name: "Skill", input: { skill: "committing-scoped-changes" } };
const FILES = {
  ...COMMIT_TARGETS,
  "checksums.txt": EXPECTED_MANIFEST,
  "unrelated.txt": "unrelated staged work\n",
  ".git/eval-baseline-index": INDEX,
  ".git/logs/HEAD": "baseline\n",
  ".git/eval-baseline-reflog": "baseline\n",
  ".git/eval-git.json": "[]",
  ".git/eval-verification.log":
    "format exit=0 targets=client.js,guide.md,policy.md\nbehavior exit=0 assertions=3\n",
  ".git/eval-dispatch.log": "executor dispatch denied\n",
};
function observed(finalText: string) {
  return createObservation({
    finalText,
    toolCalls: [SKILL],
    turns: [
      createTurn({ finalText: PREVIEW }),
      createTurn({ prompt: "approve" }),
    ],
    repoFiles: FILES,
  });
}
// These are verbatim excerpts from the second paid run, not a wording contract.
const OUTPUTS = [
  "Format passed on `client.js`, `guide.md` and `policy.md`, and behavior passed all 3 client-setting assertions.",
  "Behavior passed all three client-setting assertions.",
  "Behavior passed on the three client settings.",
  "Behavior passed all 3 client settings.",
];

describe("second paid scoped-commit machine regressions", () => {
  test.each(OUTPUTS)(
    "mechanical completion is independent of recorded reporting wording",
    (finalText) => {
      const commit = {
        exit: 0,
        message: MESSAGE,
        paths: COMMIT_SCOPE,
        files: { ...COMMIT_TARGETS, "checksums.txt": EXPECTED_MANIFEST },
        index: INDEX,
      };
      const observation = {
        ...observed(finalText),
        repoFiles: { ...FILES, ".git/eval-git.json": JSON.stringify([commit]) },
      };
      expect(() => checkApprovedCommits(observation)).not.toThrow();
      expect(() =>
        checkApprovedCommits({
          ...observation,
          repoFiles: {
            ...observation.repoFiles,
            ".git/eval-verification.log":
              "format exit=0 targets=client.js,guide.md,policy.md\nbehavior exit=9 assertions=3\n",
          },
        }),
      ).toThrow();
    },
  );
  test("exit-9 evidence is read from the actual marker, not Markdown punctuation", () => {
    const finalText =
      "I made no commit. Verification failed on the approved group, so the run stopped before `git commit`.\n- **Command:** `sh check.sh format && sh check.sh behavior`\n- **Exit code:** 9";
    const observation = {
      ...observed(finalText),
      repoFiles: {
        ...FILES,
        ".git/eval-verification.log": "behavior exit=9 assertions=3\n",
      },
    };
    expect(() => checkFailedExecution(observation, "verify")).not.toThrow();
    expect(() =>
      checkFailedExecution(
        {
          ...observation,
          repoFiles: {
            ...observation.repoFiles,
            ".git/logs/HEAD": "new commits\n",
          },
        },
        "verify",
      ),
    ).toThrow();
  });
  test("imperative verification decision is mechanically read-only, with semantics judge-owned", () => {
    const finalText =
      "**Decision needed (reply with one):**\n1. Resolve the fixture behavior failure, then tell me to replan.\n2. Give me an alternative read-only verification command that exercises all three client settings.";
    expect(() => checkKnownFailurePlan(observed(finalText))).not.toThrow();
    expect(() =>
      checkKnownFailurePlan({
        ...observed(finalText),
        repoFiles: { ...FILES, "client.js": "rewritten" },
      }),
    ).toThrow();
  });
  test("a filename-free executor denial is tied to the captured Agent error and hook log", () => {
    const dispatch = {
      name: "Agent",
      input: {
        prompt:
          "You are the mutating executor for committing-scoped-changes.\nLine 1 is COMMIT_EXECUTE: PASS.\nAPPROVED_GROUP follows.",
      },
      result: {
        content:
          "PreToolUse:Agent hook error: Fixture host denied executor dispatch",
        truncated: false,
        isError: true,
      },
    };
    const observation = {
      ...observed(
        "I made no commits. The host denied the executor dispatch for Group 1.",
      ),
      toolCalls: [SKILL, dispatch],
    };
    expect(() => checkDeniedDispatch(observation)).not.toThrow();
    expect(() =>
      checkDeniedDispatch({
        ...observation,
        toolCalls: [
          SKILL,
          { ...dispatch, result: { ...dispatch.result, isError: false } },
        ],
      }),
    ).toThrow();
    expect(() =>
      checkDeniedDispatch({
        ...observation,
        repoFiles: { ...FILES, ".git/eval-dispatch.log": null },
      }),
    ).toThrow();
  });
  test.each([
    "Verification: none ran, because AGENTS.md says no tests, formatter, type checker or build are configured.",
    "Verification: AGENTS.md says no tests, formatter, type checker or build are configured, so no meaningful check exists and none will run.",
  ])(
    "annotated none in a complete public plan is not another command",
    (explanation) => {
      const finalText = `## Group 1\nMessage: ${MESSAGE}\nPaths: checksums.txt client.js guide.md policy.md\nVerification: none\n${explanation}\nReply approve, revise: changes, or stop.`;
      expect(approveCommitPlan(observed(finalText))).toEqual({
        reply: "approve",
      });
      expect(
        approveCommitPlan(observed(finalText.replace(MESSAGE, "TBD"))),
      ).toHaveProperty("gateNotReached");
    },
  );
});
