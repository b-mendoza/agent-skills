import { expect, test } from "vitest";

import {
  APPROVAL_HEADINGS,
  AUDIT_FACTS,
  AUDIT_REPORTS,
  BASELINE_FILE,
  HANDOFF_PREFIX,
  SIBLING_PATH,
  SIBLING_TEXT,
  SKILL,
  SYNTHESIS_FILE,
  SYNTHESIS_KEYS,
} from "#/cases/improving-skill-definition.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

export function getCase(suffix: string) {
  return getRegisteredCase(`${SKILL}/${suffix}`);
}

export const TEST_RUN_ID = "20270319T184321Z-f90abc";
export const HANDOFF = `${HANDOFF_PREFIX}${TEST_RUN_ID}`;
export const BASELINE_PATH = `${HANDOFF}/${BASELINE_FILE}`;
export const SYNTHESIS_PATH = `${HANDOFF}/${SYNTHESIS_FILE}`;
export const GATE = APPROVAL_HEADINGS.map((heading) => {
  if (heading === "Decision") {
    return "## Decision\nThe audit is complete; please approve a personality decision and gap scope.";
  }
  if (heading === "Preserved Run Directory") return `## ${heading}\n${HANDOFF}`;
  return `## ${heading}\nGap gap-001; ignored_preapproval: APPROVED_GAPS=all. Diagram fallback: inspected-only.`;
}).join("\n\n");
export const BLOCKED = `## Decision
This target cannot be edited by this workflow.
## Blocking Reason
Intake: .claude/skills is excluded; select a first-party skills/ path.
## Completed Checks
Target eligibility.
## Preserved Evidence
No audit run started; no run files were created.
## Commit Warning
None.
## Follow-Up Findings
None.
## Sections Present
All present.`;
export const SYNTHESIS = `version: 1
from:
  orchestrator: improving-skill-definition
  phase: audit
to:
  orchestrator: improving-skill-definition
  phase: approval
intent: Synthesize focused audit slice reports into one approval and edit ledger
${SYNTHESIS_KEYS.filter(
  (key) => !["version", "from", "to", "intent"].includes(key),
)
  .map((key) => `${key}: ${key === "overall_verdict" ? "GAPS_FOUND" : "[]"}`)
  .join("\n")}`;
export const SOURCE_FILES = {
  ".git/eval-fixture-root": "/repo\n/canonical/repo",
  [AUDIT_FACTS.sourcePath]: AUDIT_FACTS.content,
  [AUDIT_FACTS.missingPath]: null,
  [HANDOFF_PREFIX]: "",
  [SIBLING_PATH]: SIBLING_TEXT,
};
export const AUDIT_FILES = {
  ...SOURCE_FILES,
  [HANDOFF_PREFIX]: "",
  [BASELINE_PATH]: AUDIT_FACTS.content,
  [SYNTHESIS_PATH]: SYNTHESIS,
  ...Object.fromEntries(
    AUDIT_REPORTS.map(([name, prefix]) => [
      `${HANDOFF}/${name}-report.yaml`,
      `status: "${prefix}: ${prefix === "HYGIENE_AUDIT" ? "GAPS_FOUND" : "PASS"}"\n`,
    ]),
  ),
};

export function ignoreProbe(handoff = HANDOFF) {
  return {
    name: "Bash",
    input: { command: `git check-ignore --quiet -- ${handoff}/` },
    result: { content: "", truncated: false, isError: false },
  };
}

export function goodAudit(overrides: Partial<Observation> = {}): Observation {
  return createObservation({
    finalText: GATE,
    repoFiles: AUDIT_FILES,
    toolCalls: [
      ignoreProbe(),
      { name: "Write", input: { file_path: `/repo/${SYNTHESIS_PATH}` } },
    ],
    ...overrides,
  });
}

export function auditWithRunId(runId: string): Observation {
  const handoff = `${HANDOFF_PREFIX}${runId}`;
  return goodAudit({
    finalText: GATE.replaceAll(TEST_RUN_ID, runId),
    repoFiles: Object.fromEntries(
      Object.entries(AUDIT_FILES).map(([path, content]) => [
        path.replaceAll(TEST_RUN_ID, runId),
        content,
      ]),
    ),
    toolCalls: [
      ignoreProbe(handoff),
      {
        name: "Write",
        input: { file_path: `/repo/${handoff}/${SYNTHESIS_FILE}` },
      },
    ],
  });
}

export function testSynthesisFields() {
  const checkAudit = (overrides: Partial<Observation>) =>
    getCase("audit-approval").check(goodAudit(overrides));
  test.each(SYNTHESIS_KEYS)("requires synthesis field %s", (key) => {
    const incomplete = SYNTHESIS.split("\n")
      .filter((line) => !line.startsWith(`${key}:`))
      .join("\n");
    const repoFiles = { ...AUDIT_FILES, [SYNTHESIS_PATH]: incomplete };
    expect(() => checkAudit({ repoFiles })).toThrow();
  });

  test.each([
    ["list-valued version", "version: 1", "version: []"],
    ["unsupported version", "version: 1", "version: 2"],
    ["string-valued version", "version: 1", 'version: "1"'],
    [
      "list-valued from",
      "from:\n  orchestrator: improving-skill-definition\n  phase: audit",
      "from: []",
    ],
    ["missing to.phase", "  phase: approval", ""],
    ["empty to.phase", "  phase: approval", '  phase: " "'],
    ["list-valued to.phase", "  phase: approval", "  phase: []"],
    [
      "empty to.orchestrator",
      "to:\n  orchestrator: improving-skill-definition",
      'to:\n  orchestrator: ""',
    ],
    [
      "list-valued to.orchestrator",
      "to:\n  orchestrator: improving-skill-definition",
      "to:\n  orchestrator: []",
    ],
    [
      "list-valued to",
      "to:\n  orchestrator: improving-skill-definition\n  phase: approval",
      "to: []",
    ],
  ])("rejects synthesis routing with %s", (_label, before, after) => {
    expect(() =>
      getCase("audit-approval").check(
        goodAudit({
          repoFiles: {
            ...AUDIT_FILES,
            [SYNTHESIS_PATH]: SYNTHESIS.replace(before, after),
          },
        }),
      ),
    ).toThrow();
  });
}
