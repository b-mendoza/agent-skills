// Pins successful result handling and query policy without starting an SDK subprocess.

import { tmpdir } from "node:os";

import { Effect } from "effect";
import { expect, test } from "vitest";

import {
  assistant,
  BUDGET_USD,
  COST_BUDGET_STOP,
  COST_FULL,
  lastQueryRequest,
  runHarness,
  sampledRepositories,
  scripted,
  setQueryStart,
  success,
  toolUse,
} from "#/observation/harness-lifecycle-test-support.ts";

test("a normal stream yields the result and its tool calls", async () => {
  setQueryStart(() =>
    Effect.succeed(
      scripted(assistant(toolUse("Skill")), success("done", COST_FULL)),
    ),
  );

  const observation = await runHarness();

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
  await runHarness();

  const request = lastQueryRequest();
  expect(request).toMatchObject({
    prompt: "observe the repo",
    options: {
      cwd: tmpdir(),
      model: "haiku",
      maxBudgetUsd: BUDGET_USD,
      permissionMode: "auto",
      settingSources: ["project"],
      systemPrompt: { type: "preset", preset: "claude_code" },
      tools: { type: "preset", preset: "claude_code" },
    },
  });
  expect(request.options?.abortController).toBeInstanceOf(AbortController);
  // Omitted on purpose: setting `env` REPLACES the subprocess environment,
  // and the run must inherit ambient credentials.
  expect(request.options ?? {}).not.toHaveProperty("env");
});

test("gitRepo overrides cwd only for git sampling", async () => {
  await runHarness({ cwd: "/fixture", gitRepo: "/repository" });

  expect(sampledRepositories).toStrictEqual(["/repository", "/repository"]);
  expect(lastQueryRequest().options?.cwd).toBe("/fixture");
});

test("tool calls accumulate across assistant messages in stream order", async () => {
  setQueryStart(() =>
    Effect.succeed(
      scripted(
        assistant({ type: "text" }, toolUse("Read")),
        assistant(toolUse("Bash", { command: "git log" }), toolUse("Grep")),
        success("done", COST_FULL),
      ),
    ),
  );

  const observation = await runHarness();

  expect(observation.toolCalls.map((call) => call.name)).toStrictEqual([
    "Read",
    "Bash",
    "Grep",
  ]);
  expect(observation.toolCalls[1]?.input).toStrictEqual({ command: "git log" });
});

test("a malformed tool input degrades to an empty record", async () => {
  setQueryStart(() =>
    Effect.succeed(
      scripted(
        assistant(toolUse("Write", ["an", "array"]), toolUse("Edit", "scalar")),
        success("done", COST_FULL),
      ),
    ),
  );

  const observation = await runHarness();

  expect(observation.toolCalls).toStrictEqual([
    { name: "Write", input: {} },
    { name: "Edit", input: {} },
  ]);
});

test("valid messages strip excess keys, retain whitespace, and project tool inputs", async () => {
  const inheritedToolInput = { inherited: "discarded" };
  const originalToolInput: Record<string, unknown> = {
    command: "git status",
  };
  Object.setPrototypeOf(originalToolInput, inheritedToolInput);
  setQueryStart(() =>
    Effect.succeed(
      scripted(
        {
          type: "assistant",
          ignored: "message excess",
          message: {
            ignored: "payload excess",
            content: [
              {
                type: "tool_use",
                name: " Read ",
                input: originalToolInput,
                ignored: "block excess",
              },
            ],
          },
        },
        {
          type: "result",
          subtype: "success",
          is_error: false,
          result: " done ",
          total_cost_usd: COST_FULL,
          ignored: "result excess",
        },
      ),
    ),
  );

  const observation = await runHarness();

  expect(observation.finalText).toBe(" done ");
  expect(observation.toolCalls).toStrictEqual([
    { name: " Read ", input: { command: "git status" } },
  ]);
  expect(observation.toolCalls[0]?.input).not.toBe(originalToolInput);
  expect(observation.toolCalls[0]?.input).not.toHaveProperty("inherited");
});

test("messages without a string discriminator are ignored", async () => {
  setQueryStart(() =>
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

  const observation = await runHarness();

  expect(observation.subtype).toBe("success");
  expect(observation.toolCalls).toStrictEqual([]);
  expect(observation.finalText).toBe("done");
});

test("messages that are neither assistant nor result are ignored", async () => {
  setQueryStart(() =>
    Effect.succeed(
      scripted(
        { type: "user", message: { role: "user", content: "echoed prompt" } },
        success("done", COST_FULL),
      ),
    ),
  );

  const observation = await runHarness();

  expect(observation.subtype).toBe("success");
  expect(observation.toolCalls).toStrictEqual([]);
  expect(observation.finalText).toBe("done");
});

test("an authentication failure keeps subtype and isError independent", async () => {
  setQueryStart(() =>
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

  const observation = await runHarness();

  expect(observation.subtype).toBe("success");
  expect(observation.isError).toBe(true);
  expect(observation.toolCalls).toStrictEqual([]);
});

test("an error result retains subtype and diagnostic whitespace", async () => {
  setQueryStart(() =>
    Effect.succeed(
      scripted({
        type: "result",
        subtype: " error_custom ",
        is_error: true,
        errors: [" first diagnostic ", " second diagnostic "],
        total_cost_usd: COST_BUDGET_STOP,
      }),
    ),
  );

  const observation = await runHarness();

  expect(observation.subtype).toBe(" error_custom ");
  expect(observation.finalText).toBe(" first diagnostic \n second diagnostic ");
});

test("an error result keeps diagnostics, cost, and prior calls", async () => {
  setQueryStart(() =>
    Effect.succeed(
      scripted(assistant(toolUse("Skill")), {
        type: "result",
        subtype: "error_max_budget_usd",
        is_error: true,
        errors: ["max budget exceeded", "budget was $0.01"],
        total_cost_usd: COST_BUDGET_STOP,
      }),
    ),
  );

  const observation = await runHarness();

  expect(observation.subtype).toBe("error_max_budget_usd");
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("max budget exceeded\nbudget was $0.01");
  expect(observation.costUsd).toBe(COST_BUDGET_STOP);
  expect(observation.toolCalls.map((call) => call.name)).toStrictEqual([
    "Skill",
  ]);
});
