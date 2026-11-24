import assert from "node:assert/strict";
import { basename, dirname } from "node:path";

import type { FollowUpReply } from "#/cases/case-contract.ts";
import { assertNoGithubWrites } from "#/cases/pr-creator-checks.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { isolatedScriptArgs } from "#/cases/review-pull-request-command.ts";
import { REVIEW_POSTS } from "#/cases/review-pull-request-fixtures.ts";
import {
  assertRetainedReviewFiles,
  RUN_ROOT,
} from "#/cases/review-pull-request-retention.ts";
import {
  APPROVAL_CHECKPOINT,
  recordFileCheckpoint,
} from "#/cases/review-pull-request-retention-checkpoint.ts";
import { shellCommands } from "#/cases/review-pull-request-shell.ts";
import {
  assertVisibleReview,
  visibleTurn,
} from "#/cases/review-pull-request-visible-preview.ts";
import {
  assertFileExists,
  assertRunHappened,
  capturedFilesUnder,
  FIXTURE_ROOT_PATH,
} from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const FIRST = 0;
const ONE = 1;
const registeredRoots = new Map<string, string>();

/** Only the runner's initial user prompt binds a follow-up to a seeded fixture. */
export function registerReviewFixture(repoPath: string): void {
  registeredRoots.set(dirname(repoPath), repoPath);
}

export function fixturePrompt(prompt: string, notGitPath: string): string {
  const root = registeredRoots.get(dirname(notGitPath));
  return root === undefined ? prompt : `${prompt}\nWorking directory: ${root}`;
}

export function registeredFixtureRoot(observation: Observation): string {
  const line = String(observation.turns?.at(FIRST)?.prompt)
    .split("\n")
    .at(-ONE);
  const prefix = "Working directory: ";
  assert.ok(
    line?.startsWith(prefix) === true,
    "missing trusted fixture working directory",
  );
  const root = line.slice(prefix.length);
  assert.equal(
    registeredRoots.get(dirname(root)),
    root,
    "unregistered fixture working directory",
  );
  return root;
}

function boundaryFiles(observation: Observation): Observation {
  if (observation.repoFiles !== undefined) return observation;
  return {
    ...observation,
    repoFiles: snapshotRepoFiles(registeredFixtureRoot(observation), [
      GITHUB_FACTS.report,
      GITHUB_FACTS.log,
      REVIEW_POSTS,
      FIXTURE_ROOT_PATH,
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
  const script = (word: string) => basename(word) === "post-review.py";
  if (script(String(args[FIRST]))) return args.at(ONE) === mode;
  return isolatedScriptArgs(args, script)?.at(FIRST) === mode;
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
    assertVisibleReview(
      posterPreview(observation).output,
      visibleTurn(observation.finalText),
    );
    return retainedApprovalReply(observation);
  } catch (error) {
    return {
      gateNotReached: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkpointFixture(
  observation: Observation,
  repoPath?: string,
): string | undefined {
  if (repoPath !== undefined) return repoPath;
  return observation.repoFiles === undefined
    ? registeredFixtureRoot(observation)
    : undefined;
}

export function retainedApprovalReply(
  observation: Observation,
  refreshedRun?: string,
  repoPath?: string,
): FollowUpReply {
  try {
    assertRunHappened(observation);
    posterPreview(observation);
    noApprovedPoster(observation);
    const boundary = boundaryFiles(observation);
    assertNoGithubWrites(boundary);
    assertFileExists(boundary, GITHUB_FACTS.report);
    assertRetainedReviewFiles(boundary, refreshedRun);
    const fixture = checkpointFixture(observation, repoPath);
    if (fixture !== undefined) {
      recordFileCheckpoint(
        fixture,
        APPROVAL_CHECKPOINT,
        capturedFilesUnder(boundary, RUN_ROOT),
      );
    }
    return { reply: "APPROVED" };
  } catch (error) {
    return {
      gateNotReached: error instanceof Error ? error.message : String(error),
    };
  }
}
