import type { GitStatus } from "#/observation/git-status.ts";
import { mutationEvidence } from "#/observation/mutation-evidence.ts";
import type { Observation, ToolCall } from "#/observation/observation-types.ts";

/** A sampled worktree; `entries` is `git status --short` output. */
export const createWorktreeStatus = (entries = ""): GitStatus => ({
  kind: "worktree",
  entries,
});

/** A zero-cost clean observation with optional field overrides. */
export function createObservation(
  overrides: Readonly<Partial<Observation>> = {},
): Observation {
  return {
    subtype: "success",
    isError: false,
    finalText: "",
    toolCalls: [],
    gitStatusBefore: createWorktreeStatus(),
    gitStatusAfter: createWorktreeStatus(),
    costUsd: 0,
    durationMs: 0,
    timedOut: false,
    ...overrides,
  };
}

export const toolUse = (name: string, input: unknown = {}) => ({
  type: "tool_use",
  name,
  input,
});
export const assistant = (...content: unknown[]) => ({
  type: "assistant",
  message: { content },
});
const DEFAULT_COST = 0.5;
export const success = (result: string, totalCostUsd = DEFAULT_COST) => ({
  type: "result",
  subtype: "success",
  is_error: false,
  result,
  total_cost_usd: totalCostUsd,
});
export async function* scripted(...messages: unknown[]) {
  yield* await Promise.all(messages);
}

/** A Bash tool call carrying `command` exactly as the SDK reported it. */
export function bash(command: unknown): ToolCall {
  return { name: "Bash", input: { command } };
}

/** The mutation evidence a run produces from a single Bash command. */
export function evidenceFor(command: unknown): string[] {
  return mutationEvidence(createObservation({ toolCalls: [bash(command)] }));
}
