import { Data, Effect } from "effect";

import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import {
  BEHAVIORAL_TIER,
  ROUTING_TIER,
  SKILL,
} from "#/cases/analyzing-recent-project-state.ts";
import type {
  FixtureCleanupError,
  FixtureProvisioningError,
} from "#/fixtures/fixture-errors.ts";
import type { Fixture } from "#/fixtures/fixtures.ts";
import {
  FixtureProvisioner,
  FixtureProvisionerLive,
} from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/observation-types.ts";
import type { ObservationRunError } from "#/orchestration/case-execution/agent-observation.ts";
import {
  ObservationRunner,
  ObservationRunnerLive,
} from "#/orchestration/case-execution/agent-observation.ts";
import {
  FailureArtifacts,
  FailureArtifactsLive,
} from "#/orchestration/case-execution/failure-artifacts.ts";
import {
  EvalConfiguration,
  EvalConfigurationLive,
} from "#/orchestration/case-execution/model-configuration.ts";
import type {
  AttemptResult,
  AttemptStatus,
  ReportTier,
} from "#/orchestration/report.ts";
import { evaluate, evaluateWithJudge } from "#/orchestration/verdict.ts";

export const REPORT_TIER_BY_CASE_TIER = {
  [ROUTING_TIER]: "1",
  [BEHAVIORAL_TIER]: "2",
} as const satisfies Record<CaseTier, ReportTier>;

/** One attempt at one case; the suite aggregates attempts into report rows. */
export interface CaseExecutionResult {
  result: AttemptResult;
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

export type CaseExecutionError =
  | CaseFixtureAcquisitionError
  | CaseFixtureCleanupError
  | PromptConstructionError
  | ObservationRunError;

function acquireFixture(
  fixtureProvisioner: FixtureProvisioner,
  evalCase: EvalCase,
) {
  return fixtureProvisioner.make(evalCase.fixture, SKILL).pipe(
    Effect.mapError(
      (fixtureError) =>
        new CaseFixtureAcquisitionError({
          cause: fixtureError.cause,
          fixtureError,
        }),
    ),
  );
}

function releaseFixture(
  fixtureProvisioner: FixtureProvisioner,
  fixture: Fixture,
) {
  return fixtureProvisioner.cleanup(fixture).pipe(
    Effect.mapError(
      (fixtureError) =>
        new CaseFixtureCleanupError({
          cause: fixtureError.cause,
          fixtureError,
        }),
    ),
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

interface CaseExecutionServices {
  readonly observationRunner: ObservationRunner;
  readonly failureArtifacts: FailureArtifacts;
  readonly model: string;
}

function shouldRunJudge(
  mechanicalStatus: AttemptStatus,
  judge: EvalCase["judge"],
): judge is NonNullable<EvalCase["judge"]> {
  return mechanicalStatus === "PASS" && judge !== undefined;
}

function executeWithFixture(
  evalCase: EvalCase,
  fixture: Fixture,
  { observationRunner, failureArtifacts, model }: CaseExecutionServices,
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
    const mechanical = evaluate(() => evalCase.check(observation));
    const { judge } = evalCase;
    const { status, observed } = shouldRunJudge(mechanical.status, judge)
      ? yield* Effect.promise(async () =>
          evaluateWithJudge(judge, observation, mechanical.observed),
        )
      : mechanical;
    if (status === "FAIL") {
      yield* failureArtifacts.persist(evalCase.id, observation.finalText);
    }

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
    const failureArtifacts = yield* FailureArtifacts;
    const configuration = yield* EvalConfiguration;

    return yield* Effect.acquireUseRelease(
      acquireFixture(fixtureProvisioner, evalCase),
      (fixture) =>
        executeWithFixture(evalCase, fixture, {
          observationRunner,
          failureArtifacts,
          model: configuration.model,
        }),
      (fixture) => releaseFixture(fixtureProvisioner, fixture),
    );
  });
}

export const executeCaseLive = (evalCase: EvalCase) =>
  executeCase(evalCase).pipe(
    Effect.provide(FixtureProvisionerLive),
    Effect.provide(ObservationRunnerLive),
    Effect.provide(FailureArtifactsLive),
    Effect.provide(EvalConfigurationLive),
  );
