import assert from "node:assert/strict";

import { fixtureRoots, invokes } from "#/cases/review-pull-request-command.ts";
import { shellCommands } from "#/cases/review-pull-request-shell.ts";
import { findBashCalls } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

const ONE = 1;

function literalPrint(command: string): boolean {
  if (/[`$<>]/u.test(command)) return false;
  const commands = shellCommands(command);
  return commands.every(([name]) => name === "echo" || name === "printf");
}

function approvedCall(observation: Observation) {
  const approval = observation.turns?.at(-ONE);
  assert.ok(approval?.prompt === "APPROVED", "missing fresh approval turn");
  const calls = findBashCalls(
    { ...observation, toolCalls: approval.toolCalls },
    /post-review\.py[^\n]*--approved\b/,
  ).filter((call) => !literalPrint(String(call.input["command"])));
  assert.equal(calls.length, ONE, "approved poster not called exactly once");
  const [poster] = calls;
  assert.ok(poster?.result !== undefined, "poster result was not captured");
  return { poster, result: poster.result };
}

export function assertApprovedPoster(
  observation: Observation,
  hash: string,
  run: string,
  refused = false,
): string {
  const { poster, result } = approvedCall(observation);
  assert.equal(
    result.isError,
    refused,
    refused
      ? "expected poster refusal"
      : "no successful approved poster result",
  );
  assert.ok(
    invokes(
      poster,
      "post-review.py",
      ["--approved", hash, run],
      fixtureRoots(observation),
    ),
    "approved poster did not use the fresh approval hash and retained run",
  );
  return result.content;
}
