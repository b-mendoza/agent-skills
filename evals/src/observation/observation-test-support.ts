import { Layer } from "effect";

import type {
  AgentQuery as AgentQueryService,
  GitSampler as GitSamplerService,
  GitStatus,
  Observation,
} from "#/observation/harness.ts";
import { AgentQuery, GitSampler } from "#/observation/harness.ts";

/** A sampled worktree; `entries` is `git status --short` output. */
export const createWorktreeStatus = (entries = ""): GitStatus => ({
  kind: "worktree",
  entries,
});

export const createAgentQueryLayer = (
  start: AgentQueryService["start"],
): Layer.Layer<AgentQueryService> =>
  Layer.succeed(AgentQuery, AgentQuery.of({ start }));

export const createGitSamplerLayer = (
  sample: GitSamplerService["sample"],
): Layer.Layer<GitSamplerService> =>
  Layer.succeed(GitSampler, GitSampler.of({ sample }));

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
