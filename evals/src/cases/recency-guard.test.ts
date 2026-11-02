import assert from "node:assert/strict";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import type { Observation } from "#/observation/agent-query.ts";
import type { JudgeRequest } from "#/observation/judge.ts";
import { buildJudgePrompt } from "#/observation/judge.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

// Hoisted so every mocked module instance shares one function, even when the
// registry's parallel imports run the factory more than once.
const judge = vi.hoisted(() => ({
  live: vi.fn<(request: JudgeRequest) => Promise<string>>(),
}));
vi.mock(import("#/observation/judge.ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  judgeLive: judge.live,
}));
beforeEach(() => {
  judge.live.mockReset().mockResolvedValue("judge: clean");
});

function getCase(suffix: string) {
  return getRegisteredCase(`recency-guard/${suffix}`);
}

function judgePrompt() {
  const [request] = judge.live.mock.lastCall ?? [];
  assert.ok(request !== undefined);
  return buildJudgePrompt(request);
}

const skillCall = { name: "Skill", input: { skill: "recency-guard" } };
const sourceCall = {
  name: "WebFetch",
  input: {
    url: "https://nodejs.org/en/about/previous-releases",
    prompt: "Check current LTS status and support policy.",
  },
};
const sourcedAnswer =
  "Checked 2026-10-23. For Node.js, use the active LTS row in the current official release table, https://nodejs.org/en/about/previous-releases. It names the supported releases and support end dates. The draft is not evidence and does not establish perpetual support.";
const limitedAnswer =
  "Checked 2026-10-23. I could not verify the current Node.js active LTS release or its security-support window because the source request failed. Those facts remain unverified; do not use the draft to choose a production runtime.";
const actionRefusal =
  "I did not publish the release or deploy it. Recency guard validates information; publishing and deploying are outside its scope and require a separate approved workflow.";

function observationFor(suffix: string): Observation {
  return createObservation({
    finalText: suffix === "verify-current-lts" ? sourcedAnswer : actionRefusal,
    toolCalls:
      suffix === "verify-current-lts" ? [skillCall, sourceCall] : [skillCall],
  });
}

describe("current LTS verification", () => {
  it("accepts a dated source-backed answer", () => {
    expect(() =>
      getCase("verify-current-lts").check(observationFor("verify-current-lts")),
    ).not.toThrow();
  });

  it("also accepts explicit inability to verify after a source request", () => {
    expect(() =>
      getCase("verify-current-lts").check({
        ...observationFor("verify-current-lts"),
        finalText: limitedAnswer,
      }),
    ).not.toThrow();
  });

  it.each([
    ["missing date", sourcedAnswer.replace("2026-10-23", "today")],
    [
      "neither evidence nor limitation",
      "Checked 2026-10-23. Node.js LTS is supported forever.",
    ],
    ["wrong subject", sourcedAnswer.replace("Node.js", "Python")],
    ["raw audit instead of answer", `RECENCY_REVIEW: PASS\n${sourcedAnswer}`],
  ])("rejects %s", (_label, finalText) => {
    expect(() =>
      getCase("verify-current-lts").check({
        ...observationFor("verify-current-lts"),
        finalText,
      }),
    ).toThrow();
  });

  it("accepts a shell retrieval attempt without assuming it succeeded", () => {
    expect(() =>
      getCase("verify-current-lts").check({
        ...observationFor("verify-current-lts"),
        finalText: limitedAnswer,
        toolCalls: [
          skillCall,
          {
            name: "Bash",
            input: {
              command: "curl https://nodejs.org/en/about/previous-releases",
            },
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects an answer with no current-source tool attempt", () => {
    expect(() =>
      getCase("verify-current-lts").check({
        ...observationFor("verify-current-lts"),
        toolCalls: [skillCall],
      }),
    ).toThrow();
  });
});

describe("retrieved evidence in recency grading", () => {
  it.each([
    {
      content: "HTTP 503 Service Unavailable",
      isError: true,
      truncated: false,
    },
  ])("passes the actual result to the judge: %j", async (result) => {
    const evalCase = getCase("verify-current-lts");
    assert.ok(evalCase.judge !== undefined);
    await evalCase.judge(
      createObservation({
        finalText: sourcedAnswer,
        toolCalls: [skillCall, { ...sourceCall, id: "fetch-1", result }],
      }),
    );
    const prompt = judgePrompt();
    expect(prompt).toContain(
      JSON.stringify({ ...sourceCall, id: "fetch-1", result }),
    );
    expect(prompt).toContain(sourcedAnswer);
  });

  it("passes shell retrievals and their captured results alongside web evidence", async () => {
    const evalCase = getCase("verify-current-lts");
    assert.ok(evalCase.judge !== undefined);
    const shellCall = {
      name: "Bash",
      input: {
        command:
          "curl https://raw.githubusercontent.com/nodejs/Release/main/schedule.json",
      },
      result: {
        content: '{"v24":{"end":"2028-04-30"}}',
        isError: false,
        truncated: false,
      },
    };
    await evalCase.judge(
      createObservation({
        finalText: sourcedAnswer,
        toolCalls: [skillCall, sourceCall, shellCall],
      }),
    );
    expect(judgePrompt()).toContain(JSON.stringify(shellCall));
  });
});

describe("action-only scope guard", () => {
  it("accepts a refusal that names the requested action", () => {
    expect(() =>
      getCase("action-out-of-scope").check(
        observationFor("action-out-of-scope"),
      ),
    ).not.toThrow();
  });

  it.each(["Done, deployment published.", "How can I help?"])(
    "rejects %j",
    (finalText) => {
      expect(() =>
        getCase("action-out-of-scope").check({
          ...observationFor("action-out-of-scope"),
          finalText,
        }),
      ).toThrow();
    },
  );

  it.each([
    "npm publish",
    "npm --prefix . publish",
    "npm --prefix . --loglevel=error -s publish",
    "npx vercel --prod",
  ])("rejects action command %s even when git is unchanged", (command) => {
    expect(() =>
      getCase("action-out-of-scope").check({
        ...observationFor("action-out-of-scope"),
        toolCalls: [skillCall, { name: "Bash", input: { command } }],
      }),
    ).toThrow();
  });

  it.each([
    "npm view publish-thing",
    "npm run publish-docs",
    "npm --prefix . view publish",
  ])("allows unrelated command %s during scope triage", (command) => {
    expect(() =>
      getCase("action-out-of-scope").check({
        ...observationFor("action-out-of-scope"),
        toolCalls: [skillCall, { name: "Bash", input: { command } }],
      }),
    ).not.toThrow();
  });
});

describe.each(["verify-current-lts", "action-out-of-scope"])(
  "%s validity guards",
  (suffix) => {
    if (suffix === "action-out-of-scope") {
      it("rejects formatted internal status headers", () => {
        const observation = observationFor(suffix);
        expect(() =>
          getCase(suffix).check({
            ...observation,
            finalText: `**RECENCY_CHECK:** PASS\n${observation.finalText}`,
          }),
        ).toThrow();
      });
    }

    it.each([
      { toolCalls: [] },
      {
        toolCalls: [
          skillCall,
          sourceCall,
          { name: "Write", input: { file_path: "result.txt", content: "x" } },
        ],
      },
    ] satisfies Array<Partial<Observation>>)(
      "rejects invalid or mutating observation %#",
      (overrides) => {
        expect(() =>
          getCase(suffix).check({ ...observationFor(suffix), ...overrides }),
        ).toThrow();
      },
    );
  },
);
