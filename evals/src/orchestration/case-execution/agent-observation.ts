// The one seam in orchestration that reaches the Agent SDK. Everything paid
// happens behind this service, so tests can replace it with a local layer.

import { Context, Data, Effect, Layer } from "effect";

import { observeClaude } from "#/observation/agent-query.ts";
import { AgentQueryLive } from "#/observation/agent-query-service.ts";
import { GitSamplerLive } from "#/observation/git-status.ts";
import type {
  Observation,
  RunOptions,
} from "#/observation/observation-types.ts";

export class ObservationRunError extends Data.TaggedError(
  "ObservationRunError",
)<{
  readonly cause: unknown;
}> {}

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
