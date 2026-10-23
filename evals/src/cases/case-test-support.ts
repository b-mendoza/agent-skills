// Shared synthetic fixtures for the case-assertion test files. Not a test
// file itself: it holds the observation builder and canonical
// snapshot texts that both `cases.test.ts` and `cases-behavioral.test.ts` pin
// against.

import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

export function observe(
  overrides: Readonly<Partial<Observation>> = {},
): Observation {
  return createObservation({ costUsd: 0.01, durationMs: 1000, ...overrides });
}

/** Behavioral runs must show the deterministic validator in the tool stream. */
export const VALIDATOR_CALL = {
  name: "Bash",
  input: {
    command:
      "sh .claude/skills/analyzing-recent-project-state/scripts/validate-output.sh draft <<'EOF'\n...\nEOF",
  },
} as const satisfies ToolCall;

// Canonical names matter; heading order and numbering are presentation.
export const QUIET_STATE_SNAPSHOT = `# Project State Snapshot
## Executive Summary
No recent changes.
## Git State
Clean tree, empty window.
Assumptions: none
Execution mode: isolated
## Final Developer Briefing
Nothing to hand off.
## Ranked Next Actions
- nice-to-have: Continue development.`;

export const FULL_REPORT_SNAPSHOT = `# Project State Snapshot
## 1. Executive Summary
## 2. Git State
Assumptions: none
Execution mode: isolated
## 3. Change Themes
## 4. Behavioral Impact
## 5. Risks
## 6. Test And Validation Review
## 7. Dependency, Config, Tooling, And Security Notes
## 8. Questions Before Merging
## 9. Ranked Next Actions
## 10. Final Developer Briefing`;
