# Analyzing Recent Project State

This flow diagram was generated with the `generate-flow-diagram` skill in `new` mode and describes the workflow boundary of `skills/analyzing-recent-project-state/` as written. The workflow is read-only: it may inspect local Git state and narrow repository context, then produce a verified Markdown snapshot or a `RECENT_STATE` escalation; it does not stage, commit, merge, deploy, reset, push, format, fetch remote state, or bypass CI.

```mermaid
flowchart TD
  START([Start: recent project state analysis]) --> P1[Phase 1/5: Intake banner]
  P1 --> POSTURE[Load personality posture]
  POSTURE --> INPUTS[Normalize PROJECT_PATH, BASE_BRANCH, REVIEW_FOCUS, OUTPUT_DEPTH]
  INPUTS --> PATH{PROJECT_PATH available?}
  PATH -->|provided| BASE{Material BASE_BRANCH ambiguity?}
  PATH -->|missing and active workspace clear| WORKSPACE[Use active workspace and record assumption]
  PATH -->|missing or unclear| NEED_PATH([RECENT_STATE: NEEDS_CONTEXT])
  WORKSPACE --> BASE
  BASE -->|yes| ASK_BASE[Ask one targeted base-branch question]
  ASK_BASE --> NEED_BASE([RECENT_STATE: NEEDS_CONTEXT])
  BASE -->|no| DEFAULTS[Apply defaults: REVIEW_FOCUS full; OUTPUT_DEPTH standard]
  DEFAULTS --> MUTATION{User asks for mutation?}
  MUTATION -->|yes| CARRY[Keep run read-only; carry ask into risks or next actions]
  MUTATION -->|no| P2
  CARRY --> P2[Phase 2/5: Git evidence banner]

  P2 --> DISPATCH_COLLECT[Dispatch git-evidence-collector]
  DISPATCH_COLLECT --> COLLECT[Read-only Git pass: status, log, diff, show, refs, merge-base]
  COLLECT --> HANDOFF[Format compact GIT_EVIDENCE handoff]
  HANDOFF --> GIT_STATUS{GIT_EVIDENCE status}
  GIT_STATUS -->|PASS| EVIDENCE[Retain compact evidence only]
  GIT_STATUS -->|NOT_GIT| NOT_GIT([RECENT_STATE: NOT_GIT])
  GIT_STATUS -->|PATH_ERROR| PATH_ERROR([RECENT_STATE: PATH_ERROR])
  GIT_STATUS -->|NEEDS_CONTEXT| GIT_NEEDS([RECENT_STATE: NEEDS_CONTEXT])
  GIT_STATUS -->|ERROR| GIT_ERROR([RECENT_STATE: ERROR])

  EVIDENCE --> P3[Phase 3/5: Snapshot writing banner]
  P3 --> DISPATCH_WRITE[Dispatch state-snapshot-writer]
  DISPATCH_WRITE --> NARROW[Inspect changed files and nearby context only as needed]
  NARROW --> SOURCE_Q{Concrete need for static public guidance?}
  SOURCE_Q -->|yes| FETCH[Use external-sources index; fetch smallest relevant URL]
  SOURCE_Q -->|no| DRAFT
  FETCH --> DRAFT[Draft report from evidence, context, and labeled inference]
  DRAFT --> TEMPLATE[Assemble with project-state snapshot template]
  TEMPLATE --> WRITE_STATUS{SNAPSHOT_WRITE status}
  WRITE_STATUS -->|PASS| CANDIDATE[Retain candidate report body]
  WRITE_STATUS -->|NEEDS_CONTEXT| WRITE_NEEDS([RECENT_STATE: NEEDS_CONTEXT])
  WRITE_STATUS -->|ERROR| WRITE_ERROR([RECENT_STATE: ERROR])

  CANDIDATE --> P4[Phase 4/5: Verification banner]
  P4 --> DISPATCH_VERIFY[Dispatch snapshot-verifier]
  DISPATCH_VERIFY --> CHECKLIST[Apply snapshot verification checklist]
  CHECKLIST --> VERIFY_STATUS{SNAPSHOT_VERIFY status}
  VERIFY_STATUS -->|PASS| P5[Phase 5/5: Final response banner]
  VERIFY_STATUS -->|FAIL and repair cycles under 2| FIXES[Return targeted required fixes]
  VERIFY_STATUS -->|FAIL after second repair| REPAIR_ERROR([RECENT_STATE: ERROR])
  VERIFY_STATUS -->|NEEDS_CONTEXT| VERIFY_NEEDS([RECENT_STATE: NEEDS_CONTEXT])
  VERIFY_STATUS -->|ERROR| VERIFY_ERROR([RECENT_STATE: ERROR])

  FIXES --> REPAIR_BANNER[Reprint Phase 3/5: Snapshot writing]
  REPAIR_BANNER --> REPAIR_WRITE[Redispatch writer with TARGETED_FIXES and original evidence]
  REPAIR_WRITE --> REVERIFY_BANNER[Reprint Phase 4/5: Verification]
  REVERIFY_BANNER --> DISPATCH_VERIFY

  P5 --> STRIP[Strip subagent status wrappers]
  STRIP --> REPORT[Return verified Markdown report body]
  REPORT --> DONE([Complete])

  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class PATH,BASE,MUTATION,GIT_STATUS,SOURCE_Q,WRITE_STATUS,VERIFY_STATUS decision;
  class COLLECT,HANDOFF,NARROW,CHECKLIST check;
  class EVIDENCE,CANDIDATE,REPORT output;
  class FIXES,REPAIR_BANNER,REPAIR_WRITE,REVERIFY_BANNER refine;
  class DONE success;
  class NEED_PATH,NEED_BASE,NOT_GIT,PATH_ERROR,GIT_NEEDS,GIT_ERROR,WRITE_NEEDS,WRITE_ERROR,REPAIR_ERROR,VERIFY_NEEDS,VERIFY_ERROR stop;
```

```text
RECENT_STATE: <NOT_GIT | PATH_ERROR | NEEDS_CONTEXT | ERROR>
Reason: <one line>
Next step: <one clear action>
```

Readiness rule: the workflow is complete only when it returns a verified `# Project State Snapshot` report body with unsupported claims removed or labeled, or a documented `RECENT_STATE` escalation with the smallest recovery action.

## Run Report

- Run mode and scope: `new`, whole target skill workflow.
- Assumptions: `DOCS_DIR=docs/`; target skill slug is `analyzing-recent-project-state`; existing target `flow-diagram.md` was source evidence, not the sole output.
- Repair cycles used: 0 for this generated diagram after review.
- Mermaid validation method: inspected-only; `.agents/skills/generate-flow-diagram/scripts/check-mermaid.sh` was run, but no Mermaid parser (`mmdc`, `node`, `npm`, or `npx`) was available in this shell.
- Dispatch method: inline.
- External sources fetched: none for diagram generation.
- Decompose approval path: n/a.
- Mirror/lockfile follow-up disclosed: n/a.
