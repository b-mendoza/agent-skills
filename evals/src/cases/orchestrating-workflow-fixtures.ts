import type { SeedContext } from "#/cases/case-contract.ts";
import {
  artifactsWithout,
  CRITIQUE_PATH,
  DECISIONS_PATH,
  EXECUTION_FACTS,
  seedExecutionArtifacts,
} from "#/cases/executing-work-item-task-fixtures.ts";

export const RESUME_FACTS = {
  key: EXECUTION_FACTS.key,
  phase: 6,
  task: 1,
  progressPath: `docs/${EXECUTION_FACTS.key}-progress.md`,
} as const;

export const RESUME_ARTIFACTS: Readonly<Record<string, string>> = {
  ...artifactsWithout(CRITIQUE_PATH, DECISIONS_PATH),
  [RESUME_FACTS.progressPath]: `# ${RESUME_FACTS.key} — Workflow Progress

| Phase | Name | Status | Completed at | Notes |
| --- | --- | --- | --- | --- |
| 1 | Fetch work item | ✅ Complete | 2026-01-01 00:00 UTC | Fetched |
| 2 | Plan tasks | ✅ Complete | 2026-01-01 00:01 UTC | Planned |
| 3 | Clarify and critique | ✅ Complete | 2026-01-01 00:02 UTC | Approved |
| 4 | Create child items | ✅ Complete | 2026-01-01 00:03 UTC | acme/app#101 |

## Task Execution (Phases 5–7)

| Task | Title | Dependencies | Priority | Child item | Current Phase | Status | Outcome | Execution mode | Human owner | Branch name |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ${EXECUTION_FACTS.title} | None | High | acme/app#101 | 6/7 Critique | 🔄 Active | — | code | Not specified | ${EXECUTION_FACTS.branch} |

## Execution Log
2026-01-01 00:04 UTC — Task 1 Phase 5: complete — Plan ready for critique.
`,
};

export function seedResumeArtifacts(seedContext: SeedContext): void {
  seedExecutionArtifacts(seedContext, RESUME_ARTIFACTS);
}
