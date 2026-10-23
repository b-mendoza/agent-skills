import { promisify } from "node:util";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { Schema } from "effect";

import {
  gitStatusSchema,
  sampleGitStatus,
  toText,
} from "#/observation/mutation-evidence.ts";

const toolCallSchema = Schema.Struct({
  name: Schema.String,
  input: Schema.Record(Schema.String, Schema.Unknown),
});
export type ToolCall = {
  -readonly [Key in keyof typeof toolCallSchema.Type]: (typeof toolCallSchema.Type)[Key];
};
export const observationSchema = Schema.Struct({
  subtype: Schema.String,
  // Expired credentials can yield subtype "success" with isError true.
  isError: Schema.Boolean,
  finalText: Schema.String,
  toolCalls: Schema.mutable(Schema.Array(toolCallSchema)),
  gitStatusBefore: gitStatusSchema,
  gitStatusAfter: gitStatusSchema,
  costUsd: Schema.Number,
  durationMs: Schema.Number,
  timedOut: Schema.Boolean,
  repoFiles: Schema.optional(
    Schema.Record(Schema.String, Schema.NullOr(Schema.String)),
  ),
});
export type Observation = {
  -readonly [Key in keyof typeof observationSchema.Type]: (typeof observationSchema.Type)[Key];
};
/** The fields a result message settles, before run-level facts are attached. */
export type ResultVerdict = Pick<
  Observation,
  "subtype" | "isError" | "finalText" | "costUsd"
>;
export interface RunOptions {
  /** Working directory the agent runs in. Skills resolve relative to it. */
  cwd: string;
  prompt: string;
  budgetUsd: number;
  model: string;
  /** Abort deadline; reads and cleanup get a fixed grace period before forced settlement. */
  wallClockMs: number;
  /** Repo whose `git status` is sampled before and after. Usually `cwd`. */
  gitRepo?: string;
  /** Executable directory prepended to the inherited PATH. */
  pathPrefix?: string;
}

const NS_PER_MS = 1e6;
// Three seconds allows subprocess shutdown without letting a stuck iterator hang the suite.
const ABORT_GRACE_MS = 3_000;
export const QUERY_ERROR_SUBTYPE = "query_error";
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
function normalizeStreamMessage(
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

function failureText(failure: unknown): string {
  if (failure == null) return "query ended without a result message";
  return failure instanceof Error ? failure.message : toText(failure);
}

async function readResult(
  iterator: AsyncIterator<unknown>,
  toolCalls: ToolCall[],
): Promise<ResultVerdict | null> {
  const message = await iterator.next();
  if (message.done === true) return null;
  const result = normalizeStreamMessage(message.value, toolCalls);
  return result ?? readResult(iterator, toolCalls);
}

async function closeIterator(
  iterator: AsyncIterator<unknown> | undefined,
  settleBy: Promise<null>,
): Promise<void> {
  if (iterator?.return !== undefined) {
    await Promise.race([settleBy, iterator.return()]);
  }
}

function queryEnvironment(pathPrefix: string | undefined): {
  env?: NodeJS.ProcessEnv;
} {
  return pathPrefix === undefined
    ? {}
    : {
        env: {
          ...process.env,
          PATH: `${pathPrefix}:${process.env["PATH"] ?? ""}`,
        },
      };
}

/** Observe one query; a recorded result takes precedence over cleanup errors. */
export async function observeClaude(
  runOptions: RunOptions,
): Promise<Observation> {
  const repo = runOptions.gitRepo ?? runOptions.cwd;
  const gitStatusBefore = sampleGitStatus(repo);
  const startedAt = process.hrtime.bigint();
  const abortController = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, runOptions.wallClockMs);
  const deadlineError = new Error("query did not settle after abort");
  let settleTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  const settleBy = promisify((callback: (error: Error) => void) => {
    settleTimer = setTimeout(
      callback,
      runOptions.wallClockMs + ABORT_GRACE_MS,
      deadlineError,
    );
  })().then(() => null);
  const toolCalls: ToolCall[] = [];
  let result: ResultVerdict | null = null;
  let failure: unknown = undefined;
  let iterator: AsyncIterator<unknown> | undefined = undefined;
  try {
    iterator = query({
      prompt: runOptions.prompt,
      options: {
        cwd: runOptions.cwd,
        model: runOptions.model,
        maxBudgetUsd: runOptions.budgetUsd,
        permissionMode: "auto",
        abortController,
        // Without a prefix, omit env and inherit the subprocess environment.
        ...queryEnvironment(runOptions.pathPrefix),
        settingSources: ["project"],
        systemPrompt: { type: "preset", preset: "claude_code" },
        tools: { type: "preset", preset: "claude_code" },
      },
    })[Symbol.asyncIterator]();
    result = await Promise.race([readResult(iterator, toolCalls), settleBy]);
  } catch (error) {
    failure = error;
  } finally {
    try {
      await closeIterator(iterator, settleBy).catch((error: unknown) => {
        if (result !== null) return;
        if (error === deadlineError) failure = error;
        if (failure !== deadlineError) throw error;
      });
    } finally {
      clearTimeout(timer);
      clearTimeout(settleTimer);
    }
  }
  const gitStatusAfter = sampleGitStatus(repo);
  return {
    toolCalls: [...toolCalls],
    gitStatusBefore,
    gitStatusAfter,
    durationMs: Number(process.hrtime.bigint() - startedAt) / NS_PER_MS,
    timedOut,
    ...(result ?? {
      subtype: QUERY_ERROR_SUBTYPE,
      isError: true,
      finalText: failureText(failure),
      costUsd: 0,
    }),
  };
}
