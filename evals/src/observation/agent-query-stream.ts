import { Data, Effect, Stream } from "effect";

import { normalizeStreamMessage } from "#/observation/agent-query-messages.ts";
import type {
  AgentQueryRequest,
  QueryStartError,
} from "#/observation/agent-query-service.ts";
import {
  AgentQuery,
  QueryStreamError,
  SdkMessageValidationError,
} from "#/observation/agent-query-service.ts";
import { toText } from "#/observation/git-status.ts";
import type {
  ResultVerdict,
  ToolCall,
} from "#/observation/observation-types.ts";

/** Signals that a result message settled the stream, so iteration stops. */
class ResultObserved extends Data.TaggedError("ResultObserved") {}

export interface QueryAccumulator {
  readonly getResultVerdict: () => ResultVerdict | null;
  readonly recordResultVerdict: (verdict: ResultVerdict) => void;
  readonly toolCalls: ToolCall[];
}

type QueryFailure =
  | QueryStartError
  | QueryStreamError
  | SdkMessageValidationError;

/** What a run without a result message can still say about why. */
export function failureText(failure: unknown): string {
  if (failure == null) return "query ended without a result message";
  return failure instanceof Error ? failure.message : toText(failure);
}

function observeSdkMessage(
  message: unknown,
  accumulator: QueryAccumulator,
): Effect.Effect<void, SdkMessageValidationError | ResultObserved> {
  return Effect.gen(function* () {
    const resultVerdict = yield* Effect.try({
      try: () => normalizeStreamMessage(message, accumulator.toolCalls),
      catch: (cause) => new SdkMessageValidationError({ cause }),
    });
    if (resultVerdict !== null) {
      accumulator.recordResultVerdict(resultVerdict);
      return yield* new ResultObserved();
    }
  });
}

function preserveObservedResultDuringCleanup(
  messages: AsyncIterable<unknown>,
  accumulator: QueryAccumulator,
): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]: () => {
      const iterator = messages[Symbol.asyncIterator]();
      return {
        next: async () => iterator.next(),
        return: async () => {
          if (iterator.return === undefined) {
            return { done: true, value: undefined };
          }
          try {
            return await iterator.return();
          } catch (cleanupError) {
            // The legacy loop recorded a result before `break`; a failing
            // iterator cleanup therefore could not replace that verdict.
            if (accumulator.getResultVerdict() !== null) {
              return { done: true, value: undefined };
            }
            throw cleanupError;
          }
        },
      };
    },
  };
}

function consumeQueryMessages(
  request: AgentQueryRequest,
  accumulator: QueryAccumulator,
): Effect.Effect<void, QueryFailure, AgentQuery> {
  return Effect.gen(function* () {
    const agentQuery = yield* AgentQuery;
    const messages = yield* agentQuery.start(request);
    return yield* Stream.fromAsyncIterable(
      preserveObservedResultDuringCleanup(messages, accumulator),
      (cause) => new QueryStreamError({ cause }),
    ).pipe(
      Stream.runForEach((message) => observeSdkMessage(message, accumulator)),
      Effect.asVoid,
      Effect.catchTag("ResultObserved", () => Effect.void),
    );
  });
}

interface QuerySettlement {
  readonly failure: unknown;
  readonly resultVerdict: ResultVerdict | null;
}

export function settleQuery(
  request: AgentQueryRequest,
  accumulator: QueryAccumulator,
): Effect.Effect<QuerySettlement, never, AgentQuery> {
  return consumeQueryMessages(request, accumulator).pipe(
    Effect.match({
      onFailure: (error) => {
        const resultVerdict = accumulator.getResultVerdict();
        return {
          failure: resultVerdict === null ? error.cause : null,
          resultVerdict,
        };
      },
      onSuccess: () => ({
        failure: null,
        resultVerdict: accumulator.getResultVerdict(),
      }),
    }),
  );
}
