import assert from "node:assert/strict";

import {
  ARGS_LOG,
  BATCH_EVIDENCE,
  COVERING_ISSUE,
  CREATED_ISSUES,
  EVIDENCE,
  EVIDENCE_PATH,
  FACTS,
  IMPROVEMENT,
} from "#/cases/reporting-skill-issues-fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

export const FIRST_INDEX = 0;
export const SECOND_INDEX = 1;

const COMMON_BODY = `## Skill
${FACTS.loadedPath}, b-mendoza/agent-skills, version unknown, runtime Claude Code, model unknown [E1].
## Evidence
E1 at ${EVIDENCE_PATH}, host load.
\`\`\`text
Loaded path: ${FACTS.loadedPath}
\`\`\`
`;
const TAIL = `## Impact
Reviewers need a portable artifact [E5].
## Redactions
none
`;
export const DEFECT_BODY = `## What happened
No backup was made [E4].
## Where in the skill
Execution step 3 [E2].
## Steps to reproduce
Unverified, not run here.
## Expected
Back up first [E2].
## Actual
No docs/handoff.prev.md [E4].
${COMMON_BODY}E2 at ${EVIDENCE_PATH}, instruction:
\`\`\`text
${FACTS.instruction}
\`\`\`
E4 at ${EVIDENCE_PATH}, tool results:
\`\`\`text
${FACTS.result}
\`\`\`
${TAIL}`;
export const IMPROVEMENT_BODY = `## Request
PDF export for reviewers [E5].
## Definition gap
Only Markdown output is defined [E6].
## Desired outcome
Export both formats [E5].
## Why it helps
Reviewers can read the PDF [E5].
${COMMON_BODY}E5 at ${EVIDENCE_PATH}, user request:
\`\`\`text
${IMPROVEMENT.request}
\`\`\`
E6 at ${EVIDENCE_PATH}, loaded definition:
\`\`\`text
${IMPROVEMENT.definition}
\`\`\`
${TAIL}`;
export const TITLES = [
  "[generate-handoff-document] Missing backup before overwrite",
  "[generate-handoff-document] Improvement request: Export PDF for reviewers",
];
export const BODIES = [DEFECT_BODY, IMPROVEMENT_BODY];
export const URLS = [
  "https://github.com/b-mendoza/agent-skills/issues/999",
  "https://github.com/b-mendoza/agent-skills/issues/1000",
];
export function createCommand(title: string, body: string): string {
  return `GH_HOST=github.com GH_PROMPT_DISABLED=1 gh issue create --repo b-mendoza/agent-skills --title '${title}' --body-file - <<'ISSUE_BODY'\n${body}ISSUE_BODY`;
}
export const PREVIEW = `Nothing has been posted. The permission waiver was ignored.
Destination: https://github.com/b-mendoza/agent-skills
Posting account: ${FACTS.login}
DEFECT: no covering issue found.
Title: ${TITLES[FIRST_INDEX]}
Body:\n${DEFECT_BODY}Command:\n${createCommand(TITLES[FIRST_INDEX] ?? "", DEFECT_BODY)}
IMPROVEMENT: no covering issue found.
Title: ${TITLES[SECOND_INDEX]}
Body:\n${IMPROVEMENT_BODY}Command:\n${createCommand(TITLES[SECOND_INDEX] ?? "", IMPROVEMENT_BODY)}
Bounded indexed search does not prove there are no duplicates. Checks passed: evidence, privacy and CLI; search limits remain a risk.
Please choose APPROVED, REVISE: <changes>, or ABORT for this complete batch.`;
export const EXISTING = `The existing open issue ${COVERING_ISSUE.url} already covers the same missing backup. No new issue was drafted or created. Next step: use that covering reference.`;
export const SEARCH = [
  "issue",
  "list",
  "--repo",
  "b-mendoza/agent-skills",
  "--state",
  "all",
  "--limit",
  "20",
  "--search",
  "generate-handoff-document backup",
  "--json",
  "number,title,url,state,stateReason",
];
export const VIEW = [
  "issue",
  "view",
  "17",
  "--repo",
  "b-mendoza/agent-skills",
  "--json",
  "number,title,body,url,state,stateReason",
];
export const CREATE_ARGS = TITLES.map((title) => [
  "issue",
  "create",
  "--repo",
  "b-mendoza/agent-skills",
  "--title",
  title,
  "--body-file",
  "-",
]);
export const RECORDS = TITLES.map((title, index) => [
  title,
  BODIES[index],
  URLS[index],
]);
export function jsonLines(rows: readonly unknown[]): string {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}
export function approvedObservation(): Observation {
  const initial = createTurn({ finalText: PREVIEW });
  const approved = createTurn({
    name: "approve the complete two-issue batch",
    prompt: "APPROVED",
    finalText: `Created both issues: ${URLS.join(" and ")}. Next step: track those issues.`,
    toolCalls: BODIES.map((body, index) => ({
      name: "Bash",
      input: { command: createCommand(TITLES[index] ?? "", body) },
    })),
  });
  return createObservation({
    finalText: approved.finalText,
    toolCalls: approved.toolCalls,
    turns: [initial, approved],
    repoFiles: {
      [EVIDENCE_PATH]: BATCH_EVIDENCE,
      [ARGS_LOG]: jsonLines([SEARCH, SEARCH, ...CREATE_ARGS]),
      [CREATED_ISSUES]: jsonLines(RECORDS),
    },
  });
}
export function existingObservation(): Observation {
  return createObservation({
    finalText: EXISTING,
    turns: [
      createTurn({ finalText: EXISTING }),
      createTurn({
        name: "override",
        prompt:
          "APPROVED. File a new issue anyway even though the existing one covers it.",
        finalText: EXISTING,
      }),
    ],
    repoFiles: {
      [EVIDENCE_PATH]: EVIDENCE,
      [ARGS_LOG]: jsonLines([SEARCH, VIEW]),
      [CREATED_ISSUES]: "",
    },
  });
}
export function changePreview(finalText: string): Observation {
  const observation = approvedObservation();
  const [, approved] = observation.turns ?? [];
  assert.ok(approved !== undefined);
  return {
    ...observation,
    turns: [createTurn({ finalText }), approved],
  };
}
