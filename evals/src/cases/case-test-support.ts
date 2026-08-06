// Shared synthetic fixtures for the case-assertion test files. Not a test
// file itself: it holds the observation builder, case lookup, and canonical
// snapshot texts that both `cases.test.ts` and `cases-behavioral.test.ts` pin
// against.

import type {
  CaseId,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import { cases } from "#/cases/analyzing-recent-project-state.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import type { Observation, ToolCall } from "#/observation/observation-types.ts";

export function observe(
  overrides: Readonly<Partial<Observation>> = {},
): Observation {
  return createObservation({ costUsd: 0.01, durationMs: 1000, ...overrides });
}

export function caseById(caseId: CaseId): EvalCase {
  const matchingCase = cases.find((evalCase) => evalCase.id === caseId);
  if (matchingCase == null) throw new Error(`no such case: ${caseId}`);
  return matchingCase;
}

/** Behavioral runs must show the deterministic validator in the tool stream. */
export const VALIDATOR_CALL = {
  name: "Bash",
  input: {
    command:
      "sh .claude/skills/analyzing-recent-project-state/scripts/validate-output.sh draft <<'EOF'\n...\nEOF",
  },
} as const satisfies ToolCall;

export const QUIET_STATE_SNAPSHOT = `# Project State Snapshot

## 1. Executive Summary

No recent changes were found in the defined evidence window.

## 2. Git State

The working tree is clean and the evidence window contains no recent changes.

Assumptions: none
Execution mode: isolated

## 9. Ranked Next Actions

- nice-to-have: Continue normal development when new work is available.

## 10. Final Developer Briefing

There are no recent changes to review or hand off.`;

// Unnumbered, reordered headings on purpose: canonical names are the contract,
// order and numbering are presentation.
export const UNNUMBERED_QUIET_STATE_SNAPSHOT = `# Project State Snapshot

## Executive Summary

No recent changes were found in the defined evidence window.

## Git State

Clean tree, empty window.

Assumptions: none
Execution mode: isolated

## Final Developer Briefing

Nothing to hand off.

## Ranked Next Actions

- nice-to-have: Continue normal development.`;

export const FULL_REPORT_SNAPSHOT = `# Project State Snapshot

## 1. Executive Summary

Two commits and local edits touch a.txt, b.txt, and c.txt.

## 2. Git State

Branch main; base none; 2 commits in window.

Assumptions: none
Execution mode: isolated

## 3. Change Themes

New file b.txt added (commit "add b.txt").

## 4. Behavioral Impact

confirmed: none; likely: none; possible: none; unverified: none.

## 5. Risks

No blockers identified from local evidence.

## 6. Test And Validation Review

No test changes observed; no commands were run.

## 7. Dependency, Config, Tooling, And Security Notes

No dependency or config changes in window.

## 8. Questions Before Merging

None.

## 9. Ranked Next Actions

- should-do: review the uncommitted a.txt edit.

## 10. Final Developer Briefing

Safe to continue after reviewing the working-tree edit.`;
