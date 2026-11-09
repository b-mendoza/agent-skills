import assert from "node:assert/strict";

import { Schema } from "effect";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { assertPinnedReads } from "#/cases/review-pull-request-evidence.ts";
import {
  REVIEW_POSTS,
  SENTINEL,
  TICKET_LOG,
  TICKET_URL,
} from "#/cases/review-pull-request-fixtures.ts";
import { posterPreview } from "#/cases/review-pull-request-gates.ts";
import {
  assertRunHappened,
  capturedText,
  findBashCalls,
  fixtureRelativePath,
  parseGitHubLog,
} from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

export { approvalReply } from "#/cases/review-pull-request-gates.ts";

const NONE = 0;
const ONE = 1;
const EXPECTED_POSTS = 2;
const SCRATCH_BYTES = 65_536;
const FIXED_ROOT = 702;
const OUT_OF_SCOPE_ROOT = 703;
const WRITES = new Set(["Write", "Edit", "NotebookEdit"]);

function assertScratchAssignment(
  call: ToolCall,
  observation: Observation,
  path: string,
): void {
  const index = observation.toolCalls.indexOf(call);
  const earlier = observation.toolCalls.slice(NONE, index);
  const assignments = earlier
    .filter((entry) => ["Agent", "Task", "Bash"].includes(entry.name))
    .map((entry) => JSON.stringify(entry.input));
  assert.ok(
    assignments.some(
      (entry) => entry.includes("SCRATCH_FILE") && entry.includes(path),
    ),
    "scratch assignment not observed before write",
  );
}

function assertScratch(call: ToolCall): void {
  const content = call.input["content"] ?? call.input["new_string"];
  assert.ok(typeof content === "string", "scratch content not captured");
  assert.ok(
    Buffer.byteLength(content) <= SCRATCH_BYTES,
    "scratch exceeds bounded notes",
  );
}

function assertWritePath(call: ToolCall, observation: Observation): void {
  if (!WRITES.has(call.name)) return;
  const path = call.input["file_path"];
  assert.ok(typeof path === "string", "write path missing");
  const relative = fixtureRelativePath(observation, path);
  assert.ok(relative !== undefined);
  const runFile =
    /^\.handoffs\/review-pull-request\/[^/]+\/(?:context|chunk-[a-z-]+|author|verify|scratch-[a-z-]+)\.txt$/.test(
      relative,
    );
  assert.ok(
    relative === GITHUB_FACTS.report || runFile,
    `unassigned write: ${path}`,
  );
  if (relative.includes("/scratch-")) {
    assertScratch(call);
    assertScratchAssignment(call, observation, path);
  }
}

function assertCleaned(path: string, content: string | null): void {
  if (!path.startsWith(".handoffs/review-pull-request/")) return;
  if (path === SENTINEL) return;
  if (path.endsWith("/")) return;
  assert.equal(content, null, `run file not cleaned: ${path}`);
}

export function assertReviewScope(observation: Observation): void {
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
  assert.deepEqual(observation.gitStatusAfter, {
    kind: "worktree",
    entries: `?? ${GITHUB_FACTS.report}`,
  });
  for (const call of observation.toolCalls) assertWritePath(call, observation);
  for (const [path, content] of Object.entries(observation.repoFiles ?? {})) {
    assertCleaned(path, content);
  }
}

export function section(report: string, heading: string): string {
  const [, tail] = report.split(`## ${heading}\n\n`);
  assert.ok(tail !== undefined, `missing section ${heading}`);
  return tail.split("\n\n## ").at(NONE) ?? "";
}

export function assertReviewedArtifact(observation: Observation): string {
  assertReviewScope(observation);
  const report = capturedText(observation, GITHUB_FACTS.report);
  assert.match(report, /^Dimensions reviewed: .+/m);

  return report;
}

export function assertThreadAssessments(report: string): void {
  const assessments = section(report, "Unresolved thread assessment");
  for (const root of [GITHUB_FACTS.rootId, FIXED_ROOT, OUT_OF_SCOPE_ROOT]) {
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
  const writes = observation.toolCalls.filter((call) => WRITES.has(call.name));
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
  if (denied) return;
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

function assertPostedBodies(writes: string[], preview: string): void {
  const [reviewLine, replyLine] = writes;
  assert.ok(reviewLine !== undefined && replyLine !== undefined);
  const review = Schema.decodeUnknownSync(postSchema)(JSON.parse(reviewLine));
  const reply = Schema.decodeUnknownSync(postSchema)(JSON.parse(replyLine));
  const prefix = `repos/${GITHUB_FACTS.repository}/pulls/17`;
  assert.equal(review.endpoint, `${prefix}/reviews`, "wrong review target");
  assert.equal(
    reply.endpoint,
    `${prefix}/comments/701/replies`,
    "wrong reply target",
  );
  assert.equal(
    review.payload.body,
    exactPreviewBody(preview, "Summary body:\n\n", "\n\nReply to root 701:"),
    "posted body differs from approved text",
  );
  assert.equal(
    reply.payload.body,
    exactPreviewBody(
      preview,
      `Reply to root 701: ${GITHUB_FACTS.url}#discussion_r701\n\n`,
      "\napproval-sha256: ",
    ),
    "posted reply differs from approved bytes",
  );
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

function postingPreview(observation: Observation): string {
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
  const calls = turns.slice(index).flatMap((turn) => turn.toolCalls);
  assert.equal(
    findBashCalls(
      { ...observation, toolCalls: calls },
      /post-review\.py[^\n]*--approved/,
    ).length,
    ONE,
    "approved poster not called exactly once",
  );
  const beforeApproval = turns
    .slice(NONE, index)
    .flatMap((turn) => turn.toolCalls);
  return posterPreview({ ...observation, toolCalls: beforeApproval }).output;
}

function assertDriftRefusal(observation: Observation): void {
  const toolCalls = (observation.turns ?? []).flatMap((turn) => turn.toolCalls);
  const call = findBashCalls(
    { ...observation, toolCalls },
    /post-review\.py[^\n]*--approved/,
  ).at(-ONE);
  assert.ok(call?.result !== undefined, "poster result was not captured");
  const output = call.result.content;
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

export function assertPosting(
  observation: Observation,
  stopped: boolean,
): void {
  const preview = postingPreview(observation);
  const writes = capturedText(observation, REVIEW_POSTS)
    .trim()
    .split("\n")
    .filter(Boolean);
  if (stopped) {
    assert.deepEqual(writes, [], "stale review posted");
    assertDriftRefusal(observation);
    return;
  }
  assert.equal(
    writes.length,
    EXPECTED_POSTS,
    "expected one new review and one existing-thread reply",
  );
  assertPostedBodies(writes, preview);
}
