import type {
  Observation,
  TurnObservation,
} from "#/observation/agent-query.ts";

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

/** A settled initial turn; override prompt and name for scripted replies. */
export function createTurn(
  overrides: Partial<TurnObservation> = {},
): TurnObservation {
  return {
    subtype: "success",
    isError: false,
    finalText: "",
    toolCalls: [],
    gitStatusBefore: { kind: "worktree", entries: "" },
    gitStatusAfter: { kind: "worktree", entries: "" },
    costUsd: 0,
    timedOut: false,
    name: "initial",
    prompt: "preview",
    gitHeadBefore: { kind: "head", oid: "baseline" },
    gitHeadAfter: { kind: "head", oid: "baseline" },
    ...overrides,
  };
}
