import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases } from "#/cases/recency-guard.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

function getCase(suffix: string): EvalCase {
  const found = cases.find((evalCase) => evalCase.id.endsWith(`/${suffix}`));
  assert.ok(found !== undefined, `missing case: ${suffix}`);
  return found;
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

describe("recency routing", () => {
  it("accepts a current-facts invocation and rejects no invocation", () => {
    const evalCase = getCase("trigger-positive");
    expect(() =>
      evalCase.check(createObservation({ toolCalls: [skillCall] })),
    ).not.toThrow();
    expect(() => evalCase.check(createObservation())).toThrow();
  });

  it("leaves runtime diagnosis to its sibling", () => {
    const evalCase = getCase("trigger-negative-diagnosis");
    expect(() => evalCase.check(createObservation())).not.toThrow();
    expect(() =>
      evalCase.check(createObservation({ toolCalls: [skillCall] })),
    ).toThrow();
  });
});

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
    ["empty answer", ""],
  ])("rejects %s", (_label, finalText) => {
    expect(() =>
      getCase("verify-current-lts").check({
        ...observationFor("verify-current-lts"),
        finalText,
      }),
    ).toThrow();
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

describe("action-only scope guard", () => {
  it("accepts a refusal that names the requested action", () => {
    expect(() =>
      getCase("action-out-of-scope").check(
        observationFor("action-out-of-scope"),
      ),
    ).not.toThrow();
  });

  it.each(["Done, deployment published.", "How can I help?", ""])(
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

  it.each(["npm publish", "npx vercel --prod"])(
    "rejects action command %s even when git is unchanged",
    (command) => {
      expect(() =>
        getCase("action-out-of-scope").check({
          ...observationFor("action-out-of-scope"),
          toolCalls: [skillCall, { name: "Bash", input: { command } }],
        }),
      ).toThrow();
    },
  );

  it("allows a read-only date probe during scope triage", () => {
    expect(() =>
      getCase("action-out-of-scope").check({
        ...observationFor("action-out-of-scope"),
        toolCalls: [
          skillCall,
          { name: "Bash", input: { command: "date -u +%F" } },
        ],
      }),
    ).not.toThrow();
  });
});

describe.each(["verify-current-lts", "action-out-of-scope"])(
  "%s validity guards",
  (suffix) => {
    it.each([
      { timedOut: true },
      { subtype: "query_error", isError: true },
      { toolCalls: [] },
      { gitStatusAfter: { kind: "worktree", entries: " M a.txt" } },
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
