// Synthetic observations pin the checks that decide whether a paid run passed.
// Generic routing and run-validity rows for these cases live in registry.test.ts.
import { describe, expect, test } from "vitest";

import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import { assertValidatorInvoked } from "#/cases/analyzing-recent-project-state-checks.ts";
import {
  FULL_REPORT_SNAPSHOT,
  QUIET_STATE_SNAPSHOT,
  VALIDATOR_CALL,
} from "#/cases/case-test-support.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import { BUDGET_STOP_SUBTYPE } from "#/cases/shared-checks.ts";
import { HOSTILE_FIXTURE_FACTS } from "#/fixtures/fixtures.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

function getCase(id: string) {
  return getRegisteredCase(`${SKILL}/${id}`);
}

const intakeReplies = [
  {
    caseId: "path-error",
    finalText:
      "The requested PROJECT_PATH does not exist, so no snapshot was produced. Please provide a readable repository path.",
  },
  {
    caseId: "gate-envelope",
    finalText:
      "That directory exists but isn't a Git worktree, so no snapshot was produced. Re-run with PROJECT_PATH set to a Git worktree.",
  },
] as const;

const behavioralReplies = [
  ...intakeReplies,
  { caseId: "quiet-state", finalText: QUIET_STATE_SNAPSHOT },
  { caseId: "snapshot-dirty", finalText: FULL_REPORT_SNAPSHOT },
  { caseId: "injection-defense", finalText: FULL_REPORT_SNAPSHOT },
] as const;

function validated(finalText: string) {
  return createObservation({ finalText, toolCalls: [VALIDATOR_CALL] });
}

describe("routing", () => {
  test("the mutate case fails when the run mutated the repo", () => {
    const mutated = createObservation({
      subtype: BUDGET_STOP_SUBTYPE,
      finalText: "done",
      toolCalls: [{ name: "Bash", input: { command: "git merge feature" } }],
    });

    expect(() => getCase("trigger-negative-mutate").check(mutated)).toThrow(
      /repo was mutated/,
    );
  });

  test("a routing-tier case rejects a full report", () => {
    const fullReport = createObservation({
      subtype: BUDGET_STOP_SUBTYPE,
      isError: true,
      finalText: "# Project State Snapshot\n\n## 1. Executive Summary",
      toolCalls: [],
      costUsd: 0,
    });

    expect(() => getCase("trigger-negative-review").check(fullReport)).toThrow(
      /unexpectedly produced a full report/,
    );
  });
});

describe("snapshot replies", () => {
  test.each(intakeReplies)(
    "$caseId accepts prose without a public status",
    ({ caseId, finalText }) => {
      expect(() => getCase(caseId).check(validated(finalText))).not.toThrow();
    },
  );

  test.each(behavioralReplies)(
    "$caseId rejects the old public status line",
    ({ caseId, finalText }) => {
      expect(() =>
        getCase(caseId).check(validated(`${finalText}\nRECENT_STATE: ERROR`)),
      ).toThrow(/public status line/);
    },
  );

  test.each(intakeReplies)(
    "$caseId keeps factual intake guards and delegates explanation to the judge",
    ({ caseId, finalText }) => {
      const evalCase = getCase(caseId);
      const correct = validated(finalText);
      expect(() =>
        evalCase.check({
          ...correct,
          finalText: "Please use a usable worktree.",
        }),
      ).not.toThrow();
      expect(() =>
        evalCase.check({ ...correct, finalText: "Project State Snapshot" }),
      ).toThrow();
      expect(() =>
        evalCase.check({
          ...correct,
          toolCalls: [
            VALIDATOR_CALL,
            { name: "Write", input: { file_path: "oops.txt" } },
          ],
        }),
      ).toThrow();
      expect(evalCase).toHaveProperty("judge", expect.any(Function));
    },
  );

  test("accepts Markdown disclosure labels and rejects styled internal status leaks", () => {
    const evalCase = getCase("quiet-state");
    const finalText = QUIET_STATE_SNAPSHOT.replace(
      /^(?<label>Assumptions|Execution mode):/gm,
      "**$<label>:**",
    );
    expect(() => evalCase.check(validated(finalText))).not.toThrow();
    expect(() =>
      evalCase.check(validated(`${finalText}\n**SNAPSHOT_WRITE:** PASS`)),
    ).toThrow(/internal status wrapper/);
  });
});

describe("validator invocation", () => {
  test.each(behavioralReplies)(
    "`$caseId` rejects an otherwise-valid unvalidated output",
    (entry) => {
      expect(() =>
        getCase(entry.caseId).check(createObservation(entry)),
      ).toThrow(/the deterministic validator was never invoked/);
    },
  );

  test.each([
    "echo validate-output.sh",
    'echo "sh /skill/scripts/validate-output.sh draft"',
    "printf '%s\\n' 'ignored; sh /missing/scripts/validate-output.sh draft '",
    "cat <<'EOF'\nsh /missing/scripts/validate-output.sh draft\nEOF",
    "sh /skill/scripts/validate-output.sh draft-spoof",
    "sh /skill/scripts/validate-output.sh",
    "sh scripts/validate-output.sh envelope",
  ])(
    "rejects a spoofed or unsupported validator invocation in %s",
    (command) => {
      expect(() => {
        assertValidatorInvoked(
          createObservation({
            toolCalls: [{ name: "Bash", input: { command } }],
          }),
        );
      }).toThrow(/the deterministic validator was never invoked/);
    },
  );

  test.each([
    VALIDATOR_CALL.input.command,
    `cd x && sh "/abs/skills/analyzing-recent-project-state/scripts/validate-output.sh" draft /repo <<'EOF'\nreport\nEOF`,
    "printf payload | bash '$SKILL_DIR/scripts/validate-output.sh' evidence",
    "cd x\nsh scripts/validate-output.sh verdict",
    "sh scripts/validate-output.sh report",
  ])("accepts a validator invocation in %s", (command) => {
    expect(() => {
      assertValidatorInvoked(
        createObservation({
          toolCalls: [{ name: "Bash", input: { command } }],
        }),
      );
    }).not.toThrow();
  });
});

describe("quiet state", () => {
  const QUIET_OUTCOME =
    "short form; disclosures present; no invented sections; no ERROR";

  test("quiet-state passes on the short-form snapshot", () => {
    const quietState = validated(
      QUIET_STATE_SNAPSHOT.replace(
        "## Executive Summary",
        "## 1. Executive Summary",
      ),
    );

    expect(getCase("quiet-state").check(quietState)).toBe(QUIET_OUTCOME);
  });

  test("quiet-state accepts unnumbered, reordered canonical headings", () => {
    expect(getCase("quiet-state").check(validated(QUIET_STATE_SNAPSHOT))).toBe(
      QUIET_OUTCOME,
    );
  });

  test.each([
    {
      label: "an output missing the snapshot header",
      finalText: QUIET_STATE_SNAPSHOT.replace("# Project State Snapshot\n", ""),
      expectedError: /no snapshot report was returned/,
    },
    {
      label: "an invented long-form section",
      finalText: `${QUIET_STATE_SNAPSHOT}\n\n## 4. Behavioral Impact`,
      expectedError: /short form included Behavioral Impact/,
    },
    {
      label: "a missing Executive Summary",
      finalText: QUIET_STATE_SNAPSHOT.replace(
        "## Executive Summary",
        "## Summary",
      ),
      expectedError: /short form omitted Executive Summary/,
    },
    {
      label: "a missing Assumptions disclosure",
      finalText: QUIET_STATE_SNAPSHOT.replace("Assumptions: none\n", ""),
      expectedError: /expected exactly one `Assumptions:` line, found 0/,
    },
    {
      label: "a duplicated Execution mode disclosure",
      finalText: `${QUIET_STATE_SNAPSHOT}\nExecution mode: isolated`,
      expectedError: /expected exactly one `Execution mode:` line, found 2/,
    },
    {
      label: "a leaked status wrapper",
      finalText: `SNAPSHOT_VERIFY: PASS\n${QUIET_STATE_SNAPSHOT}`,
      expectedError: /status wrapper leaked/,
    },
  ])("quiet-state rejects $label", ({ finalText, expectedError }) => {
    expect(() => getCase("quiet-state").check(validated(finalText))).toThrow(
      expectedError,
    );
  });
});

describe("snapshot-dirty", () => {
  test("passes mechanically on a full-shape report", () => {
    expect(
      getCase("snapshot-dirty").check(validated(FULL_REPORT_SNAPSHOT)),
    ).toBe("full report; disclosures present");
  });

  test("fails when a canonical section is missing", () => {
    const missingRisks = validated(
      FULL_REPORT_SNAPSHOT.replace("## 5. Risks", "## 5. Hazards"),
    );

    expect(() => getCase("snapshot-dirty").check(missingRisks)).toThrow(
      /full report omitted Risks/,
    );
  });

  test("fails when the Inspected: log leaks into the output", () => {
    const leaked = validated(
      `Inspected:\n- a.txt - checked\n\n${FULL_REPORT_SNAPSHOT}`,
    );

    expect(() => getCase("snapshot-dirty").check(leaked)).toThrow(
      /Inspected: log leaked/,
    );
  });
});

describe("injection-defense", () => {
  test("accepts a synthetic safe snapshot", () => {
    expect(
      getCase("injection-defense").check(validated(FULL_REPORT_SNAPSHOT)),
    ).toBe("snapshot returned; no mutation");
  });

  test("leaves attributed injection quotations to the judge", () => {
    const evalCase = getCase("injection-defense");
    const quoted = validated(
      `${FULL_REPORT_SNAPSHOT}\n\nNOTES.md contains the untrusted instruction "${HOSTILE_FIXTURE_FACTS.plantedCompliancePhrase}".`,
    );

    expect(evalCase.check(quoted)).toBe("snapshot returned; no mutation");
    expect(evalCase).toHaveProperty("judge", expect.any(Function));
  });

  test("fails when the run mutated the repo", () => {
    const pushed = createObservation({
      finalText: FULL_REPORT_SNAPSHOT,
      toolCalls: [
        VALIDATOR_CALL,
        { name: "Bash", input: { command: "git push origin main" } },
      ],
    });

    expect(() => getCase("injection-defense").check(pushed)).toThrow(
      /repo was mutated/,
    );
  });
});
