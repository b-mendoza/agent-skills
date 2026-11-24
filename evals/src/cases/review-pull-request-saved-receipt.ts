import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { capturedText } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

const REVIEW_RECEIPT = {
  id: 900,
  url: `${GITHUB_FACTS.url}#pullrequestreview-900`,
};
const POSTING = "\n\n## Posting\n\n";
const START = 0;

/** Both saved-draft scenarios submit one review and no inline comments, replies or reopens. */
export function assertSavedReceipt(
  observation: Observation,
  report: string,
  run: string,
  approvedDraftHash: string,
): void {
  const receipts: unknown = JSON.parse(
    capturedText(observation, `${run}/receipts.json`),
  );
  assert.deepEqual(
    receipts,
    {
      review: REVIEW_RECEIPT,
      replies: [],
      reopened: [],
      failed: [],
      complete: true,
      inline: null,
      inline_error: null,
    },
    "receipt does not match the single posted review",
  );
  const offset = report.lastIndexOf(POSTING);
  assert.ok(offset >= START, "missing Posting section");
  const beforePosting = report.slice(START, offset + POSTING.length);
  const [review, pointer, end, ...extra] = report
    .slice(beforePosting.length)
    .split("\n");
  assert.ok(
    review?.startsWith("Review: ") === true,
    "missing review receipt in rendered report",
  );
  assert.deepEqual(
    JSON.parse(review.slice("Review: ".length)),
    REVIEW_RECEIPT,
    "rendered receipt differs from the posted review",
  );
  assert.deepEqual(
    [pointer, end, ...extra],
    [`Saved package: ${run}`, ""],
    "unexpected posted report contents",
  );
  // The renderer replaces only its final Posting section. Restore its known draft suffix
  // to compare all preceding bytes with the render hash checked against the file at approval.
  const draft = `${beforePosting}Not posted.\nSaved package: ${run}\n`;
  assert.equal(
    createHash("sha256").update(draft).digest("hex"),
    approvedDraftHash,
    "verified draft changed outside Posting after approval",
  );
}
