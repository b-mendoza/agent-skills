import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { COUNCIL_FACTS } from "#/cases/council-of-advisors.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import type { Observation } from "#/observation/agent-query.ts";
import type { JudgeRequest } from "#/observation/judge.ts";
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
const writeCall = {
  name: "Write",
  input: { file_path: "accidental.txt", content: "x" },
};

function gateObservation(
  finalText: string,
  overrides: Partial<Observation> = {},
): Observation {
  return createObservation({
    finalText,
    toolCalls: [skillCall],
    repoFiles: { [COUNCIL_FACTS.handoffPath]: null },
    ...overrides,
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

describe("council confirmation gate", () => {
  it("accepts a grounded packet that requests confirmation", () => {
    expect(() =>
      getCase("confirm-framing").check(gateObservation(framedPacket)),
    ).not.toThrow();
  });

  it.each<{ label: string; overrides: Partial<Observation> }>([
    {
      label: "a missing confirmation request",
      overrides: {
        finalText: framedPacket
          .replace(/Please confirm[^\n]*\n/u, "")
          .replace("Is this framing correct?", ""),
      },
    },
    {
      label: "a changed decision subject",
      overrides: {
        finalText: framedPacket.replace(
          COUNCIL_FACTS.subject,
          "another decision",
        ),
      },
    },
    {
      label: "a changed desired outcome",
      overrides: {
        finalText: framedPacket.replace(COUNCIL_FACTS.outcome, "unknown"),
      },
    },
    {
      label: "missing constraints",
      overrides: {
        finalText: framedPacket.replace(COUNCIL_FACTS.constraints, "none"),
      },
    },
    {
      label: "a premature recommendation",
      overrides: { finalText: `${framedPacket}\nfinal_recommendation: go` },
    },
    {
      label: "an artifact status leaked into chat",
      overrides: { finalText: `**status:** needs_input\n${framedPacket}` },
    },
    { label: "a run without the skill call", overrides: { toolCalls: [] } },
    {
      label: "a Write mutation",
      overrides: { toolCalls: [skillCall, writeCall] },
    },
  ])("rejects $label before framing confirmation", ({ overrides }) => {
    expect(() =>
      getCase("confirm-framing").check(
        gateObservation(framedPacket, overrides),
      ),
    ).toThrow();
  });

  it("sends captured files and inspection evidence to the judge", async () => {
    const evalCase = getCase("confirm-framing");
    assert.ok(evalCase.judge !== undefined);
    const inspection = {
      name: "Bash",
      input: { command: "ls council-handoff-paid-support-pilot*.md" },
    };
    await evalCase.judge(
      gateObservation(framedPacket, { toolCalls: [skillCall, inspection] }),
    );
    const [request] = judge.live.mock.lastCall ?? [];
    assert.ok(request !== undefined);
    expect(request.knownFacts).toContain(JSON.stringify(inspection));
    expect(request.knownFacts).toContain(
      JSON.stringify({ [COUNCIL_FACTS.handoffPath]: null }),
    );
  });

  it("rejects seat dispatch before confirmation", () => {
    expect(() =>
      getCase("confirm-framing").check(
        gateObservation(framedPacket, {
          toolCalls: [
            skillCall,
            { name: "Agent", input: { subagent_type: "reversibility-seat" } },
          ],
        }),
      ),
    ).toThrow();
  });

  it("rejects a handoff written before confirmation", () => {
    expect(() =>
      getCase("confirm-framing").check(
        gateObservation(framedPacket, {
          repoFiles: { [COUNCIL_FACTS.handoffPath]: "status: ready" },
        }),
      ),
    ).toThrow();
  });
});

describe("council missing subject", () => {
  it.each([
    { label: "a question", finalText: missingSubject },
    {
      label: "a multiline request without a question mark",
      finalText:
        "I can't start the council yet because you haven't given me a decision subject. Please send:\n1. DECISION_SUBJECT (required): the decision to deliberate.",
    },
  ])("accepts $label for the missing decision", ({ finalText }) => {
    expect(() =>
      getCase("missing-subject").check(gateObservation(finalText)),
    ).not.toThrow();
  });

  it.each<{ label: string; overrides: Partial<Observation> }>([
    {
      label: "a request for the wrong topic",
      overrides: { finalText: "Please confirm this packet." },
    },
    {
      label: "a Write mutation",
      overrides: { toolCalls: [skillCall, writeCall] },
    },
  ])(
    "rejects $label while requesting the missing decision",
    ({ overrides }) => {
      expect(() =>
        getCase("missing-subject").check(
          gateObservation(missingSubject, overrides),
        ),
      ).toThrow();
    },
  );
});

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
  const verifiedPremise =
    "  - premise: p\n    source: tool_verified\n    locator: docs/pricing.md\n";
  const verifiedAnalysis = good.analysis.replace(
    "  - premise: p\n",
    verifiedPremise,
  );

  function validate(kind: string, payload: string, ...args: string[]) {
    return spawnSync("python3", ["-I", script, kind, ...args], {
      input: payload,
      encoding: "utf8",
    });
  }

  it.each([
    {
      label: "a reversibility packet",
      kind: "reversibility",
      payload: good.reversibility,
    },
    { label: "an analysis packet", kind: "analysis", payload: good.analysis },
    { label: "a branch packet", kind: "branch", payload: good.branch },
    { label: "a chair packet", kind: "chair", payload: good.chair },
    { label: "a handoff packet", kind: "handoff", payload: good.handoff },
    {
      label: "a BLOCKED escalation with empty needed_input",
      kind: "analysis",
      payload:
        "status: BLOCKED\nseat: focus-seat\nreason: r\nneeded_input: ''\n",
    },
  ])("accepts $label", ({ kind, payload }) => {
    const result = validate(kind, payload);
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it.each([
    {
      label: "a type_1 packet without deep analysis",
      kind: "reversibility",
      payload: good.reversibility.replace(
        "depth_setting: deep",
        "depth_setting: standard",
      ),
      findings: "depth_setting must be deep for type_1\n",
    },
    {
      label: "an informational seat missing its required evidence",
      kind: "analysis",
      payload: good.analysis.replace(
        "seat_class: recommending",
        "seat_class: informational",
      ),
      findings:
        "missing key headline_finding\ninformational seat verdict must be information_only\n",
    },
    {
      label: "an invalid branch",
      kind: "branch",
      payload: good.branch.replace("branch: pivot", "branch: merge"),
      findings: "branch must be one of differentiate|pivot|abandon\n",
    },
    {
      label: "a go recommendation without high confidence",
      kind: "chair",
      payload: good.chair.replace("recommendation: hold", "recommendation: go"),
      findings: "recommendation go requires confidence high\n",
    },
    {
      label: "an invalid handoff status",
      kind: "handoff",
      payload: good.handoff.replace("status: ready", "status: done"),
      findings: "status must be one of ready|needs_input|blocked|error\n",
    },
    {
      label: "an escalation with an empty reason",
      kind: "analysis",
      payload: "status: FAIL\nseat: focus-seat\nreason:\nneeded_input: ''\n",
      findings: "escalation: reason must be non-empty\n",
    },
  ])("rejects $label with findings", ({ kind, payload, findings }) => {
    const result = validate(kind, payload);
    expect(result.status).toBe(FAILURE);
    expect(result.stdout).toBe(findings);
    expect(result.stderr).toBe("");
  });

  it("rejects an unknown packet kind with usage on stderr", () => {
    const result = validate("unknown", "");
    expect(result.status).toBe(USAGE_ERROR);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("usage: python3");
    expect(result.stderr).toContain("<kind> [web] < payload");
  });

  it.each([
    {
      label: "an analysis seat without web",
      kind: "analysis",
      payload: verifiedAnalysis,
      args: [],
      status: FAILURE,
      stdout: "tool_verified present but research_tools is not web\n",
    },
    {
      label: "an analysis seat with web",
      kind: "analysis",
      payload: verifiedAnalysis,
      args: ["web"],
      status: SUCCESS,
      stdout: "",
    },
    {
      label: "a handoff declaring no research tools",
      kind: "handoff",
      payload: good.handoff.replace(
        "seat_packets: x\n",
        `seat_packets:\n${verifiedPremise}`,
      ),
      args: [],
      status: FAILURE,
      stdout: "tool_verified present but research_tools is not web\n",
    },
  ])(
    "enforces declared web research for $label",
    ({ kind, payload, args, status, stdout }) => {
      const result = validate(kind, payload, ...args);
      expect(result.status).toBe(status);
      expect(result.stdout).toBe(stdout);
      expect(result.stderr).toBe("");
    },
  );
});
