// Pins the skill's deterministic validator, which is the normative shape
// definition shared by the subagents (pre-return), the orchestrator (gates),
// and the eval checks. These run the real script through the same wrapper the
// checks use, offline and token-free.

import { describe, expect, test } from "vitest";

import { runOutputValidator } from "#/cases/analyzing-recent-project-state-checks.ts";

const GOOD_ENVELOPE =
  "RECENT_STATE: NOT_GIT\nReason: not a worktree.\nNext step: Re-run with PROJECT_PATH set to a Git worktree.";

const GOOD_DRAFT = [
  "SNAPSHOT_WRITE: PASS",
  "Inspected:",
  "- a.txt:1-5 - checked the change",
  "- b.txt - new file",
  "",
  "# Project State Snapshot",
  "",
  "Body.",
  "",
  "Assumptions: none",
  "Execution mode: isolated",
].join("\n");

const GOOD_VERDICT =
  "SNAPSHOT_VERIFY: PASS\nRequired fixes: none\nReason: all checks passed\nDecision needed: none";

const GOOD_NON_PASS_EVIDENCE =
  "GIT_EVIDENCE: NOT_GIT\nReason: /tmp/notes is not a worktree.";

describe("validate-output.sh", () => {
  test.each([
    { mode: "envelope", payload: GOOD_ENVELOPE },
    { mode: "draft", payload: GOOD_DRAFT },
    { mode: "verdict", payload: GOOD_VERDICT },
    { mode: "evidence", payload: GOOD_NON_PASS_EVIDENCE },
  ] as const)("$mode accepts a conformant payload", ({ mode, payload }) => {
    expect(runOutputValidator(mode, payload)).toBe("");
  });

  test.each([
    {
      label: "an envelope with a fourth line",
      mode: "envelope",
      payload: `${GOOD_ENVELOPE}\nHope that helps!`,
      finding: /expected exactly 3 envelope lines/,
    },
    {
      label: "a draft whose paths are out of byte order",
      mode: "draft",
      payload: GOOD_DRAFT.replace(
        "- a.txt:1-5 - checked the change\n- b.txt - new file",
        "- b.txt - new file\n- a.txt:1-5 - checked the change",
      ),
      finding: /ascending byte-wise order/,
    },
    {
      label: "a draft missing its Assumptions: line",
      mode: "draft",
      payload: GOOD_DRAFT.replace("Assumptions: none\n", ""),
      finding: /exactly one Assumptions: line in the body, found 0/,
    },
    {
      label: "a draft with a non-enum Execution mode",
      mode: "draft",
      payload: GOOD_DRAFT.replace(
        "Execution mode: isolated",
        "Execution mode: inline",
      ),
      finding: /isolated or inline enum literal/,
    },
    {
      label: "a - none entry carrying a cap note",
      mode: "draft",
      payload: GOOD_DRAFT.replace(
        "- a.txt:1-5 - checked the change\n- b.txt - new file",
        "- none\n- inspection cap reached; 3 files not inspected",
      ),
      finding: /- none never carries a cap note/,
    },
    {
      label: "an incoherent FAIL verdict with no fixes",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: FAIL\nRequired fixes: none\nReason: x\nDecision needed: none",
      finding: /FAIL requires at least one section-targeted required fix/,
    },
    {
      label: "a NEEDS_CONTEXT verdict carrying fixes",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: NEEDS_CONTEXT\nRequired fixes:\n- Section 2: fix.\nReason: x\nDecision needed: pick a base",
      finding: /NEEDS_CONTEXT requires Required fixes: none/,
    },
    {
      label: "a PASS verdict with an unaddressed prior fix",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: PASS\nFix dispositions: Section 5 not addressed\nRequired fixes: none\nReason: x\nDecision needed: none",
      finding: /PASS requires every prior fix addressed/,
    },
    {
      label: "an evidence payload missing a field",
      mode: "evidence",
      payload: "GIT_EVIDENCE: PASS\nProject path: /repo/app\nReason: partial",
      finding: /missing field: Repo state:/,
    },
    {
      label: "a non-PASS evidence payload with an extra line",
      mode: "evidence",
      payload: `${GOOD_NON_PASS_EVIDENCE}\nNext step: nope`,
      finding: /non-PASS payload must be exactly 2 lines/,
    },
  ] as const)("rejects $label", ({ mode, payload, finding }) => {
    expect(runOutputValidator(mode, payload)).toMatch(finding);
  });
});
