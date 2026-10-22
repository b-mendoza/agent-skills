import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
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
const DEADLINE = 25;
const PAST_DEADLINE = 50;
let options: RunOptions = {
  cwd: "",
  prompt: "observe",
  budgetUsd: 0,
  model: "haiku",
  wallClockMs: 0,
};
beforeEach(() => {
  options = {
    cwd: mkdtempSync(join(tmpdir(), "observation-timeout-")),
    prompt: "observe",
    budgetUsd: 0,
    model: "haiku",
    wallClockMs: DEADLINE,
  };
  sdk.query.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(options.cwd, { recursive: true, force: true });
});

test("a run exceeding its wall clock is aborted and settles", async () => {
  sdk.query.mockImplementation(async function* ({ options: requestOptions }) {
    const signal = requestOptions?.abortController?.signal;
    if (signal === undefined) throw new Error("no abort signal");
    yield assistant(toolUse("Read"));
    await once(signal, "abort");
    throw new Error("The operation was aborted");
  });
  expect(await observeClaude(options)).toMatchObject({
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
  expect(await observeClaude(options)).toMatchObject({
    subtype: "success",
    finalText: "late result",
    costUsd: 0.5,
    timedOut: true,
  });
});

test("a completed run cannot be re-flagged by an expired timer", async () => {
  vi.useFakeTimers();
  const captured: { controller: AbortController | undefined } = {
    controller: undefined,
  };
  sdk.query.mockImplementation((request) => {
    captured.controller = request.options?.abortController;
    return scripted(success("done"));
  });
  const observation = await observeClaude(options);
  const abortController = captured.controller;
  expect(abortController).toBeInstanceOf(AbortController);
  if (abortController === undefined) {
    throw new Error("missing abort controller");
  }
  vi.advanceTimersByTime(PAST_DEADLINE);
  expect(abortController.signal.aborted).toBe(false);
  expect(observation.timedOut).toBe(false);
});
