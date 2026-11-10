import type { query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { beforeEach, expect, test, vi } from "vitest";

import type { RunOptions } from "#/observation/agent-query.ts";
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
const FIRST_COST = 0.25;
const FINAL_COST = 0.5;
const C2_FIRST_COST = 0.0383411;
const C2_NOTIFICATION_COST = 0.0709186;
const C2_FOUR_COST = 0.0742307;
const C2_FINAL_COST = 0.0823216;
const success = (result: string, cost = FIRST_COST) => ({
  type: "result",
  subtype: "success",
  is_error: false,
  result,
  total_cost_usd: cost,
});
function options(): RunOptions {
  return {
    cwd: "/unused-offline-correlation-path",
    prompt: "preview",
    budgetUsd: 1,
    model: "haiku",
    wallClockMs: 30_000,
    followUps: [{ name: "approval", reply: () => ({ reply: "APPROVED" }) }],
  };
}
beforeEach(() => {
  sdk.query.mockReset();
});
function inputStream(prompt: string | AsyncIterable<SDKUserMessage>) {
  if (typeof prompt === "string") throw new Error("expected stream");
  return prompt[Symbol.asyncIterator]();
}

test("ignores a stale unchanged-cost result before the follow-up assistant starts", async () => {
  sdk.query.mockImplementation(async function* ({ prompt }) {
    const input = inputStream(prompt);
    await input.next();
    yield* scripted(success("Approve TOKEN-42"));
    await input.next();
    yield* scripted(
      success(""),
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Bash",
              input: { command: "git status" },
            },
          ],
        },
      },
      success("approved work completed", FINAL_COST),
    );
  });
  const observation = await observeClaude(options());
  expect(observation).toMatchObject({
    finalText: "approved work completed",
    costUsd: FINAL_COST,
  });
  expect(observation.turns).toMatchObject([
    { finalText: "Approve TOKEN-42" },
    { finalText: "approved work completed", toolCalls: [{ name: "Bash" }] },
  ]);
});

test("fails closed when only a stale result follows the reply", async () => {
  sdk.query.mockImplementation(() =>
    scripted(success("Approve TOKEN-42"), success("")),
  );
  expect(await observeClaude(options())).toMatchObject({
    subtype: "query_error",
    costUsd: FIRST_COST,
  });
});

test.each(["single", "batch"])(
  "correlates %s client UUID echoes instead of attributing older frames or results",
  async (mode) => {
    sdk.query.mockImplementation(async function* ({ prompt }) {
      const input = inputStream(prompt);
      const first = await nextUserMessage(input);
      expect(first.uuid).toBeTypeOf("string");
      yield* scripted({
        ...success("Approve TOKEN-42"),
        user_message_uuid: first.uuid,
      });
      const second = await nextUserMessage(input);
      expect(second.uuid).toBeTypeOf("string");
      expect(second.uuid).not.toBe(first.uuid);
      yield* scripted(
        {
          type: "assistant",
          user_message_uuid: first.uuid,
          message: {
            content: [
              {
                type: "tool_use",
                name: "Write",
                input: { file_path: "stale.txt" },
              },
            ],
          },
        },
        {
          ...success("stale result", FINAL_COST),
          user_message_uuid: first.uuid,
        },
        {
          ...success("current zero-cost result"),
          ...(mode === "single"
            ? { user_message_uuid: second.uuid }
            : {
                user_message_uuid: first.uuid,
                user_message_uuids: [first.uuid, second.uuid],
              }),
        },
      );
    });
    const observation = await observeClaude(options());
    expect(observation).toMatchObject({
      finalText: "current zero-cost result",
      costUsd: FIRST_COST,
      toolCalls: [],
    });
  },
);

async function nextUserMessage(
  input: AsyncIterator<SDKUserMessage>,
): Promise<SDKUserMessage> {
  const message = await input.next();
  if (message.done === true) throw new Error("input closed early");
  return message.value;
}

const notification = (result: string, cost = FINAL_COST) => ({
  ...success(result, cost),
  origin: { kind: "task-notification", runId: "background-run" },
});
const assistant = (text: string) => ({
  type: "assistant",
  message: { content: [{ type: "text", text }] },
});

test("replays C2 without sending turn three before the FOUR result", async () => {
  let fourDelivered = false;
  let callbackAfterFour = false;
  // C2/raw.jsonl lines 14-35, retaining reply order, echoes and cumulative costs.
  sdk.query.mockImplementation(async function* ({ prompt }) {
    const input = inputStream(prompt);
    const first = await nextUserMessage(input);
    yield* scripted(assistant("BACKGROUND STARTED"), {
      ...success("BACKGROUND STARTED", C2_FIRST_COST),
      user_message_uuid: first.uuid,
      user_message_uuids: [first.uuid],
    });
    const second = await nextUserMessage(input);
    yield* scripted(
      assistant("The background command finished with exit code 0"),
      notification(
        "The background command finished with exit code 0",
        C2_NOTIFICATION_COST,
      ),
      {
        ...assistant("FOUR"),
        user_message_uuid: second.uuid,
        user_message_uuids: [second.uuid],
      },
    );
    fourDelivered = true;
    yield {
      ...success("FOUR", C2_FOUR_COST),
      user_message_uuid: second.uuid,
      user_message_uuids: [second.uuid],
    };
    const third = await nextUserMessage(input);
    yield* scripted(
      {
        type: "assistant",
        user_message_uuid: third.uuid,
        message: {
          content: [
            {
              type: "tool_use",
              id: "check",
              name: "Bash",
              input: { command: "test -e bg.txt" },
            },
          ],
        },
      },
      {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "check",
              content: "exists done",
            },
          ],
        },
      },
      assistant("bg.txt exists and contains done"),
      {
        ...success("bg.txt exists and contains done", C2_FINAL_COST),
        user_message_uuid: third.uuid,
      },
    );
  });
  const observation = await observeClaude({
    ...options(),
    followUps: [
      { name: "arithmetic", reply: () => ({ reply: "Reply exactly FOUR" }) },
      {
        name: "check background",
        reply: (previous) => {
          callbackAfterFour = fourDelivered && previous.finalText === "FOUR";
          return { reply: "Check bg.txt" };
        },
      },
    ],
  });
  expect(observation.turns).toMatchObject([
    { finalText: "BACKGROUND STARTED" },
    { finalText: "FOUR", costUsd: 0.0742307 },
    {
      finalText: "bg.txt exists and contains done",
      toolCalls: [{ name: "Bash", result: { content: "exists done" } }],
    },
  ]);
  expect(callbackAfterFour).toBe(true);
  expect(observation.costUsd).toBeCloseTo(C2_FINAL_COST);
});

test("does not let an untagged success settle after the session has echoed identities", async () => {
  sdk.query.mockImplementation(async function* ({ prompt }) {
    const input = inputStream(prompt);
    const first = await nextUserMessage(input);
    yield { ...success("preview"), user_message_uuid: first.uuid };
    const second = await nextUserMessage(input);
    yield* scripted(
      assistant("unattributed activity"),
      success("unattributed result", FINAL_COST),
      {
        ...success("current reply", FINAL_COST),
        user_message_uuid: second.uuid,
      },
    );
  });
  expect(await observeClaude(options())).toMatchObject({
    finalText: "current reply",
  });
});

test("surfaces an untagged session budget error after a notification without losing cumulative spend", async () => {
  sdk.query.mockImplementation(async function* ({ prompt }) {
    const input = inputStream(prompt);
    const first = await nextUserMessage(input);
    yield { ...success("preview"), user_message_uuid: first.uuid };
    await nextUserMessage(input);
    yield* scripted(notification("background text"), {
      type: "result",
      subtype: "error_max_budget_usd",
      is_error: true,
      errors: ["budget exceeded"],
      total_cost_usd: FINAL_COST,
    });
  });
  expect(await observeClaude(options())).toMatchObject({
    subtype: "error_max_budget_usd",
    isError: true,
    finalText: "budget exceeded",
    costUsd: FINAL_COST,
    turns: [{ finalText: "preview" }, { subtype: "error_max_budget_usd" }],
  });
});

test("accepts a same-cost follow-up result after new top-level streaming activity", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      success("Approve TOKEN-42"),
      {
        type: "stream_event",
        parent_tool_use_id: null,
        event: { type: "message_start" },
      },
      success("streamed follow-up"),
    ),
  );
  expect(await observeClaude(options())).toMatchObject({
    subtype: "success",
    finalText: "streamed follow-up",
    costUsd: FIRST_COST,
  });
});
