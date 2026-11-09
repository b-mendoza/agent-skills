import { execFileSync } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { assertRunHappened } from "#/cases/shared-checks.ts";
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
const ONE_CALL = 1;
const TWO_TURNS = 2;
const NO_TIMERS = 0;
const FIRST_COST = 0.25;
const FINAL_COST = 0.5;
const DEADLINE = 100;
const FIRST_TURN_DELAY = 60;
const success = (result: string, cost = FIRST_COST) => ({
  type: "result",
  subtype: "success",
  is_error: false,
  result,
  total_cost_usd: cost,
});
const tasks = (...ids: string[]) => ({
  type: "system",
  subtype: "background_tasks_changed",
  tasks: ids,
});
let cwd = "";
const approval: NonNullable<RunOptions["followUps"]>[number] = {
  name: "approve preview",
  reply: (observation) => {
    const [token] = /TOKEN-\d+/.exec(observation.finalText) ?? [];
    return token === undefined
      ? { gateNotReached: "preview has no approval token" }
      : { reply: `APPROVED ${token}` };
  },
};
function options(): RunOptions {
  return {
    cwd,
    prompt: "preview the change",
    budgetUsd: 1,
    model: "haiku",
    wallClockMs: 30_000,
    followUps: [approval],
  };
}
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "turn-observation-"));
  execFileSync("git", ["init", "-q"], { cwd });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--allow-empty",
      "-qm",
      "initial",
    ],
    { cwd },
  );
  sdk.query.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(cwd, { recursive: true, force: true });
});

test("derives the reply from the settled preview and records git boundaries and cumulative cost", async () => {
  sdk.query.mockImplementation(async function* ({ prompt }) {
    const input = inputStream(prompt);
    await input.next();
    yield* scripted(success("Approve TOKEN-42"));
    expect(await input.next()).toMatchObject({
      value: { message: { content: "APPROVED TOKEN-42" } },
    });
    writeFileSync(join(cwd, "approved.txt"), "approved");
    yield* scripted({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Write",
            input: { file_path: "approved.txt" },
          },
        ],
      },
    });
    execFileSync("git", ["add", "approved.txt"], { cwd });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "commit",
        "-qm",
        "approved",
      ],
      { cwd },
    );
    yield* scripted(success("committed", FINAL_COST));
  });
  const observation = await observeClaude(options());
  expect(observation.finalText).toBe("committed");
  expect(sdk.query).toHaveBeenCalledTimes(ONE_CALL);
  expect(observation.costUsd).toBe(FINAL_COST);
  expect(observation.toolCalls).toHaveLength(ONE_CALL);
  expect(observation.turns).toHaveLength(TWO_TURNS);
  const [preview, execution] = observation.turns ?? [];
  if (preview === undefined || execution === undefined) {
    throw new Error("missing turns");
  }
  expect(preview).toMatchObject({
    name: "initial",
    prompt: "preview the change",
    finalText: "Approve TOKEN-42",
    toolCalls: [],
    gitStatusAfter: { kind: "worktree", entries: "" },
  });
  expect(preview.gitHeadAfter).toEqual(preview.gitHeadBefore);
  expect(execution).toMatchObject({
    name: "approve preview",
    prompt: "APPROVED TOKEN-42",
    finalText: "committed",
    gitStatusBefore: preview.gitStatusAfter,
    gitHeadBefore: preview.gitHeadAfter,
  });
  expect(execution.gitHeadAfter).not.toEqual(preview.gitHeadAfter);
  expect(execution.toolCalls).toHaveLength(ONE_CALL);
});

test("fails with the turn name rather than sending a reply when the gate is absent", async () => {
  sdk.query.mockImplementation(() =>
    scripted(success("I cannot find the repository")),
  );
  const observation = await observeClaude(options());
  expect(observation).toMatchObject({
    subtype: "gate_not_reached",
    isError: true,
    costUsd: FIRST_COST,
  });
  expect(observation.finalText).toMatch(
    /turn 2.*approve preview.*preview has no approval token/,
  );
  expect(() => {
    assertRunHappened(observation);
  }).toThrow(/gate not reached.*turn 2.*approve preview/);
});

test("waits for background settlement before computing and sending a follow-up", async () => {
  sdk.query.mockImplementation(async function* ({ prompt }) {
    const input = inputStream(prompt);
    await input.next();
    const nextReply = input.next();
    let replySent = false;
    void nextReply.then(() => {
      replySent = true;
    });
    yield* scripted(tasks("worker"), success("not ready"), tasks());
    expect(replySent).toBe(false);
    yield* scripted(success("Approve TOKEN-42"));
    expect(await nextReply).toMatchObject({
      value: { message: { content: "APPROVED TOKEN-42" } },
    });
    yield* scripted(success("done", FINAL_COST));
  });
  expect(await observeClaude(options())).toMatchObject({
    finalText: "done",
    turns: [{ finalText: "Approve TOKEN-42" }, { finalText: "done" }],
  });
});

test("uses one deadline across turns and retains the first turn on a later timeout", async () => {
  vi.useFakeTimers();
  sdk.query.mockImplementation(async function* ({
    prompt,
    options: requestOptions,
  }) {
    const signal = requestOptions?.abortController?.signal;
    if (signal === undefined) throw new Error("expected abort signal");
    const input = inputStream(prompt);
    await input.next();
    const turnDelay = new EventEmitter();
    setTimeout(() => {
      turnDelay.emit("ready");
    }, FIRST_TURN_DELAY);
    await once(turnDelay, "ready");
    yield* scripted(success("Approve TOKEN-42"));
    await input.next();
    yield* scripted(success(""));
    await once(signal, "abort");
    throw new Error("aborted turn two");
  });
  const pending = observeClaude({ ...options(), wallClockMs: DEADLINE });
  await vi.advanceTimersByTimeAsync(DEADLINE);
  const observation = await pending;
  expect(observation).toMatchObject({
    timedOut: true,
    costUsd: FIRST_COST,
    turns: [{ subtype: "success" }, { subtype: "query_error", timedOut: true }],
  });
  expect(() => {
    assertRunHappened(observation);
  }).toThrow(/wall clock/);
  expect(vi.getTimerCount()).toBe(NO_TIMERS);
});

test("rejects a missing later result instead of reusing the preview", async () => {
  sdk.query.mockImplementation(() => scripted(success("Approve TOKEN-42")));
  const observation = await observeClaude(options());
  expect(observation).toMatchObject({
    subtype: "query_error",
    costUsd: FIRST_COST,
    turns: [{ subtype: "success" }, { subtype: "query_error" }],
  });
  expect(() => {
    assertRunHappened(observation);
  }).toThrow(/no result.*turn 2.*approve preview/);
});

test("keeps single-turn aggregate behavior and records one boundary", async () => {
  sdk.query.mockImplementation(() => scripted(success("unchanged")));
  const singleTurn = { ...options(), followUps: [] };
  expect(await observeClaude(singleTurn)).toMatchObject({
    finalText: "unchanged",
    costUsd: FIRST_COST,
    isError: false,
    turns: [
      { name: "initial", prompt: "preview the change", finalText: "unchanged" },
    ],
  });
});

function inputStream(prompt: string | AsyncIterable<SDKUserMessage>) {
  if (typeof prompt === "string") throw new Error("expected stream");
  return prompt[Symbol.asyncIterator]();
}

test("retains the latest cumulative cost when a later background turn has no final result", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      success("Approve TOKEN-42"),
      tasks("worker"),
      success("working", FINAL_COST),
      tasks(),
    ),
  );
  const observation = await observeClaude(options());
  expect(observation).toMatchObject({
    costUsd: FINAL_COST,
    subtype: "query_error",
  });
});

test("does not send a scripted reply after an error result", async () => {
  sdk.query.mockImplementation(() =>
    scripted({
      type: "result",
      subtype: "error_max_budget_usd",
      is_error: true,
      errors: ["budget exceeded"],
      total_cost_usd: FIRST_COST,
    }),
  );
  const observation = await observeClaude(options());
  expect(observation).toMatchObject({
    subtype: "gate_not_reached",
    turns: [
      { subtype: "error_max_budget_usd" },
      { name: "approve preview", prompt: null },
    ],
  });
  expect(() => {
    assertRunHappened(observation);
  }).toThrow(/previous turn failed/);
});

test("sends multiple follow-ups in order and settles background work on the second turn", async () => {
  sdk.query.mockImplementation(async function* ({ prompt }) {
    const input = inputStream(prompt);
    await input.next();
    yield* scripted(success("Please revise"));
    expect(await input.next()).toMatchObject({
      value: { message: { content: "REVISE" } },
    });
    writeFileSync(join(cwd, "draft.txt"), "revised");
    yield* scripted(
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "Revising the preview" }] },
      },
      tasks("revision"),
      success("revision running"),
      tasks(),
      success("Approve TOKEN-99"),
    );
    expect(await input.next()).toMatchObject({
      value: { message: { content: "APPROVED TOKEN-99" } },
    });
    yield* scripted(success("approved revision", FINAL_COST));
  });
  const observation = await observeClaude({
    ...options(),
    followUps: [
      { name: "revise", reply: () => ({ reply: "REVISE" }) },
      approval,
    ],
  });
  expect(observation).toMatchObject({
    finalText: "approved revision",
    turns: [
      { name: "initial", finalText: "Please revise" },
      {
        name: "revise",
        prompt: "REVISE",
        finalText: "Approve TOKEN-99",
        gitStatusAfter: { kind: "worktree", entries: "?? draft.txt" },
      },
      {
        name: "approve preview",
        prompt: "APPROVED TOKEN-99",
        gitStatusBefore: { kind: "worktree", entries: "?? draft.txt" },
      },
    ],
  });
});
