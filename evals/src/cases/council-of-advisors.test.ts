import assert from "node:assert/strict";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { COUNCIL_FACTS } from "#/cases/council-of-advisors.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import type { Observation } from "#/observation/agent-query.ts";
import type { JudgeRequest } from "#/observation/judge.ts";
import { buildJudgePrompt } from "#/observation/judge.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

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

function checkWithOverrides(overrides: Partial<Observation>): string {
  return getCase("confirm-framing").check({
    ...gateObservation(framedPacket),
    ...overrides,
  });
}

describe("council confirmation gate", () => {
  it("accepts the grounded packet and explicit confirmation question", () => {
    expect(() => checkWithOverrides({})).not.toThrow();
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
    expect(() => checkWithOverrides({ finalText })).toThrow();
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
  });
  it("rejects seat dispatch before confirmation", () => {
    expect(() =>
      checkWithOverrides({
        toolCalls: [
          skillCall,
          { name: "Agent", input: { subagent_type: "reversibility-seat" } },
        ],
      }),
    ).toThrow(/seat was dispatched before/);
  });
  it("rejects a prematurely written handoff", () => {
    expect(() =>
      checkWithOverrides({
        repoFiles: { [COUNCIL_FACTS.handoffPath]: "status: ready" },
      }),
    ).toThrow(/file exists/);
  });
});

describe("council missing subject", () => {
  it("accepts a request without a question mark", () => {
    const finalText =
      "I can't start the council yet because you haven't given me a decision subject. Please send:\n1. DECISION_SUBJECT (required): the decision to deliberate.";
    expect(() =>
      getCase("missing-subject").check(gateObservation(finalText)),
    ).not.toThrow();
  });
  it("rejects a request about the wrong topic", () => {
    expect(() =>
      getCase("missing-subject").check(
        gateObservation("Please confirm this packet."),
      ),
    ).toThrow(/missing request for the decision subject/);
  });
});

describe("common waiting guards", () => {
  it("rejects an artifact status leaked into chat", () => {
    expect(() =>
      checkWithOverrides({
        finalText: `**status:** needs_input\n${framedPacket}`,
      }),
    ).toThrow(/public status line/);
  });
  it.each([
    { overrides: { toolCalls: [] }, error: /skill never triggered/ },
    { overrides: { repoFiles: {} }, error: /not captured/ },
    {
      overrides: {
        toolCalls: [
          skillCall,
          {
            name: "Write",
            input: { file_path: "accidental.txt", content: "x" },
          },
        ],
      },
      error: /read-only contract violated/,
    },
  ])("rejects invalid or mutating observation %#", ({ overrides, error }) => {
    expect(() => checkWithOverrides(overrides)).toThrow(error);
  });
});
