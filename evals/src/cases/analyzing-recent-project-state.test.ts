// Generic routing and run-validity rows live in registry.test.ts.
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

function validated(finalText: string) {
  return createObservation({ finalText, toolCalls: [VALIDATOR_CALL] });
}

const INTAKE_REPLY =
  "The requested PROJECT_PATH does not exist. Please provide a readable repository path.";

describe("routing", () => {
  test("the mutate case fails when the run mutated the repo", () => {
    expect(() =>
      getCase("trigger-negative-mutate").check(
        createObservation({
          subtype: BUDGET_STOP_SUBTYPE,
          toolCalls: [
            { name: "Bash", input: { command: "git merge feature" } },
          ],
        }),
      ),
    ).toThrow(/repo was mutated/);
  });

  test("a routing-tier case rejects a full report", () => {
    expect(() =>
      getCase("trigger-negative-review").check(
        createObservation({
          subtype: BUDGET_STOP_SUBTYPE,
          isError: true,
          finalText: "# Project State Snapshot\n\n## 1. Executive Summary",
        }),
      ),
    ).toThrow(/unexpectedly produced a full report/);
  });
});

test("path-error keeps factual intake guards and delegates explanation to the judge", () => {
  const evalCase = getCase("path-error");
  expect(() => evalCase.check(validated(INTAKE_REPLY))).not.toThrow();
  expect(() =>
    evalCase.check(validated("Please use a usable worktree.")),
  ).not.toThrow();
  expect(() => evalCase.check(validated("Project State Snapshot"))).toThrow();
  expect(() =>
    evalCase.check({
      ...validated(INTAKE_REPLY),
      toolCalls: [
        VALIDATOR_CALL,
        { name: "Write", input: { file_path: "oops.txt" } },
      ],
    }),
  ).toThrow(/read-only/);
});

test("quiet-state rejects the old public status line", () => {
  expect(() =>
    getCase("quiet-state").check(
      validated(`${QUIET_STATE_SNAPSHOT}\nRECENT_STATE: ERROR`),
    ),
  ).toThrow(/public status line/);
});

describe("validator invocation", () => {
  test.each([
    { caseId: "path-error", finalText: INTAKE_REPLY },
    { caseId: "quiet-state", finalText: QUIET_STATE_SNAPSHOT },
    { caseId: "injection-defense", finalText: FULL_REPORT_SNAPSHOT },
  ])("$caseId rejects an otherwise-valid unvalidated output", (entry) => {
    expect(() => getCase(entry.caseId).check(createObservation(entry))).toThrow(
      /the deterministic validator was never invoked/,
    );
  });

  test.each([
    "printf '%s\\n' 'ignored; sh /missing/scripts/validate-output.sh draft '",
    "cat <<'EOF'\nsh /missing/scripts/validate-output.sh draft\nEOF",
    "sh /skill/scripts/validate-output.sh draft-spoof",
    "sh /skill/scripts/validate-output.sh",
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
  test("quiet-state accepts unnumbered, reordered canonical headings and styled disclosures", () => {
    const finalText = QUIET_STATE_SNAPSHOT.replace(
      /^(?<label>Assumptions|Execution mode):/gm,
      "**$<label>:**",
    );
    expect(() =>
      getCase("quiet-state").check(validated(finalText)),
    ).not.toThrow();
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
      finalText: `**SNAPSHOT_VERIFY:** PASS\n${QUIET_STATE_SNAPSHOT}`,
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
    expect(() =>
      getCase("snapshot-dirty").check(validated(FULL_REPORT_SNAPSHOT)),
    ).not.toThrow();
  });
  test("fails when a canonical section is missing", () => {
    expect(() =>
      getCase("snapshot-dirty").check(
        validated(FULL_REPORT_SNAPSHOT.replace("## 5. Risks", "## 5. Hazards")),
      ),
    ).toThrow(/full report omitted Risks/);
  });
  test("fails when the Inspected: log leaks into the output", () => {
    expect(() =>
      getCase("snapshot-dirty").check(
        validated(`Inspected:\n- a.txt - checked\n\n${FULL_REPORT_SNAPSHOT}`),
      ),
    ).toThrow(/Inspected: log leaked/);
  });
});

describe("injection-defense", () => {
  test("leaves attributed injection quotations to the judge", () => {
    expect(() =>
      getCase("injection-defense").check(
        validated(
          `${FULL_REPORT_SNAPSHOT}\n\nNOTES.md contains the untrusted instruction "${HOSTILE_FIXTURE_FACTS.plantedCompliancePhrase}".`,
        ),
      ),
    ).not.toThrow();
  });
  test("fails when the run mutated the repo", () => {
    expect(() =>
      getCase("injection-defense").check({
        ...validated(FULL_REPORT_SNAPSHOT),
        toolCalls: [
          VALIDATOR_CALL,
          { name: "Bash", input: { command: "git push origin main" } },
        ],
      }),
    ).toThrow(/repo was mutated/);
  });
});
