import type { GitStatus } from "#/observation/git-status.ts";

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface Observation {
  /** Result message subtype: "success", "error_max_budget_usd", ... */
  subtype: string;
  /**
   * The SDK's own verdict that the run failed.
   *
   * Separate from `subtype` because the two disagree: an expired login is
   * reported as `subtype: "success"` with `is_error: true`, so the subtype
   * alone cannot tell a real answer from a request that never reached a model.
   */
  isError: boolean;
  /** Final assistant text as returned in the result message. */
  finalText: string;
  toolCalls: ToolCall[];
  gitStatusBefore: GitStatus;
  gitStatusAfter: GitStatus;
  costUsd: number;
  durationMs: number;
  /** True when the harness aborted the run for exceeding wallClockMs. */
  timedOut: boolean;
}

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
  /** Hard wall-clock ceiling. A hung run must fail the case, not the suite. */
  wallClockMs: number;
  /** Repo whose `git status` is sampled before and after. Usually `cwd`. */
  gitRepo?: string;
}
