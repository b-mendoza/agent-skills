import { expect, test } from "vitest";

import { FIXTURE_ROOT_PATH } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

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

interface ArtifactWriteMatrix {
  /** Names the checker in the registered test titles. */
  readonly label: string;
  /** Fixture-relative path of the artifact the checker allows. */
  readonly artifact: string;
  readonly check: (observation: Observation) => unknown;
  /** A fresh passing observation that captured the lexical and canonical fixture roots. */
  readonly valid: () => Observation;
  /** Other allowed artifacts, accepted under every root spelling. */
  readonly extraArtifacts?: readonly string[];
  /** Checker-specific rejected paths, passed through unchanged. */
  readonly extraRejected?: readonly string[];
}

function fixtureRoots(observation: Observation): string[] {
  const roots = observation.repoFiles?.[FIXTURE_ROOT_PATH];
  if (typeof roots !== "string") {
    throw new TypeError(`valid observation lacks ${FIXTURE_ROOT_PATH}`);
  }
  return roots.split("\n");
}

function isWriteOrEdit(call: ToolCall): boolean {
  return call.name === "Write" || call.name === "Edit";
}

/**
 * Registers the foreign-root and root-spelling write rows for one checker, so
 * every allowlist proves it resolves paths against the captured fixture roots.
 */
export function testArtifactWriteMatrix(matrix: ArtifactWriteMatrix): void {
  const [lexicalRoot = ""] = fixtureRoots(matrix.valid());
  const rejected = ["/outside", "../outside", `${lexicalRoot}-other`]
    .map((root) => `${root}/${matrix.artifact}`)
    .concat(matrix.extraRejected ?? []);
  const prefixes = [
    "",
    ...fixtureRoots(matrix.valid()).map((root) => `${root}/`),
  ];
  const accepted = [matrix.artifact, ...(matrix.extraArtifacts ?? [])].flatMap(
    (artifact) => prefixes.map((prefix) => `${prefix}${artifact}`),
  );

  test.each(rejected)(
    `${matrix.label} rejects foreign-root same-suffix write %s`,
    (path) => {
      const valid = matrix.valid();
      const foreignEdit = { name: "Edit", input: { file_path: path } };
      expect(() =>
        matrix.check({
          ...valid,
          toolCalls: [...valid.toolCalls, foreignEdit],
        }),
      ).toThrow();
    },
  );

  test.each(accepted)(`${matrix.label} accepts fixture artifact %s`, (path) => {
    const valid = matrix.valid();
    const write = { name: "Write", input: { file_path: path } };
    expect(() =>
      matrix.check({
        ...valid,
        toolCalls: [
          ...valid.toolCalls.filter((call) => !isWriteOrEdit(call)),
          write,
        ],
      }),
    ).not.toThrow();
  });
}
