import { Effect } from "effect";

import type {
  AgentQuery,
  AgentQueryRequest,
} from "#/observation/agent-query-service.ts";
import { AgentQueryLive } from "#/observation/agent-query-service.ts";
import type {
  QueryAccumulator,
  ResultVerdict,
} from "#/observation/agent-query-stream.ts";
import { failureText, settleQuery } from "#/observation/agent-query-stream.ts";
import { GitSampler, GitSamplerLive } from "#/observation/git-status.ts";
import type {
  Observation,
  RunOptions,
} from "#/observation/observation-types.ts";

const NS_PER_MS = 1e6;
/** A run with no reported cost books nothing rather than `NaN`. */
const ZERO_COST = 0;

interface WallClock {
  readonly abortController: AbortController;
  readonly clear: () => void;
  readonly timedOut: () => boolean;
}

function startWallClock(wallClockMs: number): WallClock {
  const abortController = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, wallClockMs);
  return {
    abortController,
    clear: () => {
      clearTimeout(timer);
    },
    timedOut: () => timedOut,
  };
}

function createQueryRequest(
  opts: RunOptions,
  abortController: AbortController,
): AgentQueryRequest {
  return {
    prompt: opts.prompt,
    options: {
      cwd: opts.cwd,
      model: opts.model,
      maxBudgetUsd: opts.budgetUsd,
      permissionMode: "auto",
      abortController,
      // `env` is omitted on purpose: the subprocess then inherits
      // `process.env`, including whatever credentials the ambient
      // environment carries. Setting `env` would REPLACE the environment,
      // not merge it.
      settingSources: ["project"],
      systemPrompt: { type: "preset", preset: "claude_code" },
      tools: { type: "preset", preset: "claude_code" },
    },
  };
}

/**
 * Subtype of the synthetic Observation produced when the query never yielded
 * a result message: the SDK threw (option validation, bundled-CLI startup,
 * transport, abort) or the stream ended early. There is no result to trust,
 * so the run reports failure and books no cost. Exported so case assertions
 * reject the same constant the harness emits instead of a drifting literal.
 */
export const QUERY_ERROR_SUBTYPE = "query_error";

/**
 * One Agent SDK query, observed end to end as an Effect program.
 *
 * The native timer stays at the SDK boundary because its cooperative abort
 * semantics and ordering are observable contracts not covered by the pinned
 * Effect timeout APIs.
 */
export const observeClaude = (
  opts: RunOptions,
): Effect.Effect<Observation, never, AgentQuery | GitSampler> =>
  Effect.gen(function* () {
    const gitSampler = yield* GitSampler;
    const repo = opts.gitRepo ?? opts.cwd;
    const gitStatusBefore = yield* gitSampler.sample(repo);
    const startedAt = process.hrtime.bigint();
    const wallClock = startWallClock(opts.wallClockMs);
    let resultVerdict: ResultVerdict | null = null;
    const accumulator: QueryAccumulator = {
      getResultVerdict: () => resultVerdict,
      recordResultVerdict: (verdict) => {
        resultVerdict = verdict;
      },
      toolCalls: [],
    };
    const request = createQueryRequest(opts, wallClock.abortController);
    const querySettlement = yield* settleQuery(request, accumulator);
    wallClock.clear();

    // Sampled after settlement on every path -- a run that threw may still
    // have mutated the repo, and that evidence must not be lost.
    const gitStatusAfter = yield* gitSampler.sample(repo);
    const settled = {
      // Copied so nothing can grow an observation a caller already holds.
      toolCalls: [...accumulator.toolCalls],
      gitStatusBefore,
      gitStatusAfter,
      durationMs: Number(process.hrtime.bigint() - startedAt) / NS_PER_MS,
      timedOut: wallClock.timedOut(),
    };

    if (querySettlement.resultVerdict === null) {
      // No result message means no trustworthy verdict and no reported cost:
      // the run failed as infrastructure, whatever partial state accumulated.
      return {
        ...settled,
        subtype: QUERY_ERROR_SUBTYPE,
        isError: true,
        finalText: failureText(querySettlement.failure),
        costUsd: ZERO_COST,
      };
    }

    return { ...settled, ...querySettlement.resultVerdict };
  });

/** Promise compatibility facade for non-Effect orchestration callers. */
export async function runClaude(opts: RunOptions): Promise<Observation> {
  const observation = await Effect.runPromise(
    observeClaude(opts).pipe(
      Effect.provide(AgentQueryLive),
      Effect.provide(GitSamplerLive),
    ),
  );
  return observation;
}
