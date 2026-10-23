// Pins the skill's deterministic validator, which is the normative shape
// definition shared by the subagents (pre-return), the orchestrator (gates),
// and the eval checks. These run the real script through the same wrapper the
// checks use, offline and token-free.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { runOutputValidator } from "#/cases/analyzing-recent-project-state-checks.ts";
import { QUIET_STATE_SNAPSHOT } from "#/cases/case-test-support.ts";

const PROJECT_PATH = fileURLToPath(new URL("../../", import.meta.url));

const GOOD_ENVELOPE =
  "RECENT_STATE: NOT_GIT\nReason: not a worktree.\nNext step: Re-run with PROJECT_PATH set to a Git worktree.";

const GOOD_DRAFT = `SNAPSHOT_WRITE: PASS

${QUIET_STATE_SNAPSHOT}

The project has a manifest [confirmed: path package.json].`;

const GOOD_VERDICT =
  "SNAPSHOT_VERIFY: PASS\nRequired fixes: none\nReason: all checks passed\nDecision needed: none";

const GOOD_NON_PASS_EVIDENCE =
  "GIT_EVIDENCE: ERROR\nReason: Could not determine the repository state.";

describe("validate-output.sh", () => {
  test.each([
    { mode: "envelope", payload: GOOD_ENVELOPE },
    { mode: "draft", payload: GOOD_DRAFT },
    { mode: "verdict", payload: GOOD_VERDICT },
    { mode: "evidence", payload: GOOD_NON_PASS_EVIDENCE },
  ] as const)("$mode accepts a conformant payload", ({ mode, payload }) => {
    expect(runOutputValidator(mode, payload, PROJECT_PATH)).toBe("");
  });

  test("throws an operational error when draft validation lacks a project path", () => {
    expect(() => runOutputValidator("draft", GOOD_DRAFT)).toThrow(
      /output validator could not run: validator exited with status 2 without findings/,
    );
  });

  test.each(["../evals/package.json", "src/../package.json"])(
    "lexically rejects parent traversal in locator %s even when its target exists",
    (locator) => {
      expect(existsSync(join(PROJECT_PATH, locator))).toBe(true);
      const findings = runOutputValidator(
        "draft",
        GOOD_DRAFT.replace("path package.json", `path ${locator}`),
        PROJECT_PATH,
      );
      expect(findings).toContain(
        `malformed claim label: [confirmed: path ${locator}]`,
      );
    },
  );

  test.each([
    {
      label: "an envelope with an empty Reason value",
      mode: "envelope",
      payload:
        "RECENT_STATE: PATH_ERROR\nReason:\nNext step: supply a real path",
      finding: /line 2 must be Reason:/,
    },
    {
      label: "an envelope with the wrong first-line label",
      mode: "envelope",
      payload:
        "STATE: PATH_ERROR\nReason: missing\nNext step: supply a real path",
      finding: /line 1 must be RECENT_STATE:/,
    },
    {
      label: "an envelope with swapped Reason and Next step lines",
      mode: "envelope",
      payload:
        "RECENT_STATE: PATH_ERROR\nNext step: supply a real path\nReason: missing",
      finding: /line 2 must be Reason:/,
    },
    {
      label: "an envelope with a fourth line",
      mode: "envelope",
      payload: `${GOOD_ENVELOPE}\nHope that helps!`,
      finding: /expected exactly 3 envelope lines/,
    },
    {
      label: "a draft with an unresolved path locator",
      mode: "draft",
      payload: GOOD_DRAFT.replace(
        "path package.json",
        "path missing-output-validator-fixture.txt",
      ),
      finding:
        /locator does not resolve: path missing-output-validator-fixture.txt/,
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
      label: "a draft missing a canonical section",
      mode: "draft",
      payload: GOOD_DRAFT.replace(
        "## 9. Ranked Next Actions",
        "## Next Actions",
      ),
      finding:
        /section set is neither the full form nor the quiet-state short form/,
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
        "SNAPSHOT_VERIFY: NEEDS_CONTEXT\nRequired fixes:\n- Git State: fix.\nReason: x\nDecision needed: pick a base",
      finding: /NEEDS_CONTEXT requires Required fixes: none/,
    },
    {
      label: "a PASS verdict carrying required fixes",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: PASS\nRequired fixes:\n- Risks: address the finding.\nReason: x\nDecision needed: none",
      finding: /PASS requires Required fixes: none/,
    },
    {
      label: "an evidence payload missing a field",
      mode: "evidence",
      payload: "GIT_EVIDENCE: PASS\nProject path: /repo/app\nReason: partial",
      finding: /missing field: Repo state/,
    },
    {
      label: "a non-PASS evidence payload with an extra line",
      mode: "evidence",
      payload: `${GOOD_NON_PASS_EVIDENCE}\nNext step: nope`,
      finding: /non-PASS payload must be exactly 2 lines/,
    },
  ] as const)("rejects $label", ({ mode, payload, finding }) => {
    expect(runOutputValidator(mode, payload, PROJECT_PATH)).toMatch(finding);
  });
});
