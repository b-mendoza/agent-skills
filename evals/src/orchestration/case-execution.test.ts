// Pins the real case-execution boundary: fixture context and configured limits
// reach the observation harness, and fixture cleanup survives every settlement.
//
// The fixture and harness boundaries are replaced with local layers, so these
// tests spend no tokens and write no report file.
//
//   pnpm test

import { Effect, Layer } from "effect";
import { afterEach, expect, test, vi } from "vitest";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import type { Fixture } from "#/fixtures/fixtures.ts";
import {
  FixtureCleanupError,
  FixtureProvisioner,
} from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/harness.ts";
import { runClaude } from "#/observation/harness.ts";
import {
  executeCase,
  ObservationRunnerLive,
} from "#/orchestration/case-execution.ts";
import {
  EvalConfiguration,
  evalModel,
} from "#/orchestration/run-configuration.ts";

vi.mock(import("#/observation/harness.ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  runClaude: vi.fn(),
}));

const runClaudeMock = vi.mocked(runClaude);

const CASE_BUDGET_USD = 1.25;
const CASE_WALL_CLOCK_MS = 42_000;
const FIXTURE_CWD = "/fixture/repo";
const FIXTURE_GIT_REPO = "/fixture/git-repo";
const FIXTURE_MISSING_PATH = "/fixture/missing";
const FIXTURE_NOT_GIT_PATH = "/fixture/not-git";

function selectedCase(overrides: Partial<EvalCase> = {}): EvalCase {
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
    ...overrides,
  };
}

function testFixture(
  cleanup: Fixture["cleanup"],
  gitRepo: string | undefined = FIXTURE_GIT_REPO,
): Fixture {
  return {
    cwd: FIXTURE_CWD,
    gitRepo,
    missingPath: FIXTURE_MISSING_PATH,
    notGitPath: FIXTURE_NOT_GIT_PATH,
    cleanup,
  };
}

function testFixtureWithoutGit(cleanup: Fixture["cleanup"]): Fixture {
  return { ...testFixture(cleanup), gitRepo: undefined };
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

function fixtureLayer(fixture: Fixture) {
  return Layer.succeed(
    FixtureProvisioner,
    FixtureProvisioner.of({
      make: () => Effect.succeed(fixture),
      cleanup: (fixtureToClean) =>
        Effect.try({
          try: fixtureToClean.cleanup,
          catch: (cause) => new FixtureCleanupError({ cause }),
        }),
    }),
  );
}

async function runSelectedCase(evalCase: EvalCase, fixture: Fixture) {
  return Effect.runPromise(
    executeCase(evalCase).pipe(
      Effect.provide(fixtureLayer(fixture)),
      Effect.provide(ObservationRunnerLive),
      Effect.provide(
        Layer.succeed(
          EvalConfiguration,
          EvalConfiguration.of({ model: evalModel }),
        ),
      ),
    ),
  );
}

afterEach(() => {
  vi.resetAllMocks();
});

test("the selected case configuration and fixture context reach runClaude", async () => {
  const cleanup = vi.fn<Fixture["cleanup"]>();
  runClaudeMock.mockResolvedValue(resolvedObservation());

  await runSelectedCase(selectedCase(), testFixture(cleanup));

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

test("cwd is sampled when the fixture declares no git repository", async () => {
  runClaudeMock.mockResolvedValue(resolvedObservation());

  await runSelectedCase(
    selectedCase(),
    testFixtureWithoutGit(vi.fn<Fixture["cleanup"]>(() => undefined)),
  );

  expect(runClaudeMock).toHaveBeenCalledWith(
    expect.objectContaining({ gitRepo: FIXTURE_CWD }),
  );
});

test("fixture cleanup runs after runClaude resolves", async () => {
  const cleanup = vi.fn<Fixture["cleanup"]>();
  runClaudeMock.mockResolvedValue(resolvedObservation());

  await runSelectedCase(selectedCase(), testFixture(cleanup));

  expect(cleanup).toHaveBeenCalledOnce();
});

test("fixture cleanup runs and the rejection remains the observation error cause", async () => {
  const cleanup = vi.fn<Fixture["cleanup"]>();
  const runFailure = new Error("runClaude rejected");
  runClaudeMock.mockRejectedValue(runFailure);

  await expect(
    runSelectedCase(selectedCase(), testFixture(cleanup)),
  ).rejects.toMatchObject({ cause: runFailure });
  expect(cleanup).toHaveBeenCalledOnce();
});

test("prompt construction failure cleans the fixture and bypasses runClaude", async () => {
  const cleanup = vi.fn<Fixture["cleanup"]>();
  const promptFailure = new Error("prompt broke");
  const evalCase = selectedCase({
    prompt: () => {
      throw promptFailure;
    },
  });

  await expect(
    runSelectedCase(evalCase, testFixture(cleanup)),
  ).rejects.toMatchObject({ cause: promptFailure });
  expect(cleanup).toHaveBeenCalledOnce();
  expect(runClaudeMock).not.toHaveBeenCalled();
});

test("a failed check becomes row data and retains measured cost and duration", async () => {
  const cleanup = vi.fn<Fixture["cleanup"]>();
  runClaudeMock.mockResolvedValue(resolvedObservation());

  const execution = await runSelectedCase(
    selectedCase({
      check: () => {
        throw new Error("check failed\nextra detail");
      },
    }),
    testFixture(cleanup),
  );

  expect(execution.result).toMatchObject({
    status: "FAIL",
    observed: "check failed",
    costUsd: resolvedObservation().costUsd,
    durationMs: resolvedObservation().durationMs,
  });
  expect(cleanup).toHaveBeenCalledOnce();
});

test("cleanup failure replaces a successful case result", async () => {
  const cleanupFailure = new Error("cleanup broke");
  runClaudeMock.mockResolvedValue(resolvedObservation());

  await expect(
    runSelectedCase(
      selectedCase(),
      testFixture(() => {
        throw cleanupFailure;
      }),
    ),
  ).rejects.toMatchObject({ cause: cleanupFailure });
});

test("cleanup failure replaces an earlier observation rejection", async () => {
  const runFailure = new Error("runClaude rejected");
  const cleanupFailure = new Error("cleanup broke");
  runClaudeMock.mockRejectedValue(runFailure);

  await expect(
    runSelectedCase(
      selectedCase(),
      testFixture(() => {
        throw cleanupFailure;
      }),
    ),
  ).rejects.toMatchObject({ cause: cleanupFailure });
});
