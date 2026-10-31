import type { query } from "@anthropic-ai/claude-agent-sdk";
import { expect, test, vi } from "vitest";

import { observeClaude } from "#/observation/agent-query.ts";
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
