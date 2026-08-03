import { Data, Effect, Stream } from "effect";
import * as z from "zod";

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
import type { Observation, ToolCall } from "#/observation/observation-types.ts";

/**
 * Tool inputs cross the SDK boundary as `unknown` -- their shape is decided
 * by the model, not the type system. A malformed input degrades to `{}`
 * rather than discarding the call: the call's existence is the fact cases
 * assert on, and `mutationEvidence` already treats an unreadable input as
 * unverifiable rather than clean.
 */
// eslint-disable-next-line zod/prefer-string-schema-with-trim -- SDK identifiers, answers, and diagnostics must be retained verbatim.
const untrimmedStringSchema = z.string();
const toolInputSchema = z.record(untrimmedStringSchema, z.unknown()).catch({});

const streamMessageDiscriminatorSchema = z.object({
  type: untrimmedStringSchema,
});
const assistantMessageSchema = z.object({
  type: z.literal("assistant"),
  message: z.object({ content: z.array(z.unknown()) }),
});
const contentBlockDiscriminatorSchema = z.object({
  type: untrimmedStringSchema,
});
const toolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  name: untrimmedStringSchema,
  input: z.unknown(),
});
const successfulResultMessageSchema = z.object({
  type: z.literal("result"),
  subtype: z.literal("success"),
  is_error: z.boolean(),
  result: untrimmedStringSchema,
  total_cost_usd: z.number(),
});
const failedResultMessageSchema = z.object({
  type: z.literal("result"),
  subtype: untrimmedStringSchema,
  is_error: z.boolean(),
  errors: z.array(untrimmedStringSchema),
  total_cost_usd: z.number(),
});

export type ResultVerdict = Pick<
  Observation,
  "subtype" | "isError" | "finalText" | "costUsd"
>;

class ResultObserved extends Data.TaggedError("ResultObserved")<{
  readonly verdict: ResultVerdict;
}> {}

export interface QueryAccumulator {
  readonly getResultVerdict: () => ResultVerdict | null;
  readonly recordResultVerdict: (verdict: ResultVerdict) => void;
  readonly toolCalls: ToolCall[];
}

type QueryFailure =
  | QueryStartError
  | QueryStreamError
  | SdkMessageValidationError;

type NormalizedStreamMessage =
  | { kind: "ignored" }
  | { kind: "assistant" }
  | { kind: "result"; verdict: ResultVerdict };

/** Relevant SDK messages, validated and reduced to the fields observed here. */
function normalizeStreamMessage(
  message: unknown,
  observedToolCalls: ToolCall[],
): NormalizedStreamMessage {
  const parsedDiscriminator =
    streamMessageDiscriminatorSchema.safeParse(message);
  if (!parsedDiscriminator.success) return { kind: "ignored" };

  if (parsedDiscriminator.data.type === "assistant") {
    const assistantMessage = assistantMessageSchema.parse(message);
    const messageToolCalls: ToolCall[] = [];

    for (const contentBlock of assistantMessage.message.content) {
      // A relevant assistant message fails closed when any content entry lacks
      // the minimum SDK block shape. Its calls are committed only after every
      // entry validates, preserving the message-level atomicity of the SDK.
      const blockDiscriminator =
        contentBlockDiscriminatorSchema.parse(contentBlock);
      if (blockDiscriminator.type === "tool_use") {
        const toolUseBlock = toolUseBlockSchema.parse(contentBlock);
        messageToolCalls.push({
          name: toolUseBlock.name,
          input: toolInputSchema.parse(toolUseBlock.input),
        });
      }
    }

    observedToolCalls.push(...messageToolCalls);
    return { kind: "assistant" };
  }

  if (parsedDiscriminator.data.type === "result") {
    const parsedSubtype = z
      .object({ subtype: untrimmedStringSchema })
      .parse(message);
    if (parsedSubtype.subtype === "success") {
      const resultMessage = successfulResultMessageSchema.parse(message);
      return {
        kind: "result",
        verdict: {
          subtype: resultMessage.subtype,
          isError: resultMessage.is_error,
          finalText: resultMessage.result,
          costUsd: resultMessage.total_cost_usd,
        },
      };
    }

    const resultMessage = failedResultMessageSchema.parse(message);
    return {
      kind: "result",
      verdict: {
        subtype: resultMessage.subtype,
        isError: resultMessage.is_error,
        // Error results carry diagnostics instead of an answer. Joining them
        // keeps auth and execution failures readable in a case failure.
        finalText: resultMessage.errors.join("\n"),
        costUsd: resultMessage.total_cost_usd,
      },
    };
  }

  return { kind: "ignored" };
}

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
    const normalizedMessage = yield* Effect.try({
      try: () => normalizeStreamMessage(message, accumulator.toolCalls),
      catch: (cause) => new SdkMessageValidationError({ cause }),
    });
    if (normalizedMessage.kind === "result") {
      accumulator.recordResultVerdict(normalizedMessage.verdict);
      return yield* new ResultObserved({
        verdict: normalizedMessage.verdict,
      });
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
        next: async () => {
          const nextMessage = await iterator.next();
          return nextMessage;
        },
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
): Effect.Effect<ResultVerdict | undefined, QueryFailure, AgentQuery> {
  return Effect.gen(function* () {
    const agentQuery = yield* AgentQuery;
    const messages = yield* agentQuery.start(request);
    return yield* Stream.fromAsyncIterable(
      preserveObservedResultDuringCleanup(messages, accumulator),
      (cause) => new QueryStreamError({ cause }),
    ).pipe(
      Stream.runForEach((message) => observeSdkMessage(message, accumulator)),
      Effect.as(undefined),
      Effect.catchTag("ResultObserved", (error) =>
        Effect.succeed(error.verdict),
      ),
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
