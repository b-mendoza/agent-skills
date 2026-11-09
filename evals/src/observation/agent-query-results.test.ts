import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { Schema } from "effect";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { ToolCall } from "#/observation/agent-query.ts";
import { observationSchema, observeClaude } from "#/observation/agent-query.ts";
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
const toolUse = (name: string, input: unknown = {}) => ({
  type: "tool_use",
  name,
  input,
});
const assistant = (...content: unknown[]) => ({
  type: "assistant",
  message: { content },
});
const success = (result: string) => ({
  type: "result",
  subtype: "success",
  is_error: false,
  result,
  total_cost_usd: 0,
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

test("saved observations without call IDs or results remain valid", async () => {
  const observation = await observeClaude(options);
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

const EXECUTION_RESULT_CHARS = 16_000;
const EXECUTION_TOTAL_CHARS = 128_000;
const EXHAUSTED_EXECUTION_TAIL_CHARS = 2_000;
const WEB_TOTAL_CHARS = 32_000;
const FIRST_RESULT_INDEX = 0;
const FILLED_EXECUTION_RESULTS = 8;
const CAPTURED_TOOL_NAMES = ["Bash", "Agent", "Task"];
const TRUNCATION_MARKER = "\n[truncated]\n";

test.each(CAPTURED_TOOL_NAMES)(
  "attaches %s output and carries it into the turn record",
  async (name) => {
    sdk.query.mockImplementation(() =>
      scripted(
        assistant({ ...toolUse(name), id: "execution" }),
        user([
          {
            type: "tool_result",
            tool_use_id: "execution",
            content: "PASS validator\nAPPROVAL_HASH=abc123",
          },
        ]),
        success("done"),
      ),
    );
    const observation = await observeClaude(options);
    const [call] = observation.toolCalls;
    const [turn] = observation.turns ?? [];
    expect(call?.result).toStrictEqual({
      content: "PASS validator\nAPPROVAL_HASH=abc123",
      isError: false,
      truncated: false,
    });
    expect(turn?.toolCalls).toStrictEqual(observation.toolCalls);
  },
);

test.each(["Bash", "Agent", "Task"])(
  "retains denied or error results for %s",
  async (name) => {
    sdk.query.mockImplementation(() =>
      scripted(
        assistant({ ...toolUse(name), id: "denied" }),
        user([
          {
            type: "tool_result",
            tool_use_id: "denied",
            content: [
              {
                type: "text",
                text: "Denied: executor dispatch requires approval",
              },
            ],
            is_error: true,
          },
        ]),
        success("stopped"),
      ),
    );
    const observation = await observeClaude(options);
    const [call] = observation.toolCalls;
    expect(call?.result).toStrictEqual({
      content: "Denied: executor dispatch requires approval",
      isError: true,
      truncated: false,
    });
  },
);

test("truncates execution output with its head, marker and final status or hash", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      assistant({ ...toolUse("Bash"), id: "large" }),
      user([
        {
          type: "tool_result",
          tool_use_id: "large",
          content: `START\n${"x".repeat(OVERSIZED_CHARS)}\nPASS\nAPPROVAL_HASH=last`,
        },
      ]),
      success("done"),
    ),
  );
  const observation = await observeClaude(options);
  const [call] = observation.toolCalls;
  if (call?.result === undefined) throw new Error("missing execution result");
  expect(call.result.truncated).toBe(true);
  expect(call.result.content).toHaveLength(EXECUTION_RESULT_CHARS);
  expect(call.result.content).toMatch(/^START\n/);
  expect(call.result.content).toContain(TRUNCATION_MARKER);
  expect(call.result.content).toMatch(/PASS\nAPPROVAL_HASH=last$/);
});

test("bounds all turns while reserving the unchanged web allowance", async () => {
  const executionCalls = Array.from({ length: 9 }, (_, index) => ({
    ...toolUse("Bash"),
    id: `exec-${String(index)}`,
  }));
  const webCalls = Array.from({ length: 5 }, (_, index) => ({
    ...toolUse("WebFetch"),
    id: `web-${String(index)}`,
  }));
  const output = (id: string) => ({
    type: "tool_result" as const,
    tool_use_id: id,
    content: `HEAD${"x".repeat(OVERSIZED_CHARS)}TAIL`,
  });
  sdk.query.mockImplementation(() =>
    scripted(
      assistant(...executionCalls, ...webCalls),
      user(
        executionCalls
          .slice(FIRST_RESULT_INDEX, FILLED_EXECUTION_RESULTS)
          .map((call) => output(call.id)),
      ),
      success("preview"),
      assistant({ type: "text", text: "capturing post-approval readback" }),
      user(
        executionCalls
          .slice(FILLED_EXECUTION_RESULTS)
          .map((call) => output(call.id)),
      ),
      user(webCalls.map((call) => output(call.id))),
      success("done"),
    ),
  );
  const observation = await observeClaude({
    ...options,
    followUps: [{ name: "continue", reply: () => ({ reply: "continue" }) }],
  });
  expect(observation.finalText).toBe("done");
  const execution = observation.toolCalls.filter(
    (call) => call.name === "Bash",
  );
  const web = observation.toolCalls.filter((call) => call.name === "WebFetch");
  expect(resultLengths(execution)).toStrictEqual([
    EXECUTION_RESULT_CHARS,
    EXECUTION_RESULT_CHARS,
    EXECUTION_RESULT_CHARS,
    EXECUTION_RESULT_CHARS,
    EXECUTION_RESULT_CHARS,
    EXECUTION_RESULT_CHARS,
    EXECUTION_RESULT_CHARS,
    EXECUTION_RESULT_CHARS,
    EXHAUSTED_EXECUTION_TAIL_CHARS + TRUNCATION_MARKER.length,
  ]);
  expect(resultLengths(web)).toStrictEqual([
    RESULT_CHARS,
    RESULT_CHARS,
    RESULT_CHARS,
    RESULT_CHARS,
    ZERO_CHARS,
  ]);
  const capturedChars = totalResultChars(observation.toolCalls);
  expect(capturedChars).toBe(
    EXECUTION_TOTAL_CHARS +
      WEB_TOTAL_CHARS +
      EXHAUSTED_EXECUTION_TAIL_CHARS +
      TRUNCATION_MARKER.length,
  );
  expect(web.every((call) => call.result?.truncated === true)).toBe(true);
  const [firstWebCall] = web;
  expect(firstWebCall?.result?.content).toMatch(/TAIL$/);
});

function resultLengths(calls: readonly ToolCall[]) {
  return calls.map((call) => call.result?.content.length);
}

function totalResultChars(calls: readonly ToolCall[]): number {
  return calls.reduce(
    (total, call) => total + (call.result?.content.length ?? ZERO_CHARS),
    ZERO_CHARS,
  );
}

test("retains the final 2000 characters and hash for every execution result after pool exhaustion", async () => {
  const filledCalls = Array.from(
    { length: FILLED_EXECUTION_RESULTS },
    (_, index) => ({ ...toolUse("Bash"), id: `filled-${String(index)}` }),
  );
  const lateCalls = ["poster", "readback"].map((id) => ({
    ...toolUse("Bash"),
    id,
  }));
  const hashLine = "\nAPPROVAL_HASH=last-required-approval";
  const expectedTail =
    "z".repeat(EXHAUSTED_EXECUTION_TAIL_CHARS - hashLine.length) + hashLine;
  sdk.query.mockImplementation(() =>
    scripted(
      assistant(...filledCalls, ...lateCalls),
      user(
        filledCalls.map(({ id }) => ({
          type: "tool_result" as const,
          tool_use_id: id,
          content: "x".repeat(OVERSIZED_CHARS),
        })),
      ),
      user(
        lateCalls.map(({ id }) => ({
          type: "tool_result" as const,
          tool_use_id: id,
          content: `discarded head${expectedTail}`,
        })),
      ),
      success("done"),
    ),
  );
  const observation = await observeClaude(options);
  const lateResults = observation.toolCalls.slice(FILLED_EXECUTION_RESULTS);
  expect(lateResults).toHaveLength(lateCalls.length);
  for (const call of lateResults) {
    expect(call.result).toStrictEqual({
      content: TRUNCATION_MARKER + expectedTail,
      truncated: true,
      isError: false,
    });
    expect(call.result?.content.length).toBeLessThanOrEqual(
      EXECUTION_RESULT_CHARS,
    );
  }
});
