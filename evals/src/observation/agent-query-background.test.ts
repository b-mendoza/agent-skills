import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
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
const FINAL_COST = 0.75;
const THIRD_TURN_COST = 0.9;
const WALL_CLOCK_LIMIT = 25;
const options: RunOptions = {
  cwd: "",
  prompt: "observe the repo",
  budgetUsd: 0.01,
  model: "haiku",
  wallClockMs: 30_000,
};
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
beforeEach(() => {
  options.cwd = mkdtempSync(join(tmpdir(), "background-observation-"));
  execFileSync("git", ["init", "-q"], { cwd: options.cwd });
  sdk.query.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(options.cwd, { recursive: true, force: true });
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
    yield success("done");
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
      success("both running"),
      taskNotification("first"),
      liveTasks("second"),
      success("second still running"),
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

test.each(["completed", "failed", "stopped"])(
  "waits for a follow-up result when a task is %s",
  async (status) => {
    sdk.query.mockImplementation(() =>
      scripted(
        liveTasks("investigation"),
        success("still running"),
        // Bookend ordering relative to the level signal is unspecified.
        liveTasks(),
        taskNotification("investigation", status),
        { ...success("final diagnosis", FINAL_COST), is_error: true },
      ),
    );

    expect(await observeClaude(options)).toMatchObject({
      subtype: "success",
      isError: true,
      finalText: "final diagnosis",
      costUsd: FINAL_COST,
    });
  },
);

test("preserves the follow-up result's budget error and cumulative cost", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      liveTasks("investigation"),
      success("still running"),
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
    scripted(liveTasks("investigation"), success("still running"), liveTasks()),
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
      success("must not be graded"),
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
    yield success("still running");
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

test("bounds a background wait that ignores abort by the shutdown grace", async () => {
  vi.useFakeTimers();
  const stalled = once(new EventTarget(), "never");
  sdk.query.mockImplementation(async function* () {
    yield liveTasks("investigation");
    yield success("still running");
    await stalled;
  });
  const captured: { observation?: Observation } = {};
  const pending = observeClaude({ ...options, wallClockMs: WALL_CLOCK_LIMIT });
  void pending.then((observation) => {
    captured.observation = observation;
  });
  await vi.advanceTimersByTimeAsync(WALL_CLOCK_LIMIT);
  expect(captured.observation).toBeUndefined();
  await vi.runAllTimersAsync();

  expect(await pending).toMatchObject({
    timedOut: true,
    subtype: QUERY_ERROR_SUBTYPE,
    isError: true,
    finalText: "query did not settle after abort",
  });
  expect(vi.getTimerCount()).toBeFalsy();
});
