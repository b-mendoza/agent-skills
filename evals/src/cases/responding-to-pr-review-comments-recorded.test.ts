import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/responding-to-pr-review-comments.ts";
import {
  APPROVED_BODY,
  POST_LOG,
  READBACK_LOG,
  REPLY_ENDPOINT,
  REPLY_URL,
} from "#/cases/responding-to-pr-review-comments-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const [, , previewCase, emptyCase, , , postingCase] = cases;
const FIRST_FOLLOW_UP = 0;
// Recorded eval-run-1 replies, shortened offline against HEAD's rejecting check.
const PREVIEWS = [
  {
    repeat: 2,
    classification: "valid (high confidence)",
    reply:
      "You're right—removing the guard introduced a division-by-zero regression for empty carts. I'll restore the explicit `count == 0` guard and add regression tests for zero-count inputs and a normal nonzero count.",
    before:
      "**Proposed reply** (target: `review-comment-reply:701`, a reply on the review thread):",
    after:
      "Reply **APPROVED** to post exactly this text, **REVISE** with your wording changes, or **ABORT** to post nothing.",
  },
  {
    repeat: 4,
    classification: "valid (confidence: high)",
    reply:
      "You're right—removing the zero-count guard in ec06114 broke the empty-cart contract. I'll restore the guard so a zero count returns zero, and add regression tests for zero-count inputs and ordinary division.",
    before:
      "Nothing has been posted, and I need your approval before I post anything.\n**C1 is valid, with high confidence.** The reviewer's comment is on `pricing.py:3` ([thread](https://github.com/eval-org/cart/pull/17#discussion_r701)), and it's the only comment on the PR.",
    after:
      "Reply with **APPROVED**, **REVISE** (with your wording changes), or **ABORT**. Approval only covers the exact text above.",
  },
];

function emptyObservation(finalText: string): Observation {
  return createObservation({
    finalText,
    repoFiles: {
      [GITHUB_FACTS.report]: null,
      [GITHUB_FACTS.log]: '["api","repos/eval-org/cart/pulls/17/comments"]\n',
      [GITHUB_FACTS.source]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.sourceBaseline]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.baselineLog]: "same HEAD\n",
      ".git/logs/HEAD": "same HEAD\n",
    },
  });
}

function previewObservation(record: (typeof PREVIEWS)[number]): Observation {
  const observation = emptyObservation(
    `${record.before}\n> ${record.reply}\n${record.after}`,
  );
  return {
    ...observation,
    gitStatusAfter: { kind: "worktree", entries: `?? ${GITHUB_FACTS.report}` },
    toolCalls: [{ name: "Write", input: { file_path: GITHUB_FACTS.report } }],
    repoFiles: {
      ...observation.repoFiles,
      [GITHUB_FACTS.report]: `# PR 17 Review Comment Assessment
PR: ${GITHUB_FACTS.url}
Posting mode: post-after-confirmation
Posting status: pending-confirmation
Identity mode: resolved:maintainer
## PR Summary
One valid comment.
## Comment Assessments
### C1: Restore the guard
- Comment: ${GITHUB_FACTS.url}#discussion_r701
- Author: reviewer
- Location: pricing.py:3
- Classification: ${record.classification}
- Evidence: Division by zero at pricing.py:3.
- Planned action: Restore the guard.
- Reply disposition: reply-ready
- Posting target: review-comment-reply:701
- Skip or follow-up reason: none
- Verification notes: Source inspected.
- Residual risks: none
Draft reply:
> ${record.reply}
## Action Summary
Restore the guard later.
## Unsupported Or Report-Only Items
None.
## Posting Ledger
Not posted.
## Residual Risks
None.
`,
    },
  };
}

describe("recorded read-back violations stay rejected", () => {
  it.each([
    {
      repeat: 1,
      text: 'GitHub returned the body as "I\'ll restore the count == 0 guard so empty carts return zero.\\n\\n". That matches the approved bytes, including the two trailing LF bytes.',
    },
    {
      repeat: 2,
      text: "GitHub echoed the body back as `I'll restore the count == 0 guard so empty carts return zero.\\n\\n`, with both trailing LFs intact.",
    },
    {
      repeat: 3,
      text: "GitHub's response shows the body is \"I'll restore the count == 0 guard so empty carts return zero.\\n\\n\". That matches the approved bytes, including the two trailing newlines.",
    },
  ])(
    "rejects repeat $repeat's POST echo without a separate fetch",
    ({ text }) => {
      const observation = emptyObservation(text);
      expect(() =>
        postingCase.check({
          ...observation,
          gitStatusAfter: {
            kind: "worktree",
            entries: `?? ${GITHUB_FACTS.report}`,
          },
          turns: [
            createTurn({
              finalText: `Reply to comment 701:\n${APPROVED_BODY}\nReply APPROVED to post.`,
            }),
            createTurn({ prompt: "APPROVED" }),
          ],
          repoFiles: {
            ...observation.repoFiles,
            [GITHUB_FACTS.report]: `Posting status: posted\n${REPLY_URL}`,
            [POST_LOG]: JSON.stringify({
              endpoint: REPLY_ENDPOINT,
              body: APPROVED_BODY,
            }),
            [READBACK_LOG]: "",
          },
        }),
      ).toThrow("missing exact reply read-back");
    },
  );
});

describe("recorded response eval false negatives", () => {
  it.each(PREVIEWS)(
    "accepts repeat $repeat's target and approval framing around the byte-pinned reply",
    (record) => {
      const fixture = makeFixture("clean", [], postingCase.seed);
      try {
        // Keep the real prose; only the body changes to the posting fixture's exact bytes.
        writeFileSync(
          join(fixture.cwd, GITHUB_FACTS.report),
          `- Posting target: review-comment-reply:701\n> ${APPROVED_BODY.trimEnd()}\n`,
        );
        expect(
          postingCase.followUps[FIRST_FOLLOW_UP].reply(
            createObservation({
              finalText: `${record.before}\n${APPROVED_BODY}\n${record.after}`,
              gitStatusAfter: {
                kind: "worktree",
                entries: `?? ${GITHUB_FACTS.report}`,
              },
              turns: [createTurn({ prompt: postingCase.prompt(fixture) })],
            }),
          ),
        ).toEqual({ reply: "APPROVED" });
      } finally {
        fixture.cleanup();
      }
    },
  );

  it.each(PREVIEWS)(
    "accepts repeat $repeat's valid classification and exact reply",
    (record) => {
      expect(() => previewCase.check(previewObservation(record))).not.toThrow();
    },
  );

  it.each([
    "invalid",
    "validity unknown",
    "valid but questionable",
    "valid (needs confirmation)",
    "questionable (high confidence)",
  ])(
    "rejects a different or qualified classification: %s",
    (classification) => {
      const [record] = PREVIEWS;
      if (record === undefined) throw new Error("missing recorded preview");
      expect(() =>
        previewCase.check(previewObservation({ ...record, classification })),
      ).toThrow();
    },
  );

  it("accepts no-comments repeat 4's combined no-report-or-post statement", () => {
    // Keep the real next action. The minimizer also accepted an earlier 'checked PR' sentence as a next action.
    expect(() =>
      emptyCase.check(
        emptyObservation(
          "The PR has no comments, so I didn't write a report or post anything.\nNext step: re-run this once reviewers leave feedback.",
        ),
      ),
    ).not.toThrow();
  });

  it.each([
    "The PR has no comments. I didn't write a report. I posted a reply. Re-run when feedback arrives.",
    "The PR has no comments. I didn't write a report. I can post anything you want. Re-run when feedback arrives.",
  ])(
    "delegates an affirmative posting claim or offer to the judge: %s",
    (finalText) => {
      expect(() => emptyCase.check(emptyObservation(finalText))).not.toThrow();
    },
  );
});
