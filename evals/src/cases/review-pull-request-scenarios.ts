import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { behavioralDefaults } from "#/cases/case-contract.ts";
import {
  assertNoGithubWrites,
  assertPlantedStatePreserved,
} from "#/cases/pr-creator-checks.ts";
import { GITHUB_FACTS, GITHUB_SNAPSHOTS } from "#/cases/pr-creator-fixtures.ts";
import {
  approvalReply,
  assertCrossFileScratch,
  assertPinnedCitations,
  assertPosting,
  assertReviewedArtifact,
  assertThreadAssessments,
  assertTicketRead,
} from "#/cases/review-pull-request-checks.ts";
import {
  LATE_CI_READS,
  REVIEW_POSTS,
  seedReviewFixture,
  SENTINEL,
  TICKET_LOG,
} from "#/cases/review-pull-request-fixtures.ts";
import { judgeReview } from "#/cases/review-pull-request-judges.ts";
import {
  assertFileAbsent,
  assertNoMutation,
  capturedText,
  findBashCalls,
} from "#/cases/shared-checks.ts";

const SKILL = "review-pull-request";
const NO_CALLS = 0;
const extensionSnapshots = [
  ...GITHUB_SNAPSHOTS,
  GITHUB_FACTS.report,
  REVIEW_POSTS,
  LATE_CI_READS,
  TICKET_LOG,
  SENTINEL,
  ".handoffs/review-pull-request/",
];
const extensionDefaults = {
  ...behavioralDefaults,
  skill: SKILL,
  mutationPolicy: "allowed",
  budgetUsd: 2.5,
  snapshotPaths: extensionSnapshots,
  judge: judgeReview("review"),
} as const;

const postingCases = ([undefined, "thread", "head"] as const).map(
  (drift): EvalCase => ({
    ...extensionDefaults,
    id: `review-pull-request/approved-${drift ?? "thread-reply"}`,
    judge: judgeReview("threads"),
    intent:
      "Assess all unresolved threads, preview an exact new review, and preflight after approval",
    seed: (context) => {
      seedReviewFixture(context, {
        threads: true,
        ...(drift === undefined ? {} : { drift }),
      });
    },
    prompt: () =>
      `Review ${GITHUB_FACTS.url} for correctness. Save OUTPUT_FILE=${GITHUB_FACTS.report}, POSTING_MODE=post-after-confirmation. Review unresolved claims even when no candidate matches. Show the exact preview and wait for my reply. Do not resolve any thread.`,
    followUps: [{ name: "approve-review", reply: approvalReply }],
    check: (observation) => {
      const report = assertReviewedArtifact(observation);
      assertThreadAssessments(report);
      assertPinnedCitations(observation, report);
      assertPosting(observation, drift !== undefined);
      return drift === undefined
        ? "Exact new review and one thread reply posted after approval"
        : "Fresh preflight refused drift without GitHub writes";
    },
  }),
) satisfies EvalCase[];

export const extensionCases = [
  ...postingCases,
  {
    ...extensionDefaults,
    id: "review-pull-request/divergent-checkout",
    seed: (context) => {
      seedReviewFixture(context, { divergent: true });
    },
    snapshotPaths: [
      ...extensionSnapshots,
      ".git/reviewed-pr-head",
      ".git/checkout-head",
    ],
    intent:
      "Read pinned PR code even when the local checkout already fixes the regression",
    prompt: () =>
      `Review ${GITHUB_FACTS.url} for correctness, OUTPUT_FILE=${GITHUB_FACTS.report}, draft only. Do not change this checkout.`,
    check: (observation) => {
      const report = assertReviewedArtifact(observation);
      assertNoGithubWrites(observation);
      assertPinnedCitations(observation, report);
      const reviewed = capturedText(observation, ".git/reviewed-pr-head");
      assert.ok(report.includes(`Reviewed head: ${reviewed}`));
      assert.notEqual(
        reviewed,
        capturedText(observation, ".git/checkout-head"),
      );
      assert.match(report, /## Review decision\s+REQUEST_CHANGES/);
      return "Pinned regression found despite a clean but divergent local checkout";
    },
  },
  {
    ...extensionDefaults,
    id: "review-pull-request/existing-approval-abort",
    judge: judgeReview("clean"),
    intent:
      "No-findings review notices a same-account approval and preserves the draft on ABORT",
    seed: (context) => {
      seedReviewFixture(context, { clean: true });
    },
    prompt: () =>
      `Review ${GITHUB_FACTS.url} for correctness, OUTPUT_FILE=${GITHUB_FACTS.report}, POSTING_MODE=post-after-confirmation. Preserve collection-time CI attribution. Show an exact preview before any posting.`,
    followUps: [
      {
        name: "abort-redundant-review",
        reply: (observation) => {
          const gate = approvalReply(observation);
          if ("gateNotReached" in gate) return gate;
          return { reply: "ABORT" };
        },
      },
    ],
    check: (observation) => {
      const report = assertReviewedArtifact(observation);
      assertNoGithubWrites(observation);
      assert.equal(
        [...report.matchAll(/^ID:/gm)].length,
        NO_CALLS,
        "unexpected canonical findings in a behavior-preserving PR",
      );
      assert.equal(
        capturedText(observation, LATE_CI_READS),
        "",
        "CI refreshed after preview",
      );
      assert.equal(capturedText(observation, REVIEW_POSTS), "");
      const [, reply] = observation.turns ?? [];
      assert.ok(reply !== undefined);
      assert.equal(reply.prompt, "ABORT");
      assert.equal(
        findBashCalls(observation, /post-review\.py[^\n]*--approved/).length,
        NO_CALLS,
      );
      return "No-findings author path, prior approval warning and abort preserved";
    },
  },
  {
    ...extensionDefaults,
    id: "review-pull-request/historical-draft",
    judge: judgeReview("historical"),
    intent: "Closed PRs receive scoped historical reviews without posting",
    seed: (context) => {
      seedReviewFixture(context, { historical: true });
    },
    prompt: () =>
      `Review ${GITHUB_FACTS.url} for correctness and save OUTPUT_FILE=${GITHUB_FACTS.report}; draft only.`,
    check: (observation) => {
      const report = assertReviewedArtifact(observation);
      assertNoGithubWrites(observation);
      assert.match(report, /PR state: closed \(historical assessment\)/);
      assert.equal(capturedText(observation, REVIEW_POSTS), "");
      return "Historical draft saved without GitHub effects";
    },
  },
  ...(["allow", "deny"] as const).map((access): EvalCase => ({
    ...extensionDefaults,
    id: `review-pull-request/authenticated-ticket-${access}`,
    judge: judgeReview(access === "allow" ? "ticket" : "denied"),
    budgetUsd: 3.0,
    intent:
      "Ground project requirements in an observed authenticated connector read or stop on denied access",
    seed: (context) => {
      seedReviewFixture(context, { ticket: access });
    },
    prompt: () =>
      `Review ${GITHUB_FACTS.url}, OUTPUT_FILE=${GITHUB_FACTS.report}, draft only. The linked ticket is authoritative for requirements; use the available authenticated read-only project connector CLI, ticket read URL. Do not guess its requirements. Follow the pricing-to-cart-to-checkout path as one causal defect, not one comment per file. For the larger checkout evidence, give each role an assigned bounded scratch file for redacted notes, use Write for those notes so the file writes are observable, and at the actual terminal remove all and only this run's recorded scratch AND payload files, as the skill requires. Preserve the unrelated run. Keep full diffs out of scratch.`,
    check: (observation) => {
      assertTicketRead(observation, access === "deny");
      assertNoGithubWrites(observation);
      assert.equal(capturedText(observation, REVIEW_POSTS), "");
      if (access === "allow") {
        const report = assertReviewedArtifact(observation);
        assertPinnedCitations(observation, report);
        assertCrossFileScratch(observation, report);
      } else {
        assertPlantedStatePreserved(observation);
        assert.deepEqual(observation.gitStatusAfter, {
          kind: "worktree",
          entries: "",
        });
        assertFileAbsent(observation, GITHUB_FACTS.report);
      }
      return "Project-record provenance obeys observed access";
    },
  })),
  {
    ...behavioralDefaults,
    skill: SKILL,
    id: "review-pull-request/clarify-author-reply-intent",
    judge: judgeReview("replies"),
    mutationPolicy: "read-only",
    seed: (context) => {
      seedReviewFixture(context, { threads: true });
    },
    snapshotPaths: [...extensionSnapshots],
    prompt: () =>
      `I am the author of ${GITHUB_FACTS.url}. Review the feedback and send my responses; use your review workflow.`,
    intent: "Ambiguous author response requests do not become a new review",
    check: (observation) => {
      assertNoMutation(observation);
      assertNoGithubWrites(observation);
      assertFileAbsent(observation, GITHUB_FACTS.report);
      assert.equal(capturedText(observation, REVIEW_POSTS), "");
      assert.equal(
        findBashCalls(
          observation,
          /post-review\.py[^\n]*(?:--dry-run|--approved)/,
        ).length,
        NO_CALLS,
        "author-response request invoked a new-review gate",
      );
      return "Author-reply intent clarified without a new-review gate";
    },
  },
] as const satisfies readonly EvalCase[];
