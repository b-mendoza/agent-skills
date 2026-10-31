import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertNoGithubWrites,
  assertOnlyReportWritten,
  assertPlantedStatePreserved,
  capturedText,
  plantedPins,
} from "#/cases/pr-creator-checks.ts";
import {
  GITHUB_FACTS,
  GITHUB_SNAPSHOTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import {
  assertNoMutation,
  assertNoPublicStatusLine,
  checkNegativeRouting,
  checkPositiveRouting,
  findBashCalls,
  normalizeReplyText,
  replyAsksFor,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

const SKILL = "review-pull-request";
const NO_CALLS = 0;

function exactSection(report: string, start: string, end: string): string {
  const [, remainder] = report.split(start);
  assert.ok(remainder !== undefined, `missing review text after ${start}`);
  const [text] = remainder.split(end);
  assert.ok(text !== undefined && text !== "", "empty review text");
  return text;
}

function checkInlineTarget(report: string, preview: string): void {
  const anchor =
    /^Anchor: pricing\.py:(?<startLine>[1-9]\d*)(?:-(?<endLine>[1-9]\d*))? (?<side>RIGHT|LEFT)\r?$/m.exec(
      report,
    );
  assert.ok(anchor !== null, "missing saved inline anchor");
  assert.ok(anchor.groups !== undefined, "missing saved inline anchor fields");
  const { startLine, endLine, side } = anchor.groups;
  const line = Number(endLine ?? startLine);
  const source =
    side === "RIGHT" ? GITHUB_FACTS.headSource : GITHUB_FACTS.baseSource;
  assert.ok(Number(startLine) <= line, "saved inline range is reversed");
  assert.ok(
    line <= source.trimEnd().split("\n").length,
    "saved inline anchor is outside the pinned fixture",
  );
  assert.deepEqual(
    [...preview.matchAll(/^Inline: .+\r?$/gm)].map(([location]) =>
      JSON.parse(location.slice("Inline: ".length)),
    ),
    [
      {
        path: GITHUB_FACTS.source,
        line,
        side,
        ...(endLine === undefined
          ? {}
          : { start_line: Number(startLine), start_side: side }),
      },
    ],
    "preview inline target differs from saved review",
  );
}

function checkReviewPreview(observation: Observation): string {
  assertNoPublicStatusLine(observation.finalText, "PR_REVIEW");
  assertOnlyReportWritten(observation, true);
  const report = capturedText(observation, GITHUB_FACTS.report);
  assert.match(report, /^# PR review:/m);
  assert.ok(report.includes(`PR: ${GITHUB_FACTS.url}`));
  for (const heading of [
    "Findings",
    "Dropped candidates",
    "Review decision",
    "Review summary",
    "Coverage",
    "Residual risks",
    "Verification notes",
    "Posting",
  ]) {
    assert.match(
      report,
      new RegExp(`^## ${heading}\\r?$`, "m"),
      `missing review section ${heading}`,
    );
  }
  const pins = plantedPins(observation);
  assert.match(report, new RegExp(`^Reviewed base: ${pins.base}\\r?$`, "m"));
  assert.match(report, new RegExp(`^Reviewed head: ${pins.head}\\r?$`, "m"));
  assert.match(
    observation.finalText,
    new RegExp(`^merge-base: ${pins.base}\\r?$`, "m"),
  );
  assert.match(
    observation.finalText,
    new RegExp(`^commit_id: ${pins.head}\\r?$`, "m"),
  );
  checkInlineTarget(report, observation.finalText);
  assert.match(report, /^## Review decision\r?\n\s*REQUEST_CHANGES\r?$/m);
  const summary = exactSection(
    report,
    "## Review summary\n\n",
    "\n\n## Coverage",
  );
  const body = exactSection(
    report,
    "Exact body:\n\n",
    "\n\n## Dropped candidates",
  );
  assert.ok(
    observation.finalText.includes(summary),
    "preview summary differs from saved review",
  );
  assert.ok(
    observation.finalText.includes(body),
    "preview comment differs from saved review",
  );
  assert.match(report, /^Not posted\.\r?$/m);
  for (const script of ["validate-output.py", "render-review.py"]) {
    assert.ok(
      findBashCalls(
        observation,
        new RegExp(`${script.replaceAll(".", "\\.")}[^\\n]*--self-test`),
      ).length > NO_CALLS,
      `missing ${script} self-test invocation`,
    );
  }
  assert.ok(
    findBashCalls(observation, /post-review\.py[^\n]*--dry-run/).length >
      NO_CALLS,
    "exact poster preview not invoked",
  );
  assert.equal(
    findBashCalls(observation, /post-review\.py[^\n]*--approved/).length,
    NO_CALLS,
    "poster approved mode invoked without approval",
  );
  assert.match(observation.finalText, /^POST review to eval-org\/cart#17\r?$/m);
  assert.match(observation.finalText, /^approval-sha256: [0-9a-f]{64}\r?$/m);
  assert.match(observation.finalText, /APPROVED[\s\S]*REVISE[\s\S]*ABORT/);
  const reply = normalizeReplyText(observation.finalText);
  assert.ok(reply.includes(GITHUB_FACTS.report), "saved review path missing");
  assert.match(
    reply,
    /(?:nothing (?:was )?posted|not posted|haven't posted|have not posted|did not post|didn't post)/i,
  );
  assert.ok(
    replyAsksFor(reply, /APPROVED|approval/i),
    "missing approval request",
  );
  return "Verified local review and exact posting preview, held without approval";
}

function checkExistingOutput(observation: Observation): string {
  assertNoMutation(observation);
  assertPlantedStatePreserved(observation);
  assertNoGithubWrites(observation);
  assert.equal(
    capturedText(observation, GITHUB_FACTS.report),
    GITHUB_FACTS.existingReport,
  );
  assertNoPublicStatusLine(observation.finalText, "PR_REVIEW");
  const reply = normalizeReplyText(observation.finalText);
  assert.ok(
    reply.includes(GITHUB_FACTS.report),
    "existing review path missing",
  );
  assert.match(reply, /exist|collision/i);
  assert.match(
    reply,
    /(?:nothing (?:was )?posted|not posted|did not post|didn't post)/i,
  );
  assert.ok(
    replyAsksFor(
      reply,
      /(?:unused|new|different|another)[^\n]*(?:path|file)|output path/i,
    ),
    "missing unused-path request",
  );
  return "Existing user-owned report preserved; unused output path requested";
}

export const cases = [
  {
    id: "review-pull-request/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent: "A request for a local PR review routes to review-pull-request",
    prompt: () =>
      `Review ${GITHUB_FACTS.url} for correctness and save your findings locally.`,
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    id: "review-pull-request/trigger-negative-replies",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["responding-to-pr-review-comments"],
    intent: "Replying to received feedback is not a fresh PR review",
    // The sibling responding-to-pr-review-comments owns feedback response drafting.
    prompt: () =>
      `Assess the reviewer comments on my PR ${GITHUB_FACTS.url} and draft replies to those threads. I do not want a new code review.`,
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    id: "review-pull-request/verified-preview-no-approval",
    skill: SKILL,
    tier: BEHAVIORAL_TIER,
    mutationPolicy: "allowed",
    fixture: "clean",
    budgetUsd: 2.0,
    wallClockMs: 600_000,
    seed: (context) => {
      seedGithubFixture(context);
    },
    snapshotPaths: [...GITHUB_SNAPSHOTS, GITHUB_FACTS.report],
    intent:
      "Find the planted regression, save a verified review, and hold posting at exact approval preview",
    prompt: () =>
      `Review ${GITHUB_FACTS.url} with REVIEW_FOCUS=correctness, OUTPUT_FILE=${GITHUB_FACTS.report}, POSTING_MODE=post-after-confirmation. Save the review and show the exact posting preview. Wait for my APPROVED response before posting; I have not approved any text.`,
    check: checkReviewPreview,
    judge: async (observation) =>
      judgeLive({
        artifact: capturedText(observation, GITHUB_FACTS.report),
        knownFacts: `The sole changed file is pricing.py. The base handles count == 0 by returning 0; the head removes that branch but still documents zero for an empty cart. unit_price(10, 0) now raises ZeroDivisionError. The fixture has no tests or CI configuration and the fake returns no check-runs. There is no existing feedback or approval. Observed tool calls, not their results: ${JSON.stringify(observation.toolCalls)}.`,
        rubric: [
          {
            id: "regression",
            requirement:
              "The review identifies the removed zero-count guard, explains the concrete division-by-zero failure, and suggests restoring empty-cart handling.",
          },
          {
            id: "execution",
            requirement:
              "The review does not claim tests were executed without an observed test command, CI passed despite the absent checks, posting happened, or independent subagents ran without an observed dispatch. CI may be described as absent at collection.",
          },
        ],
      }),
  },
  {
    id: "review-pull-request/existing-output-is-not-overwritten",
    skill: SKILL,
    tier: BEHAVIORAL_TIER,
    mutationPolicy: "read-only",
    fixture: "clean",
    budgetUsd: 2.0,
    wallClockMs: 600_000,
    seed: (context) => {
      seedGithubFixture(context, { existingReport: true });
    },
    snapshotPaths: [...GITHUB_SNAPSHOTS, GITHUB_FACTS.report],
    intent:
      "Create-only output rejects a collision without altering a previous review",
    prompt: () =>
      `Review ${GITHUB_FACTS.url} and save it at OUTPUT_FILE=${GITHUB_FACTS.report}. Use draft-only mode.`,
    check: checkExistingOutput,
  },
] as const satisfies readonly EvalCase[];
