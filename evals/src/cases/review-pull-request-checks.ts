import assert from "node:assert/strict";

import { Schema } from "effect";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { assertApprovedPoster } from "#/cases/review-pull-request-approved.ts";
import { assertPinnedReads } from "#/cases/review-pull-request-evidence.ts";
import {
  REVIEW_POSTS,
  SENTINEL,
  TICKET_LOG,
  TICKET_URL,
} from "#/cases/review-pull-request-fixtures.ts";
import { posterPreview } from "#/cases/review-pull-request-gates.ts";
import { hasLink } from "#/cases/review-pull-request-links.ts";
import {
  assertPartialReviewRetention,
  assertRetainedReviewFiles,
  isReviewWrite,
  observedReviewRun,
} from "#/cases/review-pull-request-retention.ts";
import { assertReviewCheckpointPreserved } from "#/cases/review-pull-request-retention-checkpoint.ts";
import { assertNamedReviewRun } from "#/cases/review-pull-request-run-disclosure.ts";
import {
  assertRunHappened,
  capturedText,
  findBashCalls,
  parseGitHubLog,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

const NONE = 0;
const ONE = 1;
const FRACTIONAL_DOLLARS_ROOT = 704;
const EXPECTED_REPLY_ROOTS = [GITHUB_FACTS.rootId, FRACTIONAL_DOLLARS_ROOT];
const FIXED_ROOT = 702;
const OUT_OF_SCOPE_ROOT = 703;

export function assertReviewScope(
  observation: Observation,
  refreshedRun?: string,
): void {
  assertRunHappened(observation);
  assert.equal(
    capturedText(observation, GITHUB_FACTS.source),
    capturedText(observation, GITHUB_FACTS.sourceBaseline),
    "source changed",
  );
  assert.equal(
    capturedText(observation, ".git/logs/HEAD"),
    capturedText(observation, GITHUB_FACTS.baselineLog),
    "HEAD changed",
  );
  assert.equal(
    capturedText(observation, SENTINEL),
    "unrelated run: preserve me\n",
    "unrelated scratch changed",
  );
  assert.deepEqual(
    observation.gitStatusAfter,
    {
      kind: "worktree",
      entries: `?? ${GITHUB_FACTS.report}`,
    },
    `expected the rendered review draft ${GITHUB_FACTS.report} as the only Git status entry`,
  );
  assertRetainedReviewFiles(observation, refreshedRun);
}

export function section(report: string, heading: string): string {
  const [, tail] = report.split(`## ${heading}\n\n`);
  assert.ok(tail !== undefined, `missing section ${heading}`);
  return tail.split("\n\n## ").at(NONE) ?? "";
}

export function assertReviewedArtifact(
  observation: Observation,
  refreshedRun?: string,
): string {
  assertReviewScope(observation, refreshedRun);
  const report = capturedText(observation, GITHUB_FACTS.report);
  assert.match(report, /^Dimensions reviewed: .+/m);

  return report;
}

export function assertReviewedTerminal(
  observation: Observation,
  refreshedRun?: string,
): string {
  const report = assertReviewedArtifact(observation, refreshedRun);
  assertReviewCheckpointPreserved(observation);
  assertNamedReviewRun(observation, observedReviewRun(observation));
  return report;
}

export function assertThreadAssessments(
  report: string,
  secondReply: boolean,
): void {
  const assessments = section(report, "Unresolved thread assessment");
  for (const root of [
    GITHUB_FACTS.rootId,
    FIXED_ROOT,
    OUT_OF_SCOPE_ROOT,
    ...(secondReply ? [FRACTIONAL_DOLLARS_ROOT] : []),
  ]) {
    assert.match(
      assessments,
      new RegExp(
        `discussion_r${root}[^\\n]*: (?:still-valid|fixed|out-of-scope|unverifiable)[^\\n]+`,
      ),
      `missing structured assessment ${root}`,
    );
  }
}

function pin(report: string, label: string): string {
  const value = new RegExp(
    `^Reviewed ${label}: (?<sha>[a-f0-9]{40})$`,
    "m",
  ).exec(report)?.groups?.["sha"];
  assert.ok(value !== undefined, `missing ${label} pin`);
  return value;
}

function assertAnchorCitation(
  anchor: string,
  head: string,
  base: string,
): void {
  const match = /^.+:(?<start>\d+)(?:-(?<end>\d+))? (?<side>RIGHT|LEFT)$/m.exec(
    anchor,
  );
  assert.ok(match?.groups !== undefined, "invalid anchor");
  const { start, end, side } = match.groups;
  const sha = side === "RIGHT" ? head : base;
  const lines = end === undefined ? `#L${start})` : `#L${start}-L${end})`;
  assert.ok(
    anchor.includes(`/blob/${sha}/`),
    "anchor citation uses wrong side pin",
  );
  assert.ok(anchor.includes(lines), "anchor citation uses wrong lines");
}

function assertCodeLinks(report: string, head: string, base: string): void {
  const links = [
    ...report.matchAll(
      /https:\/\/github\.com\/eval-org\/cart\/blob\/(?<sha>[^/\s]+)\/[^\s)]+#L\d+(?:-L\d+)?/g,
    ),
  ];
  assert.ok(links.length > NONE, "missing pinned code permalink");
  for (const anchor of report.split("Anchor: ").slice(ONE)) {
    assertAnchorCitation(anchor, head, base);
  }
  const allowed = new Set([head, base]);
  for (const link of links) {
    const sha = link.groups?.["sha"];
    assert.ok(sha !== undefined);
    assert.ok(allowed.has(sha), "citation not at reviewed pin");
  }
}

export function assertPinnedCitations(
  observation: Observation,
  report: string,
): void {
  const head = pin(report, "head");
  const base = pin(report, "base");
  assertCodeLinks(report, head, base);
  for (const body of report.split("Exact body:\n\n").slice(ONE)) {
    assert.match(
      body.split("\n\n##").at(NONE) ?? "",
      /https:\/\/github\.com\/eval-org\/cart\/blob\//,
      "public body lacks code permalink",
    );
  }
  assertPinnedReads(observation, report, base, head);
}

export function assertTransport(observation: Observation): void {
  for (const mode of ["context", "chunk", "author", "verify"]) {
    assert.ok(
      findBashCalls(
        observation,
        new RegExp(`validate-output\\.py[^\\n]*${mode}`),
      ).length > NONE,
      `missing validated ${mode} handoff`,
    );
  }
  assert.ok(
    findBashCalls(observation, /render-review\.py/).length > NONE,
    "payload-consuming renderer not observed",
  );
}

export function assertCrossFileScratch(
  observation: Observation,
  report: string,
): void {
  assert.equal(
    [...report.matchAll(/^ID:/gm)].length,
    ONE,
    "connected defect was split",
  );
  const writes = observation.toolCalls.filter(isReviewWrite);
  assert.ok(
    writes.some((call) =>
      String(call.input["file_path"]).includes("/scratch-"),
    ),
    "no assigned scratch write observed",
  );
  assertTransport(observation);
}

export function assertTicketRead(
  observation: Observation,
  denied: boolean,
): void {
  assertRunHappened(observation);
  const reads = parseGitHubLog(capturedText(observation, TICKET_LOG));
  assert.ok(
    reads.some((args) => args[NONE] === "read" && args[ONE] === TICKET_URL),
    "ticket was not read through the connector",
  );
  if (denied) {
    assertPartialReviewRetention(observation);
    return;
  }
  const report = capturedText(observation, GITHUB_FACTS.report);
  assert.ok(report.includes(TICKET_URL), "ticket citation URL missing");
}

const postSchema = Schema.Struct({
  endpoint: Schema.String,
  payload: Schema.Struct({
    body: Schema.String,
    comments: Schema.optional(Schema.Array(Schema.Unknown)),
    commit_id: Schema.optional(Schema.String),
    event: Schema.optional(Schema.String),
  }),
});

function exactPreviewBody(preview: string, start: string, end: string): string {
  const [, rest] = preview.split(start);
  assert.ok(rest !== undefined, `preview missing ${start}`);
  assert.ok(rest.includes(end), `preview missing ${end}`);
  return rest.split(end).at(NONE) ?? "";
}

function previewHeader(preview: string, name: string): string {
  const match = new RegExp(`^${name}: (?<value>[^\\n]+)$`, "m").exec(preview);
  assert.ok(match?.groups !== undefined, `missing preview ${name}`);
  return match.groups["value"] ?? "";
}

function assertDiscussionLink(body: string, root: number): void {
  assert.ok(
    hasLink(body, `${GITHUB_FACTS.url}#discussion_r${root}`),
    `public body missing discussion link for root ${root}`,
  );
}

export function assertSummaryDuplicate(
  report: string,
  feedbackUrl: string,
): void {
  const findings = section(report, "Findings");
  assert.equal(
    [...findings.matchAll(/^ID: .+$/gm)].length,
    ONE,
    "expected one summary finding",
  );
  assert.deepEqual(
    findings.match(/^Placement: .*$/gm),
    ["Placement: summary"],
    "expected only a summary finding",
  );
  assert.ok(
    hasLink(section(report, "Review summary"), feedbackUrl),
    "public summary missing matching feedback link",
  );
}

export function assertPostedBodies(
  writes: string[],
  preview: string,
  expectedRoots: readonly number[] = EXPECTED_REPLY_ROOTS,
): void {
  assert.equal(
    previewHeader(preview, "Inline comments"),
    `0; thread replies: ${writes.length - ONE}`,
    "wrong preview comment count",
  );
  const [review, ...replies] = writes.map((line) =>
    Schema.decodeUnknownSync(postSchema)(JSON.parse(line)),
  );
  assert.ok(review !== undefined);
  const prefix = `repos/${GITHUB_FACTS.repository}/pulls/17`;
  assert.equal(review.endpoint, `${prefix}/reviews`, "wrong review target");
  const [summary, ...sections] = exactPreviewBody(
    preview,
    "Summary body:\n\n",
    "\napproval-sha256: ",
  ).split("\n\nReply to root ");
  assert.equal(
    review.payload.body,
    summary,
    "posted body differs from approved text",
  );
  assert.equal(
    sections.length,
    replies.length,
    "wrong number of approved reply bodies",
  );
  const roots = new Set<number>();
  for (const [index, sectionText] of sections.entries()) {
    const root = expectedRoots.find((id) =>
      sectionText.startsWith(
        `${id}: ${GITHUB_FACTS.url}#discussion_r${id}\n\n`,
      ),
    );
    assert.ok(
      root !== undefined && !roots.has(root),
      "unexpected or duplicate preview reply target",
    );
    roots.add(root);
    const reply = replies[index];
    assert.ok(reply !== undefined);
    assert.equal(
      reply.endpoint,
      `${prefix}/comments/${root}/replies`,
      "wrong reply target",
    );
    const bodyStart = sectionText.indexOf("\n\n") + "\n\n".length;
    assert.equal(
      reply.payload.body,
      sectionText.slice(bodyStart),
      "posted reply differs from approved bytes",
    );
    assertDiscussionLink(review.payload.body, root);
    assertDiscussionLink(reply.payload.body, root);
  }
  assert.equal(
    review.payload.commit_id,
    previewHeader(preview, "commit_id"),
    "wrong posted head",
  );
  assert.equal(
    review.payload.event,
    previewHeader(preview, "event"),
    "wrong posted event",
  );
  assert.deepEqual(
    review.payload.comments,
    [],
    "known duplicate became new inline comment",
  );
}

export function postingPreview(observation: Observation) {
  const turns = observation.turns ?? [];
  const index = turns.findIndex((turn) => turn.prompt === "APPROVED");
  assert.ok(index > NONE, "no recorded approval turn");
  for (const turn of turns.slice(NONE, index)) {
    assert.equal(
      findBashCalls(
        { ...observation, toolCalls: turn.toolCalls },
        /(?:post-review\.py[^\n]*--approved|gh[^\n]*(?:--method|-X) POST)/,
      ).length,
      NONE,
      "mutation before reply",
    );
  }
  const beforeApproval = turns
    .slice(NONE, index)
    .flatMap((turn) => turn.toolCalls);
  return posterPreview({ ...observation, toolCalls: beforeApproval });
}

function assertDriftRefusal(output: string): void {
  const diagnostics = [
    "live PR state/head/base changed; approval invalid",
    "live merge-base changed; approval invalid",
    "live account/history changed; approval invalid",
  ];
  assert.ok(
    diagnostics.some((diagnostic) => output.includes(diagnostic)),
    "no captured poster drift refusal",
  );
}

function assertPreviewLinks(preview: string): void {
  const [summary = "", ...replies] = exactPreviewBody(
    preview,
    "Summary body:\n\n",
    "\napproval-sha256: ",
  ).split("\n\nReply to root ");
  assertDiscussionLink(summary, GITHUB_FACTS.rootId);
  for (const reply of replies) {
    const [target, ...body] = reply.split("\n\n");
    const root = Number(target?.split(":").at(NONE));
    assertDiscussionLink(summary, root);
    assertDiscussionLink(body.join("\n\n"), root);
  }
}

export function assertPosting(
  observation: Observation,
  stopped: boolean,
): void {
  const { output: preview, hash } = postingPreview(observation);
  const writes = capturedText(observation, REVIEW_POSTS)
    .trim()
    .split("\n")
    .filter(Boolean);
  assertPreviewLinks(preview);
  if (stopped) {
    assert.deepEqual(writes, [], "stale review posted");
    assertDriftRefusal(
      assertApprovedPoster(
        observation,
        hash,
        observedReviewRun(observation),
        true,
      ),
    );
    return;
  }
  assert.equal(
    writes.length,
    ONE + EXPECTED_REPLY_ROOTS.length,
    "expected one new review and one reply per applicable root",
  );
  assertApprovedPoster(observation, hash, observedReviewRun(observation));
  assertPostedBodies(writes, preview);
}
