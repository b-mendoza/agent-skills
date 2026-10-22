import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { query } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

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
import type { RunOptions } from "#/observation/observation-types.ts";

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
let cwd = "";
let options: RunOptions = {
  cwd: "",
  prompt: "observe",
  budgetUsd: 0,
  model: "haiku",
  wallClockMs: 0,
};
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "observation-failure-"));
  execFileSync("git", ["init", "-q"], { cwd });
  options = {
    cwd,
    prompt: "observe",
    budgetUsd: COST,
    model: "haiku",
    wallClockMs: WALL_CLOCK,
  };
  sdk.query.mockReset();
});
afterEach(() => {
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

test.each([NaN, Infinity, -Infinity])(
  "non-finite result cost fails closed: %s",
  async (cost) => {
    sdk.query.mockImplementation(() => scripted(success("done", cost)));
    const observation = await observeClaude(options);
    expect(observation).toMatchObject({
      subtype: QUERY_ERROR_SUBTYPE,
      costUsd: 0,
    });
    expect(observation.finalText).toContain("finite number");
  },
);

test("a BigInt thrown value cannot reject observation settlement", async () => {
  sdk.query.mockImplementation(() => {
    return {
      [Symbol.asyncIterator]: () => ({
        next: vi
          .fn<AsyncIterator<unknown>["next"]>()
          .mockRejectedValue(FOREIGN_BIGINT),
      }),
    };
  });
  expect(await observeClaude(options)).toMatchObject({
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
    finalText: "1",
    costUsd: 0,
  });
});

test("a cyclic thrown value cannot reject observation settlement", async () => {
  const failure: Record<string, unknown> = {};
  failure["self"] = failure;
  sdk.query.mockImplementation(() => ({
    [Symbol.asyncIterator]: () => ({
      next: vi.fn<AsyncIterator<unknown>["next"]>().mockRejectedValue(failure),
    }),
  }));
  const observation = await observeClaude(options);
  expect(observation).toMatchObject({
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
    costUsd: 0,
  });
  expect(observation.finalText).toBeTypeOf("string");
  expect(observation.finalText).not.toBe("");
});

test.each([null, undefined])(
  "a nullish failure uses the no-result diagnostic: %s",
  async (failure) => {
    sdk.query.mockImplementation(() => ({
      [Symbol.asyncIterator]: () => ({
        next: vi
          .fn<AsyncIterator<unknown>["next"]>()
          .mockRejectedValue(failure),
      }),
    }));
    expect((await observeClaude(options)).finalText).toBe(
      "query ended without a result message",
    );
  },
);

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
