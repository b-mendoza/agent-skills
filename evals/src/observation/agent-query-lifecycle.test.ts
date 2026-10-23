import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { query } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { RunOptions } from "#/observation/agent-query.ts";
import {
  observeClaude,
  QUERY_ERROR_SUBTYPE,
} from "#/observation/agent-query.ts";
import {
  assistant,
  scripted,
  success,
  toolUse,
} from "#/observation/observation-test-support.ts";

const sdk = vi.hoisted(() => ({
  query:
    vi.fn<(request: Parameters<typeof query>[0]) => AsyncIterable<unknown>>(),
}));
vi.mock(
  import("@anthropic-ai/claude-agent-sdk"),
  async (original): Promise<Record<string, unknown>> => ({
    ...(await original()),
    query: sdk.query,
  }),
);
const COST = 0.5;
const FOREIGN_BIGINT = 1n;
const WALL_CLOCK = 30_000;
const DEADLINE = 25;
const PAST_DEADLINE = 50;
let cwd = "";
const options: RunOptions = {
  cwd: "",
  prompt: "observe",
  budgetUsd: COST,
  model: "haiku",
  wallClockMs: WALL_CLOCK,
};
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "observation-failure-"));
  execFileSync("git", ["init", "-q"], { cwd });
  options.cwd = cwd;
  sdk.query.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(cwd, { recursive: true, force: true });
});

test("startup failure samples git after settlement and books no cost", async () => {
  sdk.query.mockImplementation(() => {
    writeFileSync(join(cwd, "changed.txt"), "changed");
    throw new Error("bundled CLI failed to start");
  });
  expect(await observeClaude(options)).toMatchObject({
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
    finalText: "bundled CLI failed to start",
    costUsd: 0,
    timedOut: false,
    gitStatusBefore: { kind: "worktree", entries: "" },
    gitStatusAfter: { kind: "worktree", entries: "?? changed.txt" },
  });
});

test("a mid-stream failure keeps earlier tool calls", async () => {
  sdk.query.mockImplementation(async function* () {
    yield await Promise.resolve(
      assistant(toolUse("Write", { file_path: "/repo/x" })),
    );
    throw new Error("stream died");
  });
  expect(await observeClaude(options)).toMatchObject({
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
    finalText: "stream died",
    costUsd: 0,
    toolCalls: [{ name: "Write", input: { file_path: "/repo/x" } }],
  });
});

const cyclicFailure: Record<string, unknown> = {};
cyclicFailure["self"] = cyclicFailure;
test.each([
  [
    "a BigInt thrown value cannot reject observation settlement",
    FOREIGN_BIGINT,
    "1",
  ],
  [
    "a cyclic thrown value cannot reject observation settlement",
    cyclicFailure,
    "[object Object]",
  ],
  [
    "a nullish failure uses the no-result diagnostic: null",
    null,
    "query ended without a result message",
  ],
  [
    "a nullish failure uses the no-result diagnostic: undefined",
    undefined,
    "query ended without a result message",
  ],
])("%s", async (_name, failure, finalText) => {
  sdk.query.mockImplementation(() => ({
    [Symbol.asyncIterator]: () => ({
      next: vi.fn<AsyncIterator<unknown>["next"]>().mockRejectedValue(failure),
    }),
  }));
  expect(await observeClaude(options)).toMatchObject({
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
    finalText,
    costUsd: 0,
  });
});

test("a stream ending without a result fails closed", async () => {
  sdk.query.mockImplementation(() => scripted(assistant(toolUse("Read"))));
  expect(await observeClaude(options)).toMatchObject({
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
    finalText: "query ended without a result message",
    costUsd: 0,
    toolCalls: [{ name: "Read", input: {} }],
  });
});

test("the first result stops iteration and closes the generator", async () => {
  const closed = vi.fn();
  sdk.query.mockImplementation(async function* () {
    try {
      yield await Promise.resolve(success("first", COST));
      yield assistant(toolUse("Write"));
      yield success("second");
    } finally {
      closed();
    }
  });
  expect(await observeClaude(options)).toMatchObject({
    finalText: "first",
    costUsd: COST,
    toolCalls: [],
  });
  expect(closed).toHaveBeenCalledExactlyOnceWith();
});

test.each(["rejects", "exhausts"])(
  "cleanup rejection escapes when next %s without a result",
  async (outcome) => {
    const cleanupError = new Error("cleanup failed");
    const next = vi.fn<AsyncIterator<unknown>["next"]>();
    if (outcome === "rejects") next.mockRejectedValue(new Error("stream died"));
    else next.mockResolvedValue({ done: true, value: undefined });
    sdk.query.mockImplementation(() => ({
      [Symbol.asyncIterator]: () => ({
        next,
        return: vi
          .fn<NonNullable<AsyncIterator<unknown>["return"]>>()
          .mockRejectedValue(cleanupError),
      }),
    }));
    await expect(observeClaude(options)).rejects.toBe(cleanupError);
  },
);

test("cleanup failure cannot replace an observed result", async () => {
  const close = vi
    .fn<NonNullable<AsyncIterator<unknown>["return"]>>()
    .mockRejectedValue(new Error("cleanup failed"));
  sdk.query.mockImplementation(() => ({
    [Symbol.asyncIterator]: () => ({
      next: vi
        .fn<AsyncIterator<unknown>["next"]>()
        .mockResolvedValue({ done: false, value: success("recorded", COST) }),
      return: close,
    }),
  }));
  expect(await observeClaude(options)).toMatchObject({
    subtype: "success",
    finalText: "recorded",
    costUsd: COST,
  });
  expect(close).toHaveBeenCalledExactlyOnceWith();
});

test("a run exceeding its wall clock is aborted and settles", async () => {
  sdk.query.mockImplementation(async function* ({ options: requestOptions }) {
    const signal = requestOptions?.abortController?.signal;
    if (signal === undefined) throw new Error("no abort signal");
    yield assistant(toolUse("Read"));
    await once(signal, "abort");
    throw new Error("The operation was aborted");
  });
  expect(
    await observeClaude({ ...options, wallClockMs: DEADLINE }),
  ).toMatchObject({
    timedOut: true,
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
    costUsd: 0,
    toolCalls: [{ name: "Read", input: {} }],
  });
});

test("a result after abort retains verdict and timeout evidence", async () => {
  sdk.query.mockImplementation(async function* ({ options: requestOptions }) {
    const signal = requestOptions?.abortController?.signal;
    if (signal === undefined) throw new Error("no abort signal");
    await once(signal, "abort");
    yield success("late result");
  });
  expect(
    await observeClaude({ ...options, wallClockMs: DEADLINE }),
  ).toMatchObject({
    subtype: "success",
    finalText: "late result",
    costUsd: 0.5,
    timedOut: true,
  });
});

test("a completed run cannot be re-flagged by an expired timer", async () => {
  vi.useFakeTimers();
  const captured: { request?: Parameters<typeof query>[0] } = {};
  sdk.query.mockImplementation((request) => {
    captured.request = request;
    return scripted(success("done"));
  });
  const observation = await observeClaude({
    ...options,
    wallClockMs: DEADLINE,
  });
  const abortController = captured.request?.options?.abortController;
  expect(abortController).toBeInstanceOf(AbortController);
  if (abortController === undefined) {
    throw new Error("missing abort controller");
  }
  vi.advanceTimersByTime(PAST_DEADLINE);
  expect(abortController.signal.aborted).toBe(false);
  expect(observation.timedOut).toBe(false);
});
