import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SeedContext } from "#/cases/case-contract.ts";
import { GH_LOG, HEAD_LOG, writeRepoFiles } from "#/fixtures/fixtures.ts";

export const EXECUTION_FACTS = {
  key: "acme-app-42",
  issueUrl: "https://github.com/acme/app/issues/42",
  task: "1",
  title: "Correct greeting spelling",
  branch: "task/acme-app-42-1-greeting",
  sourcePath: "a.txt",
  sourceContent: "hello\n",
  logPath: GH_LOG,
  headPath: HEAD_LOG,
} as const;

const taskPrefix = `docs/${EXECUTION_FACTS.key}-task-1`;
export const DECISIONS_PATH = `${taskPrefix}-decisions.md`;
export const CRITIQUE_PATH = `${taskPrefix}-critique.md`;

export const EXECUTION_ARTIFACTS: Readonly<Record<string, string>> = {
  [`docs/${EXECUTION_FACTS.key}.md`]: `# acme/app#42: Correct greeting spelling
## Metadata
- URL: ${EXECUTION_FACTS.issueUrl}
- State: OPEN
## Description
Correct the greeting in a.txt from hello to Hello.
## Acceptance Criteria
- a.txt contains exactly Hello followed by a newline.
## Comments
_None_
## Retrieval Warnings
_None_
## Child Issues
- acme/app#101: Correct greeting spelling
## Linked Issues
_None_
## Labels
_None_
## Assignees
_None_
## Milestone
_None_
## Projects
_None_
## Attachments
_None_
`,
  [`docs/${EXECUTION_FACTS.key}-tasks.md`]: `# Task Plan
## Issue Summary
Correct one greeting in a.txt. Parent: ${EXECUTION_FACTS.issueUrl}
## Tasks
## Task 1: ${EXECUTION_FACTS.title}
**Status:** Pending
**Branch name:** ${EXECUTION_FACTS.branch}
**Dependencies:** None
GitHub Task Issue: acme/app#101
**Definition of Done:** a.txt contains exactly Hello followed by a newline.
## GitHub Task Issues
| Task | GitHub Task Issue | Status |
| --- | --- | --- |
| 1 | acme/app#101 | Pending |
## Execution Order Summary
| Order | Task | Branch name | Dependencies |
| --- | --- | --- | --- |
| 1 | 1 | ${EXECUTION_FACTS.branch} | None |
## Tracker Policy
No startup or completion tracker mutations are requested. All tracker actions are optional.
`,
  [`${taskPrefix}-brief.md`]: `# Task 1 Execution Brief
## Scope
Change only a.txt from hello to Hello. Do not add files, dependencies, or tests frameworks.
## Definition of Done
- a.txt contains exactly Hello followed by a newline.
- Verify with a direct text comparison.
## Constraints
No commits, staging, or tracker writes. Task 1 only.
`,
  [`${taskPrefix}-execution-plan.md`]: `# Task 1 Execution Plan
## Approach
Replace hello with Hello in a.txt, preserving its newline.
## Branch
${EXECUTION_FACTS.branch}
## Validation
Compare the file contents with the expected literal.
`,
  [`${taskPrefix}-test-spec.md`]: `# Task 1 Test Specification
## Required Behavior
a.txt equals Hello followed by a newline.
## Verification
Read a.txt and compare with the expected literal. No test framework is needed.
`,
  [`${taskPrefix}-refactoring-plan.md`]: `# Task 1 Refactoring Plan
## Verdict
No refactoring needed. Change only a.txt.
`,
  [CRITIQUE_PATH]: `CRITIQUE: PASS
Ticket: ${EXECUTION_FACTS.key} | Mode: critique | Task: 1
Artifact: ${CRITIQUE_PATH}
## Critique Report
### Artifacts Reviewed
- docs/${EXECUTION_FACTS.key}-tasks.md
- ${taskPrefix}-brief.md
- ${taskPrefix}-execution-plan.md
- ${taskPrefix}-test-spec.md
- ${taskPrefix}-refactoring-plan.md
### Codebase Verification
Plain text fixture. a.txt contains hello followed by a newline. No build or test framework.
### Technology Critique Items
None: no technology change is planned.
### User Impact Critique Items
None: the task changes only greeting capitalization.
### Items Not Raised
No unresolved questions. No refactoring is needed.
### Summary
- Problem-framing items: 0
- Technology critique items: 0
- User-impact items: 0
Execution still needs explicit user approval.
`,
  [DECISIONS_PATH]: `## Per-Task Decisions — Task 1: ${EXECUTION_FACTS.title}

> TICKET_KEY: ${EXECUTION_FACTS.key} Mode: critique Iteration: 1

### Decisions
| # | Item ID | Category | Outcome | Answer | Rationale |
| --- | --- | --- | --- | --- | --- |
| 1 | A1 | assumption | confirmed | Change only a.txt; no tracker writes | No other changes are required |

### Questions Marked Irrelevant
_None_

### Implementation Updates Required
_None_

### Execution Approval
PENDING: the developer has not approved real execution after critique.
`,
};

/** The readiness cases need reads only; every unsupported command fails closed. */
export function seedFakeGithub({ repoPath, binPath }: SeedContext): void {
  writeFileSync(join(repoPath, EXECUTION_FACTS.logPath), "");
  const issue = {
    number: 42,
    title: EXECUTION_FACTS.title,
    state: "OPEN",
    url: EXECUTION_FACTS.issueUrl,
    body: "Correct hello to Hello in a.txt.",
    labels: [],
    assignees: [],
    comments: [],
    updatedAt: "2026-01-01T00:00:00Z",
  };
  writeFileSync(
    join(binPath, "gh"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(join(repoPath, EXECUTION_FACTS.logPath))}, args.join(' ') + '\\n');
if (args.length === 1 && args[0] === '--version') {
  console.log('gh version 2.0.0 (fixture)');
} else if (args.join(' ') === 'auth status') {
  console.log('Logged in to github.com as fixture');
} else if (args[0] === 'issue' && args[1] === 'view') {
  console.log(JSON.stringify(${JSON.stringify(issue)}));
} else {
  console.error('Unsupported fixture gh command; no remote operation performed');
  process.exitCode = 1;
}
`,
    { mode: 0o755 },
  );
}

/** The execution artifacts minus `omittedPaths`, for fixtures planting a partial workflow. */
export function artifactsWithout(
  ...omittedPaths: readonly string[]
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(EXECUTION_ARTIFACTS).filter(
      ([path]) => !omittedPaths.includes(path),
    ),
  );
}

export function seedExecutionArtifacts(
  seedContext: SeedContext,
  artifacts: Readonly<Record<string, string>> = EXECUTION_ARTIFACTS,
): void {
  const { repoPath } = seedContext;
  writeRepoFiles(repoPath, artifacts);
  // Expose individual untracked artifacts instead of the collapsed docs/ entry.
  execFileSync("git", ["config", "status.showUntrackedFiles", "all"], {
    cwd: repoPath,
  });
  seedFakeGithub(seedContext);
}
