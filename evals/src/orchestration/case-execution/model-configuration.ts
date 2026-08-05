import { Context, Layer } from "effect";

const DEFAULT_MODEL = "sonnet";

export function resolveModel(configuredModel: string | undefined): string {
  // An empty EVAL_MODEL is an unset EVAL_MODEL, not a request for a nameless model.
  return configuredModel === undefined || configuredModel === ""
    ? DEFAULT_MODEL
    : configuredModel;
}

export const evalModel = resolveModel(process.env["EVAL_MODEL"]);

export interface EvalConfiguration {
  readonly model: string;
}

export const EvalConfiguration = Context.Service<EvalConfiguration>(
  "evals/orchestration/EvalConfiguration",
);

export const EvalConfigurationLive = Layer.succeed(
  EvalConfiguration,
  EvalConfiguration.of({ model: evalModel }),
);
