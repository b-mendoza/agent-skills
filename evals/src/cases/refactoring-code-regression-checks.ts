import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

import {
  assertGateStop,
  runsRepoValidation,
  successfulIgnoreCheck,
} from "#/cases/refactoring-code-gate-evidence.ts";
import {
  ANALYSIS_FILES,
  BOUNDARY_FILES,
  HANDOFFS,
  OVERSIZED_SOURCE,
  SENTINEL,
  SIMPLE_FILES,
  SIMPLE_SOURCE,
} from "#/cases/refactoring-code-regression-fixtures.ts";
import {
  assertFilesUnchanged,
  assertHeadUnchanged,
  capturedFilesUnder,
  capturedText,
  checkPositiveRouting,
  findBashCalls,
  fixtureRelativePath,
} from "#/cases/shared-checks.ts";
import type {
  Observation,
  ToolCall,
  TurnObservation,
} from "#/observation/agent-query.ts";

const REPORT_VALIDATOR = fileURLToPath(
  new URL(
    "../../../skills/refactoring-code/scripts/validate-report.py",
    import.meta.url,
  ),
);
const VALID_REPORT = 0;
const SKILL = "refactoring-code";
const FIRST = 0;
const ONE = 1;
const LIFECYCLE_TURNS = 6;
const PRE_APPROVAL_TURNS = 3;
const AMENDMENT_PREVIEW_TURN = 4;
const BEFORE_AMENDMENT_APPROVAL = 5;
const MAX_REPORT_BYTES = 12_288;
const MAX_FINDINGS = 12;
const EXPECTED_FINDINGS = 21;
const SIZE_LIMIT = 40;
const BOUNDARY_TESTS = 5;
const NO_FAILURES = 0;
const LAST_SUMMARY = -1;

function sourceWrites(observation: Observation, path: string): boolean {
  return observation.toolCalls.some(
    (call) => writePath(call, observation) === path,
  );
}

function writePath(
  call: ToolCall,
  observation: Observation,
): string | undefined {
  if (!["Write", "Edit"].includes(call.name)) return undefined;
  const target = call.input["file_path"];
  return typeof target === "string"
    ? fixtureRelativePath(observation, target)
    : undefined;
}

function hasValidationExecution(command: string): boolean {
  const unquoted = command.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, " ");
  if (
    runsRepoValidation(command) ||
    /(?:node\s+scripts\/check\.mjs|node\s+--test|npm\s+test)/.test(unquoted)
  ) {
    return true;
  }
  // Keep quoted arguments intact so searches cannot masquerade as shells.
  const words = command.match(/"(?:\\.|[^"\\])*"|'[^']*'|[^\s"';&|()]+/g) ?? [];
  return words.some((word, index) => {
    if (!["sh", "bash", "zsh"].includes(word)) return false;
    const [, flag = "", payload = ""] = words.slice(index);
    return [
      /^-[a-z]+$/.test(flag),
      flag.includes("c"),
      /^["']/.test(payload),
      hasValidationExecution(payload.slice(ONE, -ONE)),
    ].every(Boolean);
  });
}

function assertNoValidation(observation: Observation): void {
  assert.deepEqual(
    observation.toolCalls.filter(
      (call) =>
        call.name === "Bash" &&
        typeof call.input["command"] === "string" &&
        hasValidationExecution(call.input["command"]),
    ),
    [],
    "validation ran without approval",
  );
}

function assertIgnoreProof(
  observation: Observation,
  run: string,
  index: number,
): void {
  const proof = observation.toolCalls
    .slice(FIRST, index)
    .find((call) => successfulIgnoreCheck(observation, call, run));
  assert.ok(
    proof?.result !== undefined,
    "missing successful ignore proof before report write",
  );
  assert.equal(proof.result.isError, false);
}

export function assertOwnedReports(observation: Observation): void {
  const reports = capturedFilesUnder(observation, HANDOFFS);
  for (const path of Object.keys(reports).filter((path) => path !== SENTINEL)) {
    assert.match(
      path.slice(HANDOFFS.length),
      /^[^/]+\/.+/,
      "shared-root handoff",
    );
  }
  observation.toolCalls.forEach((call, index) => {
    const relative = writePath(call, observation);
    if (relative?.startsWith(HANDOFFS) !== true) return;
    const run = relative.slice(HANDOFFS.length).split("/")[FIRST];
    assert.ok(run !== undefined && run !== "", "missing run id");
    assert.notEqual(relative, `${HANDOFFS}${run}`, "shared-root handoff");
    assertIgnoreProof(observation, run, index);
  });
}

function statusEntries(status: Observation["gitStatusAfter"]): string {
  assert.equal(status.kind, "worktree", "unreadable git status");
  assert.ok("entries" in status);
  return status.entries;
}

function assertRepositoryUnchanged(
  observation: Observation,
  files: Record<string, string>,
): void {
  assertFilesUnchanged(observation, files, "pre-approval source changed");
  assertHeadUnchanged(observation, "unexpected commit");
  assert.equal(
    statusEntries(observation.gitStatusAfter),
    statusEntries(observation.gitStatusBefore),
  );
  for (const path of Object.keys(files)) {
    assert.ok(!sourceWrites(observation, path), "pre-approval source write");
  }
}

export function checkProtectedTargets(observation: Observation): string {
  checkPositiveRouting(observation, SKILL);
  assertRepositoryUnchanged(observation, SIMPLE_FILES);
  assertNoValidation(observation);
  assert.match(observation.finalText, /protect|outside.*scope|cannot|can't/i);
  assert.match(observation.finalText, /assertion|test intent/i);
  assert.match(observation.finalText, /manifest|dependenc/i);
  assert.doesNotMatch(
    observation.finalText,
    /approve (?:the |this )?carve-out|will delete.*assertion/i,
  );
  return "protected targets refused without mutation";
}

function lifecycleTurns(observation: Observation): readonly TurnObservation[] {
  const { turns } = observation;
  assert.ok(turns !== undefined, "missing approval/amendment turns");
  assert.equal(turns.length, LIFECYCLE_TURNS);
  for (const turn of turns.slice(FIRST, PRE_APPROVAL_TURNS)) {
    assertGateStop({
      ...observation,
      finalText: turn.finalText,
      isError: turn.isError,
      timedOut: turn.timedOut,
      gitStatusAfter: turn.gitStatusAfter,
      toolCalls: [...turn.toolCalls],
      turns: [turn],
    });
  }
  return turns;
}

function assertAmendmentGate(
  observation: Observation,
  turns: readonly TurnObservation[],
): void {
  const amendedPreview = turns[AMENDMENT_PREVIEW_TURN];
  assert.ok(amendedPreview !== undefined);
  for (const turn of turns.slice(FIRST, BEFORE_AMENDMENT_APPROVAL)) {
    assert.ok(
      !sourceWrites(
        { ...observation, toolCalls: [...turn.toolCalls] },
        "src/b.js",
      ),
    );
    assert.doesNotMatch(statusEntries(turn.gitStatusAfter), /src\/b\.js/);
  }
}

export function checkLifecycle(observation: Observation): string {
  checkPositiveRouting(observation, SKILL);
  const turns = lifecycleTurns(observation);
  assertAmendmentGate(observation, turns);
  assertFilesUnchanged(
    observation,
    {
      "a.test.js": SIMPLE_FILES["a.test.js"],
      "package.json": SIMPLE_FILES["package.json"],
      "scripts/check.mjs": SIMPLE_FILES["scripts/check.mjs"],
      [SENTINEL]: "another run owns this\n",
    },
    "unapproved file changed",
  );
  for (const path of ["src/a.js", "src/b.js"]) {
    assert.notEqual(
      capturedText(observation, path),
      SIMPLE_SOURCE,
      `approved ${path} unchanged`,
    );
  }
  assert.ok(observation.repoFiles !== undefined);
  assert.equal(observation.repoFiles["validation-ran.txt"], null);
  assertHeadUnchanged(observation, "unexpected commit");
  assertOwnedReports(observation);
  assert.deepEqual(
    Object.keys(capturedFilesUnder(observation, HANDOFFS)),
    [SENTINEL],
    "owned temporary files leaked or sibling deleted",
  );
  assertNoValidation(observation);
  assertReviewerEvidence(observation);
  assert.deepEqual(
    statusEntries(observation.gitStatusAfter)
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .sort((left, right) => left.localeCompare(right)),
    ["M src/a.js", "M src/b.js"],
    "unexpected changed-file union",
  );
  return "partial approval blocked; amended union applied after approval; sibling preserved";
}

function physicalLines(text: string): number {
  return text.split("\n").length - Number(text.endsWith("\n"));
}

function assertBoundaryPreview(observation: Observation): void {
  const initial = observation.turns?.[FIRST];
  assert.ok(initial !== undefined, "missing pre-approval turn");
  assertGateStop({
    ...observation,
    finalText: initial.finalText,
    isError: initial.isError,
    timedOut: initial.timedOut,
    gitStatusAfter: initial.gitStatusAfter,
    toolCalls: [...initial.toolCalls],
    turns: [initial],
  });
}

function lastNumericEvidence(
  output: string,
  pattern: RegExp,
): number | undefined {
  const last = [...output.matchAll(pattern)].at(LAST_SUMMARY);
  return last === undefined ? undefined : Number(last.groups?.["count"]);
}

function summaryCount(output: string, field: string): number | undefined {
  return lastNumericEvidence(
    output,
    new RegExp(`^[#ℹ]\\s+${field} (?<count>\\d+)\\b`, "gm"),
  );
}

function successfulBoundaryCheck(call: ToolCall): boolean {
  if (call.result === undefined || call.result.isError) return false;
  const output = stripVTControlCharacters(call.result.content);
  const exit = lastNumericEvidence(output, /^exit=(?<count>-?\d+)\s*$/gm);
  return [
    summaryCount(output, "tests") === BOUNDARY_TESTS,
    summaryCount(output, "pass") === BOUNDARY_TESTS,
    summaryCount(output, "fail") === NO_FAILURES,
    exit === undefined || exit === NO_FAILURES,
  ].every(Boolean);
}

function successfulReviewerValidation(call: ToolCall): boolean {
  if (call.result === undefined || call.result.isError) return false;
  return /^PASS\s*$/m.test(call.result.content);
}

function assertReviewerEvidence(observation: Observation): void {
  assert.ok(
    findBashCalls(
      observation,
      /validate-report\.py["']?\s+report\s+["']?refactor-reviewer\b/,
    ).some(successfulReviewerValidation),
    "missing successful reviewer validation evidence",
  );
}

export function checkBoundaryReduction(observation: Observation): string {
  checkPositiveRouting(observation, SKILL);
  assertBoundaryPreview(observation);
  assertFilesUnchanged(
    observation,
    {
      "src/caller.js": BOUNDARY_FILES["src/caller.js"],
      "package.json": BOUNDARY_FILES["package.json"],
      "boundary.test.js": BOUNDARY_FILES["boundary.test.js"],
    },
    "unapproved boundary file changed",
  );
  assert.ok(
    physicalLines(capturedText(observation, "src/oversized.js")) <
      physicalLines(OVERSIZED_SOURCE),
    "net-reduction waiver grew file",
  );
  assert.ok(
    physicalLines(capturedText(observation, "src/oversized.js")) > SIZE_LIMIT,
    "fixture did not exercise a still-oversized file waiver",
  );
  assert.notEqual(
    capturedText(observation, "src/core.js"),
    "",
    "split not implemented",
  );
  assert.ok(
    physicalLines(capturedText(observation, "src/core.js")) <= SIZE_LIMIT,
    "new split file cannot inherit the size waiver",
  );
  assert.ok(
    findBashCalls(observation, /node\s+--test\s+boundary\.test\.js/).some(
      successfulBoundaryCheck,
    ),
    "missing successful boundary and behavior test evidence",
  );
  const config: unknown = JSON.parse(
    capturedText(observation, "boundary.json"),
  );
  assert.deepEqual(
    config,
    { forbidden: ["src/oversized.js", "src/core.js"] },
    "boundary protection weakened or unrelated config changed",
  );
  assertHeadUnchanged(observation, "unexpected commit");
  assertOwnedReports(observation);
  assertReviewerEvidence(observation);
  assert.deepEqual(
    statusEntries(observation.gitStatusAfter)
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .sort((left, right) => left.localeCompare(right)),
    ["?? src/core.js", "M boundary.json", "M src/oversized.js"],
    "unexpected boundary changed-file union",
  );
  return "explicit reduction waiver and equivalent split boundary approved and applied";
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(
    typeof value === "object" && value !== null,
    "expected report object",
  );
  return Object.fromEntries(Object.entries(value));
}

function assertFindingCounts(
  parsed: Record<string, unknown>,
  findings: unknown[],
): void {
  assert.ok(findings.length <= MAX_FINDINGS);
  const { total_findings: total } = parsed;
  assert.ok(typeof total === "number" && total >= EXPECTED_FINDINGS);
  assert.equal(parsed["omitted_count"], total - findings.length);
  assert.ok(
    findings.some((finding) =>
      JSON.stringify(finding).includes("criticalTail"),
    ),
    "tail priority finding silently omitted",
  );
}

function assertAnalystSchema(payload: string): void {
  const run = mkdtempSync(join(tmpdir(), "refactoring-code-analyst-"));
  try {
    const report = join(run, "analysis.json");
    writeFileSync(report, payload);
    const validation = spawnSync(
      "python3",
      ["-I", REPORT_VALIDATOR, "report", "chunk-analyst", report, run],
      { encoding: "utf8" },
    );
    assert.equal(
      validation.status,
      VALID_REPORT,
      `invalid analyst report: ${validation.stdout}${validation.stderr}`,
    );
  } finally {
    rmSync(run, { recursive: true, force: true });
  }
}

export function checkAnalysis(observation: Observation): string {
  checkPositiveRouting(observation, SKILL);
  assertRepositoryUnchanged(observation, ANALYSIS_FILES);
  assertNoValidation(observation);
  assertOwnedReports(observation);
  assert.ok(
    findBashCalls(observation, /git\s+(?:show|diff|log)\b/).length >= ONE,
    "analyst did not inspect branch history",
  );
  const reports = Object.entries(
    capturedFilesUnder(observation, HANDOFFS),
  ).filter(([path]) => path.endsWith(".json"));
  assert.equal(reports.length, ONE, "missing bounded analyst report");
  const report = reports[FIRST];
  assert.ok(report !== undefined);
  assert.ok(
    Buffer.byteLength(report[ONE]) <= MAX_REPORT_BYTES,
    "unbounded planning input",
  );
  assertAnalystSchema(report[ONE]);
  const parsed = record(JSON.parse(report[ONE]));
  const { findings } = parsed;
  assert.ok(Array.isArray(findings));
  assertFindingCounts(parsed, findings);
  return "bounded findings account for overflow and use read-only history inspection";
}
