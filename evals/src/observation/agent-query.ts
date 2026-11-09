import { promisify } from "node:util";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { Predicate, Schema } from "effect";

import { createConversation, createInput } from "#/observation/conversation.ts";
import { sampleGitStatus, toText } from "#/observation/mutation-evidence.ts";
import type {
  FollowUpTurn,
  Observation,
  ResultVerdict,
  ToolCall,
} from "#/observation/observation-contract.ts";
import { createTurnCorrelation } from "#/observation/turn-correlation.ts";

export type {
  Observation,
  ToolCall,
  TurnObservation,
} from "#/observation/observation-contract.ts";
export { observationSchema } from "#/observation/observation-contract.ts";

export interface RunOptions {
  /** Working directory the agent runs in. Skills resolve relative to it. */
  cwd: string;
  prompt: string;
  followUps?: readonly FollowUpTurn[];
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
const LAST_TURN_INDEX = -1;
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
  Schema.Struct({
    name: Schema.String,
    input: Schema.Unknown,
    id: Schema.optional(Schema.String),
  }),
);
const decodeUser = Schema.decodeUnknownSync(
  Schema.Struct({
    message: Schema.Struct({
      content: Schema.Union([Schema.String, Schema.Array(Schema.Unknown)]),
    }),
  }),
);
const decodeToolResult = Schema.decodeUnknownSync(
  Schema.Struct({
    tool_use_id: Schema.String,
    content: Schema.optional(
      Schema.Union([Schema.String, Schema.Array(Schema.Unknown)]),
    ),
    is_error: Schema.optional(Schema.Boolean),
  }),
);
const WEB_TOOLS = new Set(["WebSearch", "WebFetch"]);
const WEB_RESULT_CHARS = 8_000;
const WEB_RESULTS_TOTAL_CHARS = 32_000;
const EXECUTION_RESULT_CHARS = 16_000;
const EXECUTION_RESULTS_TOTAL_CHARS = 128_000;
const EXECUTION_RESULT_TAIL_CHARS = 2_000;
// Reserved tails do not consume the shared pool; weak membership follows call lifetime.
const RESERVED_RESULT_CALLS = new WeakSet<ToolCall>();
const CAPTURED_TOOLS = new Set([...WEB_TOOLS, "Bash", "Agent", "Task"]);
const WEB_LIMITS = {
  perResult: WEB_RESULT_CHARS,
  total: WEB_RESULTS_TOTAL_CHARS,
};
const EXECUTION_LIMITS = {
  perResult: EXECUTION_RESULT_CHARS,
  total: EXECUTION_RESULTS_TOTAL_CHARS,
};
const TRUNCATION_MARKER = "\n[truncated]\n";
const TRUNCATION_SIDES = 2;
const ZERO_CHARS = 0;
const NO_TASKS = 0;
const decodeBackgroundTasks = Schema.decodeUnknownSync(
  Schema.Struct({ tasks: Schema.Array(Schema.Unknown) }),
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

function assistantToolCalls(message: unknown): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const block of decodeAssistant(message).message.content) {
    if (decodeBlock(block).type !== "tool_use") continue;
    const tool = decodeTool(block);
    calls.push({
      ...tool,
      input: Predicate.isObject(tool.input) ? { ...tool.input } : {},
    });
  }
  return calls;
}

function resultLimits(toolName: string) {
  return WEB_TOOLS.has(toolName) ? WEB_LIMITS : EXECUTION_LIMITS;
}

function executionBlockText(block: unknown): string {
  if (
    Predicate.isObject(block) &&
    block["type"] === "text" &&
    typeof block["text"] === "string"
  ) {
    return block["text"];
  }
  return toText(block);
}

function resultText(content: unknown, toolName: string): string {
  if (WEB_TOOLS.has(toolName)) return toText(content);
  return Array.isArray(content)
    ? content.map(executionBlockText).join("\n")
    : toText(content);
}

/** The marker counts against both caps. An exhausted allowance retains error/truncation metadata. */
function boundedResult(content: string, limit: number): string {
  if (content.length <= limit) return content;
  if (limit < TRUNCATION_MARKER.length) return "";
  const retainedChars = limit - TRUNCATION_MARKER.length;
  const headChars = Math.floor(retainedChars / TRUNCATION_SIDES);
  const tailChars = retainedChars - headChars;
  return (
    content.slice(ZERO_CHARS, headChars) +
    TRUNCATION_MARKER +
    content.slice(content.length - tailChars)
  );
}

function reserveRequired(
  limits: ReturnType<typeof resultLimits>,
  limit: number,
): boolean {
  return limits === EXECUTION_LIMITS && limit < TRUNCATION_MARKER.length;
}

function captureResult(content: string, limit: number, reserved: boolean) {
  if (reserved) {
    return {
      content: TRUNCATION_MARKER + content.slice(-EXECUTION_RESULT_TAIL_CHARS),
      truncated: true,
    };
  }
  return {
    content: boundedResult(content, limit),
    truncated: content.length > limit,
  };
}

function recordToolResult(block: unknown, toolCalls: ToolCall[]): void {
  const result = decodeToolResult(block);
  const call = toolCalls.find(
    (candidate) =>
      candidate.id === result.tool_use_id && CAPTURED_TOOLS.has(candidate.name),
  );
  if (call === undefined) return;
  const limits = resultLimits(call.name);
  const content = resultText(result.content, call.name);
  const capturedChars = toolCalls
    .filter(
      (candidate) =>
        candidate !== call &&
        resultLimits(candidate.name) === limits &&
        !RESERVED_RESULT_CALLS.has(candidate),
    )
    .reduce(
      (total, candidate) =>
        total + (candidate.result?.content.length ?? ZERO_CHARS),
      ZERO_CHARS,
    );
  const limit = Math.min(limits.perResult, limits.total - capturedChars);
  const reserved = reserveRequired(limits, limit);
  if (reserved) RESERVED_RESULT_CALLS.add(call);
  else RESERVED_RESULT_CALLS.delete(call);
  call.result = {
    ...captureResult(content, limit, reserved),
    isError: result.is_error ?? false,
  };
}

function userToolResults(message: unknown, toolCalls: ToolCall[]): void {
  const { content } = decodeUser(message).message;
  if (typeof content === "string") return;
  for (const block of content) {
    if (decodeBlock(block).type === "tool_result") {
      recordToolResult(block, toolCalls);
    }
  }
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
  if (!Predicate.isObject(message)) return null;
  switch (message["type"]) {
    case "assistant":
      observedToolCalls.push(...assistantToolCalls(message));
      return null;
    case "user":
      userToolResults(message, observedToolCalls);
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

function backgroundTasksLive(message: unknown, previous: boolean): boolean {
  if (!Predicate.isObject(message)) return previous;
  if (message["type"] !== "system") return previous;
  if (message["subtype"] !== "background_tasks_changed") return previous;
  // The SDK's level signal replaces membership; task edge ordering is unspecified.
  return decodeBackgroundTasks(message).tasks.length > NO_TASKS;
}

interface ResultReadState {
  readonly tasksLive: boolean;
  readonly recordResult: (result: ResultVerdict | null) => void;
  readonly correlation: ReturnType<typeof createTurnCorrelation>;
}

function canSettle(
  result: ResultVerdict | null,
  live: boolean,
  state: ResultReadState,
): boolean {
  return result !== null && !live && state.correlation.settles(result);
}

async function readResult(
  iterator: AsyncIterator<unknown>,
  toolCalls: ToolCall[],
  state: ResultReadState,
): Promise<ResultVerdict | null> {
  const message = await iterator.next();
  if (message.done === true) return null;
  if (!state.correlation.acceptsMessage(message.value)) {
    return readResult(iterator, toolCalls, state);
  }
  const live = backgroundTasksLive(message.value, state.tasksLive);
  const result = normalizeStreamMessage(message.value, toolCalls);
  state.recordResult(result);
  return canSettle(result, live, state)
    ? result
    : readResult(iterator, toolCalls, { ...state, tasksLive: live });
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
  const conversation = createConversation(repo, runOptions.prompt);
  const gitStatusBefore = conversation.initialStatus;
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
  let failedResult: ResultVerdict | null = null;
  let failure: unknown = undefined;
  let iterator: AsyncIterator<unknown> | undefined = undefined;
  const input = createInput(runOptions.prompt);
  const currentVerdict = () =>
    result ?? failedResult ?? conversation.failure(failureText(failure));
  const observeSoFar = (): Observation => ({
    ...currentVerdict(),
    toolCalls: [...toolCalls],
    gitStatusBefore,
    gitStatusAfter:
      conversation.turns.at(LAST_TURN_INDEX)?.gitStatusAfter ?? gitStatusBefore,
    durationMs: Number(process.hrtime.bigint() - startedAt) / NS_PER_MS,
    timedOut,
    turns: [...conversation.turns],
  });
  const readTurns = async (
    stream: AsyncIterator<unknown>,
    followUps: readonly FollowUpTurn[],
    turn: { readonly uuid: string; readonly previousCost: number | null },
  ): Promise<ResultVerdict> => {
    const verdict = await Promise.race([
      readResult(stream, toolCalls, {
        tasksLive: false,
        recordResult: conversation.recordResult,
        correlation: createTurnCorrelation(turn.uuid, turn.previousCost),
      }),
      settleBy,
    ]);
    if (verdict === null) {
      throw new Error("query ended without a result message");
    }
    conversation.finish(verdict, { toolCalls, timedOut });
    const [next, ...remaining] = followUps;
    if (next === undefined) return verdict;
    const observation = { ...observeSoFar(), ...verdict };
    const uuid = input.send(conversation.begin(next, observation));
    return readTurns(stream, remaining, {
      uuid,
      previousCost: verdict.costUsd,
    });
  };
  try {
    iterator = query({
      prompt: input.messages(),
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
    result = await readTurns(iterator, runOptions.followUps ?? [], {
      uuid: input.initialUuid,
      previousCost: null,
    });
  } catch (error) {
    failure = error;
    failedResult = conversation.failure(failureText(failure));
    conversation.finish(failedResult, { toolCalls, timedOut });
  } finally {
    input.close();
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
  return { ...observeSoFar(), gitStatusAfter: sampleGitStatus(repo) };
}
