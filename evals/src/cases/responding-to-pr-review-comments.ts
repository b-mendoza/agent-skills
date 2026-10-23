import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertNoGithubWrites,
  assertOnlyReportWritten,
  assertPlantedStatePreserved,
  capturedText,
  githubCalls,
} from "#/cases/pr-creator-checks.ts";
import {
  GITHUB_FACTS,
  GITHUB_SNAPSHOTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import {
  assertFileAbsent,
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

const SKILL = "responding-to-pr-review-comments";
const NO_CALLS = 0;
const ONE_COMMENT = 1;

function assertReplyPreviewMatches(report: string, finalText: string): void {
  const quotedLines = report.match(/^>.*$/gm);
  assert.ok(quotedLines !== null, "reply is not in a blockquote");
  const reply = quotedLines.map((line) => line.replace(/^> ?/, "")).join("\n");
  assert.notEqual(reply, "", "reply is empty");
  assert.ok(
    finalText.replace(/^> ?/gm, "").includes(reply),
    "approval preview differs from the report reply",
  );
}

function checkReplyPreview(observation: Observation): string {
  assertOnlyReportWritten(observation, false);
  const report = capturedText(observation, GITHUB_FACTS.report);
  assert.match(report, /^# PR 17 Review Comment Assessment\r?$/m);
  assert.match(
    report,
    /^PR: https:\/\/github\.com\/eval-org\/cart\/pull\/17(?:\s|$)/m,
  );
  assert.match(report, /Posting mode: post-after-confirmation/);
  assert.match(report, /Posting status: pending-confirmation/);
  assert.match(report, /Identity mode: resolved:maintainer/);
  for (const heading of [
    "PR Summary",
    "Comment Assessments",
    "Action Summary",
    "Unsupported Or Report-Only Items",
    "Posting Ledger",
    "Residual Risks",
  ]) {
    assert.match(
      report,
      new RegExp(`^## ${heading}\\r?$`, "m"),
      `missing report section ${heading}`,
    );
  }
  assert.equal(
    report.match(/^### /gm)?.length,
    ONE_COMMENT,
    "expected exactly one comment assessment",
  );
  for (const field of [
    "Comment",
    "Author",
    "Location",
    "Classification",
    "Evidence",
    "Planned action",
    "Reply disposition",
    "Posting target",
    "Skip or follow-up reason",
    "Verification notes",
    "Residual risks",
  ]) {
    assert.match(
      report,
      new RegExp(`^- ${field}: .+`, "m"),
      `missing assessment field ${field}`,
    );
  }
  assert.match(report, /^- Classification: valid\r?$/m);
  assert.match(report, /^- Reply disposition: reply-ready\r?$/m);
  assert.match(report, /^- Posting target: review-comment-reply:701\r?$/m);
  assertReplyPreviewMatches(report, observation.finalText);
  assert.match(
    observation.finalText,
    /review-comment-reply:701|discussion_r701/,
  );
  assert.match(
    observation.finalText,
    /(?:approv|confirm)[^\n?]*\?/i,
    "no exact-reply approval question",
  );
  assert.doesNotMatch(observation.finalText, /^Posting: posted\r?$/m);
  assert.ok(
    githubCalls(observation).length > NO_CALLS,
    "no GitHub evidence collected",
  );
  return "One grounded reply-ready assessment and pending report; no unapproved reply posted";
}

function checkNoComments(observation: Observation): string {
  assertNoMutation(observation);
  assertPlantedStatePreserved(observation);
  assertNoGithubWrites(observation);
  assertFileAbsent(observation, GITHUB_FACTS.report);
  assert.ok(
    githubCalls(observation).length > NO_CALLS,
    "no collection observed",
  );
  assert.match(observation.finalText, /^PR_COMMENT_RESPONSE: NO_COMMENTS\r?$/m);
  assert.match(observation.finalText, /^Posting: (?:none|not-posted)\r?$/m);
  assert.match(observation.finalText, /^Reason: .+/m);
  assert.match(observation.finalText, /^Next step: .+/m);
  return "Empty PR produces NO_COMMENTS with no report or reply mutation";
}

export const cases = [
  {
    id: "responding-to-pr-review-comments/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent: "Assessing received review feedback routes to response drafting",
    prompt: () =>
      `Help me assess the reviewer comments on ${GITHUB_FACTS.url} and draft replies to each thread.`,
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    id: "responding-to-pr-review-comments/trigger-negative-review",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["review-pull-request"],
    intent: "An independent PR audit is not review-comment response work",
    // The sibling review-pull-request owns fresh PR audits.
    prompt: () =>
      `Audit ${GITHUB_FACTS.url} for new correctness defects and save a local code review. I am not asking you to answer reviewer comments.`,
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    id: "responding-to-pr-review-comments/reply-preview-no-approval",
    skill: SKILL,
    tier: BEHAVIORAL_TIER,
    mutationPolicy: "allowed",
    fixture: "clean",
    budgetUsd: 2.0,
    wallClockMs: 600_000,
    seed: (context) => {
      seedGithubFixture(context, { existing: true, comments: true });
    },
    snapshotPaths: [...GITHUB_SNAPSHOTS, GITHUB_FACTS.report],
    intent:
      "Assess the planted feedback, save a pending report, and ask before posting its exact reply",
    prompt: () =>
      `Assess the review comments on ${GITHUB_FACTS.url}. Use RESPONDER_LOGIN=maintainer, COMMENT_SCOPE=all, OUTPUT_FILE=${GITHUB_FACTS.report}, POSTING_MODE=post-after-confirmation. Write the report, then show the exact proposed reply and wait for my approval. I have not approved any reply. Do not fix the code.`,
    check: checkReplyPreview,
    judge: async (observation) =>
      judgeLive({
        artifact: capturedText(observation, GITHUB_FACTS.report),
        knownFacts: `There is exactly one unresolved root review comment, REST ID 701, by reviewer. It says: ${GITHUB_FACTS.comment} The code really removed the count == 0 guard and now raises ZeroDivisionError for unit_price(10, 0). The responder maintainer has never replied. No fixes or posting happened. The fixture has no test suite or CI configuration and the fake returns no checks. Observed tool calls, not their results: ${JSON.stringify(observation.toolCalls)}.`,
        rubric: [
          {
            id: "assessment",
            requirement:
              "The report accepts the zero-count regression using pricing.py evidence and proposes restoring empty-cart handling.",
          },
          {
            id: "reply",
            requirement:
              "The blockquoted reply addresses that feedback with a concrete future action, without claiming a completed fix or unsupported test execution.",
          },
          {
            id: "approval",
            requirement:
              "The report keeps the reply pending approval rather than claiming it was posted.",
          },
        ],
      }),
  },
  {
    id: "responding-to-pr-review-comments/no-comments",
    skill: SKILL,
    tier: BEHAVIORAL_TIER,
    mutationPolicy: "read-only",
    fixture: "clean",
    budgetUsd: 2.0,
    wallClockMs: 600_000,
    seed: (context) => {
      seedGithubFixture(context, { existing: true });
    },
    snapshotPaths: [...GITHUB_SNAPSHOTS, GITHUB_FACTS.report],
    intent:
      "A genuinely empty PR stops at NO_COMMENTS without fabricating assessments",
    prompt: () =>
      `Assess and draft replies to all reviewer comments on ${GITHUB_FACTS.url}. RESPONDER_LOGIN=maintainer, OUTPUT_FILE=${GITHUB_FACTS.report}, POSTING_MODE=draft-only.`,
    check: checkNoComments,
  },
] as const satisfies readonly EvalCase[];
