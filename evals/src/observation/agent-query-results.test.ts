import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { Schema } from "effect";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  observationSchema,
  observeClaude,
  QUERY_ERROR_SUBTYPE,
} from "#/observation/agent-query.ts";
import {
  createObservation,
  scripted,
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
const toolUse = (name: string, input: unknown = {}) => ({
  type: "tool_use",
  name,
  input,
});
const assistant = (...content: unknown[]) => ({
  type: "assistant",
  message: { content },
});
const COST = 0.5;
const FINAL_COST = 0.75;
const THIRD_TURN_COST = 0.9;
const WALL_CLOCK_LIMIT = 25;
const success = (result: string, totalCostUsd = COST) => ({
  type: "result",
  subtype: "success",
  is_error: false,
  result,
  total_cost_usd: totalCostUsd,
});
const options = {
  cwd: "",
  prompt: "check current facts",
  budgetUsd: 0.01,
  model: "haiku",
  wallClockMs: 30_000,
};
beforeEach(() => {
  options.cwd = mkdtempSync(join(tmpdir(), "web-results-"));
  execFileSync("git", ["init", "-q"], { cwd: options.cwd });
  sdk.query.mockReset().mockImplementation(() => scripted(success("done")));
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(options.cwd, { recursive: true, force: true });
});
const OVERSIZED_CHARS = 40_000;
const RESULT_CHARS = 8_000;
const ZERO_CHARS = 0;

const user = (
  content: SDKUserMessage["message"]["content"],
): SDKUserMessage => ({
  type: "user",
  message: { role: "user", content },
  parent_tool_use_id: null,
});

test("web results attach to their call IDs, not arrival order; other results stay out", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      assistant(
        { ...toolUse("WebFetch", { url: "https://nodejs.org" }), id: "fetch" },
        { ...toolUse("WebSearch", { query: "Node LTS" }), id: "search" },
        { ...toolUse("Read"), id: "read" },
      ),
      user([
        {
          type: "tool_result",
          tool_use_id: "search",
          content: [{ type: "text", text: "Official release schedule" }],
        },
        {
          type: "tool_result",
          tool_use_id: "read",
          content: "private file contents",
        },
        {
          type: "tool_result",
          tool_use_id: "unknown",
          content: "unmatched result",
        },
        {
          type: "tool_result",
          tool_use_id: "fetch",
          content: "HTTP 503 Service Unavailable",
          is_error: true,
        },
      ]),
      success("done"),
    ),
  );
  const observation = await observeClaude(options);
  expect(observation.toolCalls).toStrictEqual([
    {
      name: "WebFetch",
      id: "fetch",
      input: { url: "https://nodejs.org" },
      result: {
        content: "HTTP 503 Service Unavailable",
        isError: true,
        truncated: false,
      },
    },
    {
      name: "WebSearch",
      id: "search",
      input: { query: "Node LTS" },
      result: {
        content: '[{"type":"text","text":"Official release schedule"}]',
        isError: false,
        truncated: false,
      },
    },
    { name: "Read", id: "read", input: {} },
  ]);
  expect(
    Schema.decodeUnknownSync(observationSchema)(observation),
  ).toStrictEqual(observation);
});

test("web evidence is truncated per result and across the observation", async () => {
  const oversizedContent = "x".repeat(OVERSIZED_CHARS);
  sdk.query.mockImplementation(() =>
    scripted(
      ...Array.from({ length: 5 }, (_, index) =>
        assistant({ ...toolUse("WebFetch"), id: `fetch-${String(index)}` }),
      ),
      user(
        Array.from({ length: 5 }, (_, index) => ({
          type: "tool_result" as const,
          tool_use_id: `fetch-${String(index)}`,
          content: oversizedContent,
        })),
      ),
      success("done"),
    ),
  );
  const observation = await observeClaude(options);
  expect(
    observation.toolCalls.map((call) => call.result?.content.length),
  ).toStrictEqual([
    RESULT_CHARS,
    RESULT_CHARS,
    RESULT_CHARS,
    RESULT_CHARS,
    ZERO_CHARS,
  ]);
  expect(
    observation.toolCalls.every((call) => call.result?.truncated === true),
  ).toBe(true);
});

test("saved observations without call IDs or results remain valid", () => {
  const observation = createObservation();
  observation.toolCalls = [
    { name: "WebFetch", input: { url: "https://nodejs.org" } },
  ];
  expect(
    Schema.decodeUnknownSync(observationSchema)(observation),
  ).toStrictEqual(observation);
});

describe("environment", () => {
  test("a PATH prefix preserves ambient credentials and other environment variables", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "offline-test-key");
    vi.stubEnv("PATH", "/ambient/bin");
    vi.stubEnv("EVAL_AMBIENT_TEST", "inherited");
    sdk.query.mockImplementation(() =>
      scripted({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "done",
        total_cost_usd: 0,
      }),
    );
    try {
      await observeClaude({
        cwd: "/unused-offline-path",
        prompt: "offline",
        budgetUsd: 0.01,
        model: "haiku",
        wallClockMs: 1000,
        pathPrefix: "/fixture/bin",
      });
      expect(sdk.query.mock.lastCall).toMatchObject([
        {
          options: {
            env: {
              ANTHROPIC_API_KEY: "offline-test-key",
              EVAL_AMBIENT_TEST: "inherited",
              PATH: "/fixture/bin:/ambient/bin",
            },
          },
        },
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

test("keeps input open for a one-turn run and closes it after settlement", async () => {
  const captured: { inputEnded?: Promise<IteratorResult<unknown>> } = {};
  sdk.query.mockImplementation(async function* ({ prompt }) {
    if (typeof prompt === "string") throw new Error("expected streaming input");
    const input = prompt[Symbol.asyncIterator]();
    expect(await input.next()).toMatchObject({
      done: false,
      value: {
        type: "user",
        message: { role: "user", content: options.prompt },
        parent_tool_use_id: null,
      },
    });
    captured.inputEnded = input.next();
    let closed = false;
    void captured.inputEnded.then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    yield success("done", COST);
  });

  expect(await observeClaude(options)).toMatchObject({
    subtype: "success",
    finalText: "done",
    costUsd: COST,
    timedOut: false,
  });
  expect(await captured.inputEnded).toMatchObject({ done: true });
});

const liveTasks = (...taskIds: string[]) => ({
  type: "system",
  subtype: "background_tasks_changed",
  tasks: taskIds.map((taskId) => ({
    task_id: taskId,
    task_type: "local_agent",
    description: "investigate the fixture",
  })),
});
const taskNotification = (taskId: string, status = "completed") => ({
  type: "system",
  subtype: "task_notification",
  task_id: taskId,
  status,
  output_file: "task-output",
  summary: "investigation settled",
});

test("grades the follow-up result and records tool calls from both turns", async () => {
  const captured: { inputEnded?: Promise<IteratorResult<unknown>> } = {};
  sdk.query.mockImplementation(async function* ({ prompt }) {
    if (typeof prompt === "string") throw new Error("expected streaming input");
    const input = prompt[Symbol.asyncIterator]();
    await input.next();
    captured.inputEnded = input.next();
    let closed = false;
    void captured.inputEnded.then(() => {
      closed = true;
    });
    yield* scripted(
      assistant(toolUse("Skill"), toolUse("Agent")),
      liveTasks("investigation"),
      success("It is still running, so I have no results yet", COST),
    );
    expect(closed).toBe(false);
    yield* scripted(
      taskNotification("investigation"),
      liveTasks(),
      {
        ...assistant(toolUse("Read")),
        parent_tool_use_id: "agent-tool-use",
      },
      assistant(toolUse("Bash", { command: "gh issue view 42" })),
      success("Final report and status are ready", FINAL_COST),
    );
  });

  expect(await observeClaude(options)).toMatchObject({
    subtype: "success",
    isError: false,
    finalText: "Final report and status are ready",
    costUsd: FINAL_COST,
    timedOut: false,
    toolCalls: [
      { name: "Skill", input: {} },
      { name: "Agent", input: {} },
      { name: "Read", input: {} },
      { name: "Bash", input: { command: "gh issue view 42" } },
    ],
  });
  expect(await captured.inputEnded).toMatchObject({ done: true });
});

test("replaces the live task snapshot without pairing task edges", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      liveTasks("first", "second"),
      success("both running", COST),
      taskNotification("first"),
      liveTasks("second"),
      success("second still running", COST),
      // A missing notification and a late start cannot leave a stale live task.
      liveTasks(),
      {
        type: "system",
        subtype: "task_started",
        task_id: "first",
        is_backgrounded: true,
      },
      success("all settled", THIRD_TURN_COST),
    ),
  );

  expect(await observeClaude(options)).toMatchObject({
    finalText: "all settled",
    costUsd: THIRD_TURN_COST,
    timedOut: false,
  });
});

test("waits for a follow-up result after a failed task notification", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      liveTasks("investigation"),
      success("still running", COST),
      // Bookend ordering relative to the level signal is unspecified.
      liveTasks(),
      taskNotification("investigation", "failed"),
      { ...success("final diagnosis", FINAL_COST), is_error: true },
    ),
  );

  expect(await observeClaude(options)).toMatchObject({
    subtype: "success",
    isError: true,
    finalText: "final diagnosis",
    costUsd: FINAL_COST,
  });
});

test("preserves the follow-up result's budget error and cumulative cost", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      liveTasks("investigation"),
      success("still running", COST),
      taskNotification("investigation"),
      liveTasks(),
      {
        type: "result",
        subtype: "error_max_budget_usd",
        is_error: true,
        errors: ["max budget exceeded", "no final report"],
        total_cost_usd: FINAL_COST,
      },
    ),
  );

  expect(await observeClaude(options)).toMatchObject({
    subtype: "error_max_budget_usd",
    isError: true,
    finalText: "max budget exceeded\nno final report",
    costUsd: FINAL_COST,
    timedOut: false,
  });
});

test("fails closed if the stream ends before background work has a final result", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      liveTasks("investigation"),
      success("still running", COST),
      liveTasks(),
    ),
  );

  expect(await observeClaude(options)).toMatchObject({
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
    finalText: "query ended without a result message",
  });
});

test("fails closed on a malformed background task snapshot", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      { type: "system", subtype: "background_tasks_changed", tasks: null },
      success("must not be graded", COST),
    ),
  );

  expect(await observeClaude(options)).toMatchObject({
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
  });
});

test("aborts background work that never settles and closes input at the wall-clock limit", async () => {
  vi.useFakeTimers();
  sdk.query.mockImplementation(async function* ({ options: requestOptions }) {
    const signal = requestOptions?.abortController?.signal;
    if (signal === undefined) throw new Error("no abort signal");
    yield liveTasks("investigation");
    yield success("still running", COST);
    await once(signal, "abort");
    throw new Error("The operation was aborted");
  });
  const pending = observeClaude({ ...options, wallClockMs: WALL_CLOCK_LIMIT });
  await vi.advanceTimersByTimeAsync(WALL_CLOCK_LIMIT);

  expect(await pending).toMatchObject({
    timedOut: true,
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
    finalText: "The operation was aborted",
  });
  const [request] = sdk.query.mock.lastCall ?? [];
  const prompt = request?.prompt;
  if (typeof prompt !== "object") {
    throw new Error("expected streaming input");
  }
  const input = prompt[Symbol.asyncIterator]();
  await input.next();
  expect(await input.next()).toMatchObject({ done: true });
  expect(vi.getTimerCount()).toBeFalsy();
});
