import assert from "node:assert/strict";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { behavioralDefaults, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertReadOnlyGitHub,
  ISSUE,
  seedGitHub,
} from "#/cases/fetching-work-item-fixtures.ts";
import {
  assertFileMatches,
  assertNoMutation,
  assertNoPublicStatusLine,
  checkNegativeRouting,
  checkPositiveRouting,
  normalizeReplyText,
} from "#/cases/shared-checks.ts";
import { commitRepoFiles, GH_LOG } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

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
  commitRepoFiles(
    context.repoPath,
    { [PLAN_PATH]: APPROVED_PLAN },
    "seed approved linked task plan",
  );
}

function checkSummary(observation: Observation, reconciled: boolean): string {
  assertNoMutation(observation);
  assertReadOnlyGitHub(observation, reconciled);
  assert.equal(
    observation.repoFiles?.[PLAN_PATH],
    APPROVED_PLAN,
    "the already valid plan must remain byte-identical",
  );
  assertNoPublicStatusLine(
    observation.finalText,
    "TASK_ISSUES",
    "SUBTASKS",
    "Validation",
    "Status",
  );
  const reply = normalizeReplyText(observation.finalText);
  assert.ok(
    reply.includes(ISSUE.reference) || reply.includes(ISSUE.url),
    "reply omitted parent",
  );
  assert.ok(reply.includes(PLAN_PATH), "reply omitted plan path");
  return reply;
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
    ...behavioralDefaults,
    id: "creating-work-item-children/reuse-linked-plan",
    skill: SKILL,
    mutationPolicy: "read-only",
    seed: seedLinkedPlan,
    snapshotPaths: [PLAN_PATH, GH_LOG],
    intent:
      "Reconcile a fully linked approved plan without duplicating issues or refreshing metadata",
    prompt: () =>
      `Use ${SKILL}. ISSUE_URL=${ISSUE.url}. APPROVED_MUTATION_SCOPE: I approve creating/reusing GitHub child issues for Task 1, linking them to this parent, and updating only ${PLAN_PATH}. The plan is approved. Reconcile the current state and return the outcome and Created/Linked table.`,
    check: (observation) => {
      const reply = checkSummary(observation, true);
      assertFileMatches(observation, GH_LOG, /(?:\/issues\/43|"43")/);
      assert.match(reply, /linked-issue/);
      const rows = reply
        .split("\n")
        .filter((line) => line.trim().startsWith("|"))
        .map((line) =>
          line
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((cell) => cell.trim()),
        );
      const [header, , row] = rows;
      assert.deepEqual(header, [
        "Task",
        "Issue ref",
        "Title",
        "Write model",
        "Dependencies",
        "Priority",
        "Outcome",
      ]);
      const [task, reference, title, writeModel, dependencies, priority] =
        row ?? [];
      assert.deepEqual(
        [task, reference, title, writeModel, dependencies, priority],
        [
          "1",
          "acme/app#43",
          "Preserve empty export header",
          "linked-issue",
          "None",
          "High",
        ],
      );
      return "verified existing child; zero duplicates; unchanged plan and handoff timestamp";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: `The approved ${PLAN_PATH} contains one task already linked to acme/app#43. The child was verified read-only, with parent/task traceability in its body. No issues were created, no creates failed, and the plan and handoff timestamp remain byte-identical.`,
        rubric: [
          {
            id: "reconciliation-summary",
            requirement:
              "Reports one planned task, one verified reused child, zero new creates, zero failed creates, the linked-issue write model and its body-traceability capability, and the unchanged-plan outcome; the table outcome identifies the child as already linked or reused.",
          },
        ],
      }),
  },
  {
    ...behavioralDefaults,
    id: "creating-work-item-children/approval-declined",
    skill: SKILL,
    mutationPolicy: "read-only",
    wallClockMs: 300_000,
    seed: seedLinkedPlan,
    snapshotPaths: [PLAN_PATH, GH_LOG],
    intent:
      "An approved task plan is not authorization for tracker or plan mutations",
    prompt: () =>
      `Use ${SKILL}. ISSUE_URL=${ISSUE.url}. The task plan ${PLAN_PATH} is approved, but I decline approval for remote creates, links, or local file changes. Explain what approval prevents and what remains unchanged.`,
    check: (observation) => {
      const reply = checkSummary(observation, false);
      assert.doesNotMatch(reply, /\|\s*1\s*\|\s*acme\/app#43/);
      return "declined approval blocks reconciliation and preserves the plan";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: `The user approved the task plan ${PLAN_PATH} but explicitly declined remote creates, links, and local file changes. Reconciliation was not authorized; the plan and remote state remain unchanged.`,
        rubric: [
          {
            id: "declined-mutation-boundary",
            requirement:
              "Explains that mutation approval was declined despite plan approval, that this prevents reconciliation dispatch and remote creates or links and local edits, and that the plan and remote state remain unchanged.",
          },
        ],
      }),
  },
] as const satisfies readonly EvalCase[];
