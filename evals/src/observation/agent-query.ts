import { query } from "@anthropic-ai/claude-agent-sdk";

import { normalizeStreamMessage } from "#/observation/agent-query-messages.ts";
import { sampleGitStatus, toText } from "#/observation/git-status.ts";
import type {
  Observation,
  ResultVerdict,
  RunOptions,
  ToolCall,
} from "#/observation/observation-types.ts";

const NS_PER_MS = 1e6;
export const QUERY_ERROR_SUBTYPE = "query_error";

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
  timer: ReturnType<typeof setTimeout>,
): Promise<void> {
  try {
    if (iterator?.return !== undefined) await iterator.return();
  } finally {
    clearTimeout(timer);
  }
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
        // Omit env so the subprocess inherits ambient credentials.
        settingSources: ["project"],
        systemPrompt: { type: "preset", preset: "claude_code" },
        tools: { type: "preset", preset: "claude_code" },
      },
    })[Symbol.asyncIterator]();
    result = await readResult(iterator, toolCalls);
  } catch (error) {
    failure = error;
  } finally {
    await closeIterator(iterator, timer).catch((error: unknown) => {
      if (result === null) throw error;
    });
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
