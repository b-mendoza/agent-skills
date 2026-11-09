import assert from "node:assert/strict";

import { Schema } from "effect";

import type { Observation, ToolCall } from "#/observation/agent-query.ts";

const receiptSchema = Schema.Struct({
  valuesDigest: Schema.String,
  bodyDigest: Schema.String,
});
const isReceipt = Schema.is(receiptSchema);
const HEX_DIGEST = /^[a-f\d]{64}$/;

function parseReceipt(line: string): typeof receiptSchema.Type | undefined {
  try {
    const value: unknown = JSON.parse(line);
    return isReceipt(value) ? value : undefined;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    // Non-JSON shell output is not a receipt; the approval gate fails if none exists.
    return undefined;
  }
}

function digestCommand(command: unknown, gate: string): boolean {
  return (
    typeof command === "string" &&
    command.includes("validate-output.py") &&
    new RegExp(`\\bdigest\\b[^\\w]+${gate}\\b`).test(command)
  );
}

function successfulDigestCall(call: ToolCall, gate: string): boolean {
  if (call.name !== "Bash") return false;
  const { result } = call;
  if (result === undefined) return false;
  return !result.isError && digestCommand(call.input["command"], gate);
}

function latestCalls(observation: Observation): readonly ToolCall[] {
  const LAST = -1;
  return observation.turns?.at(LAST)?.toolCalls ?? observation.toolCalls;
}

export function digestToken(
  observation: Observation,
  gate: "preview" | "scope",
): string | undefined {
  const calls = latestCalls(observation);
  const expectedBody = gate === "scope" ? /^n\/a$/ : HEX_DIGEST;
  const tokens = calls
    .filter((call) => successfulDigestCall(call, gate))
    .flatMap((call) =>
      (call.result?.content ?? "")
        .split("\n")
        .map(parseReceipt)
        .filter((receipt) => receipt !== undefined)
        .filter(
          (receipt) =>
            HEX_DIGEST.test(receipt.valuesDigest) &&
            expectedBody.test(receipt.bodyDigest),
        )
        .map((receipt) => receipt.valuesDigest),
    );
  return tokens.findLast((token) =>
    new RegExp(`(?<![a-f\\d])${token}(?![a-f\\d])`).test(observation.finalText),
  );
}

export function assertPreparedDigest(
  observation: Observation,
  gate: "preview" | "scope" = "preview",
): void {
  assert.ok(
    digestToken(observation, gate) !== undefined,
    `successful ${gate} digest receipt with a user-visible token missing`,
  );
}

export function judgeToolEvidence(observation: Observation): string {
  return JSON.stringify(
    observation.toolCalls.map((call) => ({
      name: call.name,
      input: call.input,
      result: call.result,
    })),
  );
}
