import assert from "node:assert/strict";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { COUNCIL_FACTS } from "#/cases/council-of-advisors.ts";
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

const SKILL = "council-of-advisors";

function getCase(suffix: string) {
  return getRegisteredCase(`${SKILL}/${suffix}`);
}

const skillCall = { name: "Skill", input: { skill: SKILL } };

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

  it("gives the framing judge fixture state and inspection evidence", async () => {
    const evalCase = getCase("confirm-framing");
    assert.ok(evalCase.judge !== undefined);
    const inspection = {
      name: "Bash",
      input: { command: "ls council-handoff-paid-support-pilot*.md" },
    };
    await evalCase.judge({
      ...gateObservation(framedPacket),
      toolCalls: [skillCall, inspection],
    });
    const [request] = judge.live.mock.lastCall ?? [];
    assert.ok(request !== undefined);
    const prompt = buildJudgePrompt(request);
    expect(prompt).toContain(JSON.stringify(inspection));
    expect(prompt).toContain(
      JSON.stringify({ [COUNCIL_FACTS.handoffPath]: null }),
    );
    expect(prompt).toContain("semantic paraphrases");
    expect(prompt).toContain("stakes classification");
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
