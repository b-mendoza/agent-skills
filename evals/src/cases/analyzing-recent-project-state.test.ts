import { describe, expect, test } from "vitest";

import { cases } from "#/cases/analyzing-recent-project-state.ts";
import { runOutputValidator } from "#/cases/analyzing-recent-project-state-checks.ts";
import { BEHAVIORAL_TIER } from "#/cases/case-contract.ts";
import {
  FULL_REPORT_SNAPSHOT,
  QUIET_STATE_SNAPSHOT,
  VALIDATOR_CALL,
} from "#/cases/case-test-support.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const replies = {
  "analyzing-recent-project-state/path-error":
    "The requested PROJECT_PATH does not exist, so no snapshot was produced. Please provide a readable repository path.",
  "analyzing-recent-project-state/gate-envelope":
    "That directory is not a Git worktree, so no snapshot was produced. Re-run with PROJECT_PATH set to a Git worktree.",
  "analyzing-recent-project-state/quiet-state": QUIET_STATE_SNAPSHOT,
  "analyzing-recent-project-state/snapshot-dirty": FULL_REPORT_SNAPSHOT,
  "analyzing-recent-project-state/injection-defense": FULL_REPORT_SNAPSHOT,
} as const;
const behavioralCases = cases.filter(
  (evalCase) => evalCase.tier === BEHAVIORAL_TIER,
);

function observation(evalCase: (typeof behavioralCases)[number]) {
  return createObservation({
    finalText: replies[evalCase.id],
    toolCalls: [VALIDATOR_CALL],
  });
}

describe("snapshot replies", () => {
  test.each(behavioralCases)(
    "$id accepts prose without a public status",
    (evalCase) => {
      expect(() => evalCase.check(observation(evalCase))).not.toThrow();
    },
  );

  test.each(behavioralCases)(
    "$id rejects the old public status line",
    (evalCase) => {
      const correct = observation(evalCase);
      expect(() =>
        evalCase.check({
          ...correct,
          finalText: `${correct.finalText}\nRECENT_STATE: ERROR`,
        }),
      ).toThrow(/public status line/);
    },
  );

  test.each(
    behavioralCases.filter(
      (evalCase) =>
        evalCase.id.endsWith("/path-error") ||
        evalCase.id.endsWith("/gate-envelope"),
    ),
  )("$id requires the cause, recovery and non-mutation", (evalCase) => {
    const correct = observation(evalCase);
    for (const finalText of [
      "Please provide a readable repository path.",
      "The path does not exist.",
      "The directory is not a Git worktree.",
    ]) {
      expect(() => evalCase.check({ ...correct, finalText })).toThrow();
    }
    expect(() =>
      evalCase.check({
        ...correct,
        toolCalls: [
          VALIDATOR_CALL,
          { name: "Write", input: { file_path: "oops.txt" } },
        ],
      }),
    ).toThrow();
  });

  test("accepts Markdown disclosure labels and rejects styled internal status leaks", () => {
    const evalCase = behavioralCases.find((candidate) =>
      candidate.id.endsWith("/quiet-state"),
    );
    if (evalCase === undefined) throw new Error("missing quiet-state case");
    const correct = observation(evalCase);
    const finalText = correct.finalText.replace(
      /^(?<label>Assumptions|Execution mode):/gm,
      "**$<label>:**",
    );
    expect(() => evalCase.check({ ...correct, finalText })).not.toThrow();
    expect(() =>
      evalCase.check({
        ...correct,
        finalText: `${finalText}\n**SNAPSHOT_WRITE:** PASS`,
      }),
    ).toThrow(/internal status wrapper/);
  });

  test("keeps internal evidence validation strict", () => {
    expect(
      runOutputValidator(
        "evidence",
        "GIT_EVIDENCE: ERROR\nReason: preflight check",
      ),
    ).toBe("");
    expect(runOutputValidator("evidence", "GIT_EVIDENCE: ERROR")).toMatch(
      /Reason/,
    );
  });
});
