// Pins the stream parser's tolerance contract: a malformed, truncated, or
// unrecognized line must be skipped, never thrown on. A crash here would lose
// an entire paid run, so these cases exist to make that regression loud.
//
//   node --test evals/parse-stream-line.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { parseStreamLine } from "./harness.ts";

test("an assistant event yields its tool_use blocks", () => {
  const line = JSON.stringify({
    type: "assistant",
    message: {
      content: [
        { type: "text", text: "looking" },
        { type: "tool_use", name: "Bash", input: { command: "git log" } },
      ],
    },
  });

  assert.deepEqual(parseStreamLine(line), {
    kind: "tool_calls",
    calls: [{ name: "Bash", input: { command: "git log" } }],
  });
});

// Both halves of this table are load-bearing. Arrays are recorded as-is, so
// tightening the object check to exclude them would silently drop an input;
// every non-object collapses to `{}`, so falling back on `??` alone would let
// strings, `0`, and `false` through as a `Record`.
test("a tool_use input is recorded as-is only when it is an object", () => {
  const inputOf = (input: unknown): Record<string, unknown> => {
    const event = parseStreamLine(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "tool_use", name: "T", input }] },
      }),
    );
    if (event === null || event.kind !== "tool_calls") {
      throw new Error(`expected tool_calls, got ${JSON.stringify(event)}`);
    }
    const call = event.calls.at(0);
    if (call === undefined) throw new Error("expected one tool call");
    return call.input;
  };

  assert.deepEqual(inputOf({ command: "git log" }), { command: "git log" });
  assert.deepEqual(inputOf(["git", "log"]), ["git", "log"]);
  assert.deepEqual(inputOf("git log"), {});
  assert.deepEqual(inputOf(0), {});
  assert.deepEqual(inputOf(false), {});
  assert.deepEqual(inputOf(null), {});
  assert.deepEqual(inputOf(undefined), {});
});

test("an assistant event with no tool calls records nothing", () => {
  const line = JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "text", text: "hello" }] },
  });

  assert.deepEqual(parseStreamLine(line), { kind: "tool_calls", calls: [] });
});

test("a result event yields the run totals", () => {
  const line = JSON.stringify({
    type: "result",
    subtype: "success",
    result: "# Project State Snapshot",
    total_cost_usd: 0.42,
  });

  assert.deepEqual(parseStreamLine(line), {
    kind: "result",
    subtype: "success",
    finalText: "# Project State Snapshot",
    costUsd: 0.42,
  });
});

test("malformed JSON is skipped", () => {
  assert.equal(parseStreamLine('{"type":"assistant"'), null);
});

test("a line that is not JSON is skipped", () => {
  assert.equal(parseStreamLine("not json"), null);
  assert.equal(parseStreamLine(""), null);
  assert.equal(parseStreamLine("[1,2,3]"), null);
});

test("missing and wrong-typed fields fall back instead of throwing", () => {
  assert.deepEqual(parseStreamLine(JSON.stringify({ type: "result" })), {
    kind: "result",
    subtype: "",
    finalText: "",
    costUsd: 0,
  });

  assert.deepEqual(
    parseStreamLine(
      JSON.stringify({
        type: "result",
        subtype: 5,
        result: { not: "a string" },
        total_cost_usd: "abc",
      }),
    ),
    { kind: "result", subtype: "5", finalText: "", costUsd: 0 },
  );

  assert.deepEqual(
    parseStreamLine(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "tool_use", name: 7, input: null }] },
      }),
    ),
    { kind: "tool_calls", calls: [{ name: "7", input: {} }] },
  );

  assert.equal(parseStreamLine(JSON.stringify({ type: "assistant" })), null);
  assert.equal(
    parseStreamLine(JSON.stringify({ type: "system", subtype: "init" })),
    null,
  );
});
