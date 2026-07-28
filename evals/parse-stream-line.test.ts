// Pins the stream parser's tolerance contract: a malformed, truncated, or
// unrecognized line must be skipped, never thrown on. A crash here would lose
// an entire paid run, so these cases exist to make that regression loud.
//
//   pnpm test

import { expect, test } from "vitest";

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

  expect(parseStreamLine(line)).toStrictEqual({
    kind: "tool_calls",
    calls: [{ name: "Bash", input: { command: "git log" } }],
  });
});

// A `tool_use` input is only usable as a record, so anything else collapses to
// an empty one rather than reaching a consumer that would index into it.
test("a tool_use input is recorded as-is only when it is a record", () => {
  const inputOf = (input: unknown): Record<string, unknown> => {
    const event = parseStreamLine(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "tool_use", name: "T", input }] },
      }),
    );
    if (event?.kind !== "tool_calls") {
      throw new Error(`expected tool_calls, got ${JSON.stringify(event)}`);
    }
    const call = event.calls.at(0);
    if (call === undefined) throw new Error("expected one tool call");
    return call.input;
  };

  expect(inputOf({ command: "git log" })).toStrictEqual({ command: "git log" });
  expect(inputOf(["git", "log"])).toStrictEqual({});
  expect(inputOf("git log")).toStrictEqual({});
  expect(inputOf(0)).toStrictEqual({});
  expect(inputOf(false)).toStrictEqual({});
  expect(inputOf(null)).toStrictEqual({});
  expect(inputOf(undefined)).toStrictEqual({});
});

test("an assistant event with no tool calls records nothing", () => {
  const line = JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "text", text: "hello" }] },
  });

  expect(parseStreamLine(line)).toStrictEqual({
    kind: "tool_calls",
    calls: [],
  });
});

test("a result event yields the run totals", () => {
  const line = JSON.stringify({
    type: "result",
    subtype: "success",
    result: "# Project State Snapshot",
    total_cost_usd: 0.42,
  });

  expect(parseStreamLine(line)).toStrictEqual({
    kind: "result",
    subtype: "success",
    finalText: "# Project State Snapshot",
    costUsd: 0.42,
  });
});

test("malformed JSON is skipped", () => {
  expect(parseStreamLine('{"type":"assistant"')).toBeNull();
});

test("a line that is not JSON is skipped", () => {
  expect(parseStreamLine("not json")).toBeNull();
  expect(parseStreamLine("")).toBeNull();
  expect(parseStreamLine("[1,2,3]")).toBeNull();
});

test("missing and wrong-typed fields fall back instead of throwing", () => {
  expect(parseStreamLine(JSON.stringify({ type: "result" }))).toStrictEqual({
    kind: "result",
    subtype: "",
    finalText: "",
    costUsd: 0,
  });

  expect(
    parseStreamLine(
      JSON.stringify({
        type: "result",
        subtype: 5,
        result: { not: "a string" },
        total_cost_usd: "abc",
      }),
    ),
  ).toStrictEqual({ kind: "result", subtype: "5", finalText: "", costUsd: 0 });

  expect(
    parseStreamLine(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "tool_use", name: 7, input: null }] },
      }),
    ),
  ).toStrictEqual({ kind: "tool_calls", calls: [{ name: "7", input: {} }] });

  expect(parseStreamLine(JSON.stringify({ type: "assistant" }))).toBeNull();
  expect(
    parseStreamLine(JSON.stringify({ type: "system", subtype: "init" })),
  ).toBeNull();
});
