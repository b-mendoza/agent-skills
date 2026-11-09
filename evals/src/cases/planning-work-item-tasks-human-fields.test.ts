import assert from "node:assert/strict";

import { expect, test } from "vitest";

import { cases, FINAL_PATH } from "#/cases/planning-work-item-tasks.ts";
import { humanObservation } from "#/cases/planning-work-item-tasks-fixtures.ts";

function getHumanCase() {
  const evaluation = cases.find(
    (candidate) =>
      candidate.id === "planning-work-item-tasks/human-task-user-decisions",
  );
  assert.ok(evaluation !== undefined);
  return evaluation;
}

// Shortened verbatim from human-task-user-decisions: eval-run-1 repeats 0–3 and eval-run-3 repeats 1 and 3.
const RECORDED_REPLIES = [
  "It is owned by Human and has no Git branch, so someone has to route it to a person before execution.",
  "It is marked human-only with a Human owner and no branch (N/A), so it must go to a person and never to branch checkout or a code executor.",
  "Someone has to route it to an authorized person. Nothing here approved it or can approve it.",
  "It is human-owned and has no branch, because there is no repository change. A person has to do it, not a code executor.",
  "The operations approval of the rollout checklist is Task 3. It is human-owned and has no code branch.",
  "Task 3 is the human-only operations approval of the rollout checklist. It is owned by a human and has no code branch.\nTask 3 needs a person to route it to the operations owner before anyone implements the rest.",
];

test.each(RECORDED_REPLIES)(
  "recorded human handoff prose is not a mechanical phrase gate %#",
  (finalText) => {
    const humanCase = getHumanCase();
    expect(() =>
      humanCase.check({ ...humanObservation(), finalText }),
    ).not.toThrow();
    expect(humanCase).toHaveProperty("judge", expect.any(Function));
  },
);

const FIELDS = [
  "**Execution mode:** human-only",
  "**Owner:** Human",
  "**Branch name:** N/A (human-only)",
];
test.each(FIELDS)(
  "rejects missing structured evidence %s even with correct prose",
  (field) => {
    const humanCase = getHumanCase();
    const observation = humanObservation();
    const content = observation.repoFiles?.[FINAL_PATH] ?? "";
    expect(() =>
      humanCase.check({
        ...observation,
        finalText: RECORDED_REPLIES.join("\n"),
        repoFiles: {
          ...observation.repoFiles,
          [FINAL_PATH]: content.replace(field, ""),
        },
      }),
    ).toThrow();
  },
);

test("an explicitly excluded migration mention is left to semantic scope judging", () => {
  const evaluation = getHumanCase();
  const observation = humanObservation();
  const content = observation.repoFiles?.[FINAL_PATH] ?? "";
  expect(() =>
    evaluation.check({
      ...observation,
      repoFiles: {
        ...observation.repoFiles,
        [FINAL_PATH]: content.replace(
          "## Task 2: Approve rollout",
          "## Task 2: Approve rollout with RemoteClock migration excluded",
        ),
      },
    }),
  ).not.toThrow();
  expect(evaluation).toHaveProperty("judge", expect.any(Function));
});
