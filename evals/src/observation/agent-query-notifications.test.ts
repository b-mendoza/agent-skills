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
const C_FIRST_COST = 0.038304700000000004;
const C_NOTIFICATION_COST = 0.07083220000000001;
const C_FOUR_COST = 0.07415850000000002;
const C_FINAL_COST = 0.08238090000000002;
const C_NOTIFICATION_TEXT =
  "The background command finished with exit code 0. It should have written `done` to `bg.txt`, but I haven't opened the file to check.";
const C_FINAL_TEXT =
  "`bg.txt` exists in the repository, and it contains `done`. That matches what the background command should have written.";
const notificationOrigin = { kind: "task-notification" };
const success = (result: string, cost = FIRST_COST) => ({
  type: "result",
  subtype: "success",
  is_error: false,
  result,
  total_cost_usd: cost,
});
const assistant = (...content: unknown[]) => ({
  type: "assistant",
  message: { content },
});
const text = (value: string) => ({ type: "text", text: value });
const liveTasks = (...tasks: unknown[]) => ({
  type: "system",
  subtype: "background_tasks_changed",
  tasks,
});
const options: RunOptions = {
  cwd: "/unused-offline-notifications-path",
  prompt: "start background work",
  budgetUsd: 1,
  model: "haiku",
  wallClockMs: 30_000,
};
beforeEach(() => {
  sdk.query.mockReset();
});
function inputStream(prompt: string | AsyncIterable<SDKUserMessage>) {
  if (typeof prompt === "string") throw new Error("expected streaming input");
  return prompt[Symbol.asyncIterator]();
}
async function nextUserMessage(input: AsyncIterator<SDKUserMessage>) {
  const message = await input.next();
  if (message.done === true) throw new Error("input closed early");
  return message.value;
}

// Rejecting all notification results loses C's only settled answer to turn one.
test("replays C and sends turn two only after the notification settles turn one", async () => {
  let notificationDelivered = false;
  let turnTwoAfterNotification = false;
  sdk.query.mockImplementation(async function* ({ prompt }) {
    const input = inputStream(prompt);
    // C/raw.jsonl: a1946c65, 6d44c699 and 6330c822 map to these client UUIDs.
    const first = await nextUserMessage(input);
    const firstIdentity = {
      user_message_uuid: first.uuid,
      user_message_uuids: [first.uuid],
    };
    yield* scripted(
      {
        ...assistant({
          type: "tool_use",
          id: "toolu_01PAX84ExuagVn8CVGhC1pX2",
          name: "Bash",
          input: {
            command: "sleep 25; echo done > bg.txt",
            run_in_background: true,
          },
        }),
        ...firstIdentity,
      },
      liveTasks({
        task_id: "bjdvxeshv",
        run_id: "0mwak7193-a03aab3b",
        task_type: "local_bash",
        description: "Run delayed write in background",
      }),
      assistant(text("BACKGROUND STARTED")),
      { ...success("BACKGROUND STARTED", C_FIRST_COST), ...firstIdentity },
      {
        type: "system",
        subtype: "task_notification",
        task_id: "bjdvxeshv",
        status: "completed",
      },
      liveTasks(),
      assistant(text(C_NOTIFICATION_TEXT)),
    );
    notificationDelivered = true;
    yield {
      ...success(C_NOTIFICATION_TEXT, C_NOTIFICATION_COST),
      origin: {
        ...notificationOrigin,
        producer: "session-task",
        runId: "0mwak7193-a03aab3b",
      },
    };
    // End instead of hanging if the runtime did not send the next user message.
    if (!turnTwoAfterNotification) return;
    const second = await nextUserMessage(input);
    const secondIdentity = {
      user_message_uuid: second.uuid,
      user_message_uuids: [second.uuid],
    };
    yield* scripted(
      { ...assistant(text("FOUR")), ...secondIdentity },
      { ...success("FOUR", C_FOUR_COST), ...secondIdentity },
    );
    const third = await nextUserMessage(input);
    const thirdIdentity = {
      user_message_uuid: third.uuid,
      user_message_uuids: [third.uuid],
    };
    yield* scripted(
      {
        ...assistant({
          type: "tool_use",
          id: "toolu_01Y2Ps4ttgJY8oD7rD27PFYP",
          name: "Bash",
          input: {
            command:
              "if [ -f bg.txt ]; then echo exists; cat bg.txt; else echo missing; fi",
          },
        }),
        ...thirdIdentity,
      },
      {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_01Y2Ps4ttgJY8oD7rD27PFYP",
              content: "exists\ndone",
            },
          ],
        },
      },
      assistant(text(C_FINAL_TEXT)),
      { ...success(C_FINAL_TEXT, C_FINAL_COST), ...thirdIdentity },
    );
  });
  const observation = await observeClaude({
    ...options,
    followUps: [
      {
        name: "arithmetic",
        reply: (previous) => {
          turnTwoAfterNotification =
            notificationDelivered && previous.finalText === C_NOTIFICATION_TEXT;
          return { reply: "Reply exactly FOUR" };
        },
      },
      { name: "check background", reply: () => ({ reply: "Check bg.txt" }) },
    ],
  });
  expect(observation.turns).toMatchObject([
    { finalText: C_NOTIFICATION_TEXT, costUsd: 0.07083220000000001 },
    { finalText: "FOUR", costUsd: 0.07415850000000002 },
    {
      finalText: C_FINAL_TEXT,
      toolCalls: [{ name: "Bash", result: { content: "exists\ndone" } }],
    },
  ]);
  expect(turnTwoAfterNotification).toBe(true);
  expect(observation).toMatchObject({
    subtype: "success",
    costUsd: C_FINAL_COST,
  });
});

test.each(["single", "batch"])(
  "settles a notification-origin result with the current %s UUID echo",
  async (mode) => {
    sdk.query.mockImplementation(async function* ({ prompt }) {
      const first = await nextUserMessage(inputStream(prompt));
      yield {
        ...success("folded user reply"),
        origin: notificationOrigin,
        ...(mode === "single"
          ? { user_message_uuid: first.uuid }
          : {
              user_message_uuid: "notification-send",
              user_message_uuids: ["notification-send", first.uuid],
            }),
      };
    });
    expect(await observeClaude(options)).toMatchObject({
      subtype: "success",
      finalText: "folded user reply",
      turns: [{ finalText: "folded user reply" }],
    });
  },
);

test("surfaces a notification-origin error immediately without an own result", async () => {
  sdk.query.mockImplementation(() =>
    scripted({
      ...success("background API error", FINAL_COST),
      is_error: true,
      origin: notificationOrigin,
    }),
  );
  expect(await observeClaude(options)).toMatchObject({
    subtype: "success",
    isError: true,
    finalText: "background API error",
    costUsd: FINAL_COST,
    turns: [
      { subtype: "success", isError: true, finalText: "background API error" },
    ],
  });
});

test.each([false, true])(
  "settles an untagged background follow-up with notification origin %s after an echoed provisional result",
  async (notification) => {
    sdk.query.mockImplementation(async function* ({ prompt }) {
      const first = await nextUserMessage(inputStream(prompt));
      yield* scripted(
        liveTasks({ task_id: "worker" }),
        { ...success("provisional user reply"), user_message_uuid: first.uuid },
        liveTasks(),
        {
          ...success("background final", FINAL_COST),
          ...(notification ? { origin: notificationOrigin } : {}),
        },
      );
    });
    expect(await observeClaude(options)).toMatchObject({
      finalText: "background final",
      subtype: "success",
      costUsd: FINAL_COST,
    });
  },
);

test("rejects another turn's notification and tool frames while retaining the latest cumulative cost", async () => {
  sdk.query.mockImplementation(async function* ({ prompt }) {
    const input = inputStream(prompt);
    const first = await nextUserMessage(input);
    yield { ...success("preview"), user_message_uuid: first.uuid };
    const second = await nextUserMessage(input);
    yield* scripted(
      liveTasks({ task_id: "worker" }),
      { ...success("provisional", FINAL_COST), user_message_uuid: second.uuid },
      liveTasks(),
      {
        ...assistant({
          type: "tool_use",
          name: "Bash",
          input: { command: "stale" },
        }),
        user_message_uuid: first.uuid,
      },
      {
        ...success("stale notification error", FINAL_COST),
        origin: notificationOrigin,
        user_message_uuid: first.uuid,
        is_error: true,
      },
      {
        ...success("current background final", FINAL_COST),
        origin: notificationOrigin,
      },
    );
  });
  expect(
    await observeClaude({
      ...options,
      followUps: [{ name: "next", reply: () => ({ reply: "continue" }) }],
    }),
  ).toMatchObject({
    finalText: "current background final",
    costUsd: FINAL_COST,
    toolCalls: [],
    turns: [
      { finalText: "preview" },
      { finalText: "current background final", toolCalls: [] },
    ],
  });
});
