// Pins `runClaude`'s query lifecycle: what a run observes when the Agent SDK
// stream ends abnormally, and what it must still observe when the stream ends
// normally but untidily.
//
// The rest of the offline suite tests pure functions. This file needs the SDK
// boundary itself, so it replaces `query` with a fake async generator and
// drives the actual message loop, timeout timer, and settlement path. No
// token is spent: no subprocess ever starts.
//
//   pnpm test

import { once } from "node:events";
import { tmpdir } from "node:os";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, expect, test, vi } from "vitest";

import type { Observation } from "#/observation/harness.ts";
import { QUERY_ERROR_SUBTYPE, runClaude } from "#/observation/harness.ts";

vi.mock(import("@anthropic-ai/claude-agent-sdk"), async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, query: vi.fn() };
});

const queryMock = vi.mocked(query);
type QueryReturn = ReturnType<typeof query>;
type QueryParams = Parameters<typeof query>[0];

afterEach(() => {
  vi.useRealTimers();
});

const WALL_CLOCK_MS = 30_000;
/** Short enough to exercise the abort path without slowing the suite. */
const SHORT_WALL_CLOCK_MS = 25;
/** Well past the short deadline, for the cleared-timer test. */
const PAST_THE_DEADLINE_MS = 50;
const BUDGET_USD = 0.01;
/** Distinct costs, so a test names which message a value came from. */
const COST_FULL = 0.5;
const COST_BUDGET_STOP = 0.25;

/**
 * The messages these fakes yield carry only the fields `runClaude` reads.
 * The SDK's full message types demand deeply nested usage records, session
 * ids, and model bookkeeping that no assertion here consults; padding every
 * fake with that dead data would bury the fields under test. The cast below
 * is the single boundary where the narrow fakes meet the SDK signature.
 */
interface FakeContentBlock {
  type: string;
  name?: string;
  input?: unknown;
}

type FakeMessage =
  | { type: "assistant"; message: { content: FakeContentBlock[] } }
  | { type: "user"; message: { role: "user"; content: string } }
  | {
      type: "result";
      subtype: string;
      is_error: boolean;
      result?: string;
      errors?: string[];
      total_cost_usd: number;
    };

function fakeQuery(
  gen: () => Generator<FakeMessage, void> | AsyncGenerator<FakeMessage, void>,
): QueryReturn {
  const generator = gen();
  // The harness only iterates the generator (`for await` accepts sync and
  // async iterables alike); Query's control methods (interrupt,
  // setPermissionMode, ...) are never called.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The single boundary where the narrow fakes meet the SDK signature; see the FakeMessage comment above.
  return generator as unknown as QueryReturn;
}

/** A query that yields a fixed script of messages, then ends. */
function scripted(...script: FakeMessage[]): QueryReturn {
  return fakeQuery(function* () {
    yield* script;
  });
}

const toolUse = (name: string, input: unknown = {}): FakeContentBlock => ({
  type: "tool_use",
  name,
  input,
});

const assistant = (...content: FakeContentBlock[]): FakeMessage => ({
  type: "assistant",
  message: { content },
});

const success = (text: string, cost: number): FakeMessage => ({
  type: "result",
  subtype: "success",
  is_error: false,
  result: text,
  total_cost_usd: cost,
});

async function run(wallClockMs = WALL_CLOCK_MS): Promise<Observation> {
  return runClaude({
    cwd: tmpdir(),
    prompt: "observe the repo",
    budgetUsd: BUDGET_USD,
    model: "haiku",
    wallClockMs,
  });
}

function lastQueryParams(): QueryParams {
  const call = queryMock.mock.lastCall;
  if (call === undefined) throw new Error("query was never called");
  return call[0];
}

test("a normal stream yields the result and its tool calls", async () => {
  queryMock.mockReturnValue(
    scripted(assistant(toolUse("Skill")), success("done", COST_FULL)),
  );

  const o = await run();

  expect(o.subtype).toBe("success");
  expect(o.isError).toBe(false);
  expect(o.finalText).toBe("done");
  expect(o.costUsd).toBe(COST_FULL);
  expect(o.toolCalls.map((c) => c.name)).toStrictEqual(["Skill"]);
  expect(o.timedOut).toBe(false);
});

test("run options map one-to-one onto the query options", async () => {
  queryMock.mockReturnValue(scripted(success("done", COST_FULL)));

  await run();

  const params = lastQueryParams();
  expect(params.prompt).toBe("observe the repo");
  expect(params.options).toMatchObject({
    cwd: tmpdir(),
    model: "haiku",
    maxBudgetUsd: BUDGET_USD,
    permissionMode: "auto",
    settingSources: ["project"],
    systemPrompt: { type: "preset", preset: "claude_code" },
    tools: { type: "preset", preset: "claude_code" },
  });
  expect(params.options?.abortController).toBeInstanceOf(AbortController);
  // Omitted on purpose: setting `env` REPLACES the subprocess environment,
  // and the run must inherit ambient credentials.
  expect(params.options ?? {}).not.toHaveProperty("env");
});

test("tool calls accumulate across assistant messages in stream order", async () => {
  queryMock.mockReturnValue(
    scripted(
      assistant({ type: "text" }, toolUse("Read")),
      assistant(toolUse("Bash", { command: "git log" }), toolUse("Grep")),
      success("done", COST_FULL),
    ),
  );

  const o = await run();

  expect(o.toolCalls.map((c) => c.name)).toStrictEqual([
    "Read",
    "Bash",
    "Grep",
  ]);
  expect(o.toolCalls[1]?.input).toStrictEqual({ command: "git log" });
});

test("a malformed tool input degrades to an empty record, not a lost call", async () => {
  // The model, not the type system, decides what `input` is. An array or a
  // scalar must keep the call -- its existence is the evidence -- while the
  // unreadable input reads as empty rather than inventing fields.
  queryMock.mockReturnValue(
    scripted(
      assistant(toolUse("Write", ["an", "array"]), toolUse("Edit", "scalar")),
      success("done", COST_FULL),
    ),
  );

  const o = await run();

  expect(o.toolCalls).toStrictEqual([
    { name: "Write", input: {} },
    { name: "Edit", input: {} },
  ]);
});

test("messages that are neither assistant nor result are ignored", async () => {
  queryMock.mockReturnValue(
    scripted(
      { type: "user", message: { role: "user", content: "echoed prompt" } },
      success("done", COST_FULL),
    ),
  );

  const o = await run();

  expect(o.subtype).toBe("success");
  expect(o.toolCalls).toStrictEqual([]);
  expect(o.finalText).toBe("done");
});

test("an authentication failure surfaces as a failed run", async () => {
  // What an expired login actually produces: the result subtype says success,
  // so `isError` is the only field that carries the failure out of the run.
  queryMock.mockReturnValue(
    scripted({
      type: "result",
      subtype: "success",
      is_error: true,
      result: "Failed to authenticate: OAuth session expired",
      total_cost_usd: 0,
    }),
  );

  const o = await run();

  expect(o.subtype).toBe("success");
  expect(o.isError).toBe(true);
  expect(o.toolCalls).toStrictEqual([]);
});

test("an error result keeps its diagnostics, cost, and prior tool calls", async () => {
  // The error variant of the result union carries `errors`, not `result`.
  // Tier-1 cases depend on exactly this shape: the budget cap ends the run
  // after the routing decision became observable, and the observation must
  // keep both the decision and the money it cost.
  queryMock.mockReturnValue(
    scripted(assistant(toolUse("Skill")), {
      type: "result",
      subtype: "error_max_budget_usd",
      is_error: true,
      errors: ["max budget exceeded", "budget was $0.01"],
      total_cost_usd: COST_BUDGET_STOP,
    }),
  );

  const o = await run();

  expect(o.subtype).toBe("error_max_budget_usd");
  expect(o.isError).toBe(true);
  expect(o.finalText).toBe("max budget exceeded\nbudget was $0.01");
  expect(o.costUsd).toBe(COST_BUDGET_STOP);
  expect(o.toolCalls.map((c) => c.name)).toStrictEqual(["Skill"]);
});

test("a query that throws before yielding reports no result and books no cost", async () => {
  queryMock.mockImplementation(() => {
    throw new Error("bundled CLI failed to start");
  });

  const o = await run();

  expect(o.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(o.isError).toBe(true);
  expect(o.finalText).toBe("bundled CLI failed to start");
  expect(o.costUsd).toBe(0);
  expect(o.timedOut).toBe(false);
});

test("a mid-stream failure keeps the observations already made", async () => {
  // A run that died after doing real work is not a run that did nothing:
  // the tool calls it made are exactly what the mutation-scope check needs
  // to inspect, and blanking them would read as "no evidence" -- the one
  // meaning an observation must never fabricate.
  queryMock.mockReturnValue(
    fakeQuery(function* () {
      yield assistant(toolUse("Write", { file_path: "/repo/x" }));
      throw new Error("stream died");
    }),
  );

  const o = await run();

  expect(o.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(o.isError).toBe(true);
  expect(o.finalText).toBe("stream died");
  expect(o.costUsd).toBe(0);
  expect(o.toolCalls.map((c) => c.name)).toStrictEqual(["Write"]);
});

test("a stream that ends without a result fails closed", async () => {
  // An exhausted generator with no result message must not read as a clean
  // empty run: a negative case would pass on a query that never concluded.
  queryMock.mockReturnValue(scripted(assistant(toolUse("Read"))));

  const o = await run();

  expect(o.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(o.isError).toBe(true);
  expect(o.finalText).toBe("query ended without a result message");
  expect(o.costUsd).toBe(0);
  expect(o.toolCalls.map((c) => c.name)).toStrictEqual(["Read"]);
});

test("a run that exceeds its wall clock is aborted and settles", async () => {
  // The generator hangs until the harness's own AbortController fires, which
  // is exactly how a hung SDK query behaves from the caller's side.
  queryMock.mockImplementation((params: QueryParams) => {
    const signal = params.options?.abortController?.signal;
    if (signal === undefined) throw new Error("no abort controller supplied");
    return fakeQuery(async function* () {
      yield assistant(toolUse("Read"));
      await once(signal, "abort");
      throw new Error("The operation was aborted");
    });
  });

  const o = await run(SHORT_WALL_CLOCK_MS);

  expect(o.timedOut).toBe(true);
  expect(o.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(o.isError).toBe(true);
  // The abort must not cost us the evidence gathered before it.
  expect(o.toolCalls.map((c) => c.name)).toStrictEqual(["Read"]);
});

test("a completed run cannot be re-flagged by its own expired timer", async () => {
  vi.useFakeTimers();
  queryMock.mockReturnValue(scripted(success("done", COST_FULL)));

  const o = await run(SHORT_WALL_CLOCK_MS);
  const snapshot = structuredClone(o);

  // The timer was cleared in the settle path; firing past the deadline must
  // neither abort anything nor mutate the observation already returned.
  vi.advanceTimersByTime(PAST_THE_DEADLINE_MS);

  expect(o).toStrictEqual(snapshot);
  expect(o.timedOut).toBe(false);
});

test("the returned tool-call array is a copy, not the accumulator", async () => {
  // A fresh generator per call: a generator is single-use, and this test runs
  // the harness twice.
  queryMock.mockImplementation(() =>
    scripted(assistant(toolUse("Read")), success("done", COST_FULL)),
  );

  const o = await run();
  const before = o.toolCalls.length;

  // Nothing external holds the accumulator, so the only way this could fail
  // is if the harness handed out its internal array by reference and later
  // code pushed into it. Mutating the returned copy must be a local act.
  o.toolCalls.push({ name: "Injected", input: {} });

  const again = await run();
  expect(again.toolCalls).toHaveLength(before);
});
