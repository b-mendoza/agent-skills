import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { FollowUpReply } from "#/cases/case-contract.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { assertApprovedPoster } from "#/cases/review-pull-request-approved.ts";
import {
  assertPinnedCitations,
  assertPostedBodies,
  assertReviewedTerminal,
  postingPreview,
  section,
} from "#/cases/review-pull-request-checks.ts";
import {
  REOPEN_APPROVAL,
  REOPEN_THREAD,
  REVIEW_POSTS,
  UNRESOLVE,
} from "#/cases/review-pull-request-fixtures.ts";
import {
  posterPreview,
  registeredFixtureRoot,
  retainedApprovalReply,
} from "#/cases/review-pull-request-gates.ts";
import { observedReviewRun } from "#/cases/review-pull-request-retention.ts";
import {
  assertVisibleReview,
  visibleTurn,
} from "#/cases/review-pull-request-visible-preview.ts";
import { capturedText } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

const ROOT_URL = `${GITHUB_FACTS.url}#discussion_r${GITHUB_FACTS.rootId}`;
const ACTION = `Then unresolve review thread ${REOPEN_THREAD}: ${ROOT_URL}`;
const ONE = 1;
const WRITES = 3;

function previewWithoutReopen(preview: string): string {
  assert.deepEqual(
    preview.match(/^Threads reopened after their replies: .*$/gm),
    ["Threads reopened after their replies: 1"],
  );
  assert.deepEqual(preview.match(/^Then unresolve review thread .*$/gm), [
    ACTION,
  ]);
  const suffix = `\n\n${ACTION}\napproval-sha256: `;
  assert.ok(
    preview.includes(suffix),
    "reopen must follow its approved reply body",
  );
  return preview.replace(suffix, "\napproval-sha256: ");
}

function affirmativeReopen(header: string): boolean {
  return (
    /\b(?:reopen|unresolve)\b/iu.test(header) &&
    !/\bbefore\b[^.!?]*\brepl(?:y|ying|ies)\b/iu.test(header) &&
    !/\b(?:not|never|skip|without|cannot|can['’]t|won['’]t|don['’]t)\b/iu.test(
      header,
    )
  );
}

function showsReopenTarget(text: string): boolean {
  const lines = text.split("\n");
  return lines.some((line) => {
    const header = line.replace(/^[\s#>*`|+-]+/, "");
    if (!affirmativeReopen(header)) return false;
    const targets: readonly string[] =
      header.match(/PRRT_[\w-]+|https?:\/\/[^\s)>`]+/g) ?? [];
    if (!targets.includes(REOPEN_THREAD)) return false;
    return targets.some(
      (target) =>
        target.startsWith(ROOT_URL) &&
        /^[.,;:!?]*$/.test(target.slice(ROOT_URL.length)),
    );
  });
}

export function approveReopen(observation: Observation): FollowUpReply {
  try {
    const { output, hash } = posterPreview(observation);
    const visible = visibleTurn(observation.finalText);
    assertVisibleReview(previewWithoutReopen(output), visible);
    assert.ok(
      showsReopenTarget(visible),
      "visible preview missing planned reopen and thread target",
    );
    const gate = retainedApprovalReply(observation);
    if ("gateNotReached" in gate) return gate;
    // Only the scripted APPROVED reply opens the fake, not --dry-run or --approved argv.
    writeFileSync(
      join(registeredFixtureRoot(observation), REOPEN_APPROVAL),
      hash,
      { flag: "wx" },
    );
    return gate;
  } catch (error) {
    return {
      gateNotReached: error instanceof Error ? error.message : String(error),
    };
  }
}

function assertReopenWrites(observation: Observation): void {
  const preview = previewWithoutReopen(postingPreview(observation).output);
  const writes = capturedText(observation, REVIEW_POSTS).trim().split("\n");
  assert.equal(
    writes.length,
    WRITES,
    "expected exactly a review, reply and reopen",
  );
  const last = writes.pop();
  assert.ok(last !== undefined);
  assert.deepEqual(
    JSON.parse(last),
    {
      endpoint: "graphql",
      payload: { query: UNRESOLVE, variables: { id: REOPEN_THREAD } },
    },
    "wrong final mutation or target",
  );
  assertPostedBodies(writes, preview, [GITHUB_FACTS.rootId]);
}

function assertPosterSucceeded(observation: Observation): void {
  const [preview] = observation.turns ?? [];
  assert.ok(preview !== undefined);
  const { hash } = posterPreview({
    ...observation,
    toolCalls: preview.toolCalls,
  });
  assertApprovedPoster(observation, hash, observedReviewRun(observation));
}

function assertReopenedReceipt(report: string): void {
  const posting = section(report, "Posting");
  assert.doesNotMatch(posting, /^Failed\/uncertain:|^Posting is incomplete\./m);
  const reopened = posting.match(/^Reopened: .+$/gm);
  assert.ok(reopened !== null, "no reopen receipt");
  assert.equal(
    reopened.length,
    ONE,
    "missing unique reopened receipt in report",
  );
  const [receipt] = reopened;
  const finding = /^ID: (?<id>.+)$/m.exec(section(report, "Findings"))
    ?.groups?.["id"];
  assert.ok(finding !== undefined);
  assert.deepEqual(JSON.parse(receipt.slice("Reopened: ".length)), {
    finding,
    thread_id: REOPEN_THREAD,
    url: ROOT_URL,
  });
}

export function checkReopen(observation: Observation): string {
  const report = assertReviewedTerminal(observation);
  assertPinnedCitations(observation, report);
  assertReopenWrites(observation);
  assertPosterSucceeded(observation);
  assertReopenedReceipt(report);
  return "Posted the approved review and reply, then reopened the matching thread";
}
