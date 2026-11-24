import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { Schema } from "effect";

import { capturedText } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

export const APPROVAL_CHECKPOINT = ".git/eval-review-approval-files.json";
const ZERO = 0;
const decodeDigests = Schema.decodeUnknownSync(
  Schema.Record(Schema.String, Schema.String),
);

export function digest(bytes: string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function recordFileCheckpoint(
  repoPath: string,
  checkpoint: string,
  files: Readonly<Record<string, string>>,
): void {
  const digests = Object.fromEntries(
    Object.entries(files).map(([path, bytes]) => [path, digest(bytes)]),
  );
  writeFileSync(join(repoPath, checkpoint), JSON.stringify(digests), {
    flag: "wx",
  });
}

function assertFileCheckpoint(
  observation: Observation,
  checkpoint: string,
): void {
  const expected = decodeDigests(
    JSON.parse(capturedText(observation, checkpoint)),
  );
  const entries = Object.entries(expected);
  assert.notEqual(
    entries.length,
    ZERO,
    `empty retention checkpoint: ${checkpoint}`,
  );
  for (const [path, hash] of entries) {
    assert.equal(
      digest(capturedText(observation, path)),
      hash,
      `checkpointed run file changed: ${path}`,
    );
  }
}

export function assertReviewCheckpointPreserved(
  observation: Observation,
): void {
  // From APPROVED or ABORT to terminal only receipts and the rendered draft may change.
  if (
    observation.turns?.some(
      ({ prompt }) => prompt === "APPROVED" || prompt === "ABORT",
    ) === true
  ) {
    assertFileCheckpoint(observation, APPROVAL_CHECKPOINT);
  }
}
