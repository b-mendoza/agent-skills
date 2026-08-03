// Shared synthetic Agent SDK lifecycle seam for the observation tests.

import { tmpdir } from "node:os";

import { Effect } from "effect";
import { afterEach, beforeEach, vi } from "vitest";

import type {
  AgentQuery as AgentQueryService,
  AgentQueryRequest,
  GitStatus,
  Observation,
  RunOptions,
} from "#/observation/harness.ts";
import { observeClaude } from "#/observation/harness.ts";
import {
  createAgentQueryLayer,
  createGitSamplerLayer,
  createWorktreeStatus,
} from "#/observation/observation-test-support.ts";

export const WALL_CLOCK_MS = 30_000;
/** Short enough to exercise the abort path without slowing the suite. */
export const SHORT_WALL_CLOCK_MS = 25;
/** Well past the short deadline, for the cleared-timer test. */
export const PAST_THE_DEADLINE_MS = 50;
export const BUDGET_USD = 0.01;
/** Distinct costs, so a test names which message a value came from. */
export const COST_FULL = 0.5;
export const COST_BUDGET_STOP = 0.25;
export const FOREIGN_BIGINT = 1n;
export const LAST_ITEM_OFFSET = -1;
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

type FakeMessageSource =
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

let queryStart: AgentQueryService["start"] = (_request) =>
  Effect.succeed(scripted(success("done", COST_FULL)));
let observedQueryRequests: AgentQueryRequest[] = [];

export function setQueryStart(start: AgentQueryService["start"]): void {
  queryStart = start;
}
let gitSamples: GitStatus[] = [];
export let sampledRepositories: string[] = [];

beforeEach(() => {
  queryStart = (_request) => {
    return Effect.succeed(scripted(success("done", COST_FULL)));
  };
  observedQueryRequests = [];
  gitSamples = [createWorktreeStatus(), createWorktreeStatus()];
  sampledRepositories = [];
});

afterEach(() => {
  vi.useRealTimers();
});

export async function runHarness(
  overrides: Readonly<Partial<RunOptions>> = {},
): Promise<Observation> {
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
}

export function lastQueryRequest(): AgentQueryRequest {
  const request = observedQueryRequests.at(LAST_ITEM_OFFSET);
  if (request === undefined) throw new Error("query was never started");
  return request;
}
