import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { behavioralDefaults } from "#/cases/case-contract.ts";
import {
  assertNoGithubWrites,
  assertPlantedStatePreserved,
  plantedPins,
} from "#/cases/pr-creator-checks.ts";
import { GITHUB_FACTS, GITHUB_SNAPSHOTS } from "#/cases/pr-creator-fixtures.ts";
import {
  assertCrossFileScratch,
  assertPinnedCitations,
  assertPosting,
  assertReviewedTerminal,
  assertSummaryDuplicate,
  assertThreadAssessments,
  assertTicketRead,
  section,
} from "#/cases/review-pull-request-checks.ts";
import {
  FEEDBACK_URL,
  LATE_CI_READS,
  REVIEW_ACCOUNT,
  REVIEW_POSTS,
  seedReviewFixture,
  SENTINEL,
  TICKET_LOG,
} from "#/cases/review-pull-request-fixtures.ts";
import {
  approvalReply,
  fixturePrompt,
} from "#/cases/review-pull-request-gates.ts";
import {
  judgeReview,
  reviewJudgeRequest,
} from "#/cases/review-pull-request-judges.ts";
import {
  approveReopen,
  checkReopen,
} from "#/cases/review-pull-request-reopen.ts";
import { assertPrewriteStop } from "#/cases/review-pull-request-retention.ts";
import { APPROVAL_CHECKPOINT } from "#/cases/review-pull-request-retention-checkpoint.ts";
import {
  approveSavedDraft,
  checkSavedDraftPosting,
  requestSavedDraftPosting,
} from "#/cases/review-pull-request-saved-draft.ts";
import { SAVED_FILES } from "#/cases/review-pull-request-saved-files.ts";
import {
  assertFileAbsent,
  assertNoMutation,
  capturedText,
  findBashCalls,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

const SKILL = "review-pull-request";
const NO_CALLS = 0;
const extensionSnapshots = [
  ...GITHUB_SNAPSHOTS,
  APPROVAL_CHECKPOINT,
  SAVED_FILES,
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

async function judgeApprovedThreads(observation: Observation): Promise<string> {
  const request = reviewJudgeRequest("review", observation);
  return judgeLive({
    ...request,
    knownFacts: `${request.knownFacts}\nRoot 701 reports the empty-cart division by zero. Root 704 reports cents_to_dollars(199) returning 1 instead of 1.99. Root 702 requests an already present docstring; root 703 concerns unrelated deployment policy. No resolution change is authorized.`,
    rubric: [
      ...request.rubric,
      {
        id: "thread-dispositions",
        requirement:
          "Assess each unresolved claim with evidence. Explain why 701 and 704 each need a follow-up rather than a duplicate inline finding, why 702 is fixed, and why 703 is out of scope.",
      },
    ],
  });
}

const postingCases = ([undefined, "thread", "head"] as const).map(
  (drift): EvalCase => ({
    ...extensionDefaults,
    id: `review-pull-request/approved-${drift ?? "thread-reply"}`,
    judge: drift === undefined ? judgeApprovedThreads : judgeReview("threads"),
    intent:
      "Assess all unresolved threads, preview an exact new review, and preflight after approval",
    seed: (context) => {
      seedReviewFixture(context, {
        threads: true,
        secondReply: drift === undefined,
        ...(drift === undefined ? {} : { drift }),
      });
    },
    prompt: () =>
      `Review ${GITHUB_FACTS.url} for correctness. Save OUTPUT_FILE=${GITHUB_FACTS.report}, POSTING_MODE=post-after-confirmation. Review unresolved claims even when no candidate matches. In the public summary, identify the discussions whose findings still need a fix. Show the exact preview and wait for my reply. Do not resolve any thread.`,
    followUps: [{ name: "approve-review", reply: approvalReply }],
    check: (observation) => {
      const report = assertReviewedTerminal(observation);
      assertThreadAssessments(report, drift === undefined);
      assertPinnedCitations(observation, report);
      assertPosting(observation, drift !== undefined);
      return drift === undefined
        ? "Exact new review and both thread replies posted after approval"
        : "Fresh preflight refused drift without GitHub writes";
    },
  }),
) satisfies EvalCase[];

const scenarios: readonly EvalCase[] = [
  ...postingCases,
  ...(["unchanged", "changed"] as const).map((history): EvalCase => ({
    ...extensionDefaults,
    id:
      history === "changed"
        ? "review-pull-request/post-saved-draft-new-comment"
        : "review-pull-request/post-saved-draft",
    intent:
      history === "changed"
        ? "Move the saved inline finding into the summary when a new discussion reports the same defect; post the revised review only after fresh approval"
        : "Re-verify a saved draft and get fresh approval before posting it",
    seed: (context) => {
      seedReviewFixture(
        context,
        history === "changed" ? {} : { feedback: "review" },
      );
    },
    prompt: () =>
      `Review ${GITHUB_FACTS.url} for correctness. Save OUTPUT_FILE=${GITHUB_FACTS.report}, POSTING_MODE=draft-only.`,
    followUps: [
      {
        name: "request-saved-draft-posting",
        reply: (observation) => requestSavedDraftPosting(observation, history),
      },
      {
        name: "approve-saved-draft-preview",
        reply: (observation) => approveSavedDraft(observation, history),
      },
    ],
    check: (observation) => checkSavedDraftPosting(observation, history),
  })),
  {
    ...extensionDefaults,
    id: "review-pull-request/approved-reopen",
    intent:
      "Reopen a permitted, resolved thread only after its exact follow-up receives approval",
    seed: (context) => {
      seedReviewFixture(context, { reopen: true });
    },
    prompt: () =>
      `Review ${GITHUB_FACTS.url} for correctness. Save OUTPUT_FILE=${GITHUB_FACTS.report}, POSTING_MODE=post-after-confirmation, REOPEN_RESOLVED=yes. If a resolved thread's defect still exists, link it in the summary, reply to that thread and reopen it. Show the exact preview and wait for my approval.`,
    followUps: [{ name: "approve-reopen", reply: approveReopen }],
    check: checkReopen,
  },
  {
    ...extensionDefaults,
    id: "review-pull-request/self-review-comment",
    intent:
      "Find the regression on the authenticated account's own PR and save a COMMENT draft",
    seed: (context) => {
      seedReviewFixture(context, { selfReview: true });
    },
    prompt: () =>
      `Review ${GITHUB_FACTS.url} for correctness and save OUTPUT_FILE=${GITHUB_FACTS.report}, POSTING_MODE=draft-only.`,
    judge: judgeReview("self-review"),
    check: (observation) => {
      const report = assertReviewedTerminal(observation);
      const { base, head } = plantedPins(observation);
      assert.ok(report.includes(`Reviewed base: ${base}\n`));
      assert.ok(report.includes(`Reviewed head: ${head}\n`));
      assert.ok(
        report.includes(`Review type: self-review by ${REVIEW_ACCOUNT}\n`),
      );
      assert.equal(section(report, "Review decision").trim(), "COMMENT");
      assert.match(
        section(report, "Findings"),
        /^ID: \S+$/m,
        "missing saved finding",
      );
      assertPinnedCitations(observation, report);
      assert.match(section(report, "Posting"), /^Not posted\.$/m);
      assertNoGithubWrites(observation);
      assert.equal(capturedText(observation, REVIEW_POSTS), "");
      assert.equal(
        findBashCalls(
          observation,
          /post-review\.py[^\n]*(?:--dry-run|--approved)/,
        ).length,
        NO_CALLS,
        "draft-only review invoked the poster",
      );
      return "Pinned finding saved in a COMMENT self-review without posting";
    },
  },
  {
    ...extensionDefaults,
    id: "review-pull-request/divergent-checkout",
    seed: (context) => {
      seedReviewFixture(context, { divergent: true, feedback: "review" });
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
      const report = assertReviewedTerminal(observation);
      assertNoGithubWrites(observation);
      assertPinnedCitations(observation, report);
      assertSummaryDuplicate(report, FEEDBACK_URL.review);
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
      const report = assertReviewedTerminal(observation);
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
      seedReviewFixture(context, { historical: true, feedback: "discussion" });
    },
    prompt: () =>
      `Review ${GITHUB_FACTS.url} for correctness and save OUTPUT_FILE=${GITHUB_FACTS.report}; draft only.`,
    check: (observation) => {
      const report = assertReviewedTerminal(observation);
      assertNoGithubWrites(observation);
      assert.match(report, /PR state: closed \(historical assessment\)/);
      assertSummaryDuplicate(report, FEEDBACK_URL.discussion);
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
      `Review ${GITHUB_FACTS.url}, OUTPUT_FILE=${GITHUB_FACTS.report}, draft only. The linked ticket is authoritative for requirements; use the available authenticated read-only project connector CLI, ticket read URL. Do not guess its requirements. Follow the pricing-to-cart-to-checkout path as one causal defect, not one comment per file. For the larger checkout evidence, give each role an assigned bounded scratch file for redacted notes, use Write for those notes so the file writes are observable, and retain this run's recorded scratch and payload files under its run directory after saving the draft. Preserve the unrelated run. Keep full diffs out of scratch.`,
    check: (observation) => {
      assertTicketRead(observation, access === "deny");
      assertNoGithubWrites(observation);
      assert.equal(capturedText(observation, REVIEW_POSTS), "");
      if (access === "allow") {
        const report = assertReviewedTerminal(observation);
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
      assertPrewriteStop(observation, true);
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

export const extensionCases = scenarios.map((scenario): EvalCase =>
  scenario.followUps === undefined
    ? scenario
    : {
        ...scenario,
        prompt: (context) =>
          fixturePrompt(scenario.prompt(context), context.notGitPath),
      },
);
