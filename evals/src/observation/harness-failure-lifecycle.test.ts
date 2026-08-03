// Pins failure settlement, iterator cleanup, and wall-clock behavior without starting an SDK subprocess.

import { once } from "node:events";

import { Effect } from "effect";
import { expect, test, vi } from "vitest";

import { QUERY_ERROR_SUBTYPE, QueryStartError } from "#/observation/harness.ts";
import type { FakeMessage } from "#/observation/harness-lifecycle-test-support.ts";
import {
  assistant,
  COST_BUDGET_STOP,
  COST_FULL,
  createTrackedMessages,
  EXPECTED_GIT_SAMPLE_COUNT,
  fakeQuery,
  FOREIGN_BIGINT,
  lastQueryRequest,
  PAST_THE_DEADLINE_MS,
  runHarness,
  sampledRepositories,
  scripted,
  setQueryStart,
  SHORT_WALL_CLOCK_MS,
  success,
  toolUse,
} from "#/observation/harness-lifecycle-test-support.ts";

test("a query startup failure settles and books no cost", async () => {
  setQueryStart(() =>
    Effect.fail(
      new QueryStartError({
        cause: new Error("bundled CLI failed to start"),
      }),
    ),
  );

  const observation = await runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("bundled CLI failed to start");
  expect(observation.costUsd).toBe(0);
  expect(observation.timedOut).toBe(false);
  expect(sampledRepositories).toHaveLength(EXPECTED_GIT_SAMPLE_COUNT);
});

test("a mid-stream failure keeps observations already made", async () => {
  setQueryStart(() =>
    Effect.succeed(
      fakeQuery(function* () {
        yield assistant(toolUse("Write", { file_path: "/repo/x" }));
        throw new Error("stream died");
      }),
    ),
  );

  const observation = await runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("stream died");
  expect(observation.costUsd).toBe(0);
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
    expectedFinalText: "Expected object, got null",
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
    expectedFinalText:
      'Expected number, got "not a number"\n  at ["total_cost_usd"]',
    expectedRetainedToolNames: ["Write"],
  },
] satisfies ReadonlyArray<{
  name: string;
  messageScript: FakeMessage[];
  expectedFinalText: string;
  expectedRetainedToolNames: string[];
}>)(
  "$name",
  async ({ messageScript, expectedFinalText, expectedRetainedToolNames }) => {
    setQueryStart(() => Effect.succeed(scripted(...messageScript)));

    const observation = await runHarness();

    expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
    expect(observation.isError).toBe(true);
    expect(observation.finalText).toBe(expectedFinalText);
    expect(observation.costUsd).toBe(0);
    expect(observation.toolCalls.map((call) => call.name)).toStrictEqual(
      expectedRetainedToolNames,
    );
  },
);

test.each([
  [NaN, 'Expected finite number, got NaN\n  at ["total_cost_usd"]'],
  [Infinity, 'Expected finite number, got Infinity\n  at ["total_cost_usd"]'],
  [-Infinity, 'Expected finite number, got -Infinity\n  at ["total_cost_usd"]'],
] satisfies ReadonlyArray<readonly [number, string]>)(
  "a non-finite result cost fails closed: %s",
  async (totalCostUsd, expectedFinalText) => {
    setQueryStart(() =>
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

    const observation = await runHarness();

    expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
    expect(observation.finalText).toBe(expectedFinalText);
    expect(observation.costUsd).toBe(0);
  },
);

const cyclicFailure: Record<string, unknown> = {};
cyclicFailure["self"] = cyclicFailure;

test.each([
  {
    name: "a BigInt thrown value cannot reject observation settlement",
    thrownValue: FOREIGN_BIGINT,
    expectedFinalText: "1",
  },
  {
    name: "a cyclic thrown value cannot reject observation settlement",
    thrownValue: cyclicFailure,
    expectedFinalText: null,
  },
])("$name", async ({ thrownValue, expectedFinalText }) => {
  setQueryStart(() => Effect.fail(new QueryStartError({ cause: thrownValue })));

  const observation = await runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBeTypeOf("string");
  expect(
    expectedFinalText === null || observation.finalText === expectedFinalText,
  ).toBe(true);
  expect(observation.costUsd).toBe(0);
});

test.each([null, undefined])(
  "a nullish query failure uses the no-result diagnostic",
  async (failure) => {
    setQueryStart(() => Effect.fail(new QueryStartError({ cause: failure })));

    const observation = await runHarness();

    expect(observation.finalText).toBe("query ended without a result message");
  },
);

test("a stream that ends without a result fails closed", async () => {
  setQueryStart(() => Effect.succeed(scripted(assistant(toolUse("Read")))));

  const observation = await runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("query ended without a result message");
  expect(observation.costUsd).toBe(0);
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
  setQueryStart(() => Effect.succeed(messages.iterable));

  const observation = await runHarness();

  expect(observation.finalText).toBe("first");
  expect(observation.costUsd).toBe(COST_FULL);
  expect(observation.toolCalls).toStrictEqual([]);
  expect(messages.nextCallCount()).toBe(1);
  expect(messages.returnCallCount()).toBe(1);
});

test("a cleanup failure after a result cannot replace that result", async () => {
  const messages = createTrackedMessages(
    [success("recorded", COST_FULL)],
    new Error("cleanup failed"),
  );
  setQueryStart(() => Effect.succeed(messages.iterable));

  const observation = await runHarness();

  expect(observation.subtype).toBe("success");
  expect(observation.finalText).toBe("recorded");
  expect(observation.costUsd).toBe(COST_FULL);
  expect(messages.returnCallCount()).toBe(1);
});

test("a run that exceeds its wall clock is aborted and settles", async () => {
  setQueryStart((request) => {
    const signal = request.options?.abortController?.signal;
    if (signal == null) {
      return Effect.fail(
        new QueryStartError({
          cause: new Error("no abort controller supplied"),
        }),
      );
    }
    return Effect.succeed(
      fakeQuery(async function* () {
        yield assistant(toolUse("Read"));
        await once(signal, "abort");
        throw new Error("The operation was aborted");
      }),
    );
  });

  const observation = await runHarness({
    wallClockMs: SHORT_WALL_CLOCK_MS,
  });

  expect(observation.timedOut).toBe(true);
  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.costUsd).toBe(0);
  expect(observation.toolCalls.map((call) => call.name)).toStrictEqual([
    "Read",
  ]);
});

test("a result after abort retains both verdict and timeout evidence", async () => {
  setQueryStart((request) => {
    const signal = request.options?.abortController?.signal;
    if (signal == null) {
      return Effect.fail(
        new QueryStartError({
          cause: new Error("no abort controller supplied"),
        }),
      );
    }
    return Effect.succeed(
      fakeQuery(async function* () {
        await once(signal, "abort");
        yield success("late result", COST_FULL);
      }),
    );
  });

  const observation = await runHarness({
    wallClockMs: SHORT_WALL_CLOCK_MS,
  });

  expect(observation.subtype).toBe("success");
  expect(observation.finalText).toBe("late result");
  expect(observation.costUsd).toBe(COST_FULL);
  expect(observation.timedOut).toBe(true);
});

test("a completed run cannot be re-flagged by its expired timer", async () => {
  vi.useFakeTimers();

  const observation = await runHarness({
    wallClockMs: SHORT_WALL_CLOCK_MS,
  });
  const abortController = lastQueryRequest().options?.abortController;
  expect(abortController).toBeInstanceOf(AbortController);

  vi.advanceTimersByTime(PAST_THE_DEADLINE_MS);

  expect(abortController?.signal.aborted).toBe(false);
  expect(observation.timedOut).toBe(false);
});
