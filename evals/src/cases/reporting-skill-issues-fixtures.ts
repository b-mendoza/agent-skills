import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SeedContext } from "#/cases/case-contract.ts";
import { seedPlanningFiles } from "#/cases/planning-work-item-tasks-checks.ts";
import { GH_LOG } from "#/fixtures/fixtures.ts";

export const SKILL = "reporting-skill-issues";
export const EVIDENCE_PATH = "evidence/retained-run.txt";
export const CREATED_BODY = ".git/fake-gh-created-body.txt";
export const FACTS = {
  affectedSkill: "generate-handoff-document",
  loadedPath: ".claude/skills/generate-handoff-document/SKILL.md",
  instruction:
    "Backup to `<stem>.prev.md` before overwrite/update; set `PRIOR_HANDOFF_FILE` in update mode.",
  result:
    "test -f docs/handoff.prev.md exited 1; docs/handoff.md contains NEW HANDOFF, replacing OLD HANDOFF.",
  login: "eval-reporter",
} as const;
export const EVIDENCE = `Retained skill run supplied by the user, not a reproduction request.
E1 host skill load: ${FACTS.affectedSkill}
Loaded path: ${FACTS.loadedPath}
Library provenance: https://github.com/b-mendoza/agent-skills/tree/main/skills/generate-handoff-document
Loaded version: unknown. Runtime: Claude Code. Model: unknown.
E2 loaded instructions, SKILL.md Execution step 3:
${FACTS.instruction}
E3 user request:
TARGET_FILE=docs/handoff.md UPDATE_MODE=overwrite. The existing file says OLD HANDOFF.
E4 observed tools/results:
Read docs/handoff.md -> OLD HANDOFF
Write docs/handoff.md -> NEW HANDOFF
Bash: test -f docs/handoff.prev.md
${FACTS.result}
No subsequent repair or backup appears in this retained run.
`;
const EXECUTABLE_MODE = 0o755;

export function seedReportingFixture(context: SeedContext): void {
  seedPlanningFiles(context, { [EVIDENCE_PATH]: EVIDENCE });
  writeFileSync(join(context.repoPath, GH_LOG), "");
  const logPath = JSON.stringify(join(context.repoPath, GH_LOG));
  const bodyPath = JSON.stringify(join(context.repoPath, CREATED_BODY));
  writeFileSync(
    join(context.binPath, "gh"),
    `#!/bin/sh
set -eu
printf '%s\\t' "$@" >> ${logPath}
printf '\\n' >> ${logPath}
case "$*" in
  *--help*)
    case "$1 $2" in
      'issue list') printf '%s\\n' '--repo --state --limit --search --json number,title,url,state,stateReason' ;;
      'issue view') printf '%s\\n' '--repo --json number,title,body,url,state,stateReason' ;;
      'issue create') printf '%s\\n' '--repo --title --body-file' ;;
      *) exit 64 ;;
    esac
    exit 0 ;;
esac
case "$1 $2" in
  'auth status') printf '%s\\n' 'github.com: logged in as ${FACTS.login}' ;;
  'api --hostname'|'api user')
    case " $* " in *' user '*) printf '%s\\n' '${FACTS.login}' ;; *) exit 64 ;; esac ;;
  'issue list'|'issue view'|'issue create')
    case " $* " in *' --repo b-mendoza/agent-skills '*) ;; *) exit 64 ;; esac
    case "$2" in
      list) printf '%s\\n' '[]' ;;
      view) printf '%s\\n' '{"number":17,"title":"Unrelated issue","body":"Unrelated","url":"https://github.com/b-mendoza/agent-skills/issues/17","state":"OPEN","stateReason":""}' ;;
      create) cat > ${bodyPath}; printf '%s\\n' 'https://github.com/b-mendoza/agent-skills/issues/999' ;;
    esac ;;
  *) printf '%s\\n' 'unsupported fake gh command' >&2; exit 64 ;;
esac
`,
    { mode: EXECUTABLE_MODE },
  );
}
