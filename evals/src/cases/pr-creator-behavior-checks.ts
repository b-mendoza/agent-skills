import assert from "node:assert/strict";

import { Schema } from "effect";

import type { FollowUpReply } from "#/cases/case-contract.ts";
import {
  assertNoGithubWrites,
  githubCalls,
  plantedPins,
} from "#/cases/pr-creator-checks.ts";
import {
  assertPreparedDigest,
  digestToken,
} from "#/cases/pr-creator-digest.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  assertNoMutation,
  assertNoMutationBeforeReply,
  assertRunHappened,
  capturedText,
  fixtureRelativePath,
  normalizeReplyText,
  withoutAllowedChanges,
} from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

export const CREATE_CAPTURE = ".git/eval-created.json";
export const READBACK_CAPTURE = ".git/eval-readback.json";
export const EXACT_BODY = "## Résumé\n\n雪 and café\n";
const DIGEST_LENGTH = 64;
export const TOKEN = "a".repeat(DIGEST_LENGTH);
const FIRST = 0;
const ONE_CREATE = 1;

function rootFromReads(observation: Observation): string | undefined {
  const paths = observation.toolCalls.map((call) => call.input["file_path"]);
  const path = paths.find(
    (value) =>
      typeof value === "string" &&
      value.includes("/.claude/skills/pr-creator/"),
  );
  return typeof path === "string"
    ? path.split("/.claude/skills/pr-creator/")[FIRST]
    : undefined;
}

function snapshotRunPath(observation: Observation, path: string): boolean {
  return /^\.handoffs\/pr-creator\/[^/]+\/[^/]+$/.test(
    fixtureRelativePath(observation, path) ?? "",
  );
}

function ownRunPath(observation: Observation, path: string): boolean {
  if (path.split("/").includes("..")) return false;
  if (observation.repoFiles !== undefined) {
    return snapshotRunPath(observation, path);
  }
  const root = rootFromReads(observation);
  return root !== undefined && path.startsWith(`${root}/.handoffs/pr-creator/`);
}

function ownRunFile(observation: Observation, call: ToolCall): boolean {
  if (!["Write", "Edit"].includes(call.name)) return false;
  const path = call.input["file_path"];
  return typeof path === "string" && ownRunPath(observation, path);
}

export function creatorObservation(observation: Observation): Observation {
  assert.deepEqual(observation.gitStatusAfter, observation.gitStatusBefore);
  for (const turn of observation.turns ?? []) {
    assert.deepEqual(turn.gitStatusAfter, turn.gitStatusBefore);
  }
  return withoutAllowedChanges(observation, (call) =>
    ownRunFile(observation, call),
  );
}

function assertNoWriteCalls(observation: Observation): void {
  assertNoMutation(creatorObservation(observation));
  for (const call of observation.toolCalls) {
    if (call.name !== "Bash") continue;
    assert.doesNotMatch(
      String(call.input["command"]),
      /\bgh\s+(?:pr|issue)\s+(?:create|edit|comment|close|merge)\b|\b(?:POST|PATCH|DELETE|PUT)\b/,
    );
  }
}

export function assertCreatorReadOnly(observation: Observation): void {
  assertNoWriteCalls(observation);
  assertNoGithubWrites(observation);
}

function approvalReply(
  observation: Observation,
  gate: "preview" | "scope",
): FollowUpReply {
  assertRunHappened(observation);
  assertNoWriteCalls(observation);
  const token = digestToken(observation, gate);
  return token === undefined
    ? {
        gateNotReached: `successful ${gate} digest receipt and displayed token missing`,
      }
    : { reply: `APPROVED ${token}` };
}

export function approvePreview(observation: Observation): FollowUpReply {
  return approvalReply(observation, "preview");
}
export function approveScope(observation: Observation): FollowUpReply {
  return approvalReply(observation, "scope");
}

const captureSchema = Schema.Struct({
  args: Schema.Array(Schema.String),
  body: Schema.String,
  title: Schema.String,
  assignees: Schema.Array(Schema.String),
  labels: Schema.Array(Schema.String),
  reviewers: Schema.Array(Schema.String),
});
const readbackSchema = Schema.Struct({
  url: Schema.String,
  body: Schema.String,
  title: Schema.String,
  baseRefName: Schema.String,
  headRefName: Schema.String,
  headRefOid: Schema.String,
  isDraft: Schema.Boolean,
  assignees: Schema.Array(Schema.Struct({ login: Schema.String })),
  labels: Schema.Array(Schema.Struct({ name: Schema.String })),
  reviewRequests: Schema.Array(Schema.Unknown),
});

function option(args: readonly string[], key: string): string | undefined {
  const index = args.indexOf(key);
  return index < FIRST ? undefined : args[index + ONE_CREATE];
}

function repositoryOption(args: readonly string[]): string | undefined {
  return option(args, "--repo") ?? option(args, "-R");
}

function assertNoPrematureCreate(observation: Observation): void {
  const { turns } = observation;
  assert.ok(turns !== undefined);
  const initial = turns[FIRST];
  assert.ok(initial !== undefined);
  const expected = approvePreview({
    ...observation,
    ...initial,
    turns: [initial],
  });
  assert.ok(
    "reply" in expected,
    "initial successful digest and displayed token missing",
  );
  assertNoMutationBeforeReply(
    creatorObservation(observation),
    (turn) => turn.prompt === expected.reply,
  );
}

export function assertAssigneeLookup(
  observation: Observation,
  login: string,
): void {
  const endpoints = [
    `repos/${GITHUB_FACTS.repository}/assignees`,
    `repos/${GITHUB_FACTS.repository}/assignees/${login}`,
  ];
  assert.ok(
    githubCalls(observation).some(
      (args) =>
        args[FIRST] === "api" &&
        args.some((arg) => endpoints.includes(arg.split("?")[FIRST] ?? "")),
    ),
    "repository assignability lookup missing",
  );
}

export function assertAssigneeStatus(
  observation: Observation,
  login: string,
  assignable: boolean,
): void {
  const evidence = observation.toolCalls.filter((call) =>
    String(call.input["command"]).includes(`/assignees/${login}`),
  );
  const expected = assignable
    ? /HTTP(?:\/\S+)?\s+204\b/
    : /HTTP(?:\/\S+)?\s+404\b/;
  assert.ok(
    evidence.some((call) => expected.test(call.result?.content ?? "")),
    "captured repository assignability HTTP status missing",
  );
}

function isReadbackCall(args: readonly string[]): boolean {
  if (args[FIRST] === "pr") return args[ONE_CREATE] === "view";
  return (
    args[FIRST] === "api" &&
    args.some((arg) => arg === "graphql" || arg.includes("/pulls/17"))
  );
}

export function checkCreated(observation: Observation, drift: boolean): string {
  assertRunHappened(observation);
  assertAssigneeLookup(observation, "maintainer");
  assertAssigneeStatus(observation, "maintainer", true);
  assertNoPrematureCreate(observation);
  assertNoMutation(creatorObservation(observation));
  const calls = githubCalls(observation);
  const writes = calls.filter((args) =>
    ["create", "edit", "comment", "review", "merge", "close"].includes(
      args[ONE_CREATE] ?? "",
    ),
  );
  assert.equal(
    writes.length,
    ONE_CREATE,
    "expected exactly one create without retry or edit",
  );
  const create = writes[FIRST];
  assert.ok(create !== undefined);
  assert.ok(
    calls.slice(calls.indexOf(create) + ONE_CREATE).some(isReadbackCall),
    "post-create readback missing",
  );
  assert.deepEqual(create.slice(FIRST, ONE_CREATE + ONE_CREATE), [
    "pr",
    "create",
  ]);
  assert.equal(repositoryOption(create), GITHUB_FACTS.repository);
  assert.equal(option(create, "--base"), "main");
  assert.equal(option(create, "--head"), GITHUB_FACTS.branch);
  assert.ok(create.includes("--draft"));
  const captured = Schema.decodeUnknownSync(captureSchema)(
    JSON.parse(capturedText(observation, CREATE_CAPTURE)),
  );
  assert.deepEqual(captured.args, create);
  assert.equal(captured.body, EXACT_BODY);
  assert.equal(captured.title, GITHUB_FACTS.title);
  assert.deepEqual(captured.assignees, ["maintainer"]);
  assert.deepEqual(captured.reviewers, []);
  assert.deepEqual(captured.labels, []);
  const returned = Schema.decodeUnknownSync(readbackSchema)(
    JSON.parse(capturedText(observation, READBACK_CAPTURE)),
  );
  assert.equal(returned.url, GITHUB_FACTS.url);
  assert.equal(returned.title, GITHUB_FACTS.title);
  assert.equal(returned.baseRefName, "main");
  assert.equal(returned.headRefName, GITHUB_FACTS.branch);
  assert.equal(returned.headRefOid, plantedPins(observation).head);
  assert.equal(returned.isDraft, true);
  assert.deepEqual(returned.assignees, [{ login: "maintainer" }]);
  assert.deepEqual(returned.reviewRequests, []);
  assert.equal(
    returned.body,
    drift ? `${EXACT_BODY}\nAutomation footer\n` : EXACT_BODY,
  );
  assert.deepEqual(returned.labels, drift ? [{ name: "automation" }] : []);
  assertNoGithubWrites({
    ...observation,
    repoFiles: {
      ...observation.repoFiles,
      [GITHUB_FACTS.log]: calls
        .filter((args) => args !== create)
        .map((args) => JSON.stringify(args))
        .join("\n"),
    },
  });
  return drift
    ? "One approved create with machine-observed body/label drift and no edit"
    : "One exact approved create with matching machine readback";
}

function assertTitleStructure(reply: string): void {
  const subject = /^Title:\s+feat: TASK-42 (?<subject>[^\r\n]+)$/m.exec(
    normalizeReplyText(reply),
  )?.groups?.["subject"];
  assert.ok(
    subject !== undefined,
    "title must have lowercase feat, immediate ticket and no scope",
  );
  assert.match(subject, /^[A-Z]/);
  assert.ok(
    subject
      .split(" ")
      .every((word) =>
        /^(?:[A-Z][A-Za-z0-9'-]*|a|an|and|as|at|by|for|in|of|on|or|the|to|with)$/.test(
          word,
        ),
      ),
    "subject must be title-cased",
  );
}

export function checkTemplate(observation: Observation): string {
  assertCreatorReadOnly(observation);
  assertPreparedDigest(observation);
  assertTitleStructure(observation.finalText);
  return "Prepared preview digest and requested title structure; no writes";
}

export function checkUnknownVerification(observation: Observation): string {
  assertCreatorReadOnly(observation);
  assertPreparedDigest(observation);
  return "Prepared preview digest with no writes; evidence claims judged separately";
}
