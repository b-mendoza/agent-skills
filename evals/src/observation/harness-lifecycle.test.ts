import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { query } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { observeClaude } from "#/observation/agent-query.ts";
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
const COST = 0.5;
const ZERO_COST = 0;
const BUDGET = 0.01;
const WALL_CLOCK = 30_000;
let cwd = "";
let options: RunOptions = {
  cwd: "",
  prompt: "observe",
  budgetUsd: 0,
  model: "haiku",
  wallClockMs: 0,
};
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "observation-"));
  execFileSync("git", ["init", "-q"], { cwd });
  options = {
    cwd,
    prompt: "observe the repo",
    budgetUsd: BUDGET,
    model: "haiku",
    wallClockMs: WALL_CLOCK,
  };
  sdk.query
    .mockReset()
    .mockImplementation(() => scripted(success("done", COST)));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

test("a normal stream yields the result and its tool calls", async () => {
  sdk.query.mockImplementation(() =>
    scripted(assistant(toolUse("Skill")), success("done", COST)),
  );
  expect(await observeClaude(options)).toMatchObject({
    subtype: "success",
    isError: false,
    finalText: "done",
    costUsd: COST,
    toolCalls: [{ name: "Skill", input: {} }],
    timedOut: false,
    gitStatusBefore: { kind: "worktree", entries: "" },
    gitStatusAfter: { kind: "worktree", entries: "" },
  });
});

test("the query owns its policy and inherits ambient credentials", async () => {
  await observeClaude(options);
  const abortController: unknown = expect.any(AbortController);
  const expectedOptions: unknown = expect.objectContaining({
    cwd,
    model: "haiku",
    maxBudgetUsd: BUDGET,
    permissionMode: "auto",
    settingSources: ["project"],
    systemPrompt: { type: "preset", preset: "claude_code" },
    tools: { type: "preset", preset: "claude_code" },
    abortController,
  });
  expect(sdk.query).toHaveBeenCalledWith(
    expect.objectContaining({
      prompt: options.prompt,
      options: expectedOptions,
    }),
  );
  const [request] = sdk.query.mock.lastCall ?? [];
  expect(request?.options).not.toHaveProperty("env");
});

test("gitRepo overrides cwd only for git sampling", async () => {
  const repo = join(cwd, "repository");
  execFileSync("git", ["init", "-q", repo]);
  sdk.query.mockImplementation(() => {
    writeFileSync(join(repo, "new.txt"), "new");
    return scripted(success("done"));
  });
  const observation = await observeClaude({ ...options, gitRepo: repo });
  expect(observation.gitStatusBefore).toStrictEqual({
    kind: "worktree",
    entries: "",
  });
  expect(observation.gitStatusAfter).toStrictEqual({
    kind: "worktree",
    entries: "?? new.txt",
  });
  const [request] = sdk.query.mock.lastCall ?? [];
  expect(request?.options?.cwd).toBe(cwd);
});

test("tool calls accumulate across assistant messages in stream order", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      assistant({ type: "text" }, toolUse("Read")),
      assistant(toolUse("Bash", { command: "git log" }), toolUse("Grep")),
      success("done"),
    ),
  );
  expect((await observeClaude(options)).toolCalls).toStrictEqual([
    { name: "Read", input: {} },
    { name: "Bash", input: { command: "git log" } },
    { name: "Grep", input: {} },
  ]);
});

test("malformed inputs degrade to empty records", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      assistant(toolUse("Write", ["an", "array"]), toolUse("Edit", "scalar")),
      success("done"),
    ),
  );
  expect((await observeClaude(options)).toolCalls).toStrictEqual([
    { name: "Write", input: {} },
    { name: "Edit", input: {} },
  ]);
});

test("tool input is an owned record without inherited properties", async () => {
  const input = { command: "git status" };
  Object.setPrototypeOf(input, { inherited: "not owned" });
  sdk.query.mockImplementation(() =>
    scripted(assistant(toolUse("Read", input)), success("done")),
  );
  const [call] = (await observeClaude(options)).toolCalls;
  expect(call?.input).toStrictEqual({ command: "git status" });
  expect(call?.input).not.toBe(input);
  expect(call?.input).not.toHaveProperty("inherited");
});

test("messages carrying no verdict are ignored", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      null,
      [],
      {},
      { type: 1 },
      { type: "user", message: { content: "prompt" } },
      success("done"),
    ),
  );
  expect(await observeClaude(options)).toMatchObject({
    subtype: "success",
    toolCalls: [],
    finalText: "done",
  });
});

test("authentication failure keeps subtype and isError independent", async () => {
  sdk.query.mockImplementation(() =>
    scripted({
      ...success("Failed to authenticate: OAuth session expired", ZERO_COST),
      is_error: true,
    }),
  );
  expect(await observeClaude(options)).toMatchObject({
    subtype: "success",
    isError: true,
    toolCalls: [],
  });
});

test.each([
  {
    subtype: " error_custom ",
    errors: [" first diagnostic ", " second diagnostic "],
    calls: [],
    expected: " first diagnostic \n second diagnostic ",
  },
  {
    subtype: "error_max_budget_usd",
    errors: ["max budget exceeded", "budget was $0.01"],
    calls: [toolUse("Skill")],
    expected: "max budget exceeded\nbudget was $0.01",
  },
])(
  "error result $subtype preserves diagnostics, cost, and calls",
  async ({ subtype, errors, calls, expected }) => {
    sdk.query.mockImplementation(() =>
      scripted(assistant(...calls), {
        type: "result",
        subtype,
        is_error: true,
        errors,
        total_cost_usd: COST,
      }),
    );
    const observation = await observeClaude(options);
    expect(observation).toMatchObject({
      subtype,
      isError: true,
      finalText: expected,
      costUsd: COST,
    });
    expect(observation.toolCalls.map((call) => call.name)).toStrictEqual(
      calls.map((call) => call.name),
    );
  },
);
