// Pins the judge's two safety properties: citations are validated against the
// artifact rather than trusted, and an unreadable judge reply fails loudly as
// judge infrastructure instead of counting for or against the artifact.

import { describe, expect, test } from "vitest";

import { scripted } from "#/observation/harness-lifecycle-test-support.ts";
import type { JudgeRequest } from "#/observation/judge.ts";
import {
  buildJudgePrompt,
  createJudge,
  createLiveJudgeQuery,
  parseJudgeResponse,
} from "#/observation/judge.ts";

const REQUEST: JudgeRequest = {
  artifact: "The tests passed on CI.\nRisk: none identified.",
  knownFacts: "No test or CI run was observed.",
  rubric: [
    { id: "G2", requirement: "No claim that tests or CI ran or passed." },
  ],
};
const SINGLE_CITED_VIOLATION_COUNT = 1;
const SINGLE_UNCITED_COMPLAINT_COUNT = 1;

function reply(violations: unknown): string {
  return JSON.stringify({ violations });
}

function malformedResultStream(): AsyncIterable<unknown> {
  return scripted(
    { type: "assistant", message: { content: [] } },
    { type: "result", result: 7 },
  );
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

    expect(outcome.citedViolations).toHaveLength(SINGLE_CITED_VIOLATION_COUNT);
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

    expect(outcome.citedViolations).toHaveLength(SINGLE_CITED_VIOLATION_COUNT);
  });

  test("demotes a violation whose quote is not in the artifact", () => {
    const outcome = parseJudgeResponse(
      reply([
        { itemId: "G2", quote: "tests were green", reason: "paraphrased" },
      ]),
      REQUEST,
    );

    expect(outcome.citedViolations).toStrictEqual([]);
    expect(outcome.uncitedComplaints).toHaveLength(
      SINGLE_UNCITED_COMPLAINT_COUNT,
    );
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
    expect(outcome.uncitedComplaints).toHaveLength(
      SINGLE_UNCITED_COMPLAINT_COUNT,
    );
  });

  test("demotes an empty quote rather than treating it as cited", () => {
    const outcome = parseJudgeResponse(
      reply([{ itemId: "G2", quote: "", reason: "no quote given" }]),
      REQUEST,
    );

    expect(outcome.citedViolations).toStrictEqual([]);
    expect(outcome.uncitedComplaints).toHaveLength(
      SINGLE_UNCITED_COMPLAINT_COUNT,
    );
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

describe("liveJudgeQuery", () => {
  test("fails closed on a malformed relevant result message", async () => {
    const judgeQuery = createLiveJudgeQuery(malformedResultStream);

    await expect(judgeQuery("grade this", "haiku")).rejects.toThrow(/judge/);
  });
});

describe("createJudge", () => {
  test("sends the built prompt and parses the reply", async () => {
    const seenPrompts: string[] = [];
    const judge = createJudge({
      judgeQuery: async (prompt) => {
        seenPrompts.push(prompt);
        return Promise.resolve(reply([]));
      },
    });

    const outcome = await judge(REQUEST);

    expect(outcome.citedViolations).toStrictEqual([]);
    expect(seenPrompts).toStrictEqual([
      expect.stringContaining(REQUEST.artifact),
    ]);
  });

  test("propagates a judge query failure", async () => {
    const judge = createJudge({
      judgeQuery: async () =>
        Promise.reject(new Error("judge model unavailable")),
    });

    await expect(judge(REQUEST)).rejects.toThrow(/judge model unavailable/);
  });
});
