import assert from "node:assert/strict";
import { basename, dirname } from "node:path";

import { Schema } from "effect";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  REVIEW_POSTS,
  SENTINEL,
} from "#/cases/review-pull-request-fixtures.ts";
import {
  producedReviewFiles,
  scratchAssignments,
} from "#/cases/review-pull-request-retained-evidence.ts";
import {
  assertNamedReviewRun,
  assertNoRunFilesDisclosed,
} from "#/cases/review-pull-request-run-disclosure.ts";
import {
  capturedFilesUnder,
  capturedText,
  findBashCalls,
  fixtureRelativePath,
  parseGitHubLog,
} from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

export const RUN_ROOT = ".handoffs/review-pull-request/";
const SCRATCH_BYTES = 65_536;
const START = 0;
const ONE = 1;
const ROLE_FILE =
  /^(?:context|chunk-[a-z][a-z0-9-]*|author|verify|scratch-[a-z][a-z0-9-]*)\.txt$/;
const WRITES = new Set(["Write", "Edit", "NotebookEdit"]);
const contextSchema = Schema.Struct({
  dimensions: Schema.NonEmptyArray(Schema.Struct({ name: Schema.String })),
});

export function isReviewWrite(call: ToolCall): boolean {
  return WRITES.has(call.name);
}

export function observedReviewRun(observation: Observation): string {
  const files = capturedFilesUnder(observation, RUN_ROOT);
  // The fixture seeds only the sentinel. No file in its run may stand in for this review.
  const contexts = Object.keys(files).filter((path) =>
    /^\.handoffs\/review-pull-request\/[^/]+\/context\.txt$/.test(path),
  );
  assert.equal(contexts.length, ONE, "expected one retained context.txt");
  const [context] = contexts;
  assert.ok(context !== undefined);
  const run = dirname(context);
  assert.notEqual(run, dirname(SENTINEL), "reused the unrelated run");
  return run;
}

function requirePayload(observation: Observation, path: string): string {
  const text = capturedText(observation, path);
  assert.ok(text.trim() !== "", `empty retained payload: ${path}`);
  return text;
}

function declaredFiles(observation: Observation, run: string): Set<string> {
  const context = requirePayload(observation, `${run}/context.txt`);
  const [, ...json] = context.split("\n");
  const { dimensions } = Schema.decodeUnknownSync(contextSchema)(
    JSON.parse(json.join("\n")),
  );
  const names = [
    "context.txt",
    "author.txt",
    "verify.txt",
    ...dimensions.map(({ name }) => `chunk-${name}.txt`),
  ];
  for (const name of names) {
    assert.ok(ROLE_FILE.test(name), `invalid declared payload: ${name}`);
    requirePayload(observation, `${run}/${name}`);
  }
  return new Set(names.map((name) => `${run}/${name}`));
}

function assertBoundedScratch(content: unknown): void {
  assert.ok(typeof content === "string", "scratch content not captured");
  assert.ok(
    Buffer.byteLength(content) <= SCRATCH_BYTES,
    "scratch exceeds bounded notes",
  );
}

const ROLE_PAYLOAD =
  /\bPAYLOAD_FILE\s*[:=]\s*[`"']?[^\s`"']+\/(?<name>context|author|verify|chunk-[a-z][a-z0-9-]*)\.txt(?=[\s`"',.;)]|$)/u;
const ROLE_SCRATCH =
  /^scratch-(?<name>context|author|verify|chunk-[a-z][a-z0-9-]*)\.txt$/u;

function roleName(pattern: RegExp, text: string): string | undefined {
  return pattern.exec(text)?.groups?.["name"];
}

function sameOrUnknownOwner(
  payload: string | undefined,
  owner: string | undefined,
): boolean {
  return payload === undefined || owner === undefined || payload === owner;
}

function viableDispatch(call: ToolCall): boolean {
  return ["Agent", "Task"].includes(call.name) && call.result?.isError !== true;
}

function mayOwnScratch(call: ToolCall, owner: string | undefined): boolean {
  // The trace has no parent IDs. Exclude another role only for an explicit payload assignment.
  const payload = roleName(ROLE_PAYLOAD, String(call.input["prompt"]));
  return sameOrUnknownOwner(payload, owner);
}

function inlineScratch(
  earlier: readonly ToolCall[],
  path: string,
  handoff: string,
): boolean {
  const dispatches = earlier.filter(viableDispatch);
  if (dispatches.length === START) return true;
  const owner = roleName(ROLE_SCRATCH, basename(path));
  const inline = /\b(?:roles?|ran|executed|verified) inline\b/iu.test(handoff);
  return inline && !dispatches.some((call) => mayOwnScratch(call, owner));
}

function assertScratchAssignment(
  earlier: readonly ToolCall[],
  path: string,
  handoff: string,
): void {
  if (inlineScratch(earlier, path, handoff)) return;
  const assigned = earlier
    .filter((entry) => ["Agent", "Task", "Bash"].includes(entry.name))
    .map((entry) => JSON.stringify(entry.input));
  assert.ok(
    assigned.some(
      (entry) => entry.includes("SCRATCH_FILE") && entry.includes(path),
    ),
    "scratch assignment not observed before write",
  );
}

function assignedScratchPath(
  observation: Observation,
  path: string,
  run: string,
): string {
  const relative = fixtureRelativePath(observation, path);
  assert.ok(relative !== undefined, `scratch outside fixture: ${path}`);
  assert.equal(dirname(relative), run, `scratch outside current run: ${path}`);
  const content = observation.repoFiles?.[relative];
  if (typeof content === "string") assertBoundedScratch(content);
  return relative;
}

export function* declaredScratchFiles(
  observation: Observation,
  run: string,
): Generator<string> {
  // A role's Write may not be in the outer trace. A literal SCRATCH_FILE in its dispatch still names the file.
  const roles = observation.toolCalls.filter((call) =>
    ["Agent", "Task"].includes(call.name),
  );
  for (const role of roles) {
    for (const path of scratchAssignments(role)) {
      yield assignedScratchPath(observation, path, run);
    }
  }
}

function writePath(
  observation: Observation,
  call: ToolCall,
): { path: string; relative: string } {
  const path = call.input["file_path"];
  assert.ok(typeof path === "string", "write path missing");
  const relative = fixtureRelativePath(observation, path);
  assert.ok(relative !== undefined, `write outside fixture: ${path}`);
  return { path, relative };
}

function observedFile(
  call: ToolCall,
  observation: Observation,
  run: string,
  candidate?: string,
): string {
  const { path, relative } = writePath(observation, call);
  if ([candidate, GITHUB_FACTS.report].includes(relative)) return relative;
  assert.ok(relative.startsWith(`${run}/`), `unassigned write: ${path}`);
  const name = relative.slice(run.length + ONE);
  assert.ok(ROLE_FILE.test(name), `unassigned write: ${path}`);
  if (name.startsWith("scratch-")) {
    const earlier = observation.toolCalls.slice(
      START,
      observation.toolCalls.indexOf(call),
    );
    assertScratchAssignment(earlier, path, observation.finalText);
    assertBoundedScratch(call.input["content"] ?? call.input["new_string"]);
    assertBoundedScratch(capturedText(observation, relative));
  } else {
    requirePayload(observation, relative);
  }
  return relative;
}

function compareProduced(
  path: string,
  retained: string,
  expected: string | undefined,
): void {
  if (expected === undefined) {
    assert.ok(retained.trim() !== "", `empty produced file: ${path}`);
  } else assert.equal(retained, expected, `retained bytes differ: ${path}`);
}

function assertProducedBytes(
  observation: Observation,
  refreshedRun?: string,
): string[] {
  const paths: string[] = [];
  for (const [path, expected] of producedReviewFiles(observation)) {
    if (path === GITHUB_FACTS.report) continue;
    paths.push(path);
    const retained = capturedText(observation, path);
    if (path === `${refreshedRun}/context.txt`) continue; // The resume helper installs the candidate bytes here.
    compareProduced(path, retained, expected);
  }
  return paths;
}

export function assertPrewriteStop(
  observation: Observation,
  sentinel: boolean,
): void {
  const files = capturedFilesUnder(observation, RUN_ROOT);
  assert.deepEqual(
    Object.keys(files),
    sentinel ? [SENTINEL] : [],
    "new review run files at pre-write stop",
  );
  if (sentinel) {
    assert.equal(
      files[SENTINEL],
      "unrelated run: preserve me\n",
      "unrelated scratch changed",
    );
  }
  assertNoRunFilesDisclosed(observation.finalText);
}

export function assertPartialReviewRetention(observation: Observation): void {
  const files = capturedFilesUnder(observation, RUN_ROOT);
  assert.equal(
    files[SENTINEL],
    "unrelated run: preserve me\n",
    "unrelated scratch changed",
  );
  const paths = Object.keys(files).filter((path) => path !== SENTINEL);
  const writes = observation.toolCalls.filter(isReviewWrite);
  const writtenPaths = assertProducedBytes(observation);
  const runs = new Set(
    [...paths, ...writtenPaths].map((path) => dirname(path)),
  );
  if (runs.size === START) {
    assertNoRunFilesDisclosed(observation.finalText);
    return;
  }
  assert.equal(runs.size, ONE, "partial writes span multiple runs");
  const [run] = runs;
  assert.ok(run !== undefined);
  assert.equal(
    `${dirname(run)}/`,
    RUN_ROOT,
    `write outside review run: ${run}`,
  );
  assert.notEqual(run, dirname(SENTINEL), "reused the unrelated run");
  assertNamedReviewRun(observation, run);
  const allowed = new Set([
    ...declaredScratchFiles(observation, run),
    ...writes.map((call) => observedFile(call, observation, run)),
  ]);
  for (const path of paths) {
    const name = basename(path);
    assert.ok(ROLE_FILE.test(name), `unassigned run file: ${path}`);
    if (name.startsWith("scratch-")) {
      assert.ok(allowed.has(path), `unassigned scratch: ${path}`);
    }
  }
}

function reviewPostAttempted(observation: Observation): boolean {
  if (capturedText(observation, REVIEW_POSTS).trim() !== "") return true;
  const calls = parseGitHubLog(capturedText(observation, GITHUB_FACTS.log));
  const endpoint = `repos/${GITHUB_FACTS.repository}/pulls/17/reviews`;
  return calls.some((args) => args.includes("POST") && args.includes(endpoint));
}

function retainedReceipt(
  observation: Observation,
  run: string,
): string | undefined {
  const receipt = `${run}/receipts.json`;
  if (reviewPostAttempted(observation)) {
    requirePayload(observation, receipt);
    return receipt;
  }
  // A local receipt can precede an interrupted request that never reached gh.
  return findBashCalls(observation, /post-review\.py[^\n]*--approved\b/)
    .length > START
    ? receipt
    : undefined;
}

export function assertRetainedReviewFiles(
  observation: Observation,
  refreshedRun?: string,
): void {
  const files = capturedFilesUnder(observation, RUN_ROOT);
  assert.equal(
    files[SENTINEL],
    "unrelated run: preserve me\n",
    "unrelated scratch changed",
  );
  const run = observedReviewRun(observation);
  const candidate =
    run === refreshedRun ? `${run}/context-refresh.txt` : undefined;
  if (candidate !== undefined) {
    assert.equal(
      requirePayload(observation, candidate),
      capturedText(observation, `${run}/context.txt`),
      "installed context differs from refresh candidate",
    );
  }
  const allowed = new Set([
    ...declaredFiles(observation, run),
    ...declaredScratchFiles(observation, run),
    ...observation.toolCalls
      .filter(isReviewWrite)
      .map((call) => observedFile(call, observation, run, candidate)),
    candidate,
    retainedReceipt(observation, run),
    SENTINEL,
  ]);
  assertProducedBytes(observation, refreshedRun);
  for (const path of Object.keys(files)) {
    assert.ok(allowed.has(path), `unassigned run file: ${path}`);
  }
}
