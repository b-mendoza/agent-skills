import assert from "node:assert/strict";

import { Schema } from "effect";

import type { FollowUpReply } from "#/cases/case-contract.ts";
import {
  assertNoGithubWrites,
  canonicalAction,
  githubCalls,
  isGithubWrite,
  plantedPins,
} from "#/cases/pr-creator-checks.ts";
import {
  type ApprovalKind,
  approvalKinds,
  assertPreparedDigest,
  firstReceiptIndex,
  runValidator,
} from "#/cases/pr-creator-digest.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  assertCreatorReadOnly,
  assertNoWriteCalls,
  creatorObservation,
} from "#/cases/pr-creator-read-only.ts";
import {
  assertNoMutation,
  assertNoMutationBeforeReply,
  assertRunHappened,
  capturedText,
  normalizeReplyText,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

export const CREATE_CAPTURE = ".git/eval-created.json";
export const READBACK_CAPTURE = ".git/eval-readback.json";
export const EXACT_BODY = "## Résumé\n\n雪 and café\n";
const FIRST = 0;
const ONE_CREATE = 1;

export {
  assertCreatorReadOnly,
  creatorObservation,
} from "#/cases/pr-creator-read-only.ts";
const LAST_TURN = -1;
function followsProposal(observation: Observation, index: number) {
  const previous = observation.turns?.[index - ONE_CREATE];
  return (
    previous !== undefined &&
    approvalKinds.some(
      (kind) =>
        firstReceiptIndex({ ...observation, turns: [previous] }, kind) !==
        undefined,
    )
  );
}

function assertApprovalWindow(
  observation: Observation,
  receipt: number | undefined,
) {
  const turns = observation.turns ?? [];
  const firstApproval = turns.findIndex(
    (turn, index) =>
      turn.prompt === "approved" && followsProposal(observation, index),
  );
  if (firstApproval < FIRST) {
    assertNoWriteCalls(observation);
  } else {
    const prefix = turns.slice(FIRST, firstApproval);
    assertNoWriteCalls(
      {
        ...observation,
        toolCalls: prefix.flatMap((turn) => turn.toolCalls),
        turns: prefix,
      },
      observation,
    );
    if (receipt !== undefined) {
      const latest = turns.at(LAST_TURN);
      assert.ok(latest !== undefined);
      const suffix = {
        ...latest,
        toolCalls: latest.toolCalls.slice(receipt),
      };
      assertNoWriteCalls(
        { ...observation, ...suffix, turns: [suffix] },
        observation,
      );
    }
  }
}
function approvalReply(gate: ApprovalKind) {
  return (observation: Observation): FollowUpReply => {
    assertRunHappened(observation);
    const receipt = firstReceiptIndex(observation, gate);
    assertApprovalWindow(observation, receipt);
    return receipt === undefined
      ? { gateNotReached: `successful ${gate} digest receipt missing` }
      : { reply: "approved" };
  };
}

export const approvePreview = approvalReply("preview");
export const approveScope = approvalReply("scope");
export const approvePush = approvalReply("push");
export const approveRebase = approvalReply("rebase");
export const approveForcePush = approvalReply("force-push");
export const approveUpdate = approvalReply("update");

function asksRebaseChoice(text: string): boolean {
  const reply = normalizeReplyText(text).trim();
  const sentences = reply.split(/(?<=[.!?])\s+/);
  const ending =
    sentences
      .filter(
        (part) =>
          part.endsWith("?") ||
          /^(?:please\s+)?(?:choose|reply|select)\b/i.test(part),
      )
      .at(LAST_TURN) ?? "";
  const words = ending.match(/\b(?:preserve|discard|or)\b|\//gi) ?? [];
  const options = words.join(" ");
  return (
    /(?:preserve (?:or|\/) discard|discard (?:or|\/) preserve)/i.test(
      options,
    ) && /(?:\?$|^(?:please\s+)?(?:choose|reply|select)\b)/i.test(ending)
  );
}
export function chooseRebaseResult(choice: "preserve" | "discard") {
  return (observation: Observation): FollowUpReply => {
    assertRunHappened(observation);
    const latest = observation.turns?.at(LAST_TURN) ?? observation;
    assertNoWriteCalls({ ...observation, ...latest, turns: [] }, observation);
    return asksRebaseChoice(latest.finalText)
      ? { reply: choice }
      : { gateNotReached: "final preserve or discard question missing" };
  };
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
  body: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  baseRefName: Schema.NullOr(Schema.String),
  headRefName: Schema.NullOr(Schema.String),
  headRefOid: Schema.NullOr(Schema.String),
  isDraft: Schema.NullOr(Schema.Boolean),
  assignees: Schema.NullOr(
    Schema.Array(Schema.Struct({ login: Schema.String })),
  ),
  labels: Schema.NullOr(Schema.Array(Schema.Struct({ name: Schema.String }))),
  reviewRequests: Schema.NullOr(
    Schema.Array(Schema.Struct({ login: Schema.String })),
  ),
  closingIssuesReferences: Schema.NullOr(
    Schema.Array(Schema.Struct({ number: Schema.Number })),
  ),
});

function members<T>(items: readonly T[] | null, name: (item: T) => string) {
  return items?.map(name) ?? null;
}
function readbackState(isDraft: boolean | null) {
  if (isDraft === null) return null;
  return isDraft ? "draft" : "ready";
}
function comparisonFields(returned: typeof readbackSchema.Type) {
  return {
    title: returned.title,
    body: returned.body,
    baseRef: returned.baseRefName,
    headRef: returned.headRefName,
    headSha: returned.headRefOid,
    state: readbackState(returned.isDraft),
    labels: members(returned.labels, ({ name }) => name),
    assignees: members(returned.assignees, ({ login }) => login),
    reviewers: members(returned.reviewRequests, ({ login }) => login),
    closes: members(
      returned.closingIssuesReferences,
      ({ number }) => `${GITHUB_FACTS.repository}#${number}`,
    ),
  };
}

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
  assert.ok("reply" in expected, "initial successful preview digest missing");
  assert.equal(
    turns[ONE_CREATE]?.prompt,
    expected.reply,
    "approval must immediately follow the preview",
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
  const endpoint =
    `repos/${GITHUB_FACTS.repository}/assignees/${login}`.replace(
      /[.*+?^${}()|[\]\\]/g,
      String.raw`\$&`,
    );
  const namedEndpoint = new RegExp(
    `(?:^|[\\s'"(=])/?${endpoint}(?=$|[?\\s'";|&<>)\x60])`,
  );
  // Without a printed status, only a literal standalone GET proves success.
  // Allow read-only gh api flags, but not body flags or shell expansions.
  const value = String.raw`(?:[\w./:+,@%=-]+|'[^'\r\n]*'|"[^"\x60\\$\r\n]*")`;
  const flag = [
    "(?:-i|--include|--silent|--verbose|--paginate|--slurp)",
    `(?:-X[ \\t]*|--method(?:[ \\t]+|=))(?:GET|'GET'|"GET")`,
    `--hostname(?:[ \\t]+|=)(?:github\\.com|'github\\.com'|"github\\.com")`,
    `(?:-[Hqtp][ \\t]*|--(?:header|jq|template|cache|preview)(?:[ \\t]+|=))${value}`,
  ].join("|");
  const query = String.raw`(?:\?[\w./:+,@%=?-]*)?`;
  const quotedQuery = String.raw`(?:\?[\w./:+,@%=?&-]*)?`;
  const directRequest = new RegExp(
    `^gh[ \\t]+api[ \\t]+(?:(?:${flag})[ \\t]+)*(?:/?${endpoint}${query}|'/?${endpoint}${quotedQuery}'|"/?${endpoint}${quotedQuery}")(?:[ \\t]+(?:${flag}))*$`,
  );
  const expected = assignable
    ? /HTTP(?:\/\S+)?\s+204\b/
    : /HTTP(?:\/\S+)?\s+404\b/;
  assert.ok(
    observation.toolCalls
      .filter((call) => call.name === "Bash")
      .filter((call) => namedEndpoint.test(String(call.input["command"])))
      .flatMap((call) => {
        if (call.result === undefined) return [];
        return [
          {
            command: String(call.input["command"]).trim(),
            result: call.result,
          },
        ];
      })
      .some(({ command, result }) => {
        if (/HTTP(?:\/\S+)?\s+\d{3}\b/.test(result.content)) {
          return expected.test(result.content);
        }
        return (
          assignable &&
          !result.isError &&
          directRequest.test(command.replace(/\\\r?\n/g, ""))
        );
      }),
    "captured repository assignability HTTP status or successful direct request missing",
  );
}

function isReadbackCall(args: readonly string[]): boolean {
  if (args[FIRST] === "pr") return args[ONE_CREATE] === "view";
  return (
    args[FIRST] === "api" &&
    args.some((arg) => arg === "graphql" || arg.includes("/pulls/17"))
  );
}

export type CreateOutcome = "exact" | "additions" | "drift";

export function previewValues(baseSha: string, headSha: string) {
  return {
    repository: GITHUB_FACTS.repository,
    baseRemote: "origin",
    headRemote: "origin",
    targetBranch: "main",
    headBranch: GITHUB_FACTS.branch,
    baseSha,
    headSha,
    title: GITHUB_FACTS.title,
    body: EXACT_BODY,
    reviewers: [],
    assignees: ["maintainer"],
    labels: [],
    state: "draft",
    effectiveState: "draft",
    closes: [],
    related: [],
    autoClose: "none",
    unsupported: [],
  };
}

export function checkCreated(
  observation: Observation,
  expected: CreateOutcome | boolean,
): string {
  assertRunHappened(observation);
  assertAssigneeLookup(observation, "maintainer");
  assertAssigneeStatus(observation, "maintainer", true);
  assertNoPrematureCreate(observation);
  assertNoMutation(creatorObservation(observation));
  const calls = githubCalls(observation);
  const writes = calls.filter(isGithubWrite);
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
  assert.equal(
    repositoryOption(canonicalAction(create)),
    GITHUB_FACTS.repository,
  );
  assert.equal(option(canonicalAction(create), "--base"), "main");
  assert.equal(option(canonicalAction(create), "--head"), GITHUB_FACTS.branch);
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
  const pins = plantedPins(observation);
  const result = runValidator(["compare", "preview"], {
    values: previewValues(pins.base, pins.head),
    returned: comparisonFields(returned),
  });
  const { outcome } = Schema.decodeUnknownSync(
    Schema.Struct({
      outcome: Schema.Literals(["exact", "additions", "drift"]),
    }),
  )(JSON.parse(result));
  // Legacy readbackDrift appends a footer and label: additions, not drift.
  let expectedOutcome = expected;
  if (typeof expected === "boolean") {
    expectedOutcome = expected ? "additions" : "exact";
  }
  assert.equal(outcome, expectedOutcome);
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
  return `One approved create with ${outcome} machine readback and no edit`;
}

function assertTitleStructure(reply: string, convention: string): void {
  const title = /^Title:[\t ]+(?<title>\S[^\r\n]*)$/m.exec(
    normalizeReplyText(reply),
  )?.groups?.["title"];
  assert.ok(title !== undefined, "preview title missing");
  runValidator(["title"], { convention, title });
}

export function checkTemplate(observation: Observation): string {
  assertCreatorReadOnly(observation);
  assertPreparedDigest(observation);
  assertTitleStructure(
    observation.finalText,
    "type=feat; scope=forbidden; ticket=TASK-42@after-colon; case=title",
  );
  return "Prepared preview digest and requested title structure; no writes";
}

export function checkUnknownVerification(observation: Observation): string {
  assertCreatorReadOnly(observation);
  assertPreparedDigest(observation);
  return "Prepared preview digest with no writes; evidence claims judged separately";
}
