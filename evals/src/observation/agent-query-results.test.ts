import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { Schema } from "effect";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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
