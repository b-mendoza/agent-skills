import assert from "node:assert/strict";
import { basename } from "node:path";

import { Schema } from "effect";

import {
  declaredScratchFiles,
  observedReviewRun,
  RUN_ROOT,
} from "#/cases/review-pull-request-retention.ts";
import {
  digest,
  recordFileCheckpoint,
} from "#/cases/review-pull-request-retention-checkpoint.ts";
import { capturedFilesUnder, capturedText } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

export const SAVED_FILES = ".git/eval-review-saved-files.json";
const NONE = 0;
const parseHashes = Schema.decodeUnknownSync(
  Schema.Record(Schema.String, Schema.String),
);
const isChunk = (path: string) =>
  /^chunk-[a-z][a-z0-9-]*\.txt$/u.test(basename(path));

export function savedFileHashes(observation: Observation) {
  return parseHashes(JSON.parse(capturedText(observation, SAVED_FILES)));
}

function runFiles(observation: Observation, run: string) {
  return Object.fromEntries(
    Object.entries(capturedFilesUnder(observation, RUN_ROOT)).filter(([path]) =>
      path.startsWith(`${run}/`),
    ),
  );
}

export function recordSavedFiles(
  observation: Observation,
  repoPath: string,
): void {
  const files = runFiles(observation, observedReviewRun(observation));
  recordFileCheckpoint(repoPath, SAVED_FILES, files);
}

function assertSavedScratch(
  observation: Observation,
  run: string,
  saved: Array<[string, string]>,
): void {
  const reassigned = new Set(declaredScratchFiles(observation, run));
  for (const [path, hash] of saved.filter(([name]) =>
    basename(name).startsWith("scratch-"),
  )) {
    const bytes = capturedText(observation, path);
    if (reassigned.has(path) && bytes.trim() !== "") continue;
    assert.equal(digest(bytes), hash, `saved scratch bytes changed: ${path}`);
  }
}

export function assertSavedChunks(observation: Observation, run: string): void {
  const entries = Object.entries(savedFileHashes(observation));
  assertSavedScratch(observation, run, entries);
  const saved = entries.filter(([path]) => isChunk(path));
  const current = Object.keys(runFiles(observation, run)).filter(isChunk);
  assert.ok(saved.length > NONE, "missing saved chunk checkpoint");
  assert.deepEqual(
    new Set(current),
    new Set(saved.map(([path]) => path)),
    "changed saved chunk set",
  );
  for (const [path, hash] of saved) {
    assert.equal(
      digest(capturedText(observation, path)),
      hash,
      `saved chunk bytes changed: ${path}`,
    );
  }
}
