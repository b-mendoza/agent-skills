import { Schema } from "effect";

import type {
  ResultVerdict,
  ToolCall,
} from "#/observation/observation-types.ts";

const decodeAssistant = Schema.decodeUnknownSync(
  Schema.Struct({
    message: Schema.Struct({ content: Schema.Array(Schema.Unknown) }),
  }),
);
const decodeBlock = Schema.decodeUnknownSync(
  Schema.Struct({ type: Schema.String }),
);
const decodeTool = Schema.decodeUnknownSync(
  Schema.Struct({ name: Schema.String, input: Schema.Unknown }),
);
const decodeResult = Schema.decodeUnknownSync(
  Schema.Struct({
    subtype: Schema.String,
    is_error: Schema.Boolean,
    total_cost_usd: Schema.Number,
  }),
);
const decodeSuccess = Schema.decodeUnknownSync(
  Schema.Struct({ result: Schema.String }),
);
const decodeFailure = Schema.decodeUnknownSync(
  Schema.Struct({ errors: Schema.Array(Schema.String) }),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assistantToolCalls(message: unknown): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const block of decodeAssistant(message).message.content) {
    if (decodeBlock(block).type !== "tool_use") continue;
    const tool = decodeTool(block);
    calls.push({
      name: tool.name,
      input: isRecord(tool.input) ? { ...tool.input } : {},
    });
  }
  return calls;
}

function normalizeResult(message: unknown): ResultVerdict {
  const result = decodeResult(message);
  if (!Number.isFinite(result.total_cost_usd)) {
    throw new Error(
      `Expected finite number, got ${String(result.total_cost_usd)}\n  at ["total_cost_usd"]`,
    );
  }
  return {
    subtype: result.subtype,
    isError: result.is_error,
    finalText:
      result.subtype === "success"
        ? decodeSuccess(message).result
        : decodeFailure(message).errors.join("\n"),
    costUsd: result.total_cost_usd,
  };
}

/** Commit assistant calls only after every content block has validated. */
export function normalizeStreamMessage(
  message: unknown,
  observedToolCalls: ToolCall[],
): ResultVerdict | null {
  if (!isRecord(message)) return null;
  switch (message["type"]) {
    case "assistant":
      observedToolCalls.push(...assistantToolCalls(message));
      return null;
    case "result":
      return normalizeResult(message);
    default:
      return null;
  }
}
