import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  CLARIFICATION_FACTS,
  CLARIFICATION_INPUTS,
  seedClarificationArtifacts,
} from "#/cases/clarifying-assumptions-fixtures.ts";
import {
  assertFileAbsent,
  assertFileExists,
  assertFileMatches,
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
  FIXTURE_ROOT_PATH,
  fixtureRelativePath,
} from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

export const SKILL = "clarifying-assumptions";
const headPath = ".git/logs/HEAD";
const snapshotPaths = [
  FIXTURE_ROOT_PATH,
  ...Object.keys(CLARIFICATION_INPUTS),
  CLARIFICATION_FACTS.critiquePath,
  CLARIFICATION_FACTS.decisionsPath,
  "a.txt",
  headPath,
];

function checkInputsUnchanged(observation: Observation): void {
  for (const [path, content] of Object.entries(CLARIFICATION_INPUTS)) {
    assertFileExists(observation, path);
    assert.equal(
      observation.repoFiles?.[path],
      content,
      `changed input: ${path}`,
    );
  }
  assert.equal(observation.repoFiles?.["a.txt"], "hello\n");
  assertFileMatches(
    observation,
    headPath,
    /^[^\n]+commit \(initial\): initial commit\n$/,
  );
  assertFileAbsent(observation, CLARIFICATION_FACTS.decisionsPath);
}

function isCritiqueWrite(call: ToolCall, observation: Observation): boolean {
  if (!["Write", "Edit"].includes(call.name)) return false;
  const path = call.input["file_path"];
  return (
    typeof path === "string" &&
    fixtureRelativePath(observation, path) === CLARIFICATION_FACTS.critiquePath
  );
}

function checkOnlyCritiqueChanged(observation: Observation): void {
  const before = observation.gitStatusBefore;
  const after = observation.gitStatusAfter;
  assert.equal(before.kind, "worktree");
  assert.equal(after.kind, "worktree");
  const expectedEntries = [
    ...before.entries.split("\n").filter(Boolean),
    `?? ${CLARIFICATION_FACTS.critiquePath}`,
  ].sort((left, right) => left.localeCompare(right));
  assert.deepEqual(
    after.entries
      .split("\n")
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right)),
    expectedEntries,
    "unexpected changed paths",
  );
  assertNoMutation({
    ...observation,
    gitStatusAfter: before,
    toolCalls: observation.toolCalls.filter(
      (call) => !isCritiqueWrite(call, observation),
    ),
  });
}

const behavioralDefaults = {
  tier: BEHAVIORAL_TIER,
  skill: SKILL,
  fixture: "clean",
  budgetUsd: 2.0,
  wallClockMs: 600_000,
  seed: seedClarificationArtifacts,
  snapshotPaths,
} as const;

export const cases = [
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-positive`,
    skill: SKILL,
    intent: "Plan-wide upfront clarification routes to the conversation layer",
    prompt: () =>
      "Run upfront clarification for the acme-app-42 task plan. Challenge its assumptions and ask me the unresolved questions before any implementation.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-negative-plan-validation`,
    skill: SKILL,
    intent:
      "A standalone written plan audit is not a conversational clarification session",
    // validate-implementation-plan owns independent plan audits.
    prompt: () =>
      "Audit docs/acme-app-42-task-1-execution-plan.md for requirements traceability, avoidable complexity, and evidence gaps. Return a standalone written validation report, not an interview.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    ...behavioralDefaults,
    id: `${SKILL}/upfront-preview-gate`,
    mutationPolicy: "allowed",
    intent:
      "A high-severity unresolved audience writes a critique and stops at the manifest readiness gate without choosing for the user",
    prompt: () =>
      `Use ${SKILL}. TICKET_KEY=${CLARIFICATION_FACTS.key} MODE=upfront ITERATION=1.`,
    check: (observation) => {
      checkInputsUnchanged(observation);
      checkOnlyCritiqueChanged(observation);
      assertFileMatches(
        observation,
        CLARIFICATION_FACTS.critiquePath,
        /^CRITIQUE: (?:PASS|WARN)\nTicket: acme-app-42 \| Mode: upfront \| Task: -\nArtifact: docs\/acme-app-42-upfront-critique\.md\n/,
      );
      for (const heading of [
        "## Critique Report",
        "### Artifacts Reviewed",
        "### Codebase Verification",
        "### Problem Framing Critique",
        "### Technology Critique Items",
        "### Items Not Raised",
        "### Summary",
      ]) {
        assertFileMatches(
          observation,
          CLARIFICATION_FACTS.critiquePath,
          new RegExp(`^${heading}\\s*$`, "m"),
        );
      }
      assertFileMatches(
        observation,
        CLARIFICATION_FACTS.critiquePath,
        /\|\s*PF\d+\s*\|\s*HIGH\s*\|/,
      );
      const text = observation.finalText;
      assert.match(text, /^## Question Manifest - acme-app-42\s*$/m);
      assert.match(
        text,
        /Questions now: [1-9]\d* \| Deferred: \d+ \| Irrelevant: \d+/,
      );
      assert.match(
        text,
        /\|\s*#\s*\|\s*Item ID\s*\|\s*Category\s*\|\s*Severity\s*\|\s*Model\s*\|\s*Skippable\s*\|\s*Affects\s*\|/,
      );
      assert.match(
        text,
        /\|\s*\d+\s*\|\s*PF\d+\s*\|\s*Problem framing\s*\|\s*HIGH\s*\|\s*A\s*\|\s*No\s*\|/,
      );
      assert.match(text, /Ready to start\?/);
      assert.doesNotMatch(
        text,
        /### Brief \d|Accepted decisions summary:|RE_PLAN_NEEDED:/,
        "revealed a Model A brief or recorded unanswered decisions",
      );
      return "critique written; hard-gate manifest preview; only critique changed";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: `${observation.repoFiles?.[CLARIFICATION_FACTS.critiquePath] ?? ""}\n\nUser-facing preview:\n${observation.finalText}`,
        knownFacts: `${CLARIFICATION_FACTS.audienceGap} The code currently grants account access only to the account owner. No user has selected an audience, answered a question, or authorized a scope change.`,
        rubric: [
          {
            id: "unresolved-audience",
            requirement:
              "The critique treats the export audience and its authorization consequences as unresolved, rather than inventing an accepted audience or a developer decision. The preview asks for readiness without revealing the Model A critique brief.",
          },
        ],
      }),
  },
  {
    ...behavioralDefaults,
    id: `${SKILL}/critique-missing-task-number`,
    mutationPolicy: "read-only",
    intent:
      "Critique mode without TASK_NUMBER returns the canonical input-blocked summary and writes nothing",
    prompt: () =>
      `Use ${SKILL}. TICKET_KEY=${CLARIFICATION_FACTS.key} MODE=critique.`,
    check: (observation) => {
      assertNoMutation(observation);
      checkInputsUnchanged(observation);
      assertFileAbsent(observation, CLARIFICATION_FACTS.critiquePath);
      assert.match(
        observation.finalText,
        /^- Critique artifact: -\n- Files updated: -\n- RE_PLAN_NEEDED: false\n- BLOCKERS_PRESENT: true\n- Blocking verdict: INPUT: BLOCKED\n- Reason: [^\n]*TASK_NUMBER[^\n]*/m,
      );
      return "INPUT: BLOCKED; canonical flags and order; no writes";
    },
  },
] as const satisfies readonly EvalCase[];
