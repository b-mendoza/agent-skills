import { Layer } from "effect";

import type { AgentQuery as AgentQueryService } from "#/observation/agent-query-service.ts";
import { AgentQuery } from "#/observation/agent-query-service.ts";
import type {
  GitSampler as GitSamplerService,
  GitStatus,
} from "#/observation/git-status.ts";
import { GitSampler } from "#/observation/git-status.ts";
import type { Observation } from "#/observation/observation-types.ts";

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
