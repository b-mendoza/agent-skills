// Pins successful result handling and query policy without starting an SDK subprocess.

import { tmpdir } from "node:os";

import { Effect } from "effect";
import { beforeEach, expect, test } from "vitest";

import {
  assistant,
  BUDGET_USD,
  COST_BUDGET_STOP,
  COST_FULL,
  createHarnessSeam,
  scripted,
  success,
  toolUse,
} from "#/observation/harness-lifecycle-test-support.ts";

/**
 * Every option the harness owns. Pinned as an exact set rather than a subset so
 * an option added upstream -- `env` above all -- cannot reach the subprocess
 * without a deliberate change here.
 */
const HARNESS_OWNED_QUERY_OPTION_KEYS = [
  "abortController",
  "cwd",
  "maxBudgetUsd",
  "model",
  "permissionMode",
  "settingSources",
  "systemPrompt",
  "tools",
];

let harness = createHarnessSeam();

beforeEach(() => {
  harness = createHarnessSeam();
});

test("a normal stream yields the result and its tool calls", async () => {
  harness.setQueryStart(() =>
    Effect.succeed(
      scripted(assistant(toolUse("Skill")), success("done", COST_FULL)),
    ),
  );

  const observation = await harness.runHarness();

  expect(observation.subtype).toBe("success");
  expect(observation.isError).toBe(false);
  expect(observation.finalText).toBe("done");
  expect(observation.costUsd).toBe(COST_FULL);
  expect(observation.toolCalls.map((call) => call.name)).toStrictEqual([
    "Skill",
  ]);
  expect(observation.timedOut).toBe(false);
});

test("observeClaude applies harness-owned query policy", async () => {
  await harness.runHarness();

  const request = harness.lastQueryRequest();
  const { options } = request;
  if (options === undefined) {
    throw new Error("expected the harness to supply query options");
  }

  expect(
    Object.keys(options).toSorted((left, right) => left.localeCompare(right)),
  ).toStrictEqual(HARNESS_OWNED_QUERY_OPTION_KEYS);
  expect(request.prompt).toBe("observe the repo");
  expect(options.cwd).toBe(tmpdir());
  expect(options.model).toBe("haiku");
  expect(options.maxBudgetUsd).toBe(BUDGET_USD);
  expect(options.permissionMode).toBe("auto");
  expect(options.settingSources).toStrictEqual(["project"]);
  expect(options.systemPrompt).toStrictEqual({
    type: "preset",
    preset: "claude_code",
  });
  expect(options.tools).toStrictEqual({
    type: "preset",
    preset: "claude_code",
  });
  expect(options.abortController).toBeInstanceOf(AbortController);
});

test("the query inherits ambient credentials by omitting env", async () => {
  // Setting `env` REPLACES the subprocess environment rather than merging into
  // it, so supplying one would strip whatever credentials the ambient
  // environment carries and the run would fail to authenticate.
  await harness.runHarness();

  expect(harness.lastQueryRequest().options ?? {}).not.toHaveProperty("env");
});

test("gitRepo overrides cwd only for git sampling", async () => {
  await harness.runHarness({ cwd: "/fixture", gitRepo: "/repository" });

  expect(harness.sampledRepositories()).toStrictEqual([
    "/repository",
    "/repository",
  ]);
  expect(harness.lastQueryRequest().options?.cwd).toBe("/fixture");
});

test("tool calls accumulate across assistant messages in stream order", async () => {
  harness.setQueryStart(() =>
    Effect.succeed(
      scripted(
        assistant({ type: "text" }, toolUse("Read")),
        assistant(toolUse("Bash", { command: "git log" }), toolUse("Grep")),
        success("done", COST_FULL),
      ),
    ),
  );

  const observation = await harness.runHarness();

  expect(observation.toolCalls.map((call) => call.name)).toStrictEqual([
    "Read",
    "Bash",
    "Grep",
  ]);
  const [, bashToolCall] = observation.toolCalls;
  expect(bashToolCall?.input).toStrictEqual({
    command: "git log",
  });
});

test("a malformed tool input degrades to an empty record", async () => {
  harness.setQueryStart(() =>
    Effect.succeed(
      scripted(
        assistant(toolUse("Write", ["an", "array"]), toolUse("Edit", "scalar")),
        success("done", COST_FULL),
      ),
    ),
  );

  const observation = await harness.runHarness();

  expect(observation.toolCalls).toStrictEqual([
    { name: "Write", input: {} },
    { name: "Edit", input: {} },
  ]);
});

test("a tool call's input is an owned record, not the SDK's object", async () => {
  // The observation outlives the stream and is asserted on long after it ends,
  // so a shared reference -- or a property inherited from the SDK's prototype
  // chain -- would let the SDK decide what a case sees.
  const inheritedToolInput = { inherited: "not owned" };
  const sdkToolInput: Record<string, unknown> = { command: "git status" };
  Object.setPrototypeOf(sdkToolInput, inheritedToolInput);
  harness.setQueryStart(() =>
    Effect.succeed(
      scripted(
        assistant(toolUse("Read", sdkToolInput)),
        success("done", COST_FULL),
      ),
    ),
  );

  const observation = await harness.runHarness();
  const [firstToolCall] = observation.toolCalls;
  const observedInput = firstToolCall?.input;

  expect(observedInput).toStrictEqual({ command: "git status" });
  expect(observedInput).not.toBe(sdkToolInput);
  expect(observedInput).not.toHaveProperty("inherited");
});

test("messages that carry no verdict are ignored", async () => {
  harness.setQueryStart(() =>
    Effect.succeed(
      scripted(
        null,
        [],
        {},
        { type: 1 },
        { type: "user", message: { content: "echoed prompt" } },
        success("done", COST_FULL),
      ),
    ),
  );

  const observation = await harness.runHarness();

  expect(observation.subtype).toBe("success");
  expect(observation.toolCalls).toStrictEqual([]);
  expect(observation.finalText).toBe("done");
});

test("an authentication failure keeps subtype and isError independent", async () => {
  harness.setQueryStart(() =>
    Effect.succeed(
      scripted({
        type: "result",
        subtype: "success",
        is_error: true,
        result: "Failed to authenticate: OAuth session expired",
        total_cost_usd: 0,
      }),
    ),
  );

  const observation = await harness.runHarness();

  expect(observation.subtype).toBe("success");
  expect(observation.isError).toBe(true);
  expect(observation.toolCalls).toStrictEqual([]);
});

test.each([
  {
    name: "an error result retains subtype and diagnostic whitespace",
    messageScript: [
      {
        type: "result",
        subtype: " error_custom ",
        is_error: true,
        errors: [" first diagnostic ", " second diagnostic "],
        total_cost_usd: COST_BUDGET_STOP,
      },
    ],
    expectedSubtype: " error_custom ",
    expectedFinalText: " first diagnostic \n second diagnostic ",
    expectedToolNames: [],
  },
  {
    name: "an error result keeps diagnostics, cost, and prior calls",
    messageScript: [
      assistant(toolUse("Skill")),
      {
        type: "result",
        subtype: "error_max_budget_usd",
        is_error: true,
        errors: ["max budget exceeded", "budget was $0.01"],
        total_cost_usd: COST_BUDGET_STOP,
      },
    ],
    expectedSubtype: "error_max_budget_usd",
    expectedFinalText: "max budget exceeded\nbudget was $0.01",
    expectedToolNames: ["Skill"],
  },
])(
  "$name",
  async ({
    messageScript,
    expectedSubtype,
    expectedFinalText,
    expectedToolNames,
  }) => {
    harness.setQueryStart(() => Effect.succeed(scripted(...messageScript)));

    const observation = await harness.runHarness();

    expect(observation.subtype).toBe(expectedSubtype);
    expect(observation.isError).toBe(true);
    expect(observation.finalText).toBe(expectedFinalText);
    expect(observation.costUsd).toBe(COST_BUDGET_STOP);
    expect(observation.toolCalls.map((call) => call.name)).toStrictEqual(
      expectedToolNames,
    );
  },
);
