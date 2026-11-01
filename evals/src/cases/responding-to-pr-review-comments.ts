import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { behavioralDefaults, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertNoGithubWrites,
  assertOnlyReportWritten,
  assertPlantedStatePreserved,
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
  assertNoPublicStatusLine,
  assertReadOnlyGraphqlArguments,
  capturedText,
  checkNegativeRouting,
  checkPositiveRouting,
  normalizeReplyText,
  replyAsksFor,
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
  assertNoPublicStatusLine(observation.finalText, "PR_COMMENT_RESPONSE");
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
  assert.ok(
    replyAsksFor(
      observation.finalText,
      /approv|confirm|post (?:this|the) (?:exact )?reply/i,
    ),
    "no exact-reply approval request",
  );
  assert.doesNotMatch(
    normalizeReplyText(observation.finalText),
    /^Posting: posted\r?$/m,
  );
  assert.ok(
    githubCalls(observation).length > NO_CALLS,
    "no GitHub evidence collected",
  );
  return "One grounded reply-ready assessment and pending report; no unapproved reply posted";
}

function isApiCommentInventoryRead(args: readonly string[]): boolean {
  if (assertReadOnlyGraphqlArguments(args)) {
    return args
      .map((arg) => arg.replace(/^(?:--(?:raw-)?field=|-[fF])/, ""))
      .filter((field) => field.startsWith("query="))
      .some((field) => {
        const selection =
          /\brepository\s*\(\s*owner:\s*"eval-org"[\s,]+name:\s*"cart"\s*\)\s*\{\s*pullRequest\s*\(\s*number:\s*17\s*\)\s*\{(?<fields>[^{}]*)/.exec(
            field,
          );
        return /\b(?:comments|reviews|reviewThreads)\s*[({]/.test(
          selection?.groups?.["fields"] ?? "",
        );
      });
  }
  return args.some((arg) =>
    /^repos\/eval-org\/cart\/(?:pulls\/17\/(?:comments|reviews)|issues\/17\/comments)(?:\?|$)/.test(
      arg,
    ),
  );
}

function isCommentInventoryRead(args: readonly string[]): boolean {
  const command = args.join(" ");
  if (command.startsWith("api ")) {
    return isApiCommentInventoryRead(args);
  }
  return (
    /^pr view (?:https:\/\/github\.com\/eval-org\/cart\/pull\/)?17(?: |$)/.test(
      command,
    ) &&
    !/(?:--repo[= ]|-R )(?!(?:eval-org\/cart)(?: |$))/.test(command) &&
    /(?:^| )--json[= ](?:\w+,)*(?:comments|reviews)(?:[, ]|$)/.test(command)
  );
}

function checkNoComments(observation: Observation): string {
  assertNoMutation(observation);
  assertPlantedStatePreserved(observation);
  assertNoGithubWrites(observation);
  assertFileAbsent(observation, GITHUB_FACTS.report);
  assert.ok(
    githubCalls(observation).some(isCommentInventoryRead),
    "no PR comment inventory collection observed",
  );
  assertNoPublicStatusLine(observation.finalText, "PR_COMMENT_RESPONSE");
  const reply = normalizeReplyText(observation.finalText);
  assert.match(
    reply,
    /(?:no (?:review(?:er)? |discussion |in-scope )?comments|(?:comments|inventory)[^\n]*(?:empty|zero|0)|nothing to assess)/i,
  );
  assert.ok(
    /no[^\n]*(?:report|pr-17-review\.md)[^\n]*(?:written|created)|(?:did not|didn't) (?:write|create)/i.test(
      reply,
    ) || /wrote no[^\n]*(?:report|pr-17-review\.md)/i.test(reply),
    "reply must explain that no report was written",
  );
  assert.match(
    reply,
    /(?:nothing (?:was )?(?:posted|sent to GitHub)|posted nothing|did not post|didn't post|not posted|no GitHub posts were made)/i,
  );
  assert.match(
    reply,
    /(?:re-?run|run (?:this|it) again|wait|feedback|check[^\n]*(?:URL|PR))/i,
  );
  return "Empty PR explained; no report or reply mutation";
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
    ...behavioralDefaults,
    id: "responding-to-pr-review-comments/reply-preview-no-approval",
    skill: SKILL,
    mutationPolicy: "allowed",
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
    ...behavioralDefaults,
    id: "responding-to-pr-review-comments/no-comments",
    skill: SKILL,
    mutationPolicy: "read-only",
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
