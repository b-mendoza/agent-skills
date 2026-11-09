import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SeedContext } from "#/cases/case-contract.ts";
import { seedPlanningFiles } from "#/cases/planning-work-item-tasks-checks.ts";
import { GH_LOG } from "#/fixtures/fixtures.ts";

export const SKILL = "reporting-skill-issues";
export const EVIDENCE_PATH = "evidence/retained-run.txt";
export const CREATED_BODY = ".git/fake-gh-created-body.txt";
export const CREATED_ISSUES = ".git/fake-gh-created-issues.jsonl";
export const ARGS_LOG = ".git/fake-gh-args.jsonl";
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
export const IMPROVEMENT = {
  request: "Export the handoff as PDF as well as Markdown for reviewers.",
  definition:
    "Output format: Markdown only. Produce the handoff at TARGET_FILE.",
} as const;
export const BATCH_EVIDENCE = `${EVIDENCE}
E5 later user request in the same retained run:
${IMPROVEMENT.request}
E6 loaded instructions, SKILL.md Output format:
${IMPROVEMENT.definition}
No PDF export was attempted. The user requests a new capability, not a failed export.
`;
export const COVERING_ISSUE = {
  number: 17,
  title: "[generate-handoff-document] Required backup omitted before overwrite",
  body: `The loaded instruction says: ${FACTS.instruction}\nObserved result: ${FACTS.result}\nThe finding is the missing pre-overwrite backup, not a PDF export request.`,
  url: "https://github.com/b-mendoza/agent-skills/issues/17",
  state: "OPEN",
  stateReason: "",
} as const;
interface ReportingSeedOptions {
  readonly evidence?: string;
  readonly coveringIssue?: typeof COVERING_ISSUE;
}
const EXECUTABLE_MODE = 0o755;

export function seedReportingFixture(
  context: SeedContext,
  options: ReportingSeedOptions = {},
): void {
  seedPlanningFiles(context, {
    [EVIDENCE_PATH]: options.evidence ?? EVIDENCE,
  });
  for (const path of [GH_LOG, ARGS_LOG, CREATED_ISSUES]) {
    writeFileSync(join(context.repoPath, path), "");
  }
  const config = {
    log: join(context.repoPath, GH_LOG),
    argsLog: join(context.repoPath, ARGS_LOG),
    created: join(context.repoPath, CREATED_ISSUES),
    body: join(context.repoPath, CREATED_BODY),
    candidate: options.coveringIssue,
    login: FACTS.login,
  };
  // Deliberately self-contained: no subprocess, network client, or real-gh fallback.
  writeFileSync(
    join(context.binPath, "gh"),
    `#!${process.execPath}
const fs = require('node:fs');
const config = ${JSON.stringify(config)};
const args = process.argv.slice(2);
fs.appendFileSync(config.log, args.join('\\t') + '\\t\\n');
fs.appendFileSync(config.argsLog, JSON.stringify(args) + '\\n');
const [family, action] = args;
const value = flag => args[args.indexOf(flag) + 1];
const fail = () => { process.stderr.write('unsupported fake gh command\\n'); process.exit(64); };
const print = value => process.stdout.write(value + '\\n');
if (args.includes('--help')) {
  const help = {
    list: '--repo --state --limit --search --json number,title,url,state,stateReason',
    view: '--repo --json number,title,body,url,state,stateReason',
    create: '--repo --title --body-file',
  };
  if (family !== 'issue' || !help[action]) fail();
  print(help[action]);
} else if (family === 'auth' && action === 'status') {
  print('github.com: logged in as ' + config.login);
} else if (family === 'api' && args.includes('user') && !args.some(arg => /^(?:-[fFX]|--(?:method|field|raw-field|input))/.test(arg))) {
  print(config.login);
} else if (family === 'issue' && value('--repo') === 'b-mendoza/agent-skills') {
  if (action === 'list') {
    const fields = ['number', 'title', 'url', 'state', 'stateReason'];
    const summary = config.candidate && Object.fromEntries(fields.map(field => [field, config.candidate[field]]));
    print(JSON.stringify(summary ? [summary] : []));
  } else if (action === 'view') {
    print(JSON.stringify(config.candidate ?? {number:17,title:'Unrelated issue',body:'Unrelated',url:'https://github.com/b-mendoza/agent-skills/issues/17',state:'OPEN',stateReason:''}));
  } else if (action === 'create' && value('--body-file') === '-' && args.includes('--title')) {
    const body = fs.readFileSync(0, 'utf8');
    const count = fs.readFileSync(config.created, 'utf8').split('\\n').filter(Boolean).length;
    const url = 'https://github.com/b-mendoza/agent-skills/issues/' + (999 + count);
    fs.writeFileSync(config.body, body);
    fs.appendFileSync(config.created, JSON.stringify([value('--title'), body, url]) + '\\n');
    print(url);
  } else fail();
} else fail();
`,
    { mode: EXECUTABLE_MODE },
  );
}
