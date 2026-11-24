import assert from "node:assert/strict";

import { Schema } from "effect";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  fixtureRoots,
  invokes,
  reviewScriptCall,
} from "#/cases/review-pull-request-command.ts";
import { FEEDBACK_URL } from "#/cases/review-pull-request-fixtures.ts";
import { assertSavedChunks } from "#/cases/review-pull-request-saved-files.ts";
import { producedPayload } from "#/cases/review-pull-request-saved-role.ts";
import { capturedText, fixtureRelativePath } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

const NONE = 0;
const ONE = 1;
const resumeSchema = Schema.Struct({
  run_dir: Schema.String,
  pr: Schema.Literal(GITHUB_FACTS.url),
  base: Schema.Literal("main"),
  base_sha: Schema.String,
  head_sha: Schema.String,
  output_sha256: Schema.String,
  refreshed: Schema.Boolean,
  history: Schema.Literals(["unchanged", "changed"]),
});
export type ResumeEvidence = typeof resumeSchema.Type;
export type History = ResumeEvidence["history"];

export function successful(call: ToolCall | undefined): call is ToolCall & {
  result: NonNullable<ToolCall["result"]>;
} {
  return call?.result !== undefined && !call.result.isError;
}

function resumeEvidence(output: string): ResumeEvidence {
  const objects = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.endsWith("}"));
  assert.equal(
    objects.length,
    ONE,
    "expected one resume JSON object in stdout",
  );
  return Schema.decodeUnknownSync(resumeSchema)(
    JSON.parse(String(objects[NONE])),
  );
}

function resumeResult(observation: Observation, extraArgs: readonly string[]) {
  const resume = observation.toolCalls.find((call) =>
    invokes(
      call,
      "post-review.py",
      ["--resume", GITHUB_FACTS.report, ...extraArgs],
      fixtureRoots(observation),
    ),
  );
  assert.ok(
    successful(resume),
    "no successful resume check for the saved draft",
  );
  return { resume, evidence: resumeEvidence(resume.result.content) };
}

function after(observation: Observation, call: ToolCall): Observation {
  return {
    ...observation,
    toolCalls: observation.toolCalls.slice(
      observation.toolCalls.indexOf(call) + ONE,
    ),
  };
}

function afterPayload(
  observation: Observation,
  path: string,
  status: string,
): Observation {
  assert.equal(
    capturedText(observation, path).split("\n", ONE)[NONE],
    status,
    `no fresh ${status} in ${path}`,
  );
  const call = observation.toolCalls.findLast((candidate) =>
    producedPayload(candidate, { observation, path, status }),
  );
  assert.ok(call !== undefined, `no fresh ${status} for ${path}`);
  return after(observation, call);
}

function rerunsChunk(call: ToolCall): boolean {
  if (["Write", "Edit"].includes(call.name)) {
    return /\/chunk-[^/]+\.txt$/.test(String(call.input["file_path"]));
  }
  return ["Agent", "Task"].includes(call.name) && chunkDispatch(call);
}

function chunkDispatch(call: ToolCall): boolean {
  return (
    call.input["subagent_type"] === "chunk-reviewer" ||
    /^CHUNK: /m.test(call.result?.content ?? "")
  );
}

const feedbackSchema = Schema.Struct({
  feedback: Schema.Array(
    Schema.Struct({ kind: Schema.String, url: Schema.String }),
  ),
});
function assertInstalledContext(observation: Observation, run: string): void {
  const candidate = capturedText(observation, `${run}/context-refresh.txt`);
  assert.equal(
    capturedText(observation, `${run}/context.txt`),
    candidate,
    "refreshed context not installed",
  );
  const [status, ...body] = candidate.split("\n");
  assert.equal(status, "CONTEXT: PASS");
  const { feedback } = Schema.decodeUnknownSync(feedbackSchema)(
    JSON.parse(body.join("\n")),
  );
  assert.ok(
    feedback.some(
      ({ kind, url }) =>
        kind === "discussion" && url === FEEDBACK_URL.discussion,
    ),
    "refreshed context lacks the new discussion",
  );
}

function afterRefresh(
  observation: Observation,
  evidence: ResumeEvidence,
): Observation {
  const run = evidence.run_dir;
  const collected = afterPayload(
    observation,
    `${run}/context-refresh.txt`,
    "CONTEXT: PASS",
  );
  const swap = resumeResult(collected, ["--refresh"]);
  assert.deepEqual(
    swap.evidence,
    { ...evidence, refreshed: true },
    "refresh did not resume the same changed draft",
  );
  assertInstalledContext(observation, run);
  return afterPayload(
    after(collected, swap.resume),
    `${run}/author.txt`,
    "AUTHOR: PASS",
  );
}

function completedVerification(
  call: ToolCall,
  observation: Observation,
  path: string,
): boolean {
  if (!successful(call)) return false;
  const parsed = reviewScriptCall(
    call,
    "validate-output.py",
    fixtureRoots(observation),
  );
  if (parsed?.args.join(" ") !== "verify") return false;
  return fixtureRelativePath(observation, String(parsed.stdin)) === path;
}

export function verifiedResume(
  observation: Observation,
  draftHash: string,
  history: History,
  dryRun: ToolCall,
) {
  const followUps = observation.turns?.slice(ONE) ?? [];
  assert.ok(
    !followUps.some((turn) => turn.toolCalls.some(rerunsChunk)),
    "resumed draft reran a chunk review",
  );
  const beforePreview = {
    ...observation,
    toolCalls: observation.toolCalls.slice(
      NONE,
      observation.toolCalls.indexOf(dryRun),
    ),
  };
  const { resume, evidence } = resumeResult(beforePreview, []);
  assert.equal(evidence.history, history, "unexpected saved draft history");
  assertSavedChunks(observation, evidence.run_dir);
  assert.equal(
    evidence.output_sha256,
    draftHash,
    "resume did not verify the initially saved draft hash",
  );
  const between = after(beforePreview, resume);
  const route =
    history === "changed" ? afterRefresh(between, evidence) : between;
  const path = `${evidence.run_dir}/verify.txt`;
  const verified = afterPayload(route, path, "VERIFY: PASS");
  const verifier = verified.toolCalls.find((call) =>
    completedVerification(call, observation, path),
  );
  assert.ok(
    verifier !== undefined,
    "missing successful re-verification before the fresh preview",
  );
  return { verifier, evidence };
}
