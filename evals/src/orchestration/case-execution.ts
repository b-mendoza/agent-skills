import { Context, Data, Effect, Layer } from "effect";

import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import type {
  Fixture,
  FixtureCleanupError,
  FixtureProvisioningError,
} from "#/fixtures/fixtures.ts";
import {
  FixtureProvisioner,
  FixtureProvisionerLive,
} from "#/fixtures/fixtures.ts";
import type { Observation, RunOptions } from "#/observation/harness.ts";
import {
  AgentQueryLive,
  GitSamplerLive,
  observeClaude,
} from "#/observation/harness.ts";
import type { ReportTier, Result } from "#/orchestration/report.ts";
import {
  EvalConfiguration,
  EvalConfigurationLive,
} from "#/orchestration/run-configuration.ts";

/** A report cell holds one line; a longer assertion message is truncated. */
const MAX_OBSERVED_CHARS = 160;
const ROUTING_TIER = 1;
const BEHAVIORAL_TIER = 2;

const REPORT_TIER_BY_CASE_TIER = {
  [ROUTING_TIER]: "1",
  [BEHAVIORAL_TIER]: "2",
} as const satisfies Record<CaseTier, ReportTier>;

export interface CaseExecutionResult {
  result: Result;
  observation: Observation;
}

export class CaseFixtureAcquisitionError extends Data.TaggedError(
  "CaseFixtureAcquisitionError",
)<{
  readonly cause: unknown;
  readonly fixtureError: FixtureProvisioningError;
}> {}

export class CaseFixtureCleanupError extends Data.TaggedError(
  "CaseFixtureCleanupError",
)<{
  readonly cause: unknown;
  readonly fixtureError: FixtureCleanupError;
}> {}

export class PromptConstructionError extends Data.TaggedError(
  "PromptConstructionError",
)<{
  readonly cause: unknown;
}> {}

export class ObservationRunError extends Data.TaggedError(
  "ObservationRunError",
)<{
  readonly cause: unknown;
}> {}

class CaseCheckError extends Data.TaggedError("CaseCheckError")<{
  readonly cause: unknown;
}> {}

export type CaseExecutionError =
  | CaseFixtureAcquisitionError
  | CaseFixtureCleanupError
  | PromptConstructionError
  | ObservationRunError;

export interface ObservationRunner {
  readonly run: (
    options: RunOptions,
  ) => Effect.Effect<Observation, ObservationRunError>;
}

export const ObservationRunner = Context.Service<ObservationRunner>(
  "evals/orchestration/ObservationRunner",
);

export const ObservationRunnerLive = Layer.succeed(
  ObservationRunner,
  ObservationRunner.of({
    run: (options) =>
      observeClaude(options).pipe(
        Effect.provide(AgentQueryLive),
        Effect.provide(GitSamplerLive),
      ),
  }),
);

function normalizeCheckFailure(cause: unknown): {
  status: Result["status"];
  observed: string;
} {
  const normalizedError =
    cause instanceof Error
      ? cause
      : new Error("An unknown error occurred", { cause });
  const [firstLine = ""] = normalizedError.message.split("\n");

  return {
    status: "FAIL",
    observed: firstLine.slice(0, MAX_OBSERVED_CHARS),
  };
}

/** Runs a check, turning a thrown assertion into a FAIL row. */
export function evaluate(check: () => string): {
  status: Result["status"];
  observed: string;
} {
  try {
    return { status: "PASS", observed: check() };
  } catch (cause) {
    return normalizeCheckFailure(cause);
  }
}

function evaluateCheck(check: () => string) {
  return Effect.try({
    try: check,
    catch: (cause) => new CaseCheckError({ cause }),
  }).pipe(
    Effect.match({
      onFailure: (error) => normalizeCheckFailure(error.cause),
      onSuccess: (observed) => ({
        status: "PASS" as const,
        observed,
      }),
    }),
  );
}

function acquireFixture(
  fixtureProvisioner: FixtureProvisioner,
  evalCase: EvalCase,
) {
  return fixtureProvisioner.make(evalCase.fixture, SKILL).pipe(
    Effect.matchEffect({
      onFailure: (fixtureError) =>
        Effect.fail(
          new CaseFixtureAcquisitionError({
            cause: fixtureError.cause,
            fixtureError,
          }),
        ),
      onSuccess: Effect.succeed,
    }),
  );
}

function releaseFixture(
  fixtureProvisioner: FixtureProvisioner,
  fixture: Fixture,
) {
  return fixtureProvisioner.cleanup(fixture).pipe(
    Effect.matchEffect({
      onFailure: (fixtureError) =>
        Effect.fail(
          new CaseFixtureCleanupError({
            cause: fixtureError.cause,
            fixtureError,
          }),
        ),
      onSuccess: Effect.succeed,
    }),
  );
}

function constructPrompt(evalCase: EvalCase, fixture: Fixture) {
  return Effect.try({
    try: () =>
      evalCase.prompt({
        missingPath: fixture.missingPath,
        notGitPath: fixture.notGitPath,
      }),
    catch: (cause) => new PromptConstructionError({ cause }),
  });
}

function executeWithFixture(
  evalCase: EvalCase,
  fixture: Fixture,
  observationRunner: ObservationRunner,
  model: string,
) {
  return Effect.gen(function* () {
    const prompt = yield* constructPrompt(evalCase, fixture);
    const observation = yield* observationRunner.run({
      cwd: fixture.cwd,
      gitRepo: fixture.gitRepo ?? fixture.cwd,
      prompt,
      budgetUsd: evalCase.budgetUsd,
      model,
      wallClockMs: evalCase.wallClockMs,
    });
    const { status, observed } = yield* evaluateCheck(() =>
      evalCase.check(observation),
    );

    return {
      result: {
        id: evalCase.id,
        tier: REPORT_TIER_BY_CASE_TIER[evalCase.tier],
        status,
        observed,
        costUsd: observation.costUsd,
        durationMs: observation.durationMs,
      },
      observation,
    };
  });
}

export function executeCase(evalCase: EvalCase) {
  return Effect.gen(function* () {
    const fixtureProvisioner = yield* FixtureProvisioner;
    const observationRunner = yield* ObservationRunner;
    const configuration = yield* EvalConfiguration;

    return yield* Effect.acquireUseRelease(
      acquireFixture(fixtureProvisioner, evalCase),
      (fixture) =>
        executeWithFixture(
          evalCase,
          fixture,
          observationRunner,
          configuration.model,
        ),
      (fixture) => releaseFixture(fixtureProvisioner, fixture),
    );
  });
}

export const executeCaseLive = (evalCase: EvalCase) =>
  executeCase(evalCase).pipe(
    Effect.provide(FixtureProvisionerLive),
    Effect.provide(ObservationRunnerLive),
    Effect.provide(EvalConfigurationLive),
  );
