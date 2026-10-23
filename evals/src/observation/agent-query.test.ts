import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { query } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { Observation, RunOptions } from "#/observation/agent-query.ts";
import {
  observeClaude,
  QUERY_ERROR_SUBTYPE,
} from "#/observation/agent-query.ts";
import { scripted } from "#/observation/observation-test-support.ts";

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
const BUDGET = 0.01;
const ZERO_COST = 0;
const FOREIGN_BIGINT = 1n;
const WALL_CLOCK_LIMIT = 25;
const PAST_WALL_CLOCK_LIMIT = 50;

const toolUse = (name: string, input: unknown = {}) => ({
  type: "tool_use",
  name,
  input,
});
const assistant = (...content: unknown[]) => ({
  type: "assistant",
  message: { content },
});
const success = (result: string, totalCostUsd = COST) => ({
  type: "result",
  subtype: "success",
  is_error: false,
  result,
  total_cost_usd: totalCostUsd,
});
let cwd = "";
const options: RunOptions = {
  cwd: "",
  prompt: "observe the repo",
  budgetUsd: BUDGET,
  model: "haiku",
  wallClockMs: 30_000,
};
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "observation-"));
  execFileSync("git", ["init", "-q"], { cwd });
  options.cwd = cwd;
  sdk.query
    .mockReset()
    .mockImplementation(() => scripted(success("done", COST)));
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(cwd, { recursive: true, force: true });
});

test("the query owns its policy and inherits ambient credentials", async () => {
  await observeClaude(options);
  const abortController: unknown = expect.any(AbortController);
  const [request] = sdk.query.mock.lastCall ?? [];
  expect(request).toMatchObject({
    prompt: options.prompt,
    options: {
      cwd,
      model: "haiku",
      maxBudgetUsd: BUDGET,
      permissionMode: "auto",
      settingSources: ["project"],
      systemPrompt: { type: "preset", preset: "claude_code" },
      tools: { type: "preset", preset: "claude_code" },
      abortController,
    },
  });
  expect(request?.options).not.toHaveProperty("env");
});

test("tool calls accumulate across assistant messages in stream order", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      null,
      [],
      {},
      { type: 1 },
      { type: "user", message: { content: "prompt" } },
      assistant({ type: "text" }, toolUse("Read")),
      assistant(toolUse("Bash", { command: "git log" }), toolUse("Grep")),
      success("done", COST),
    ),
  );
  const observation = await observeClaude(options);
  expect(observation).toMatchObject({
    subtype: "success",
    isError: false,
    finalText: "done",
    costUsd: COST,
    timedOut: false,
  });
  expect(observation.toolCalls).toStrictEqual([
    { name: "Read", input: {} },
    { name: "Bash", input: { command: "git log" } },
    { name: "Grep", input: {} },
  ]);
});

test("malformed inputs degrade to empty records", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      assistant(toolUse("Write", ["an", "array"]), toolUse("Edit", "scalar")),
      success("done"),
    ),
  );
  expect((await observeClaude(options)).toolCalls).toStrictEqual([
    { name: "Write", input: {} },
    { name: "Edit", input: {} },
  ]);
});

test("tool input is an owned record without inherited properties", async () => {
  const input = { command: "git status" };
  Object.setPrototypeOf(input, { inherited: "not owned" });
  sdk.query.mockImplementation(() =>
    scripted(assistant(toolUse("Read", input)), success("done")),
  );
  const [call] = (await observeClaude(options)).toolCalls;
  expect(call?.input).toStrictEqual({ command: "git status" });
  expect(call?.input).not.toHaveProperty("inherited");
});

test("authentication failure keeps subtype and isError independent", async () => {
  sdk.query.mockImplementation(() =>
    scripted({
      ...success("Failed to authenticate: OAuth session expired", ZERO_COST),
      is_error: true,
    }),
  );
  expect(await observeClaude(options)).toMatchObject({
    subtype: "success",
    isError: true,
    toolCalls: [],
  });
});

test("error_max_budget_usd preserves diagnostics, cost, and calls", async () => {
  sdk.query.mockImplementation(() =>
    scripted(assistant(toolUse("Skill")), {
      type: "result",
      subtype: "error_max_budget_usd",
      is_error: true,
      errors: ["max budget exceeded", "budget was $0.01"],
      total_cost_usd: COST,
    }),
  );
  expect(await observeClaude(options)).toMatchObject({
    subtype: "error_max_budget_usd",
    isError: true,
    finalText: "max budget exceeded\nbudget was $0.01",
    costUsd: COST,
    toolCalls: [{ name: "Skill", input: {} }],
  });
});

test.each([
  [assistant(toolUse("Write"), null), ["Read"]],
  [{ ...success("done"), total_cost_usd: "not a number" }, ["Read"]],
])(
  "a malformed relevant message fails closed: %j",
  async (message, retainedNames) => {
    sdk.query.mockImplementation(() =>
      scripted(assistant(toolUse("Read")), message, success("done")),
    );
    const observation = await observeClaude(options);
    expect(observation).toMatchObject({
      subtype: QUERY_ERROR_SUBTYPE,
      isError: true,
      costUsd: 0,
    });
    expect(observation.finalText).not.toBe("");
    expect(observation.toolCalls.map((call) => call.name)).toStrictEqual(
      retainedNames,
    );
  },
);

test("non-finite result cost fails closed: NaN", async () => {
  sdk.query.mockImplementation(() => scripted(success("done", NaN)));
  const observation = await observeClaude(options);
  expect(observation).toMatchObject({
    subtype: QUERY_ERROR_SUBTYPE,
    costUsd: 0,
  });
  expect(observation.finalText).toContain("finite number");
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
  let closed = false;
  sdk.query.mockImplementation(async function* () {
    try {
      yield await Promise.resolve(success("first", COST));
      yield assistant(toolUse("Write"));
      yield success("second");
    } finally {
      closed = true;
    }
  });
  expect(await observeClaude(options)).toMatchObject({
    finalText: "first",
    costUsd: COST,
    toolCalls: [],
  });
  expect(closed).toBe(true);
});

test("cleanup rejection escapes when next rejects without a result", async () => {
  const cleanupError = new Error("cleanup failed");
  sdk.query.mockImplementation(() => ({
    [Symbol.asyncIterator]: () => ({
      next: vi
        .fn<AsyncIterator<unknown>["next"]>()
        .mockRejectedValue(new Error("stream died")),
      return: vi
        .fn<NonNullable<AsyncIterator<unknown>["return"]>>()
        .mockRejectedValue(cleanupError),
    }),
  }));
  await expect(observeClaude(options)).rejects.toBe(cleanupError);
});

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
  vi.useFakeTimers();
  sdk.query.mockImplementation(async function* ({ options: requestOptions }) {
    const signal = requestOptions?.abortController?.signal;
    if (signal === undefined) throw new Error("no abort signal");
    yield assistant(toolUse("Read"));
    await once(signal, "abort");
    throw new Error("The operation was aborted");
  });
  const pending = observeClaude({ ...options, wallClockMs: WALL_CLOCK_LIMIT });
  await vi.advanceTimersByTimeAsync(WALL_CLOCK_LIMIT);
  expect(await pending).toMatchObject({
    timedOut: true,
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
    costUsd: 0,
    toolCalls: [{ name: "Read", input: {} }],
  });
  expect(vi.getTimerCount()).toBeFalsy();
});

test("a result after abort retains verdict and timeout evidence", async () => {
  vi.useFakeTimers();
  sdk.query.mockImplementation(async function* ({ options: requestOptions }) {
    const signal = requestOptions?.abortController?.signal;
    if (signal === undefined) throw new Error("no abort signal");
    await once(signal, "abort");
    yield success("late result");
  });
  const pending = observeClaude({ ...options, wallClockMs: WALL_CLOCK_LIMIT });
  await vi.advanceTimersByTimeAsync(WALL_CLOCK_LIMIT);
  expect(await pending).toMatchObject({
    subtype: "success",
    finalText: "late result",
    costUsd: 0.5,
    timedOut: true,
  });
  expect(vi.getTimerCount()).toBeFalsy();
});

test.each(["next", "return"])(
  "a hung %s settles after abort grace",
  async (hung) => {
    vi.useFakeTimers();
    const stalled = once(new EventTarget(), "never");
    sdk.query.mockImplementation(() => {
      writeFileSync(join(cwd, "changed.txt"), "changed");
      return {
        [Symbol.asyncIterator]: () => ({
          next: vi
            .fn<AsyncIterator<unknown>["next"]>()
            .mockResolvedValueOnce({
              done: false,
              value: assistant(toolUse("Read")),
            })
            .mockImplementation(async () => {
              if (hung === "next") await stalled;
              return { done: false, value: success("recorded") };
            }),
          return: async () => {
            await stalled;
            return { done: true, value: undefined };
          },
        }),
      };
    });
    let observation: Observation | undefined = undefined;
    void observeClaude({ ...options, wallClockMs: WALL_CLOCK_LIMIT }).then(
      (value) => {
        observation = value;
      },
    );
    await vi.advanceTimersByTimeAsync(WALL_CLOCK_LIMIT);
    expect(observation).toBeUndefined();
    await vi.runAllTimersAsync();
    const diagnostic = "query did not settle after abort";
    expect(observation).toMatchObject({
      timedOut: true,
      subtype: hung === "next" ? QUERY_ERROR_SUBTYPE : "success",
      isError: hung === "next",
      costUsd: hung === "next" ? ZERO_COST : COST,
      finalText: hung === "next" ? diagnostic : "recorded",
      toolCalls: [{ name: "Read", input: {} }],
      gitStatusBefore: { kind: "worktree", entries: "" },
      gitStatusAfter: { kind: "worktree", entries: "?? changed.txt" },
    });
    expect(vi.getTimerCount()).toBeFalsy();
  },
);

test("a completed run cannot be re-flagged by an expired timer", async () => {
  vi.useFakeTimers();
  const captured: { request?: Parameters<typeof query>[0] } = {};
  sdk.query.mockImplementation((request) => {
    captured.request = request;
    return scripted(success("done"));
  });
  const observation = await observeClaude({
    ...options,
    wallClockMs: WALL_CLOCK_LIMIT,
  });
  const abortController = captured.request?.options?.abortController;
  expect(abortController).toBeInstanceOf(AbortController);
  if (abortController === undefined) {
    throw new Error("missing abort controller");
  }
  vi.advanceTimersByTime(PAST_WALL_CLOCK_LIMIT);
  expect(abortController.signal.aborted).toBe(false);
  expect(observation.timedOut).toBe(false);
  expect(vi.getTimerCount()).toBeFalsy();
});
