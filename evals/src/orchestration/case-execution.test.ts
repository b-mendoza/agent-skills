// Pins the real case-execution boundary: fixture context and configured limits
// reach the observation harness, and fixture cleanup survives every settlement.
//
// The fixture and harness boundaries are mocked, so these tests spend no tokens
// and write no report file.
//
//   pnpm test

import { afterEach, expect, test, vi } from "vitest";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import type { Fixture } from "#/fixtures/fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/harness.ts";
import { runClaude } from "#/observation/harness.ts";
import { executeCase } from "#/orchestration/case-execution.ts";
import { evalModel } from "#/orchestration/run-configuration.ts";

vi.mock(import("#/fixtures/fixtures.ts"), () => ({ makeFixture: vi.fn() }));
vi.mock(import("#/observation/harness.ts"), () => ({ runClaude: vi.fn() }));

const makeFixtureMock = vi.mocked(makeFixture);
const runClaudeMock = vi.mocked(runClaude);

const CASE_BUDGET_USD = 1.25;
const CASE_WALL_CLOCK_MS = 42_000;
const FIXTURE_CWD = "/fixture/repo";
const FIXTURE_GIT_REPO = "/fixture/git-repo";
const FIXTURE_MISSING_PATH = "/fixture/missing";
const FIXTURE_NOT_GIT_PATH = "/fixture/not-git";

function selectedCase(): EvalCase {
  return {
    id: "boundary-case",
    tier: 2,
    fixture: "dirty",
    intent: "case execution boundary test",
    prompt: ({ missingPath, notGitPath }) =>
      `missing=${missingPath}; not-git=${notGitPath}`,
    budgetUsd: CASE_BUDGET_USD,
    wallClockMs: CASE_WALL_CLOCK_MS,
    check: () => "check passed",
  };
}

function testFixture(cleanup: Fixture["cleanup"]): Fixture {
  return {
    cwd: FIXTURE_CWD,
    gitRepo: FIXTURE_GIT_REPO,
    missingPath: FIXTURE_MISSING_PATH,
    notGitPath: FIXTURE_NOT_GIT_PATH,
    cleanup,
  };
}

function resolvedObservation(): Observation {
  return {
    subtype: "success",
    isError: false,
    finalText: "observed",
    toolCalls: [],
    gitStatusBefore: { kind: "worktree", entries: "" },
    gitStatusAfter: { kind: "worktree", entries: "" },
    costUsd: 0.2,
    durationMs: 125,
    timedOut: false,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

test("the selected case configuration and fixture context reach runClaude", async () => {
  const cleanup = vi.fn<Fixture["cleanup"]>();
  makeFixtureMock.mockReturnValue(testFixture(cleanup));
  runClaudeMock.mockResolvedValue(resolvedObservation());

  await executeCase(selectedCase());

  expect(runClaudeMock).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      cwd: FIXTURE_CWD,
      gitRepo: FIXTURE_GIT_REPO,
      prompt: `missing=${FIXTURE_MISSING_PATH}; not-git=${FIXTURE_NOT_GIT_PATH}`,
      budgetUsd: CASE_BUDGET_USD,
      model: evalModel,
      wallClockMs: CASE_WALL_CLOCK_MS,
    }),
  );
});

test("fixture cleanup runs after runClaude resolves", async () => {
  const cleanup = vi.fn<Fixture["cleanup"]>();
  makeFixtureMock.mockReturnValue(testFixture(cleanup));
  runClaudeMock.mockResolvedValue(resolvedObservation());

  await executeCase(selectedCase());

  expect(cleanup).toHaveBeenCalledOnce();
});

test("fixture cleanup runs and the rejection propagates when runClaude rejects", async () => {
  const cleanup = vi.fn<Fixture["cleanup"]>();
  const runFailure = new Error("runClaude rejected");
  makeFixtureMock.mockReturnValue(testFixture(cleanup));
  runClaudeMock.mockRejectedValue(runFailure);

  await expect(executeCase(selectedCase())).rejects.toBe(runFailure);
  expect(cleanup).toHaveBeenCalledOnce();
});
