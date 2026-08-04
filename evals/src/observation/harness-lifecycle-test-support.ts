// Shared synthetic Agent SDK lifecycle seam for the observation tests.

import { tmpdir } from "node:os";

import { Effect } from "effect";

import { observeClaude } from "#/observation/agent-query.ts";
import type {
  AgentQuery as AgentQueryService,
  AgentQueryRequest,
} from "#/observation/agent-query-service.ts";
import { QueryStartError } from "#/observation/agent-query-service.ts";
import type { GitStatus } from "#/observation/git-status.ts";
import {
  createAgentQueryLayer,
  createGitSamplerLayer,
  createWorktreeStatus,
} from "#/observation/observation-test-support.ts";
import type {
  Observation,
  RunOptions,
} from "#/observation/observation-types.ts";

const WALL_CLOCK_MS = 30_000;
/** Short enough to exercise the abort path without slowing the suite. */
export const SHORT_WALL_CLOCK_MS = 25;
/** Well past the short deadline, for the cleared-timer test. */
export const PAST_THE_DEADLINE_MS = 50;
export const BUDGET_USD = 0.01;
/** Distinct costs, so a test names which message a value came from. */
export const COST_FULL = 0.5;
export const COST_BUDGET_STOP = 0.25;
export const FOREIGN_BIGINT = 1n;
const LAST_ITEM_OFFSET = -1;
export const EXPECTED_GIT_SAMPLE_COUNT = 2;

interface FakeContentBlock {
  type: string;
  name?: string;
  input?: unknown;
}

type FakeContentEntry = FakeContentBlock | null;

export type FakeMessage =
  | { type: "assistant"; message: { content: FakeContentEntry[] } }
  | { type: "user"; message: { role: "user"; content: string } }
  | {
      type: "result";
      subtype?: unknown;
      is_error?: unknown;
      result?: unknown;
      errors?: unknown;
      total_cost_usd?: unknown;
    };

export type FakeMessageSource =
  | Generator<unknown, void>
  | AsyncGenerator<unknown, void>;

async function* asAsyncMessages(
  messageSource: FakeMessageSource,
): AsyncGenerator<unknown, void> {
  yield* messageSource;
}

export function fakeQuery(
  generatorFactory: () => FakeMessageSource,
): AsyncIterable<unknown> {
  return asAsyncMessages(generatorFactory());
}

/**
 * A query whose messages need the harness-owned abort signal. Failing when the
 * signal is absent keeps a harness that stopped supplying one from reading as a
 * run that simply never aborted.
 */
export function abortAwareQuery(
  makeMessages: (signal: AbortSignal) => FakeMessageSource,
): AgentQueryService["start"] {
  return (request) => {
    const signal = request.options?.abortController?.signal;
    if (signal == null) {
      return Effect.fail(
        new QueryStartError({
          cause: new Error("no abort controller supplied"),
        }),
      );
    }
    return Effect.succeed(fakeQuery(() => makeMessages(signal)));
  };
}

function* yieldScript(script: readonly unknown[]): Generator<unknown, void> {
  yield* script;
}

/** A query that yields a fixed script of messages, then ends. */
export function scripted(...script: unknown[]): AsyncIterable<unknown> {
  return asAsyncMessages(yieldScript(script));
}

export const toolUse = (
  name: string,
  input: unknown = {},
): FakeContentBlock => ({
  type: "tool_use",
  name,
  input,
});

export const assistant = (...content: FakeContentEntry[]): FakeMessage => ({
  type: "assistant",
  message: { content },
});

export const success = (text: string, cost: number): FakeMessage => ({
  type: "result",
  subtype: "success",
  is_error: false,
  result: text,
  total_cost_usd: cost,
});

interface TrackedMessages {
  readonly iterable: AsyncIterable<unknown>;
  readonly nextCallCount: () => number;
  readonly returnCallCount: () => number;
}

export function createTrackedMessages(
  script: readonly FakeMessage[],
  cleanupFailure: Error | null = null,
): TrackedMessages {
  let nextCallCount = 0;
  let returnCallCount = 0;
  let scriptIndex = 0;
  const iterator: AsyncIterator<unknown> = {
    next: async () => {
      nextCallCount += 1;
      const message = script[scriptIndex];
      scriptIndex += 1;
      return message === undefined
        ? { done: true, value: undefined }
        : { done: false, value: message };
    },
    return: async () => {
      returnCallCount += 1;
      if (cleanupFailure !== null) throw cleanupFailure;
      return { done: true, value: undefined };
    },
  };
  return {
    iterable: { [Symbol.asyncIterator]: () => iterator },
    nextCallCount: () => nextCallCount,
    returnCallCount: () => returnCallCount,
  };
}

/** One suite's isolated view of the synthetic harness. */
export interface HarnessSeam {
  /** Replaces the scripted query the next run observes. */
  readonly setQueryStart: (start: AgentQueryService["start"]) => void;
  readonly runHarness: (
    overrides?: Readonly<Partial<RunOptions>>,
  ) => Promise<Observation>;
  readonly lastQueryRequest: () => AgentQueryRequest;
  /** Repositories the harness sampled, in call order. */
  readonly sampledRepositories: () => readonly string[];
}

/**
 * A seam over state closed over per construction, so building one in
 * `beforeEach` *is* the reset -- no test can observe what a prior test left
 * behind, and no suite has to remember to opt into clearing it.
 */
export function createHarnessSeam(): HarnessSeam {
  let queryStart: AgentQueryService["start"] = (_request) =>
    Effect.succeed(scripted(success("done", COST_FULL)));
  const observedQueryRequests: AgentQueryRequest[] = [];
  const gitSamples: GitStatus[] = [
    createWorktreeStatus(),
    createWorktreeStatus(),
  ];
  const sampledRepositories: string[] = [];

  return {
    setQueryStart: (start) => {
      queryStart = start;
    },
    runHarness: async (overrides = {}) => {
      const options: RunOptions = {
        cwd: tmpdir(),
        prompt: "observe the repo",
        budgetUsd: BUDGET_USD,
        model: "haiku",
        wallClockMs: WALL_CLOCK_MS,
        ...overrides,
      };
      const agentQueryLayer = createAgentQueryLayer((request) => {
        observedQueryRequests.push(request);
        return queryStart(request);
      });
      const gitSamplerLayer = createGitSamplerLayer((repo) => {
        sampledRepositories.push(repo);
        return Effect.succeed(gitSamples.shift() ?? createWorktreeStatus());
      });
      const observation = await Effect.runPromise(
        observeClaude(options).pipe(
          Effect.provide(agentQueryLayer),
          Effect.provide(gitSamplerLayer),
        ),
      );
      return observation;
    },
    lastQueryRequest: () => {
      const request = observedQueryRequests.at(LAST_ITEM_OFFSET);
      if (request === undefined) throw new Error("query was never started");
      return request;
    },
    sampledRepositories: () => sampledRepositories,
  };
}
