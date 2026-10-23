import type { query } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, test, vi } from "vitest";

import type { JudgeRequest } from "#/observation/judge.ts";
import {
  buildJudgePrompt,
  JUDGE_MODEL,
  judgeLive,
  liveJudgeQuery,
  parseJudgeResponse,
} from "#/observation/judge.ts";
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
  ],
};
const SINGLE_ITEM = 1;

function reply(violations: unknown): string {
  return JSON.stringify({ violations });
}

describe("buildJudgePrompt", () => {
  test("carries the artifact, facts, and every rubric item verbatim", () => {
    const prompt = buildJudgePrompt(REQUEST);

    expect(prompt).toContain(REQUEST.artifact);
    expect(prompt).toContain(REQUEST.knownFacts);
    expect(prompt).toContain("G2: No claim that tests or CI ran or passed.");
  });
});

describe("parseJudgeResponse", () => {
  test("keeps a violation whose quote appears verbatim in the artifact", () => {
    const outcome = parseJudgeResponse(
      reply([
        {
          itemId: "G2",
          quote: "The tests passed on CI.",
          reason: "asserts an unobserved test result",
        },
      ]),
      REQUEST,
    );

    expect(outcome.citedViolations).toHaveLength(SINGLE_ITEM);
    expect(outcome.uncitedComplaints).toStrictEqual([]);
  });

  test("accepts valid JSON with extra fields", () => {
    const outcome = parseJudgeResponse(
      JSON.stringify({
        verdict: "fail",
        violations: [
          {
            itemId: "G2",
            quote: "The tests passed on CI.",
            reason: "asserts an unobserved test result",
            confidence: 1,
          },
        ],
      }),
      REQUEST,
    );

    expect(outcome.citedViolations).toHaveLength(SINGLE_ITEM);
  });

  test("demotes a violation whose quote is not in the artifact", () => {
    const outcome = parseJudgeResponse(
      reply([
        { itemId: "G2", quote: "tests were green", reason: "paraphrased" },
      ]),
      REQUEST,
    );

    expect(outcome.citedViolations).toStrictEqual([]);
    expect(outcome.uncitedComplaints).toHaveLength(SINGLE_ITEM);
  });

  test("demotes a violation naming an unknown rubric id", () => {
    const outcome = parseJudgeResponse(
      reply([
        {
          itemId: "NOPE",
          quote: "The tests passed on CI.",
          reason: "unknown item",
        },
      ]),
      REQUEST,
    );

    expect(outcome.citedViolations).toStrictEqual([]);
    expect(outcome.uncitedComplaints).toHaveLength(SINGLE_ITEM);
  });

  test("demotes an empty quote rather than treating it as cited", () => {
    const outcome = parseJudgeResponse(
      reply([{ itemId: "G2", quote: "", reason: "no quote given" }]),
      REQUEST,
    );

    expect(outcome.citedViolations).toStrictEqual([]);
    expect(outcome.uncitedComplaints).toHaveLength(SINGLE_ITEM);
  });

  test.each([
    {
      label: "missing",
      violation: {
        itemId: "G2",
        quote: "The tests passed on CI.",
      },
    },
    {
      label: "non-string",
      violation: {
        itemId: "G2",
        quote: "The tests passed on CI.",
        reason: 7,
      },
    },
  ])("throws when a violation reason is $label", ({ violation }) => {
    expect(() => parseJudgeResponse(reply([violation]), REQUEST)).toThrow(
      /judge/,
    );
  });

  test("accepts a compliant empty verdict", () => {
    const outcome = parseJudgeResponse(reply([]), REQUEST);

    expect(outcome.citedViolations).toStrictEqual([]);
    expect(outcome.uncitedComplaints).toStrictEqual([]);
  });

  test("accepts JSON wrapped in prose or a code fence", () => {
    const fenced = `Here is my verdict:\n\`\`\`json\n${reply([])}\n\`\`\``;

    expect(parseJudgeResponse(fenced, REQUEST).citedViolations).toStrictEqual(
      [],
    );
  });

  test.each([
    { label: "no JSON at all", responseText: "looks fine to me" },
    { label: "invalid JSON", responseText: "{violations: oops}" },
    { label: "missing violations array", responseText: '{"verdict": "pass"}' },
    {
      label: "a non-object violation entry",
      responseText: '{"violations": ["bad"]}',
    },
  ])("throws on $label, naming the judge", ({ responseText }) => {
    expect(() => parseJudgeResponse(responseText, REQUEST)).toThrow(/judge/);
  });
});

describe("SDK judge", () => {
  test("fails closed on a malformed relevant result message", async () => {
    sdk.query.mockImplementation(() => scripted({ type: "result", result: 7 }));
    await expect(liveJudgeQuery("", JUDGE_MODEL)).rejects.toThrow(/judge/);
  });

  test("ignores irrelevant messages and grades clean with haiku and no tools", async () => {
    sdk.query.mockImplementation(() =>
      scripted(
        null,
        "ignored",
        {},
        { type: "assistant" },
        { type: "result", result: reply([]) },
      ),
    );
    await expect(judgeLive(REQUEST)).resolves.toBe("judge: clean");
    const [call] = sdk.query.mock.lastCall ?? [];
    expect(call?.prompt).toBe(buildJudgePrompt(REQUEST));
    expect(call?.options).toMatchObject({
      model: JUDGE_MODEL,
      maxTurns: 1,
      allowedTools: [],
    });
  });

  test("fails a cited violation through the live entry", async () => {
    sdk.query.mockImplementation(() =>
      scripted({
        type: "result",
        result: reply([
          {
            itemId: "G2",
            quote: "The tests passed on CI.",
            reason: "unobserved",
          },
        ]),
      }),
    );
    await expect(judgeLive(REQUEST)).rejects.toThrow(
      "judge: G2 violated -- unobserved (quote: The tests passed on CI.)",
    );
  });

  test("records an uncited note without failing the live entry", async () => {
    sdk.query.mockImplementation(() =>
      scripted({
        type: "result",
        result: reply([
          { itemId: "G2", quote: "tests were green", reason: "paraphrased" },
        ]),
      }),
    );
    await expect(judgeLive(REQUEST)).resolves.toBe(
      "judge: clean (1 uncited note(s) ignored)",
    );
  });

  test("fails when the query produces no result", async () => {
    sdk.query.mockImplementation(() => scripted({ type: "assistant" }));
    await expect(judgeLive(REQUEST)).rejects.toThrow(
      "judge query produced no result message",
    );
  });

  test("propagates a judge query failure", async () => {
    sdk.query.mockImplementation(() => {
      throw new Error("judge model unavailable");
    });
    await expect(judgeLive(REQUEST)).rejects.toThrow(/judge model unavailable/);
  });
});
