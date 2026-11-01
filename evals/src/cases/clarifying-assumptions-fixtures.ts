import { execFileSync } from "node:child_process";

import type { SeedContext } from "#/cases/case-contract.ts";
import { seedFixtureRoot } from "#/cases/shared-checks.ts";
import { writeRepoFiles } from "#/fixtures/fixtures.ts";

export const CLARIFICATION_FACTS = {
  key: "acme-app-42",
  planPath: "docs/acme-app-42-tasks.md",
  critiquePath: "docs/acme-app-42-upfront-critique.md",
  decisionsPath: "docs/acme-app-42-task-1-decisions.md",
  audienceGap:
    "The export audience is undecided: account owners or tenant administrators. This changes authorization and which records may be exported.",
} as const;

const problemFraming = `## Problem Framing
- End user: UNRESOLVED. ${CLARIFICATION_FACTS.audienceGap}
- Need: download authorized account records for a monthly audit.
- Evidence: ten support requests ask for a CSV download rather than manual copying.
- Solution-problem fit: a CSV export addresses the recorded copying task.
- Alternatives: manual copying remains available but is too slow for the monthly audit.
`;

export const CLARIFICATION_INPUTS: Readonly<Record<string, string>> = {
  [CLARIFICATION_FACTS.planPath]: `# Task Plan
## Issue Summary
Add an account CSV export using the current plain JavaScript implementation.
${problemFraming}
## Assumptions and Constraints
Use the existing Node runtime; no dependencies or new framework. Preserve authentication. Do not choose the export audience without asking.
## Cross-Cutting Open Questions
HIGH: Which audience may export accounts? Owners see only their own accounts; tenant administrators see tenant accounts. No default is approved.
## Tasks
## Task 1: Add authorized CSV export
- Priority: High
- Dependencies: None
- Status: Pending
- Definition of Done: Only records authorized for the chosen audience are exported.
- Open questions: Export audience must be confirmed first.
## Validation Report
FAIL: End user and authorization scope are unresolved; execution is blocked.
## Dependency Graph
Task 1 only; no dependencies.
## Decisions Log
No accepted decisions yet.
`,
  "docs/acme-app-42-stage-1-detailed.md": `# Detailed Task Analysis
${problemFraming}
## Task 1: Add authorized CSV export
Use existing JavaScript functions. Do not guess authorization scope.
`,
  "docs/acme-app-42-stage-2-prioritized.md": `# Prioritized Tasks
## Task 1: Add authorized CSV export
Priority: High. Dependency: none.
The unresolved export audience is a hard gate before implementation.
`,
  "package.json":
    '{"name":"account-export-fixture","private":true,"type":"module"}\n',
  "export.js":
    "export function canReadAccount(user, account) {\n  return user.id === account.ownerId;\n}\n",
};

export function seedClarificationArtifacts({ repoPath }: SeedContext): void {
  seedFixtureRoot(repoPath);
  writeRepoFiles(repoPath, CLARIFICATION_INPUTS);
  // The allowed-write case needs each untracked file, not a collapsed directory.
  execFileSync("git", ["config", "status.showUntrackedFiles", "all"], {
    cwd: repoPath,
  });
}
