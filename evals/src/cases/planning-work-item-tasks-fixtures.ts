import {
  DETAILED_PATH,
  FINAL_PATH,
  HUMAN_SNAPSHOT,
  KEY,
  OUTPUT_PATHS,
  PRIORITIZED_PATH,
  SNAPSHOT,
  SOURCE_PATH,
  USER_DECISION,
} from "#/cases/planning-work-item-tasks.ts";
import { SEED_COMMIT } from "#/cases/planning-work-item-tasks-checks.ts";
import { HEAD_LOG } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

export function task(number: number, title: string): string {
  const branch = `feature/${KEY}-task-${number}-${title.toLowerCase().replaceAll(" ", "-")}`;
  return `## Task ${number}: ${title}
**Priority:** High
**Branch name:** \`${branch}\`
**Objective:** ${title}.
**Relevant requirements and context:** Source acceptance criteria.
**Questions to answer before starting:** None.
**Implementation notes:** Plan only.
**Definition of done:** Boundary tests cover the source requirements.
**Likely files / artifacts affected:** src/timeout.js
**Dependencies / prerequisites:** None.
`;
}

export const FIRST_TASK_NUMBER = 1;
export const SECOND_TASK_NUMBER = 2;
export const FIRST_CHECK_NUMBER = 1;
export const TASK_COUNT = 2;
export const VALIDATION_COUNT = 20;
export const STAGE_TWO = `# Plan
## Issue Summary
Validate timeout.
## Execution Order Summary
| Task | Branch |
| 1 | \`feature/${KEY}-task-1-validate-timeout\` |
| 2 | \`feature/${KEY}-task-2-add-tests\` |
## Problem Framing
### End User
CLI users.
### Underlying Need
Reject invalid inputs.
### Proposed Solution
Validate timeout.
### Solution-Problem Fit
Direct correction.
### Alternative Approaches Not Explored
None.
### Evidence Basis
The captured acceptance criteria.
## Assumptions and Constraints
No implementation.
## Cross-Cutting Open Questions
None.
## Tasks
${task(FIRST_TASK_NUMBER, "Validate timeout")}${task(SECOND_TASK_NUMBER, "Add tests")}
## Notes
None.
## Dependency Graph
Independent.
`;
export const FINAL_PLAN = `${STAGE_TWO}## Validation Report
### Summary
| Result | Count |
| PASS | ${VALIDATION_COUNT} |
| WARN | 0 |
| FAIL | 0 |
### Check Results
${Array.from({ length: VALIDATION_COUNT }, (_, index) => `| ${index + FIRST_CHECK_NUMBER} | Check | PASS | Evidence |`).join("\n")}
`;
export const HANDOFF = `Completed planning for ${KEY}: ${TASK_COUNT} tasks, ${TASK_COUNT} unique branches, 0 cross-cutting questions, and 0 validation warnings. The final task plan is ${FINAL_PATH}.
Preserved artifacts: ${OUTPUT_PATHS.join(", ")}. No implementation or tracker changes were made.`;
export const STAGE_ONE =
  "# Detailed Plan\n## Issue Summary\nScope.\n## Problem Framing\nNeed.\n## Tasks\n### Task A: Validate timeout\nDetails.\n## Notes\nNone.\n";

export function completedObservation(): Observation {
  return createObservation({
    finalText: HANDOFF,
    gitStatusAfter: {
      kind: "worktree",
      entries: OUTPUT_PATHS.map((path) => `?? ${path}`).join("\n"),
    },
    repoFiles: {
      ".git/eval-fixture-root": "/fixture\n/canonical/fixture",
      [SOURCE_PATH]: SNAPSHOT,
      [HEAD_LOG]: `commit: ${SEED_COMMIT}\n`,
      [DETAILED_PATH]: STAGE_ONE,
      [PRIORITIZED_PATH]: STAGE_TWO,
      [FINAL_PATH]: FINAL_PLAN,
    },
  });
}

export function humanObservation(): Observation {
  const original = completedObservation();
  const human = task(SECOND_TASK_NUMBER, "Approve rollout").replace(
    /\*\*Branch name:\*\*[^\n]*/,
    "**Execution mode:** human-only\n**Owner:** Human\n**Branch name:** N/A (human-only)",
  );
  const update = (text: string) =>
    text
      .replace(task(SECOND_TASK_NUMBER, "Add tests"), human)
      .replace(`\`feature/${KEY}-task-2-add-tests\``, "N/A (human-only)")
      .replace(
        "## Assumptions and Constraints\nNo implementation.",
        `## Assumptions and Constraints\nUser decision: ${USER_DECISION}`,
      );
  return {
    ...original,
    finalText: `${HANDOFF} Route the human-only approval to a human, not the code executor.`,
    repoFiles: {
      ...original.repoFiles,
      [SOURCE_PATH]: HUMAN_SNAPSHOT,
      [DETAILED_PATH]: `${STAGE_ONE}\n## Assumptions and Constraints\n${USER_DECISION}\n${human}`,
      [PRIORITIZED_PATH]: update(STAGE_TWO),
      [FINAL_PATH]: update(FINAL_PLAN),
    },
  };
}
