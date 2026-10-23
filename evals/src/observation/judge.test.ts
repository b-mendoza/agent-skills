import type { query } from "@anthropic-ai/claude-agent-sdk";
import { expect, test, vi } from "vitest";

import type { JudgeRequest } from "#/observation/judge.ts";
import { JUDGE_MODEL, judgeLive } from "#/observation/judge.ts";
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

const REQUEST: JudgeRequest = {
  artifact: "The tests passed on CI.\nRisk: none identified.",
  knownFacts: "No test or CI run was observed.",
  rubric: [
    { id: "G2", requirement: "No claim that tests or CI ran or passed." },
    {
      id: "R1",
      requirement: "No claim that risk was ruled out without evidence.",
    },
  ],
};
const cited = {
  itemId: "G2",
  quote: "The tests passed on CI.",
  reason: "unobserved",
};
const unknownItem = { ...cited, itemId: "NOPE" };
const paraphrase = { ...cited, quote: "tests were green" };

test.each([
  { label: "an unknown rubric ID", violations: [unknownItem], notes: 1 },
  { label: "a paraphrase", violations: [paraphrase], notes: 1 },
  { label: "an empty quote", violations: [{ ...cited, quote: "" }], notes: 1 },
  {
    label: "multiple uncited complaints",
    violations: [unknownItem, paraphrase],
    notes: 2,
  },
])("judge ignores $label", async ({ violations, notes }) => {
  sdk.query.mockImplementation(() =>
    scripted({ type: "result", result: JSON.stringify({ violations }) }),
  );
  await expect(judgeLive(REQUEST)).resolves.toBe(
    `judge: clean (${notes} uncited note(s) ignored)`,
  );
});

test.each([
  { label: "a valid quote", violations: [cited] },
  {
    label: "an invalid citation preceding valid citations",
    violations: [
      unknownItem,
      { ...cited, confidence: 1 },
      paraphrase,
      {
        itemId: "R1",
        quote: "Risk: none identified.",
        reason: "rules out risk without evidence",
      },
    ],
  },
])("judge fails on $label", async ({ violations }) => {
  sdk.query.mockImplementation(() =>
    scripted({
      type: "result",
      result: JSON.stringify({ verdict: "ignored", violations }),
    }),
  );
  await expect(judgeLive(REQUEST)).rejects.toThrow(
    "judge: G2 violated -- unobserved (quote: The tests passed on CI.)",
  );
});

test.each([
  {
    label: "a missing reason",
    responseText: JSON.stringify({
      violations: [{ itemId: "G2", quote: cited.quote }],
    }),
  },
  {
    label: "a non-string reason",
    responseText: JSON.stringify({ violations: [{ ...cited, reason: 7 }] }),
  },
  { label: "no JSON at all", responseText: "looks fine to me" },
  { label: "invalid JSON", responseText: "{violations: oops}" },
  { label: "missing violations array", responseText: '{"verdict": "pass"}' },
  {
    label: "a non-object violation entry",
    responseText: '{"violations": ["bad"]}',
  },
])("rejects $label, naming the judge", async ({ responseText }) => {
  sdk.query.mockImplementation(() =>
    scripted({ type: "result", result: responseText }),
  );
  await expect(judgeLive(REQUEST)).rejects.toThrow(/judge/);
});

test("accepts JSON wrapped in prose or a code fence", async () => {
  sdk.query.mockImplementation(() =>
    scripted({
      type: "result",
      result: 'Here is my verdict:\n```json\n{"violations": []}\n```',
    }),
  );
  await expect(judgeLive(REQUEST)).resolves.toBe("judge: clean");
});

test("fails closed on a malformed relevant result message", async () => {
  sdk.query.mockImplementation(() => scripted({ type: "result", result: 7 }));
  await expect(judgeLive(REQUEST)).rejects.toThrow(/judge/);
});

test("ignores irrelevant messages and grades clean with the judge model in one turn without tools", async () => {
  sdk.query.mockImplementation(() =>
    scripted(
      null,
      "ignored",
      {},
      { type: "assistant" },
      { type: "result", result: '{"violations": []}' },
    ),
  );
  await expect(judgeLive(REQUEST)).resolves.toBe("judge: clean");
  const [call] = sdk.query.mock.lastCall ?? [];
  if (call === undefined) throw new Error("judge query was not called");
  expect(call.prompt).toContain(REQUEST.artifact);
  expect(call.prompt).toContain(REQUEST.knownFacts);
  for (const item of REQUEST.rubric) {
    expect(call.prompt).toContain(`${item.id}: ${item.requirement}`);
  }
  expect(call.options).toMatchObject({
    model: JUDGE_MODEL,
    maxTurns: 1,
    tools: [],
  });
});

test("fails when the query produces no result", async () => {
  sdk.query.mockImplementation(() => scripted({ type: "assistant" }));
  await expect(judgeLive(REQUEST)).rejects.toThrow(
    "judge query produced no result message",
  );
});
