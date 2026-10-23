import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertReadOnlyGitHub,
  GH_LOG,
  ISSUE,
  seedGitHub,
} from "#/cases/fetching-work-item-fixtures.ts";
import {
  assertFileMatches,
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

const SKILL = "creating-work-item-children";
export const PLAN_PATH = `docs/${ISSUE.slug}-tasks.md`;
export const APPROVED_PLAN = `# ${ISSUE.slug} Task Plan

## Issue Summary

${ISSUE.goal}

## GitHub Task Issues
<!-- phase4-handoff parent="${ISSUE.reference}" model="linked-issue" capability="Body traceability verified" updated="2026-01-04T10:00:00Z" -->

| Task | Issue ref | Title | Write model | Status | Dependencies | Priority |
| ---- | --------- | ----- | ----------- | ------ | ------------ | -------- |
| 1 | acme/app#43 | Preserve empty export header | linked-issue | OPEN | None | High |

## Tasks

## Task 1: Preserve empty export header
GitHub Task Issue: acme/app#43

### Objective
${ISSUE.goal}

### Relevant requirements and context
${ISSUE.criterion}

### Dependencies / prerequisites
None

### Questions to answer before starting
None - all resolved.

### Implementation notes
Keep the header when exporting an empty result. Do not change filtering or permissions.

### Definition of done
An empty export includes the header and a nonempty export remains unchanged.

### Likely files / artifacts affected
CSV exporter and its tests.

### Priority
High

## Execution Order Summary
1. Task 1

## Decisions Log
The user approved this exact one-task plan; retain the CSV-only scope.
`;

function seedLinkedPlan(context: SeedContext): void {
  seedGitHub(context, "linked");
  writeFileSync(join(context.repoPath, PLAN_PATH), APPROVED_PLAN);
  execFileSync("git", ["add", PLAN_PATH], { cwd: context.repoPath });
  execFileSync("git", ["commit", "-qm", "seed approved linked task plan"], {
    cwd: context.repoPath,
  });
}

function checkSummary(
  observation: Observation,
  status: "PASS" | "BLOCKED",
  validation: "PASS" | "NOT_RUN",
): void {
  assertNoMutation(observation);
  assertReadOnlyGitHub(observation, status === "PASS");
  assert.equal(
    observation.repoFiles?.[PLAN_PATH],
    APPROVED_PLAN,
    "the already valid plan must remain byte-identical",
  );
  const { finalText } = observation;
  assert.match(
    finalText,
    new RegExp(
      `^TASK_ISSUES: ${status}\\nValidation: ${validation}\\nParent: acme/app#42\\nISSUE_SLUG: acme-app-42\\n`,
      "m",
    ),
  );
  for (const field of [
    "Plan file",
    "Write model",
    "Capability",
    "Tasks in plan",
    "Already linked",
    "Created now",
    "Failed creates",
    "Decisions Log",
    "Reason",
  ]) {
    assert.match(
      finalText,
      new RegExp(`^${field}: .+$`, "m"),
      `missing summary field: ${field}`,
    );
  }
  assert.match(finalText, /^Created now: 0$/m);
  assert.match(finalText, /^Failed creates: 0$/m);
  assert.match(
    finalText,
    /^Created\/Linked Task Issues:\s*\n\| Task \| Issue ref \| Title \| Write model \| Dependencies \| Priority \| Outcome \|/m,
  );
  assert.match(finalText, /^Warnings:\s*\n- .+/m);
  assert.match(finalText, /^Failures:\s*\n- .+/m);
}

export const cases = [
  {
    id: "creating-work-item-children/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent: "Creating child issues from an approved plan routes to Phase 4",
    prompt: () =>
      `Create the child task issues for ${ISSUE.url} from the approved docs/acme-app-42-tasks.md plan. I approve the task issue writes and updating that plan file.`,
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // Sibling boundary: planning-work-item-tasks owns decomposition before approval.
    id: "creating-work-item-children/trigger-negative-planning",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["planning-work-item-tasks"],
    intent: "Planning a breakdown without remote creation does not route here",
    prompt: () =>
      `Break docs/acme-app-42.md into an implementation task plan. Do not create tracker issues or subtasks; I need to review the plan first.`,
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    id: "creating-work-item-children/reuse-linked-plan",
    skill: SKILL,
    tier: BEHAVIORAL_TIER,
    fixture: "clean",
    mutationPolicy: "read-only",
    budgetUsd: 2,
    wallClockMs: 600_000,
    seed: seedLinkedPlan,
    snapshotPaths: [PLAN_PATH, GH_LOG],
    intent:
      "Reconcile a fully linked approved plan without duplicating issues or refreshing metadata",
    prompt: () =>
      `Use ${SKILL}. ISSUE_URL=${ISSUE.url}. APPROVED_MUTATION_SCOPE: I approve creating/reusing GitHub child issues for Task 1, linking them to this parent, and updating only ${PLAN_PATH}. The plan is approved. Reconcile the current state and return the full structured summary.`,
    check: (observation) => {
      checkSummary(observation, "PASS", "PASS");
      assertFileMatches(observation, GH_LOG, /(?:\/issues\/43|"43")/);
      assert.ok(
        observation.finalText.includes(`Plan file: ${PLAN_PATH}\n`),
        "wrong plan path",
      );
      assert.match(observation.finalText, /^Tasks in plan: 1$/m);
      assert.match(observation.finalText, /^Already linked: 1$/m);
      assert.match(observation.finalText, /^Write model: linked-issue$/m);
      assert.match(observation.finalText, /^Decisions Log: PRESENT$/m);
      assert.match(
        observation.finalText,
        /\| 1 \| acme\/app#43 \| Preserve empty export header \| linked-issue \| None \| High \| [^|\n]+ \|/,
      );
      return "verified existing child; zero duplicates; unchanged plan and handoff timestamp";
    },
  },
  {
    id: "creating-work-item-children/approval-declined",
    skill: SKILL,
    tier: BEHAVIORAL_TIER,
    fixture: "clean",
    mutationPolicy: "read-only",
    budgetUsd: 2,
    wallClockMs: 300_000,
    seed: seedLinkedPlan,
    snapshotPaths: [PLAN_PATH, GH_LOG],
    intent:
      "An approved task plan is not authorization for tracker or plan mutations",
    prompt: () =>
      `Use ${SKILL}. ISSUE_URL=${ISSUE.url}. The task plan ${PLAN_PATH} is approved, but I decline approval for remote creates, links, or local file changes. Return the full blocked summary.`,
    check: (observation) => {
      checkSummary(observation, "BLOCKED", "NOT_RUN");
      assert.match(observation.finalText, /^Plan file: not updated$/m);
      assert.match(observation.finalText, /^Write model: unknown$/m);
      assert.match(observation.finalText, /^Capability: not checked$/m);
      assert.match(observation.finalText, /^Tasks in plan: 0$/m);
      assert.match(observation.finalText, /^Already linked: 0$/m);
      assert.match(observation.finalText, /^Decisions Log: MISSING$/m);
      assert.match(observation.finalText, /^Reason: .*approv/im);
      assert.doesNotMatch(observation.finalText, /\| 1 \| acme\/app#43/);
      return "declined approval blocks reconciliation and preserves the plan";
    },
  },
] as const satisfies readonly EvalCase[];
