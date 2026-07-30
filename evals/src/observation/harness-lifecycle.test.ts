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

import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, expect, test, vi } from "vitest";

import type { Observation } from "#/observation/harness.ts";
import {
  gitStatus,
  QUERY_ERROR_SUBTYPE,
  runClaude,
} from "#/observation/harness.ts";

/** Values the next `execFileSync` calls throw instead of running; a Proxy seam
 * keeps Node's overloaded signature without a type assertion. */
const forcedExecFileSyncFailures = vi.hoisted((): unknown[] => []);

vi.mock(import("node:child_process"), async (importOriginal) => {
  const real = await importOriginal();
  const passthroughExecFileSync = new Proxy(real.execFileSync, {
    apply: (
      target,
      thisArgument: unknown,
      argumentList: readonly unknown[],
    ) => {
      const forcedFailure = forcedExecFileSyncFailures.shift();
      if (forcedFailure !== undefined) {
        // oxlint-disable-next-line typescript/only-throw-error -- Subprocess boundaries may throw plain objects; tests queue them verbatim.
        throw forcedFailure;
      }
      const output: unknown = Reflect.apply(target, thisArgument, argumentList);
      return output;
    },
  });
  return { ...real, execFileSync: passthroughExecFileSync };
});

vi.mock(import("@anthropic-ai/claude-agent-sdk"), async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, query: vi.fn() };
});

const queryMock = vi.mocked(query);
type QueryReturn = ReturnType<typeof query>;
type QueryParams = Parameters<typeof query>[0];
const tempDirectories: string[] = [];

afterEach(() => {
  vi.useRealTimers();
  forcedExecFileSyncFailures.length = 0;
  for (const tempDirectory of tempDirectories.splice(0)) {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
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
const FOREIGN_BIGINT = 1n;

function createTempDirectory(prefix: string): string {
  const tempDirectory = mkdtempSync(join(tmpdir(), prefix));
  tempDirectories.push(tempDirectory);
  return tempDirectory;
}

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

type FakeContentEntry = FakeContentBlock | null;

type FakeMessage =
  | { type: "assistant"; message: { content: FakeContentEntry[] } }
  | { type: "user"; message: { role: "user"; content: string } }
  | {
      type: "result";
      subtype?: unknown;
      is_error?: unknown;
      result?: unknown;
      errors?: unknown;
      total_cost_usd?: unknown;
    };

function fakeQuery(
  generatorFactory: () =>
    | Generator<FakeMessage, void>
    | AsyncGenerator<FakeMessage, void>,
): QueryReturn {
  const generator = generatorFactory();
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

const assistant = (...content: FakeContentEntry[]): FakeMessage => ({
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

async function runHarness(wallClockMs = WALL_CLOCK_MS): Promise<Observation> {
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
  if (call == null) throw new Error("query was never called");
  return call[0];
}

test("an invalid subprocess status preserves a valid stderr diagnostic", () => {
  // Pins the projection's per-field resilience: a malformed status must not
  // erase the sibling diagnostics.
  forcedExecFileSyncFailures.push({
    status: "not a number",
    stderr: "projected stderr survives\nsecondary detail",
    code: "IGNORED",
    message: "ignored message",
  });

  expect(gitStatus(tmpdir())).toStrictEqual({
    kind: "unreadable",
    reason: "projected stderr survives",
  });
});

test("a normal stream yields the result and its tool calls", async () => {
  queryMock.mockReturnValue(
    scripted(assistant(toolUse("Skill")), success("done", COST_FULL)),
  );

  const observation = await runHarness();

  expect(observation.subtype).toBe("success");
  expect(observation.isError).toBe(false);
  expect(observation.finalText).toBe("done");
  expect(observation.costUsd).toBe(COST_FULL);
  expect(observation.toolCalls.map((c) => c.name)).toStrictEqual(["Skill"]);
  expect(observation.timedOut).toBe(false);
});

test("runClaude applies harness-owned query policy", async () => {
  queryMock.mockReturnValue(scripted(success("done", COST_FULL)));

  await runHarness();

  const params = lastQueryParams();
  expect(params.options).toMatchObject({
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

test("runClaude samples gitRepo, not cwd, when supplied", async () => {
  const workingDirectory = createTempDirectory("harness-cwd-");
  const gitRepository = createTempDirectory("harness-repo-");
  execFileSync("git", ["init", "-q"], {
    cwd: gitRepository,
    stdio: "ignore",
  });
  queryMock.mockReturnValue(scripted(success("done", COST_FULL)));

  const observation = await runClaude({
    cwd: workingDirectory,
    gitRepo: gitRepository,
    prompt: "observe the repo",
    budgetUsd: BUDGET_USD,
    model: "haiku",
    wallClockMs: WALL_CLOCK_MS,
  });

  expect(observation.gitStatusBefore.kind).toBe("worktree");
  expect(observation.gitStatusAfter.kind).toBe("worktree");
});

test("tool calls accumulate across assistant messages in stream order", async () => {
  queryMock.mockReturnValue(
    scripted(
      assistant({ type: "text" }, toolUse("Read")),
      assistant(toolUse("Bash", { command: "git log" }), toolUse("Grep")),
      success("done", COST_FULL),
    ),
  );

  const observation = await runHarness();

  expect(observation.toolCalls.map((c) => c.name)).toStrictEqual([
    "Read",
    "Bash",
    "Grep",
  ]);
  expect(observation.toolCalls[1]?.input).toStrictEqual({ command: "git log" });
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

  const observation = await runHarness();

  expect(observation.toolCalls).toStrictEqual([
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

  const observation = await runHarness();

  expect(observation.subtype).toBe("success");
  expect(observation.toolCalls).toStrictEqual([]);
  expect(observation.finalText).toBe("done");
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

  const observation = await runHarness();

  expect(observation.subtype).toBe("success");
  expect(observation.isError).toBe(true);
  expect(observation.toolCalls).toStrictEqual([]);
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

  const observation = await runHarness();

  expect(observation.subtype).toBe("error_max_budget_usd");
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("max budget exceeded\nbudget was $0.01");
  expect(observation.costUsd).toBe(COST_BUDGET_STOP);
  expect(observation.toolCalls.map((c) => c.name)).toStrictEqual(["Skill"]);
});

test("a query that throws before yielding reports no result and books no cost", async () => {
  queryMock.mockImplementation(() => {
    throw new Error("bundled CLI failed to start");
  });

  const observation = await runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("bundled CLI failed to start");
  expect(observation.costUsd).toBe(0);
  expect(observation.timedOut).toBe(false);
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

  const observation = await runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("stream died");
  expect(observation.costUsd).toBe(0);
  expect(observation.toolCalls.map((c) => c.name)).toStrictEqual(["Write"]);
});

test.each([
  {
    name: "a malformed assistant content entry fails closed and keeps prior tool calls",
    // A relevant assistant message is atomic: the malformed second message must
    // not commit its Write call while the earlier valid message survives.
    messageScript: [
      assistant(toolUse("Read")),
      assistant(toolUse("Write", { file_path: "/repo/x" }), null),
      success("done", COST_FULL),
    ],
    expectedRetainedToolNames: ["Read"],
  },
  {
    name: "a malformed result fails closed and keeps prior tool calls",
    messageScript: [
      assistant(toolUse("Write", { file_path: "/repo/x" })),
      {
        type: "result",
        subtype: "success",
        is_error: false,
        result: "done",
        total_cost_usd: "not a number",
      },
    ],
    expectedRetainedToolNames: ["Write"],
  },
] satisfies ReadonlyArray<{
  name: string;
  messageScript: FakeMessage[];
  expectedRetainedToolNames: string[];
}>)("$name", async ({ messageScript, expectedRetainedToolNames }) => {
  queryMock.mockReturnValue(scripted(...messageScript));

  const observation = await runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.costUsd).toBe(0);
  expect(observation.toolCalls.map((call) => call.name)).toStrictEqual(
    expectedRetainedToolNames,
  );
});

const cyclicFailure: Record<string, unknown> = {};
cyclicFailure["self"] = cyclicFailure;

test.each([
  {
    name: "a BigInt thrown value cannot reject observation settlement",
    thrownValue: FOREIGN_BIGINT,
    expectedFinalText: "1",
  },
  {
    name: "a cyclic thrown value cannot reject observation settlement",
    thrownValue: cyclicFailure,
    expectedFinalText: null,
  },
])("$name", async ({ thrownValue, expectedFinalText }) => {
  queryMock.mockImplementation(() => {
    // oxlint-disable-next-line typescript/only-throw-error -- The boundary accepts unknown thrown values; these cases intentionally exercise non-Error values.
    throw thrownValue;
  });

  const observation = await runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBeTypeOf("string");
  expect(
    expectedFinalText === null || observation.finalText === expectedFinalText,
  ).toBe(true);
  expect(observation.costUsd).toBe(0);
});

test("a stream that ends without a result fails closed", async () => {
  // An exhausted generator with no result message must not read as a clean
  // empty run: a negative case would pass on a query that never concluded.
  queryMock.mockReturnValue(scripted(assistant(toolUse("Read"))));

  const observation = await runHarness();

  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  expect(observation.finalText).toBe("query ended without a result message");
  expect(observation.costUsd).toBe(0);
  expect(observation.toolCalls.map((c) => c.name)).toStrictEqual(["Read"]);
});

test("a run that exceeds its wall clock is aborted and settles", async () => {
  // The generator hangs until the harness's own AbortController fires, which
  // is exactly how a hung SDK query behaves from the caller's side.
  queryMock.mockImplementation((params: QueryParams) => {
    const signal = params.options?.abortController?.signal;
    if (signal == null) throw new Error("no abort controller supplied");
    return fakeQuery(async function* () {
      yield assistant(toolUse("Read"));
      await once(signal, "abort");
      throw new Error("The operation was aborted");
    });
  });

  const observation = await runHarness(SHORT_WALL_CLOCK_MS);

  expect(observation.timedOut).toBe(true);
  expect(observation.subtype).toBe(QUERY_ERROR_SUBTYPE);
  expect(observation.isError).toBe(true);
  // The abort must not cost us the evidence gathered before it.
  expect(observation.toolCalls.map((c) => c.name)).toStrictEqual(["Read"]);
});

test("a completed run cannot be re-flagged by its own expired timer", async () => {
  vi.useFakeTimers();
  queryMock.mockReturnValue(scripted(success("done", COST_FULL)));

  const observation = await runHarness(SHORT_WALL_CLOCK_MS);
  const queryCall = queryMock.mock.lastCall;
  if (queryCall == null) throw new Error("query was never called");
  const abortController = queryCall[0].options?.abortController;
  expect(abortController).toBeInstanceOf(AbortController);

  // The timer was cleared in the settle path; firing past the deadline must not
  // abort the controller the completed query received.
  vi.advanceTimersByTime(PAST_THE_DEADLINE_MS);

  expect(abortController?.signal.aborted).toBe(false);
  expect(observation.timedOut).toBe(false);
});
