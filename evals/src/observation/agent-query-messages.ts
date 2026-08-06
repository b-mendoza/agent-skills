import { Effect, Exit, Option, Schema } from "effect";

import type {
  ResultVerdict,
  ToolCall,
} from "#/observation/observation-types.ts";

/**
 * Tool inputs cross the SDK boundary as `unknown` -- their shape is decided
 * by the model, not the type system. A malformed input degrades to `{}`
 * rather than discarding the call: the call's existence is the fact cases
 * assert on, and `mutationEvidence` already treats an unreadable input as
 * unverifiable rather than clean.
 */
const toolInputSchema = Schema.Record(Schema.String, Schema.Unknown).pipe(
  Schema.catchDecoding(() => Effect.succeed(Option.some({}))),
);

/** The `type` field carried alike by stream messages and content blocks. */
const typeDiscriminatorSchema = Schema.Struct({
  type: Schema.String,
});
const assistantMessageSchema = Schema.Struct({
  type: Schema.Literal("assistant"),
  message: Schema.Struct({ content: Schema.Array(Schema.Unknown) }),
});
const toolUseBlockSchema = Schema.Struct({
  type: Schema.Literal("tool_use"),
  name: Schema.String,
  input: Schema.Unknown,
});
const successfulResultMessageSchema = Schema.Struct({
  type: Schema.Literal("result"),
  subtype: Schema.Literal("success"),
  is_error: Schema.Boolean,
  result: Schema.String,
  total_cost_usd: Schema.Number,
});
const failedResultMessageSchema = Schema.Struct({
  type: Schema.Literal("result"),
  subtype: Schema.String,
  is_error: Schema.Boolean,
  errors: Schema.Array(Schema.String),
  total_cost_usd: Schema.Number,
});
const resultSubtypeSchema = Schema.Struct({ subtype: Schema.String });

const decodeToolInput = Schema.decodeUnknownSync(toolInputSchema);
const decodeStreamMessageDiscriminator = Schema.decodeUnknownExit(
  typeDiscriminatorSchema,
);
const decodeAssistantMessage = Schema.decodeUnknownSync(assistantMessageSchema);
const decodeContentBlockDiscriminator = Schema.decodeUnknownSync(
  typeDiscriminatorSchema,
);
const decodeToolUseBlock = Schema.decodeUnknownSync(toolUseBlockSchema);
const decodeSuccessfulResultMessage = Schema.decodeUnknownSync(
  successfulResultMessageSchema,
);
const decodeFailedResultMessage = Schema.decodeUnknownSync(
  failedResultMessageSchema,
);
const decodeResultSubtype = Schema.decodeUnknownSync(resultSubtypeSchema);

function requireFiniteCost(costUsd: number): number {
  if (!Number.isFinite(costUsd)) {
    throw new Error(
      `Expected finite number, got ${String(costUsd)}\n  at ["total_cost_usd"]`,
    );
  }
  return costUsd;
}

function decodeAssistantToolCalls(message: unknown): ToolCall[] {
  const assistantMessage = decodeAssistantMessage(message);
  const messageToolCalls: ToolCall[] = [];

  for (const contentBlock of assistantMessage.message.content) {
    // A relevant assistant message fails closed when any content entry lacks
    // the minimum SDK block shape. Its calls are committed only after every
    // entry validates, preserving the message-level atomicity of the SDK.
    const blockDiscriminator = decodeContentBlockDiscriminator(contentBlock);
    if (blockDiscriminator.type === "tool_use") {
      const toolUseBlock = decodeToolUseBlock(contentBlock);
      messageToolCalls.push({
        name: toolUseBlock.name,
        input: decodeToolInput(toolUseBlock.input),
      });
    }
  }

  return messageToolCalls;
}

function normalizeResultMessage(message: unknown): ResultVerdict {
  const parsedSubtype = decodeResultSubtype(message);
  if (parsedSubtype.subtype === "success") {
    const resultMessage = decodeSuccessfulResultMessage(message);
    return {
      subtype: resultMessage.subtype,
      isError: resultMessage.is_error,
      finalText: resultMessage.result,
      costUsd: requireFiniteCost(resultMessage.total_cost_usd),
    };
  }

  const resultMessage = decodeFailedResultMessage(message);
  return {
    subtype: resultMessage.subtype,
    isError: resultMessage.is_error,
    // Error results carry diagnostics instead of an answer. Joining them
    // keeps auth and execution failures readable in a case failure.
    finalText: resultMessage.errors.join("\n"),
    costUsd: requireFiniteCost(resultMessage.total_cost_usd),
  };
}

/**
 * Relevant SDK messages, validated and reduced to the fields observed here.
 * Returns `null` for anything that carries no verdict, tool calls included:
 * those are pushed onto `observedToolCalls` as they are read.
 */
export function normalizeStreamMessage(
  message: unknown,
  observedToolCalls: ToolCall[],
): ResultVerdict | null {
  const parsedDiscriminator = decodeStreamMessageDiscriminator(message);
  if (Exit.isFailure(parsedDiscriminator)) return null;

  if (parsedDiscriminator.value.type === "assistant") {
    observedToolCalls.push(...decodeAssistantToolCalls(message));
    return null;
  }

  if (parsedDiscriminator.value.type !== "result") return null;

  return normalizeResultMessage(message);
}
