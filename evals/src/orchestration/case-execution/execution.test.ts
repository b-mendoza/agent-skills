// Pins the real case-execution boundary: the fixture kind and skill reach the
// provisioner, fixture context and configured limits reach the observation
// harness, and fixture cleanup survives every settlement.
//
// The fixture and harness boundaries are replaced with local layers, so these
// tests spend no tokens and write no report file.
//
//   pnpm test

import { Effect, Layer } from "effect";
import { afterEach, expect, test, vi } from "vitest";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import type { FixtureProvisioningError } from "#/fixtures/fixture-errors.ts";
import {
  FixtureCleanupError,
  FixtureTempDirectoryError,
} from "#/fixtures/fixture-errors.ts";
import type { Fixture } from "#/fixtures/fixtures.ts";
import { FixtureProvisioner } from "#/fixtures/fixtures.ts";
import { observeClaude } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import type { Observation } from "#/observation/observation-types.ts";
import { ObservationRunnerLive } from "#/orchestration/case-execution/agent-observation.ts";
import {
  CaseFixtureAcquisitionError,
  executeCase,
} from "#/orchestration/case-execution/execution.ts";
import {
  FailureArtifacts,
  FailureArtifactsNoop,
} from "#/orchestration/case-execution/failure-artifacts.ts";
import { EvalConfiguration } from "#/orchestration/case-execution/model-configuration.ts";

vi.mock(import("#/observation/agent-query.ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  observeClaude: vi.fn(),
}));

const observeClaudeMock = vi.mocked(observeClaude);

/**
 * A model no production path can produce. If `executeCase` ever stops reading
 * the model from `EvalConfiguration`, the wiring assertion below fails instead
 * of silently agreeing with whatever the environment resolved.
 */
const SENTINEL_MODEL = "sentinel-model-not-evalModel";
const SELECTED_CASE_ID = "boundary-case";
const SELECTED_CASE_FIXTURE_KIND = "dirty";
const CASE_BUDGET_USD = 1.25;
const CASE_WALL_CLOCK_MS = 42_000;
const FIXTURE_CWD = "/fixture/repo";
const FIXTURE_GIT_REPO = "/fixture/git-repo";
const FIXTURE_MISSING_PATH = "/fixture/missing";
const FIXTURE_NOT_GIT_PATH = "/fixture/not-git";

type FixtureProvisioning = Effect.Effect<Fixture, FixtureProvisioningError>;

const provisionFixtureMock = vi.fn<FixtureProvisioner["make"]>();
const releaseFixtureMock = vi.fn<FixtureProvisioner["cleanup"]>();

function selectedCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: SELECTED_CASE_ID,
    tier: 2,
    fixture: SELECTED_CASE_FIXTURE_KIND,
    intent: "case execution boundary test",
    prompt: ({ missingPath, notGitPath }) =>
      `missing=${missingPath}; not-git=${notGitPath}`,
    budgetUsd: CASE_BUDGET_USD,
    wallClockMs: CASE_WALL_CLOCK_MS,
    check: () => "check passed",
    ...overrides,
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

function testFixtureWithoutGit(cleanup: Fixture["cleanup"]): Fixture {
  return { ...testFixture(cleanup), gitRepo: undefined };
}

function resolvedObservation(): Observation {
  return createObservation({
    finalText: "observed",
    costUsd: 0.2,
    durationMs: 125,
  });
}

/** Records what the case asked the provisioner for, and how it released it. */
function fixtureLayer(fixtureProvisioning: FixtureProvisioning) {
  provisionFixtureMock.mockReturnValue(fixtureProvisioning);
  releaseFixtureMock.mockImplementation((fixtureToClean) =>
    Effect.try({
      try: fixtureToClean.cleanup,
      catch: (cause) => new FixtureCleanupError({ cause }),
    }),
  );

  return Layer.succeed(
    FixtureProvisioner,
    FixtureProvisioner.of({
      make: provisionFixtureMock,
      cleanup: releaseFixtureMock,
    }),
  );
}

async function runCaseWithProvisioning(
  evalCase: EvalCase,
  fixtureProvisioning: FixtureProvisioning,
  failureArtifactsLayer: Layer.Layer<FailureArtifacts> = FailureArtifactsNoop,
) {
  return Effect.runPromise(
    executeCase(evalCase).pipe(
      Effect.provide(fixtureLayer(fixtureProvisioning)),
      Effect.provide(ObservationRunnerLive),
      Effect.provide(failureArtifactsLayer),
      Effect.provide(
        Layer.succeed(
          EvalConfiguration,
          EvalConfiguration.of({ model: SENTINEL_MODEL }),
        ),
      ),
    ),
  );
}

async function runSelectedCase(evalCase: EvalCase, fixture: Fixture) {
  return runCaseWithProvisioning(evalCase, Effect.succeed(fixture));
}

afterEach(() => {
  vi.resetAllMocks();
});

test("the selected case configuration and fixture context reach observeClaude", async () => {
  const cleanup = vi.fn<Fixture["cleanup"]>();
  observeClaudeMock.mockReturnValue(Effect.succeed(resolvedObservation()));

  await runSelectedCase(selectedCase(), testFixture(cleanup));

  expect(provisionFixtureMock).toHaveBeenCalledExactlyOnceWith(
    SELECTED_CASE_FIXTURE_KIND,
    SKILL,
  );
  expect(observeClaudeMock).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      cwd: FIXTURE_CWD,
      gitRepo: FIXTURE_GIT_REPO,
      prompt: `missing=${FIXTURE_MISSING_PATH}; not-git=${FIXTURE_NOT_GIT_PATH}`,
      budgetUsd: CASE_BUDGET_USD,
      model: SENTINEL_MODEL,
      wallClockMs: CASE_WALL_CLOCK_MS,
    }),
  );
  expect(cleanup).toHaveBeenCalledOnce();
});

test("cwd is sampled when the fixture declares no git repository", async () => {
  observeClaudeMock.mockReturnValue(Effect.succeed(resolvedObservation()));

  await runSelectedCase(
    selectedCase(),
    testFixtureWithoutGit(vi.fn<Fixture["cleanup"]>(() => undefined)),
  );

  expect(observeClaudeMock).toHaveBeenCalledWith(
    expect.objectContaining({ gitRepo: FIXTURE_CWD }),
  );
});

test("a fixture that never provisions fails the case and releases nothing", async () => {
  const acquisitionCause = new Error("fixture root creation broke");
  const fixtureError = new FixtureTempDirectoryError({
    cause: acquisitionCause,
  });

  const caseExecution = runCaseWithProvisioning(
    selectedCase(),
    Effect.fail(fixtureError),
  );

  await expect(caseExecution).rejects.toBeInstanceOf(
    CaseFixtureAcquisitionError,
  );
  await expect(caseExecution).rejects.toMatchObject({
    cause: acquisitionCause,
    fixtureError,
  });
  expect(observeClaudeMock).not.toHaveBeenCalled();
  expect(releaseFixtureMock).not.toHaveBeenCalled();
});

test("fixture cleanup runs and the observation defect remains intact", async () => {
  const cleanup = vi.fn<Fixture["cleanup"]>();
  const observationDefect = new Error("observeClaude defect");
  observeClaudeMock.mockReturnValue(Effect.die(observationDefect));

  await expect(
    runSelectedCase(selectedCase(), testFixture(cleanup)),
  ).rejects.toBe(observationDefect);
  expect(cleanup).toHaveBeenCalledOnce();
});

test("prompt construction failure cleans the fixture and bypasses observeClaude", async () => {
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
  expect(observeClaudeMock).not.toHaveBeenCalled();
});

test("a failed check becomes row data and retains measured cost and duration", async () => {
  const cleanup = vi.fn<Fixture["cleanup"]>();
  observeClaudeMock.mockReturnValue(Effect.succeed(resolvedObservation()));

  const execution = await runSelectedCase(
    selectedCase({
      check: () => {
        throw new Error("check failed\nextra detail");
      },
    }),
    testFixture(cleanup),
  );

  expect(execution.result).toMatchObject({
    id: SELECTED_CASE_ID,
    // The behavioral case tier reaches the report as the `2` column.
    tier: "2",
    status: "FAIL",
    observed: "check failed",
    costUsd: resolvedObservation().costUsd,
    durationMs: resolvedObservation().durationMs,
  });
  expect(cleanup).toHaveBeenCalledOnce();
});

test.each<{
  label: string;
  check: EvalCase["check"];
  expectedPersisted: readonly string[];
}>([
  {
    label: "a failing check persists the observed final text",
    check: () => {
      throw new Error("check failed");
    },
    expectedPersisted: [`${SELECTED_CASE_ID}:observed`],
  },
  {
    label: "a passing check persists nothing",
    check: () => "check passed",
    expectedPersisted: [],
  },
])("$label", async ({ check, expectedPersisted }) => {
  const persisted: string[] = [];
  const recordingLayer = Layer.succeed(
    FailureArtifacts,
    FailureArtifacts.of({
      persist: (caseId, finalText) => {
        persisted.push(`${caseId}:${finalText}`);
        return Effect.succeed("/recorded/path");
      },
    }),
  );
  observeClaudeMock.mockReturnValue(Effect.succeed(resolvedObservation()));

  await runCaseWithProvisioning(
    selectedCase({ check }),
    Effect.succeed(testFixture(vi.fn<Fixture["cleanup"]>())),
    recordingLayer,
  );

  expect(persisted).toStrictEqual(expectedPersisted);
});

test("a judge runs after a passing check and its verdict joins the row", async () => {
  observeClaudeMock.mockReturnValue(Effect.succeed(resolvedObservation()));

  const execution = await runSelectedCase(
    selectedCase({
      judge: async () => {
        await Promise.resolve();
        return "judge: clean";
      },
    }),
    testFixture(vi.fn<Fixture["cleanup"]>()),
  );

  expect(execution.result).toMatchObject({
    status: "PASS",
    observed: "check passed; judge: clean",
  });
});

test("a judge failure becomes a FAIL attempt naming the judge", async () => {
  observeClaudeMock.mockReturnValue(Effect.succeed(resolvedObservation()));

  const execution = await runSelectedCase(
    selectedCase({
      judge: async () => {
        await Promise.resolve();
        throw new Error("judge: grounding violated");
      },
    }),
    testFixture(vi.fn<Fixture["cleanup"]>()),
  );

  expect(execution.result).toMatchObject({
    status: "FAIL",
    observed: "judge: grounding violated",
  });
});

test("the judge is skipped when the mechanical check fails", async () => {
  const judgeMock = vi.fn<NonNullable<EvalCase["judge"]>>();
  observeClaudeMock.mockReturnValue(Effect.succeed(resolvedObservation()));

  const execution = await runSelectedCase(
    selectedCase({
      check: () => {
        throw new Error("mechanical check failed");
      },
      judge: judgeMock,
    }),
    testFixture(vi.fn<Fixture["cleanup"]>()),
  );

  expect(execution.result).toMatchObject({ status: "FAIL" });
  expect(judgeMock).not.toHaveBeenCalled();
});

test.each<{
  label: string;
  observationOutcome: ReturnType<typeof observeClaude>;
}>([
  {
    label: "a successful case result",
    observationOutcome: Effect.succeed(resolvedObservation()),
  },
  {
    label: "an earlier observation defect",
    observationOutcome: Effect.die(new Error("observeClaude defect")),
  },
])("cleanup failure replaces $label", async ({ observationOutcome }) => {
  const cleanupFailure = new Error("cleanup broke");
  observeClaudeMock.mockReturnValue(observationOutcome);

  await expect(
    runSelectedCase(
      selectedCase(),
      testFixture(() => {
        throw cleanupFailure;
      }),
    ),
  ).rejects.toMatchObject({ cause: cleanupFailure });
});
