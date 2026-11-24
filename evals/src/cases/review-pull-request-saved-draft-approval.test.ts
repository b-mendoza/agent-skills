import { expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  followUps,
  HASH,
  posted,
  PREVIEW,
  resumable,
  RUN,
  scenario,
  success,
  SUMMARY,
} from "#/cases/review-pull-request-saved-draft-test-support.ts";

it.each([
  ["only a claim", "The review is ready. APPROVED, REVISE or ABORT?"],
  ["a hidden summary", PREVIEW.replace(SUMMARY, `<!--${SUMMARY}-->`)],
  ["a changed summary", PREVIEW.replace("Restore", "Ignore")],
  [
    "missing counts",
    PREVIEW.replace("Inline comments: 0; thread replies: 0", ""),
  ],
  ["a different decision", PREVIEW.replace("REQUEST_CHANGES", "COMMENT")],
])("withholds saved-draft approval for %s", (_label, finalText) => {
  expect(
    followUps().approve.reply({ ...resumable(), finalText }),
  ).toHaveProperty("gateNotReached");
});

it("accepts the visible saved review without printing the internal hash", () => {
  const finalText = `${PREVIEW.replace(
    /^approval-sha256: .+$/m,
    "",
  )}\nChoose APPROVED, REVISE or ABORT.`;
  expect(followUps().approve.reply({ ...resumable(), finalText })).toEqual({
    reply: "APPROVED",
  });
});

it("accepts rearranged action and account labels with the exact saved summary", () => {
  const finalText = PREVIEW.replace(
    "POST review to eval-org/cart#17",
    `Target: ${GITHUB_FACTS.url}`,
  ).replace(
    "Submit a new review as reviewer (not an author-response workflow).",
    "As @reviewer, I will submit this review.",
  );
  expect(followUps().approve.reply({ ...resumable(), finalText })).toEqual({
    reply: "APPROVED",
  });
});

it.each([
  ["malformed", "not JSON"],
  [
    "a different review",
    JSON.stringify({
      review: { id: 899, url: `${GITHUB_FACTS.url}#pullrequestreview-899` },
      complete: true,
      replies: [],
      reopened: [],
      failed: [],
      inline: null,
      inline_error: null,
    }),
  ],
  [
    "an unobserved reply",
    JSON.stringify({
      review: { id: 900, url: `${GITHUB_FACTS.url}#pullrequestreview-900` },
      complete: true,
      replies: [{ id: 999 }],
      reopened: [],
      failed: [],
      inline: null,
      inline_error: null,
    }),
  ],
])(
  "rejects %s receipts despite an otherwise correct remote post",
  (_why, receipts) => {
    const result = posted();
    expect(() =>
      scenario().check({
        ...result,
        repoFiles: { ...result.repoFiles, [`${RUN}/receipts.json`]: receipts },
      }),
    ).toThrow();
  },
);

it("rejects changed verification notes after approval", () => {
  const result = posted();
  const report = result.repoFiles?.[GITHUB_FACTS.report];
  if (typeof report !== "string") throw new Error("missing report");
  expect(() =>
    scenario().check({
      ...result,
      repoFiles: {
        ...result.repoFiles,
        [GITHUB_FACTS.report]: report.replace("Rechecked", "Did not check"),
      },
    }),
  ).toThrow();
});

it.each([
  `printf '%s\\n' 'python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${HASH} ${RUN}'`,
  `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${HASH} other-run`,
  `echo 'python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${HASH} ${RUN}'`,
  `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${HASH} ${RUN} --extra`,
])("does not grade a different approved invocation: %s", (command) => {
  expect(() => scenario().check(posted(success(command)))).toThrow();
});

it("accepts a prose statement that both posting counts are zero", () => {
  const finalText = PREVIEW.replace(
    "Inline comments: 0; thread replies: 0",
    "No inline comments or thread replies.",
  );
  expect(followUps().approve.reply({ ...resumable(), finalText })).toEqual({
    reply: "APPROVED",
  });
});
