import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { query } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import {
  assistant,
  scripted,
  success,
  toolUse,
} from "#/observation/observation-test-support.ts";
import { executeSuite } from "#/orchestration/suite.ts";

const sdk = vi.hoisted(() => ({
  query:
    vi.fn<(request: Parameters<typeof query>[0]) => AsyncIterable<unknown>>(),
}));
vi.mock(
  import("@anthropic-ai/claude-agent-sdk"),
  async (original): Promise<Record<string, unknown>> => ({
    ...(await original()),
    query: sdk.query,
  }),
);
const ONE_ATTEMPT = 1;
const TWO_ATTEMPTS = 2;
const LAST_ROW = -1;
let root = "";
let reportPath = "";
function evalCase(id: string): EvalCase {
  return {
    id,
    tier: 2,
    fixture: "clean",
    intent: "derived row",
    prompt: () => id,
    budgetUsd: 1,
    wallClockMs: 30_000,
    check: () => "ok",
  };
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "derived-"));
  reportPath = join(root, "report.md");
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  sdk.query.mockReset().mockImplementation(() => scripted(success("observed")));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

test("a clean behavioral run yields a PASS derived row without another query or cost", async () => {
  const cases = [evalCase("behavioral")];
  const rows = await executeSuite(cases, cases, ONE_ATTEMPT, reportPath);
  expect(sdk.query).toHaveBeenCalledOnce();
  expect(rows.at(LAST_ROW)).toMatchObject({
    id: "mutation-scope",
    status: "PASS",
    score: 100,
    attemptsRun: 1,
    costUsd: 0,
    durationMs: 0,
  });
  expect(readFileSync(reportPath, "utf8")).toContain(
    "| mutation-scope | 2* | PASS | 100 | 1/1 |",
  );
});

test("the derived row groups observations by attempt, not case", async () => {
  const cases = [evalCase("first"), evalCase("second")];
  sdk.query
    .mockImplementationOnce(() =>
      scripted(assistant(toolUse("Write")), success("observed")),
    )
    .mockImplementationOnce(() => scripted(success("observed")))
    .mockImplementationOnce(() =>
      scripted(assistant(toolUse("Write")), success("observed")),
    )
    .mockImplementationOnce(() => scripted(success("observed")));
  const rows = await executeSuite(cases, cases, TWO_ATTEMPTS, reportPath);
  expect(sdk.query.mock.calls.map(([request]) => request.prompt)).toStrictEqual(
    ["first", "first", "second", "second"],
  );
  expect(rows.at(LAST_ROW)).toMatchObject({
    status: "DEGRADED",
    score: 50,
    attemptsPassed: 1,
    attemptsRun: 2,
    costUsd: 0,
    durationMs: 0,
    observed: "read-only contract violated:",
  });
  expect(readFileSync(reportPath, "utf8")).toContain(
    "| mutation-scope | 2* | DEGRADED | 50 | 1/2 | read-only contract violated: |",
  );
});

test("tier one observations cannot contaminate the derived mutation diagnostic", async () => {
  const cases: EvalCase[] = [
    { ...evalCase("routing"), tier: 1 },
    evalCase("behavioral"),
  ];
  sdk.query
    .mockImplementationOnce(() =>
      scripted({ ...success("routing"), is_error: true }),
    )
    .mockImplementationOnce(() =>
      scripted(assistant(toolUse("Write")), success("observed")),
    );
  const rows = await executeSuite(cases, cases, ONE_ATTEMPT, reportPath);
  expect(sdk.query).toHaveBeenCalledTimes(cases.length);
  expect(rows.at(LAST_ROW)).toMatchObject({
    status: "FAIL",
    observed: "read-only contract violated:",
    costUsd: 0,
    durationMs: 0,
  });
  expect(readFileSync(reportPath, "utf8")).toContain(
    "| mutation-scope | 2* | FAIL | 0 | 0/1 | read-only contract violated: |",
  );
});
