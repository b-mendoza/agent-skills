import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { basename } from "node:path";

import { Schema } from "effect";

import type { FollowUpReply } from "#/cases/case-contract.ts";
import { assertNoGithubWrites } from "#/cases/pr-creator-checks.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { shellCommands } from "#/cases/review-pull-request-shell.ts";
import {
  assertFileExists,
  assertRunHappened,
  capturedText,
} from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const FIRST = 0;
const ONE = 1;
const RUN_ROOT = ".handoffs/review-pull-request/";
const registeredRoots = new Map<string, string>();

/** Follow-up callbacks lack cwd/snapshots. Register trusted fixture roots, never trust an arbitrary tool-supplied read path. */
export function registerReviewFixture(repoPath: string): void {
  registeredRoots.set(repoPath, repoPath);
  registeredRoots.set(realpathSync(repoPath), repoPath);
}

function boundaryFiles(observation: Observation): Observation {
  if (observation.repoFiles !== undefined) return observation;
  const words = observation.toolCalls
    .flatMap((call) => shellCommands(String(call.input["command"])))
    .flat()
    .map((word) => word.replace(/^[A-Za-z_]\w*=/, ""));
  const matches = [...registeredRoots.entries()]
    .filter(([root]) =>
      words.some((word) => word === root || word.startsWith(`${root}/`)),
    )
    .map(([, root]) => root);
  const roots = [...new Set(matches)];
  assert.equal(
    roots.length,
    ONE,
    "no unambiguous registered fixture root at approval boundary",
  );
  const root = roots[FIRST];
  assert.ok(root !== undefined);
  return {
    ...observation,
    repoFiles: snapshotRepoFiles(root, [
      GITHUB_FACTS.report,
      GITHUB_FACTS.log,
      RUN_ROOT,
    ]),
  };
}

function hash(text: string): string {
  const matches = [
    ...text.matchAll(/^approval-sha256: (?<hash>[a-f0-9]{64})\r?$/gm),
  ];
  const values = [...new Set(matches.map((match) => match.groups?.["hash"]))];
  assert.equal(
    values.length,
    ONE,
    "missing or ambiguous captured approval hash",
  );
  const value = values[FIRST];
  assert.ok(value !== undefined);
  return value;
}

function posterCommand(args: readonly string[], mode: string): boolean {
  const executable = basename(args[FIRST] ?? "");
  if (!["python3", "post-review.py"].includes(executable)) return false;
  return (
    args.some((arg) => basename(arg) === "post-review.py") &&
    args.includes(mode)
  );
}

function successfulOutput(call: ToolCall): string | null {
  const { result } = call;
  if (result === undefined) return null;
  // The shared observer may retain only head + tail; the final approval hash is tail evidence.
  return result.isError ? null : result.content;
}

function isPreviewCall(call: ToolCall): boolean {
  if (call.name !== "Bash") return false;
  return shellCommands(String(call.input["command"])).some((args) =>
    posterCommand(args, "--dry-run"),
  );
}

/** Machine evidence only. Never extract approval authority from free final prose. */
export function posterPreview(observation: Observation): {
  hash: string;
  output: string;
} {
  const call = observation.toolCalls.filter(isPreviewCall).at(-ONE);
  assert.ok(call !== undefined, "no poster dry-run was observed");
  const output = successfulOutput(call);
  assert.ok(
    output !== null,
    "poster dry-run did not return a successful captured result",
  );
  return { hash: hash(output), output };
}

const contextSchema = Schema.Struct({
  dimensions: Schema.Array(Schema.Struct({ name: Schema.String })),
});
function retainedPayloads(observation: Observation): void {
  const files = observation.repoFiles ?? {};
  const contexts = Object.keys(files).filter(
    (path) => path.startsWith(RUN_ROOT) && path.endsWith("/context.txt"),
  );
  assert.equal(
    contexts.length,
    ONE,
    "review context was cleaned before the user answered",
  );
  const contextPath = contexts[FIRST];
  assert.ok(contextPath !== undefined);
  const content = capturedText(observation, contextPath);
  const [, ...json] = content.split("\n");
  const context = Schema.decodeUnknownSync(contextSchema)(
    JSON.parse(json.join("\n")),
  );
  const root = contextPath.slice(FIRST, -"context.txt".length);
  for (const name of [
    "author.txt",
    "verify.txt",
    ...context.dimensions.map(({ name }) => `chunk-${name}.txt`),
  ]) {
    assertFileExists(observation, `${root}${name}`);
  }
}

function noApprovedPoster(observation: Observation): void {
  const commands = observation.toolCalls
    .filter((call) => call.name === "Bash")
    .flatMap((call) => shellCommands(String(call.input["command"])));
  assert.ok(
    !commands.some((args) => posterCommand(args, "--approved")),
    "approved poster already invoked",
  );
}

export function approvalReply(observation: Observation): FollowUpReply {
  try {
    assertRunHappened(observation);
    posterPreview(observation);
    noApprovedPoster(observation);
    const boundary = boundaryFiles(observation);
    assertNoGithubWrites(boundary);
    assertFileExists(boundary, GITHUB_FACTS.report);
    retainedPayloads(boundary);
    return { reply: "APPROVED" };
  } catch (error) {
    return {
      gateNotReached: error instanceof Error ? error.message : String(error),
    };
  }
}
