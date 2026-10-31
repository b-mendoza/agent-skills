import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases, COUNCIL_FACTS } from "#/cases/council-of-advisors.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

function getCase(suffix: string): EvalCase {
  const found = cases.find((evalCase) => evalCase.id.endsWith(`/${suffix}`));
  assert.ok(found !== undefined, `missing case: ${suffix}`);
  return found;
}

const skillCall = { name: "Skill", input: { skill: "council-of-advisors" } };

function gateObservation(finalText: string): Observation {
  return createObservation({
    finalText,
    toolCalls: [skillCall],
    repoFiles: { [COUNCIL_FACTS.handoffPath]: null },
  });
}

const framedPacket = `Please confirm this decision packet before any seats run.
Decision subject: ${COUNCIL_FACTS.subject}
Desired outcome: ${COUNCIL_FACTS.outcome}
Constraints: ${COUNCIL_FACTS.constraints}
Current lean: ${COUNCIL_FACTS.lean}
Stated claim: unstated
Is this framing correct?`;

const missingSubject =
  "What decision or objective would you like the council to examine?";

function checkWithOverrides(
  suffix: string,
  overrides: Partial<Observation>,
): string {
  const valid = gateObservation(
    suffix === "confirm-framing" ? framedPacket : missingSubject,
  );
  return getCase(suffix).check({ ...valid, ...overrides });
}

describe("council routing", () => {
  it("accepts a positive invocation and rejects no invocation", () => {
    const evalCase = getCase("trigger-positive");
    expect(() =>
      evalCase.check(createObservation({ toolCalls: [skillCall] })),
    ).not.toThrow();
    expect(() => evalCase.check(createObservation())).toThrow();
  });

  it("accepts the planning sibling and rejects a council invocation", () => {
    const evalCase = getCase("trigger-negative-plan-audit");
    expect(() => evalCase.check(createObservation())).not.toThrow();
    expect(() =>
      evalCase.check(createObservation({ toolCalls: [skillCall] })),
    ).toThrow();
  });
});

describe("council confirmation gate", () => {
  it("accepts the grounded packet and explicit confirmation question", () => {
    expect(() =>
      getCase("confirm-framing").check(gateObservation(framedPacket)),
    ).not.toThrow();
  });

  it.each([
    [
      "no confirmation",
      framedPacket
        .replace(/Please confirm[^\n]*\n/u, "")
        .replace("Is this framing correct?", ""),
    ],
    [
      "missing subject",
      framedPacket.replace(COUNCIL_FACTS.subject, "another decision"),
    ],
    ["missing outcome", framedPacket.replace(COUNCIL_FACTS.outcome, "unknown")],
    [
      "missing constraints",
      framedPacket.replace(COUNCIL_FACTS.constraints, "none"),
    ],
    ["premature recommendation", `${framedPacket}\nfinal_recommendation: go`],
  ])("rejects %s", (_label, finalText) => {
    expect(() =>
      checkWithOverrides("confirm-framing", { finalText }),
    ).toThrow();
  });

  it("rejects seat dispatch before confirmation", () => {
    expect(() =>
      checkWithOverrides("confirm-framing", {
        toolCalls: [
          skillCall,
          { name: "Agent", input: { subagent_type: "reversibility-seat" } },
        ],
      }),
    ).toThrow();
  });

  it("rejects a prematurely written handoff", () => {
    expect(() =>
      checkWithOverrides("confirm-framing", {
        repoFiles: { [COUNCIL_FACTS.handoffPath]: "status: ready" },
      }),
    ).toThrow();
  });
});

describe("council missing subject", () => {
  it("asks for the missing decision without inventing one", () => {
    expect(() =>
      getCase("missing-subject").check(gateObservation(missingSubject)),
    ).not.toThrow();
  });

  it.each([
    "Please send DECISION_SUBJECT, the decision to deliberate.",
    "I need a decision subject before I can start the council.",
    "I can't start the council yet because you haven't given me a decision subject. Please send:\n1. DECISION_SUBJECT (required): the decision to deliberate.",
  ])("accepts a request without a question mark: %s", (finalText) => {
    expect(() =>
      checkWithOverrides("missing-subject", { finalText }),
    ).not.toThrow();
  });

  it.each(["", "Please confirm this packet.", "final_recommendation: hold"])(
    "rejects non-clarification %j",
    (finalText) => {
      expect(() =>
        checkWithOverrides("missing-subject", { finalText }),
      ).toThrow();
    },
  );
});

describe.each(["confirm-framing", "missing-subject"])(
  "%s common guards",
  (suffix) => {
    it("rejects an artifact status leaked into chat", () => {
      const reply =
        suffix === "confirm-framing" ? framedPacket : missingSubject;
      expect(() =>
        checkWithOverrides(suffix, {
          finalText: `**status:** needs_input\n${reply}`,
        }),
      ).toThrow();
    });

    it.each([
      { timedOut: true },
      { subtype: "query_error", isError: true },
      { toolCalls: [] },
      { repoFiles: {} },
      { gitStatusAfter: { kind: "worktree", entries: "?? accidental.txt" } },
      {
        toolCalls: [
          skillCall,
          {
            name: "Write",
            input: { file_path: "accidental.txt", content: "x" },
          },
        ],
      },
    ] satisfies Array<Partial<Observation>>)(
      "rejects invalid or mutating observation %#",
      (overrides) => {
        expect(() => checkWithOverrides(suffix, overrides)).toThrow();
      },
    );
  },
);
