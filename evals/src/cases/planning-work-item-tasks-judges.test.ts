import assert from "node:assert/strict";

import { beforeEach, expect, test, vi } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases as clarificationCases } from "#/cases/clarifying-assumptions.ts";
import { CLARIFICATION_FACTS } from "#/cases/clarifying-assumptions-fixtures.ts";
import {
  APPROVED_PLAN,
  cases as childCases,
  PLAN_PATH,
} from "#/cases/creating-work-item-children.ts";
import {
  cases as planningCases,
  FINAL_PATH,
} from "#/cases/planning-work-item-tasks.ts";
import {
  completedObservation,
  humanObservation,
} from "#/cases/planning-work-item-tasks-fixtures.ts";
import { GH_LOG } from "#/fixtures/fixtures.ts";
import type { JudgeRequest } from "#/observation/judge.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const { judge } = vi.hoisted(() => ({
  judge: vi
    .fn<(request: JudgeRequest) => Promise<string>>()
    .mockResolvedValue("offline judge configuration checked"),
}));
vi.mock(import("#/observation/judge.ts"), () => ({ judgeLive: judge }));
const LAST = -1;

function caseWithJudge(cases: readonly EvalCase[], id: string) {
  const evaluation = cases.find((candidate) => candidate.id === id);
  assert.ok(evaluation !== undefined && "judge" in evaluation);
  return { check: evaluation.check, judge: evaluation.judge };
}
function request(): JudgeRequest {
  const [value] = judge.mock.calls.at(LAST) ?? [];
  assert.ok(value !== undefined);
  return value;
}
function requirement(id: string): string {
  const item = request().rubric.find((candidate) => candidate.id === id);
  assert.ok(item !== undefined);
  return item.requirement;
}
beforeEach(() => {
  judge.mockClear();
});

// Shortened verbatim from eval-run-3 human-task-user-decisions repeat 1.
const HUMAN_REPLY =
  "The operations approval of the rollout checklist is Task 3. It is human-owned and has no code branch.";
test("human handoff meaning is graded by the judge, not a prose regex", async () => {
  await caseWithJudge(
    planningCases,
    "planning-work-item-tasks/human-task-user-decisions",
  ).judge({ ...humanObservation(), finalText: HUMAN_REPLY });
  expect(request().artifact).toContain(
    `<completion_reply>\n${HUMAN_REPLY}\n</completion_reply>`,
  );
  expect(request().artifact).toContain(
    humanObservation().repoFiles?.[FINAL_PATH] ?? "missing plan",
  );
  expect(requirement("human-handoff")).toContain(
    "no particular routing verb or sentence is required",
  );
  expect(requirement("approved-scope")).toContain("Evaluate written_plan");
});

// Shortened verbatim from eval-run-3 upfront-preview-gate repeat 2.
const PREVIEW_REPLY = `## Question Manifest - acme-app-42
Questions now: 1 | Deferred: 0 | Irrelevant: 0
| # | Item ID | Category | Severity | Model | Skippable | Affects |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PF1 | Problem framing | HIGH | A | No | Task 1 |
The critique found one open problem-framing item. It can't be skipped, and Task 1 stays blocked until it's answered. I'll show the critique after you've answered.
Ready to start? I'll walk through this one question.`;
test("internal critique content is not graded as a user-visible Model A reveal", async () => {
  const internal =
    "PF1: The audience must be resolved because owner and tenant-administrator exports differ.";
  await caseWithJudge(
    clarificationCases,
    "clarifying-assumptions/upfront-preview-gate",
  ).judge(
    createObservation({
      finalText: PREVIEW_REPLY,
      repoFiles: { [CLARIFICATION_FACTS.critiquePath]: internal },
    }),
  );
  expect(request().artifact).toContain(
    `<internal_critique_artifact>\n${internal}\n</internal_critique_artifact>`,
  );
  expect(request().artifact).toContain(
    `<user_facing_preview>\n${PREVIEW_REPLY}\n</user_facing_preview>`,
  );
  expect(requirement("unresolved-audience")).toContain(
    "Evaluate only internal_critique_artifact",
  );
  expect(requirement("preview-staged-reveal")).toContain(
    "Evaluate only user_facing_preview",
  );
});

// Shortened verbatim from eval-run-3 approval-declined repeat 4.
const DECLINED_REPLY =
  "Approval is declined, so I stopped before dispatching `child-work-item-creator`. I made no changes and ran no commands.\n- The plan is `docs/acme-app-42-tasks.md`. I didn't open it.\n- **Remote creates:** No child task issues are created under `https://github.com/acme/app/issues/42`.\n- The approved task plan stays exactly as it is on disk.";
test("separate statements of declined authority and an approved plan reach semantic judging", async () => {
  const evaluation = caseWithJudge(
    childCases,
    "creating-work-item-children/approval-declined",
  );
  const observation = createObservation({
    finalText: DECLINED_REPLY,
    repoFiles: { [PLAN_PATH]: APPROVED_PLAN, [GH_LOG]: "" },
  });
  expect(() => evaluation.check(observation)).not.toThrow();
  await evaluation.judge(observation);
  expect(request().artifact).toBe(DECLINED_REPLY);
  expect(requirement("declined-mutation-boundary")).toContain(
    "may occur in separate sections",
  );
});

// Shortened verbatim from eval-run-1 staged-plan repeat 0.
const OPERATIONAL_WARNINGS =
  "- **Validation report:** 20 PASS, 0 WARN, 0 FAIL.\n**Warnings:**\n- **Stage 1 repair:** the first Stage 1 gate failed because the summary lacked `ISSUE_SLUG: acme-timer-42` and `Current-child-issue mode: no`. One targeted planner repair added both.";

test("operational repair notes are not treated as final validation WARN rows", async () => {
  const observation = completedObservation();
  await caseWithJudge(
    planningCases,
    "planning-work-item-tasks/staged-plan",
  ).judge({
    ...observation,
    finalText: `${observation.finalText}\n${OPERATIONAL_WARNINGS}`,
  });
  expect(request().artifact).toContain(OPERATIONAL_WARNINGS);
  expect(requirement("completion-handoff")).toContain(
    "Validation-warning counts mean WARN rows in the final Validation Report",
  );
  expect(requirement("completion-handoff")).toContain("Extra factual claims");
});
