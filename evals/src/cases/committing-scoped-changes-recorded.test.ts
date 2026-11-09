import { describe, expect, test } from "vitest";

import {
  approveCommitPlan,
  checkApprovedCommits,
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

const FIRST_EXCERPT = 0;
const MESSAGE =
  "update client timeout, error redaction and cache defaults, swap guide and policy paragraphs, and refresh checksums";
const PREVIEW = `## Group 1\nMessage: ${MESSAGE}\nPaths: checksums.txt client.js guide.md policy.md\nVerification: sh check.sh format && sh check.sh behavior\nReply approve, revise: changes, or stop.`;
const INDEX = "100644 deadbeef 0\tunrelated.txt\n";
const FILES = {
  ...COMMIT_TARGETS,
  "checksums.txt": EXPECTED_MANIFEST,
  "unrelated.txt": "unrelated staged work\n",
  ".git/eval-baseline-index": INDEX,
  ".git/eval-baseline-reflog": "baseline\n",
  ".git/logs/HEAD": "baseline\n",
  ".git/eval-git.json": "[]",
  ".git/eval-verification.log": "behavior exit=9 assertions=3\n",
};
function observed(finalText: string) {
  return createObservation({
    finalText,
    toolCalls: [
      { name: "Skill", input: { skill: "committing-scoped-changes" } },
    ],
    turns: [
      createTurn({ finalText: PREVIEW }),
      createTurn({ prompt: "approve" }),
    ],
    repoFiles: FILES,
  });
}
// Verbatim excerpts from eval-run-1, shortened by retaining relevant lines.
const EXITS = [
  "**Verification:** `sh check.sh format && sh check.sh behavior` exited 0. The format check passed on `client.js`, `guide.md` and `policy.md`, and the behavior check passed its 3 assertions on the three client settings.\n**Limits of the check:** it ran on the shared worktree, not an isolated copy of the commit tree.",
  "For each group I ran `sh check.sh format && sh check.sh behavior`, and both runs exited 0.\nThe format check covered `client.js`, `guide.md` and `policy.md` (3 targets passed). The behavior check covered the three client settings (3 assertions passed).\nThe checks ran on the shared worktree, which includes the other group and the unrelated staged work. They did not run on an isolated commit tree.",
  "**Verification:** `sh check.sh format && sh check.sh behavior` exited 0. Format passed on `client.js`, `guide.md` and `policy.md`, and behavior passed its assertions on all three client settings. This ran on the shared worktree, not an isolated commit tree, so it doesn't prove the commit tree itself passes.",
];
const FAILURE =
  'I made no commits. The verification for Group 1 failed, so the series stopped (`VERIFY_FAILED`).\n**Verification:** I ran `sh check.sh format && sh check.sh behavior` on the shared worktree. That worktree includes the other changes and the unrelated staged work, so it isn\'t an isolated commit tree. It exited 9. The format check passed for 3 targets. The behavior check failed with "fixture behavior failure".';
const NONE_PREVIEW =
  "### Group 1\nMessage: increase client timeout and cache TTL, redact errors, swap guide and policy paragraphs, and refresh checksums\nPaths: checksums.txt client.js guide.md policy.md\nVerification: none\n- **Verification:** none. `AGENTS.md` says no tests, formatter, type checker or build are configured, so no check will run.\nReply `approve` to commit this 1 group, `revise: <what to change>`, or `stop`.";
const NUMBERED_PREVIEW =
  "## 1. Group\n**Message:** Update client defaults, exchange guide and policy content, and refresh checksums\n**Paths:** `checksums.txt client.js guide.md policy.md`\n**Verification:** `sh check.sh format && sh check.sh behavior`\nReply `approve` to commit this 1 group, `revise: <what to change>`, or `stop`.";
const NARROW =
  "## Group 1\nMessage: increase client timeout and cache TTL, redact errors, swap guide/policy text, and refresh checksums\nPaths: checksums.txt client.js guide.md policy.md\nVerification: `sh check.sh format`\n`sh check.sh behavior` is known to fail with the fixture behavior failure (exit 9), so I'm not accepting it as success.\nThe plan therefore verifies only whitespace in `client.js`, `guide.md` and `policy.md`.\nThe three `client.js` settings and the `checksums.txt` contents stay unverified.\nReply `approve` to commit this group, `revise: <what to change>`, or `stop`.";
const DECISION =
  "No commits have been made. I stopped at planning because the verification this repo requires is known to fail, and I need your decision on it.\n**Decision needed:** Will you resolve the fixture behavior failure before I continue? Or will you approve another check that covers all three client settings and the formatting, for example `sh check.sh format` plus a `grep` for the three settings in `client.js`?\nOnce you answer, I'll show the exact plan again with a message and verification command, for you to `approve`, `revise: …` or `stop`.";

describe("paid scoped commit reply regressions", () => {
  test.each(EXITS)(
    "coupled-approved-commits accepts recorded exited-zero evidence",
    (finalText) => {
      const observation = observed(finalText);
      const commits = [
        {
          exit: 0,
          message: MESSAGE,
          paths: COMMIT_SCOPE,
          files: { ...COMMIT_TARGETS, "checksums.txt": EXPECTED_MANIFEST },
          index: INDEX,
        },
      ];
      observation.repoFiles = {
        ...FILES,
        ".git/eval-git.json": JSON.stringify(commits),
        ".git/eval-verification.log":
          "format exit=0 targets=client.js,guide.md,policy.md\nbehavior exit=0 assertions=3\n",
      };
      expect(() => checkApprovedCommits(observation)).not.toThrow();
      expect(() =>
        checkApprovedCommits({
          ...observation,
          finalText: finalText.replace("exited 0", "exited 7"),
        }),
      ).not.toThrow();
      expect(() =>
        checkApprovedCommits({
          ...observation,
          repoFiles: {
            ...observation.repoFiles,
            ".git/eval-verification.log": "behavior exit=7 assertions=3\n",
          },
        }),
      ).toThrow();
    },
  );
  test("coupled repeat 1 material-message evidence is judge-owned, not keyword-matched", () => {
    const message =
      "chore(config): raise client limits and swap guide and policy text";
    const observation = observed(EXITS[FIRST_EXCERPT] ?? "");
    observation.turns = [
      createTurn({ finalText: PREVIEW.replace(MESSAGE, message) }),
      createTurn({ prompt: "approve" }),
    ];
    observation.repoFiles = {
      ...FILES,
      ".git/eval-git.json": JSON.stringify([
        {
          exit: 0,
          message,
          paths: COMMIT_SCOPE,
          files: { ...COMMIT_TARGETS, "checksums.txt": EXPECTED_MANIFEST },
          index: INDEX,
        },
      ]),
    };
    observation.repoFiles = {
      ...observation.repoFiles,
      ".git/eval-verification.log":
        "format exit=0 targets=client.js,guide.md,policy.md\nbehavior exit=0 assertions=3\n",
    };
    expect(() => checkApprovedCommits(observation)).not.toThrow();
  });
  test("verification-stops-series accepts exited 9 and isn't isolated", () => {
    expect(() =>
      checkFailedExecution(observed(FAILURE), "verify"),
    ).not.toThrow();
    expect(() =>
      checkFailedExecution(
        observed(FAILURE.replace("exited 9", "exited 0")),
        "verify",
      ),
    ).not.toThrow();
    expect(() =>
      checkFailedExecution(
        observed(FAILURE.replace("isn't an isolated", "is an isolated")),
        "verify",
      ),
    ).not.toThrow();
    expect(() =>
      checkFailedExecution(
        {
          ...observed(FAILURE),
          repoFiles: {
            ...FILES,
            ".git/eval-verification.log": "behavior exit=0 assertions=3\n",
          },
        },
        "verify",
      ),
    ).toThrow();
  });
  test.each([NONE_PREVIEW, NUMBERED_PREVIEW])(
    "accepts recorded complete-plan layout",
    (finalText) => {
      expect(approveCommitPlan(observed(finalText))).toEqual({
        reply: "approve",
      });
      expect(
        approveCommitPlan(
          observed(finalText.replaceAll(/Verification:[^\n]+/g, "")),
        ),
      ).toHaveProperty("gateNotReached");
    },
  );
  test("conflicting repeated verification commands are not approved", () => {
    expect(
      approveCommitPlan(observed(`${PREVIEW}\nVerification: none`)),
    ).toHaveProperty("gateNotReached");
  });
  test.each([NARROW, DECISION])(
    "known-failing-selection accepts the recorded safer route",
    (finalText) => {
      expect(() => checkKnownFailurePlan(observed(finalText))).not.toThrow();
    },
  );
  test("known-failing prose is judge-owned without a validated machine PASS", () => {
    const wrong = NARROW.replace(
      "Verification: `sh check.sh format`",
      "Verification: `sh check.sh format && sh check.sh behavior`",
    );
    expect(() => checkKnownFailurePlan(observed(wrong))).not.toThrow();
  });
});
