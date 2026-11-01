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
  taskProgressPath: `docs/${EXECUTION_FACTS.key}-task-1-progress.md`,
} as const;

export const RESUME_ARTIFACTS: Readonly<Record<string, string>> = {
  ...artifactsWithout(CRITIQUE_PATH, DECISIONS_PATH),
  [RESUME_FACTS.progressPath]: `# ${RESUME_FACTS.key} — Workflow Progress
| Phase | Skill | Status | Completed at | Notes |
| --- | --- | --- | --- | --- |
| 1 | fetching-work-item | ✅ Complete | 2026-01-01 00:00 UTC | Fetched |
| 2 | planning-work-item-tasks | ✅ Complete | 2026-01-01 00:01 UTC | Planned |
| 3 | clarifying-assumptions | ✅ Complete | 2026-01-01 00:02 UTC | Approved |
| 4 | creating-work-item-children | ✅ Complete | 2026-01-01 00:03 UTC | acme/app#101 |
## Task Execution (Phases 5–7)
| Task | Title | Dependencies | Priority | Current Phase | Status | Detail |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ${EXECUTION_FACTS.title} | None | High | 5/7 Plan | ✅ Complete | docs/${RESUME_FACTS.key}-task-1-progress.md |
## Execution Log
2026-01-01 00:04 UTC — Task 1 Phase 5 complete. Awaiting critique.
`,
  [RESUME_FACTS.taskProgressPath]: `# ${RESUME_FACTS.key} — Task 1: ${EXECUTION_FACTS.title} — Progress
| Phase | Skill | Status | Completed at | Notes |
| --- | --- | --- | --- | --- |
| 5 | planning-task-execution | ✅ Complete | 2026-01-01 00:04 UTC | Four planning artifacts validated |
| 6 | clarifying-assumptions | ⬜ Pending | — | Not started |
| 7 | executing-work-item-task | ⬜ Pending | — | Not started |
## Re-plan History
_None_
## Activity Log
2026-01-01 00:04 UTC — Phase 5: complete — Plan ready for critique.
`,
};

export function seedResumeArtifacts(seedContext: SeedContext): void {
  seedExecutionArtifacts(seedContext, RESUME_ARTIFACTS);
}
