// Pins failure settlement, iterator cleanup, and wall-clock behavior without starting an SDK subprocess.

import { once } from "node:events";

import { Effect } from "effect";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { QUERY_ERROR_SUBTYPE } from "#/observation/agent-query.ts";
import { QueryStartError } from "#/observation/agent-query-service.ts";
import type { FakeMessage } from "#/observation/harness-lifecycle-test-support.ts";
import {
  abortAwareQuery,
  assistant,
  COST_BUDGET_STOP,
  COST_FULL,
  createHarnessSeam,
  createTrackedMessages,
  EXPECTED_GIT_SAMPLE_COUNT,
  fakeQuery,
  FOREIGN_BIGINT,
  NO_COST_USD,
  PAST_THE_DEADLINE_MS,
  scripted,
  SHORT_WALL_CLOCK_MS,
  SINGLE_ITERATOR_CALL_COUNT,
  success,
  toolUse,
} from "#/observation/harness-lifecycle-test-support.ts";

let harness = createHarnessSeam();

beforeEach(() => {
  harness = createHarnessSeam();
});

// This is the only suite that fakes timers, so it owns restoring them.
afterEach(() => {
  vi.useRealTimers();
});

test("a query startup failure settles and books no cost", async () => {
  harness.setQueryStart(() =>
    Effect.fail(
      new QueryStartError({
        cause: new Error("bundled CLI failed to start"),
      }),
    ),
  );

  const observation = await harness.runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("bundled CLI failed to start");
  expect(observation.costUsd).toBe(NO_COST_USD);
  expect(observation.timedOut).toBe(false);
  expect(harness.sampledRepositories()).toHaveLength(EXPECTED_GIT_SAMPLE_COUNT);
});

test("a mid-stream failure keeps observations already made", async () => {
  harness.setQueryStart(() =>
    Effect.succeed(
      fakeQuery(function* () {
        yield assistant(toolUse("Write", { file_path: "/repo/x" }));
        throw new Error("stream died");
      }),
    ),
  );

  const observation = await harness.runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("stream died");
  expect(observation.costUsd).toBe(NO_COST_USD);
  expect(observation.toolCalls.map((call) => call.name)).toStrictEqual([
    "Write",
  ]);
});

test.each([
  {
    name: "a malformed assistant content entry fails closed and keeps prior tool calls",
    messageScript: [
      assistant(toolUse("Read")),
      assistant(toolUse("Write", { file_path: "/repo/x" }), null),
      success("done", COST_FULL),
    ],
    expectedRetainedToolNames: ["Read"],
  },
  {
    name: "a malformed result fails closed and keeps prior tool calls",
    messageScript: [
      assistant(toolUse("Write", { file_path: "/repo/x" })),
      {
        type: "result",
        subtype: "success",
        is_error: false,
        result: "done",
        total_cost_usd: "not a number",
      },
    ],
    expectedRetainedToolNames: ["Write"],
  },
] satisfies ReadonlyArray<{
  name: string;
  messageScript: FakeMessage[];
  expectedRetainedToolNames: string[];
}>)("$name", async ({ messageScript, expectedRetainedToolNames }) => {
  harness.setQueryStart(() => Effect.succeed(scripted(...messageScript)));

  const observation = await harness.runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  // The wording belongs to Effect Schema, so only carrying a diagnostic at all
  // is ours to pin: a silent empty text would leave the failure unexplained.
  expect(observation.finalText).not.toBe("");
  expect(observation.costUsd).toBe(NO_COST_USD);
  expect(observation.toolCalls.map((call) => call.name)).toStrictEqual(
    expectedRetainedToolNames,
  );
});

test.each([
  [NaN, 'Expected finite number, got NaN\n  at ["total_cost_usd"]'],
  [Infinity, 'Expected finite number, got Infinity\n  at ["total_cost_usd"]'],
  [-Infinity, 'Expected finite number, got -Infinity\n  at ["total_cost_usd"]'],
] satisfies ReadonlyArray<readonly [number, string]>)(
  "a non-finite result cost fails closed: %s",
  async (totalCostUsd, expectedFinalText) => {
    harness.setQueryStart(() =>
      Effect.succeed(
        scripted({
          type: "result",
          subtype: "success",
          is_error: false,
          result: "done",
          total_cost_usd: totalCostUsd,
        }),
      ),
    );

    const observation = await harness.runHarness();

    expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
    expect(observation.finalText).toBe(expectedFinalText);
    expect(observation.costUsd).toBe(NO_COST_USD);
  },
);

test("a BigInt thrown value cannot reject observation settlement", async () => {
  harness.setQueryStart(() =>
    Effect.fail(new QueryStartError({ cause: FOREIGN_BIGINT })),
  );

  const observation = await harness.runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("1");
  expect(observation.costUsd).toBe(NO_COST_USD);
});

test("a cyclic thrown value cannot reject observation settlement", async () => {
  // `JSON.stringify` throws on a cycle. What the guarded fallback renders is
  // not ours to pin; that settlement completes with *some* text is.
  const cyclicFailure: Record<string, unknown> = {};
  cyclicFailure["self"] = cyclicFailure;
  harness.setQueryStart(() =>
    Effect.fail(new QueryStartError({ cause: cyclicFailure })),
  );

  const observation = await harness.runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBeTypeOf("string");
  expect(observation.finalText).not.toBe("");
  expect(observation.costUsd).toBe(NO_COST_USD);
});

test.each([null, undefined])(
  "a nullish query failure uses the no-result diagnostic",
  async (failure) => {
    harness.setQueryStart(() =>
      Effect.fail(new QueryStartError({ cause: failure })),
    );

    const observation = await harness.runHarness();

    expect(observation.finalText).toBe("query ended without a result message");
  },
);

test("a stream that ends without a result fails closed", async () => {
  harness.setQueryStart(() =>
    Effect.succeed(scripted(assistant(toolUse("Read")))),
  );

  const observation = await harness.runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("query ended without a result message");
  expect(observation.costUsd).toBe(NO_COST_USD);
  expect(observation.toolCalls.map((call) => call.name)).toStrictEqual([
    "Read",
  ]);
});

test("the first valid result stops iteration and cleans up once", async () => {
  const messages = createTrackedMessages([
    success("first", COST_FULL),
    assistant(toolUse("Write", { file_path: "/repo/late" })),
    success("second", COST_BUDGET_STOP),
  ]);
  harness.setQueryStart(() => Effect.succeed(messages.iterable));

  const observation = await harness.runHarness();

  expect(observation.finalText).toBe("first");
  expect(observation.costUsd).toBe(COST_FULL);
  expect(observation.toolCalls).toStrictEqual([]);
  expect(messages.nextCallCount()).toBe(SINGLE_ITERATOR_CALL_COUNT);
  expect(messages.returnCallCount()).toBe(SINGLE_ITERATOR_CALL_COUNT);
});

test("a tracked next promise settles before a subsequently queued microtask", async () => {
  const messages = createTrackedMessages([success("done", COST_FULL)]);
  const iterator = messages.iterable[Symbol.asyncIterator]();
  const settlementOrder: string[] = [];

  const nextResult = iterator.next();
  void nextResult.then(() => {
    settlementOrder.push("next settled");
  });
  queueMicrotask(() => {
    settlementOrder.push("queued microtask");
  });

  await nextResult;
  await Promise.resolve();

  expect(settlementOrder).toStrictEqual(["next settled", "queued microtask"]);
});

test("a rejecting tracked return settles before a subsequently queued microtask", async () => {
  const cleanupFailure = new Error("cleanup failed");
  const messages = createTrackedMessages([], cleanupFailure);
  const iterator = messages.iterable[Symbol.asyncIterator]();
  const settlementOrder: string[] = [];

  const returnResult = iterator.return?.();
  if (returnResult === undefined) {
    throw new Error("expected the tracked iterator to implement return");
  }
  void returnResult.catch(() => {
    settlementOrder.push("return settled");
  });
  queueMicrotask(() => {
    settlementOrder.push("queued microtask");
  });

  await expect(returnResult).rejects.toBe(cleanupFailure);
  await Promise.resolve();

  expect(settlementOrder).toStrictEqual(["return settled", "queued microtask"]);
});

test("a cleanup failure after a result cannot replace that result", async () => {
  const messages = createTrackedMessages(
    [success("recorded", COST_FULL)],
    new Error("cleanup failed"),
  );
  harness.setQueryStart(() => Effect.succeed(messages.iterable));

  const observation = await harness.runHarness();

  expect(observation.subtype).toBe("success");
  expect(observation.finalText).toBe("recorded");
  expect(observation.costUsd).toBe(COST_FULL);
  expect(messages.returnCallCount()).toBe(SINGLE_ITERATOR_CALL_COUNT);
});

test("a run that exceeds its wall clock is aborted and settles", async () => {
  harness.setQueryStart(
    abortAwareQuery(async function* (signal) {
      yield assistant(toolUse("Read"));
      await once(signal, "abort");
      throw new Error("The operation was aborted");
    }),
  );

  const observation = await harness.runHarness({
    wallClockMs: SHORT_WALL_CLOCK_MS,
  });

  expect(observation.timedOut).toBe(true);
  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.costUsd).toBe(NO_COST_USD);
  expect(observation.toolCalls.map((call) => call.name)).toStrictEqual([
    "Read",
  ]);
});

test("a result after abort retains both verdict and timeout evidence", async () => {
  harness.setQueryStart(
    abortAwareQuery(async function* (signal) {
      await once(signal, "abort");
      yield success("late result", COST_FULL);
    }),
  );

  const observation = await harness.runHarness({
    wallClockMs: SHORT_WALL_CLOCK_MS,
  });

  expect(observation.subtype).toBe("success");
  expect(observation.finalText).toBe("late result");
  expect(observation.costUsd).toBe(COST_FULL);
  expect(observation.timedOut).toBe(true);
});

test("a completed run cannot be re-flagged by its expired timer", async () => {
  vi.useFakeTimers();

  const observation = await harness.runHarness({
    wallClockMs: SHORT_WALL_CLOCK_MS,
  });
  const abortController = harness.lastQueryRequest().options?.abortController;
  expect(abortController).toBeInstanceOf(AbortController);

  vi.advanceTimersByTime(PAST_THE_DEADLINE_MS);

  expect(abortController?.signal.aborted).toBe(false);
  expect(observation.timedOut).toBe(false);
});
