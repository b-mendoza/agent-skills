import type { Observation } from "#/observation/agent-query.ts";

/** A zero-cost clean observation with optional field overrides. */
export function createObservation(
  overrides: Readonly<Partial<Observation>> = {},
): Observation {
  return {
    subtype: "success",
    isError: false,
    finalText: "",
    toolCalls: [],
    gitStatusBefore: { kind: "worktree", entries: "" },
    gitStatusAfter: { kind: "worktree", entries: "" },
    costUsd: 0,
    durationMs: 0,
    timedOut: false,
    ...overrides,
  };
}

export async function* scripted(...messages: unknown[]) {
  yield* await Promise.all(messages);
}
