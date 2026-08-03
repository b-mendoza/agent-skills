import { query } from "@anthropic-ai/claude-agent-sdk";
import { Context, Data, Effect, Layer } from "effect";

export type AgentQueryRequest = Parameters<typeof query>[0];

export class QueryStartError extends Data.TaggedError("QueryStartError")<{
  readonly cause: unknown;
}> {}

export class QueryStreamError extends Data.TaggedError("QueryStreamError")<{
  readonly cause: unknown;
}> {}

export class SdkMessageValidationError extends Data.TaggedError(
  "SdkMessageValidationError",
)<{
  readonly cause: unknown;
}> {}

export interface AgentQuery {
  readonly start: (
    request: AgentQueryRequest,
  ) => Effect.Effect<AsyncIterable<unknown>, QueryStartError>;
}

export const AgentQuery = Context.Service<AgentQuery>(
  "evals/observation/AgentQuery",
);

export const AgentQueryLive = Layer.succeed(
  AgentQuery,
  AgentQuery.of({
    start: (request) =>
      Effect.try({
        try: () => query(request),
        catch: (cause) => new QueryStartError({ cause }),
      }),
  }),
);
