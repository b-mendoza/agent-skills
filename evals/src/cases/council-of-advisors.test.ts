import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

describe("council packet validator", () => {
  const SUCCESS = 0;
  const FAILURE = 1;
  const USAGE_ERROR = 2;
  const script = fileURLToPath(
    new URL(
      "../../../skills/council-of-advisors/scripts/validate_packet.py",
      import.meta.url,
    ),
  );
  const good = {
    reversibility: `seat: reversibility-seat
decision_type: type_1
reversal_cost_estimate:
  money: high
rationale: x
confidence: low
depth_setting: deep
what_would_change_my_mind: [a]
`,
    analysis: `seat: focus-seat
seat_class: recommending
mandate: m
verdict: hold
reasoning_chain:
  - premise: p
key_risks_or_upside: [r]
what_would_change_my_mind: [w]
confidence: medium
mental_model_in_use: Focus
`,
    branch: `seat: originality-seat (branch mode)
branch: pivot
rationale: r
candidates:
  - name: c
`,
    chair: `seat: chair-seat
agreements_across_council: [a]
disagreements_within_council: []
recommendation: hold
confidence: medium
reasoning_chain: [s]
minority_report: m
required_kill_criterion: k
power_questions_to_answer_before_proceeding: [q]
`,
    handoff: `status: ready
subject: x
high_stakes_disclosure: x
decision_type: type_2
classification_basis: seat_verdict
chair_recommendation: go
final_recommendation: go
override_applied: false
confidence: high
research_tools: none
minority_report: x
required_kill_criterion: x
power_questions_to_answer_before_proceeding: x
seat_packets: x
educate_me: x
gates: x
execution_fidelity: subagents
run_log: x
`,
  };

  function validate(kind: string, payload: string) {
    return spawnSync("python3", ["-I", script, kind], {
      input: payload,
      encoding: "utf8",
    });
  }

  it.each(Object.entries(good))("accepts valid %s payload", (kind, payload) => {
    const result = validate(kind, payload);
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it.each([
    [
      "reversibility",
      good.reversibility.replace(
        "depth_setting: deep",
        "depth_setting: standard",
      ),
      "depth_setting must be deep for type_1\n",
    ],
    [
      "analysis",
      good.analysis.replace(
        "seat_class: recommending",
        "seat_class: informational",
      ),
      "missing key headline_finding\ninformational seat verdict must be information_only\n",
    ],
    [
      "branch",
      good.branch.replace("branch: pivot", "branch: merge"),
      "branch must be one of differentiate|pivot|abandon\n",
    ],
    [
      "chair",
      good.chair.replace("recommendation: hold", "recommendation: go"),
      "recommendation go requires confidence high\n",
    ],
    [
      "handoff",
      good.handoff.replace("status: ready", "status: done"),
      "status must be one of ready|needs_input|blocked|error\n",
    ],
  ])("rejects invalid %s payload with findings", (kind, payload, findings) => {
    const result = validate(kind, payload);
    expect(result.status).toBe(FAILURE);
    expect(result.stdout).toBe(findings);
    expect(result.stderr).toBe("");
  });

  it("accepts a BLOCKED escalation with an empty needed_input", () => {
    const result = validate(
      "analysis",
      "status: BLOCKED\nseat: focus-seat\nreason: r\nneeded_input: ''\n",
    );
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("rejects a FAIL escalation with an empty reason", () => {
    const result = validate(
      "analysis",
      "status: FAIL\nseat: focus-seat\nreason:\nneeded_input: ''\n",
    );
    expect(result.status).toBe(FAILURE);
    expect(result.stdout).toBe("escalation: reason must be non-empty\n");
    expect(result.stderr).toBe("");
  });

  it("reports usage on stderr for a bad kind", () => {
    const result = validate("unknown", "");
    expect(result.status).toBe(USAGE_ERROR);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("usage: python3");
    expect(result.stderr).toContain("<kind> [web] < payload");
  });
});
