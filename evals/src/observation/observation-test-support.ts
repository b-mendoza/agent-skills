import type { GitStatus, Observation } from "#/observation/harness.ts";

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
