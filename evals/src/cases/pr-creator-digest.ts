import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Schema } from "effect";

import type { Observation, ToolCall } from "#/observation/agent-query.ts";

export const approvalKinds = ["preview", "push", "scope"] as const;
export type ApprovalKind = (typeof approvalKinds)[number];

const SUCCESS = 0;
const FIRST = 0;
const LAST = -1;
const validator = fileURLToPath(
  new URL(
    "../../../skills/pr-creator/scripts/validate-output.py",
    import.meta.url,
  ),
);
export function runValidator(args: readonly string[], input: unknown): string {
  const result = spawnSync("python3", ["-I", "-B", validator, ...args], {
    input:
      args[FIRST] === "body" && typeof input === "string"
        ? input
        : JSON.stringify(input),
    encoding: "utf8",
  });
  if (result.error !== undefined) throw result.error;
  assert.equal(result.status, SUCCESS, result.stderr);
  return result.stdout.trim();
}

const receiptSchema = Schema.Struct({
  kind: Schema.optional(Schema.String),
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
  if (typeof command !== "string" || !command.includes("validate-output.py")) {
    return false;
  }
  // Recorded shells either invoke the script path directly or assign it to a variable.
  const scripts = String.raw`(?:[^\s;|&]*validate-output\.py|\$[\w]+)`;
  return new RegExp(
    String.raw`(?:^|[\n;&|]|\$\()[\t ]*python3\s+(?:-[IB]\s+)*["']?${scripts}["']?\s+digest\s+${gate}(?=$|[\s;<|&)])`,
  ).test(command);
}

function successfulDigestCall(call: ToolCall, gate: string): boolean {
  if (call.name !== "Bash") return false;
  const { result } = call;
  if (result === undefined) return false;
  return !result.isError && digestCommand(call.input["command"], gate);
}

function latestTurn(observation: Observation) {
  return observation.turns?.at(LAST) ?? observation;
}

function digestReceipts(observation: Observation, gate: ApprovalKind) {
  const { toolCalls: calls, finalText: reply } = latestTurn(observation);
  const expectedBody = gate === "preview" ? HEX_DIGEST : /^n\/a$/;
  const tokens = calls.flatMap((call, index) =>
    successfulDigestCall(call, gate)
      ? (call.result?.content ?? "")
          .split("\n")
          .map(parseReceipt)
          .filter((receipt) => receipt !== undefined)
          .filter(
            (receipt) =>
              (receipt.kind === undefined || receipt.kind === gate) &&
              HEX_DIGEST.test(receipt.valuesDigest) &&
              expectedBody.test(receipt.bodyDigest),
          )
          .map((receipt) => ({ index, digest: receipt.valuesDigest }))
      : [],
  );
  assert.ok(
    !tokens.some(({ digest }) => reply.toLowerCase().includes(digest)),
    `${gate} values digest exposed in reply`,
  );
  return tokens;
}
export function digestToken(observation: Observation, gate: ApprovalKind) {
  return digestReceipts(observation, gate).at(LAST)?.digest;
}
export function firstReceiptIndex(
  observation: Observation,
  gate: ApprovalKind,
) {
  return digestReceipts(observation, gate).at(FIRST)?.index;
}

export function assertPreparedDigest(
  observation: Observation,
  gate: ApprovalKind = "preview",
): void {
  assert.ok(
    digestToken(observation, gate) !== undefined,
    `successful ${gate} digest receipt missing`,
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
