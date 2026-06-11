# Committing Scoped Changes Workflow

This workflow creates reviewable atomic git commits only after explicit user commit authority. The orchestrator may normalize inputs, route specialist subagents, ask targeted gate questions, and format reports; mutation is limited to approved scoped commit execution. `CHANGE_PATHS` is the initial trust boundary, `APPROVED_COMMIT_SCOPE` expands only by exact approved paths, existing staged changes are protected facts rather than permission, and every created commit is followed by a scoped state refresh before the next action.

```mermaid
flowchart TD
  START(["Start: user requests committing scoped changes"]) --> LOAD["Load SKILL.md, flow-diagram.md, and personality.md"]
  LOAD --> INTAKE["Normalize CHANGE_PATHS, CONTEXT_QUERY, CONTEXT_LOCATION, COMMIT_STYLE, VERIFICATION_HINT"]
  INTAKE --> HAS_PATHS{"CHANGE_PATHS present and unambiguous?"}
  HAS_PATHS -->|no| ASK_PATHS["Ask one targeted path-scope question"]
  ASK_PATHS --> NEEDS_PATHS["COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT"]
  HAS_PATHS -->|yes| HAS_AUTH{"User explicitly asked to create commits?"}
  HAS_AUTH -->|no| NO_AUTH["COMMIT_SCOPED_CHANGES: BLOCKED"]
  HAS_AUTH -->|yes| SET_SCOPE["Set COMMIT_REQUEST_CONFIRMED=true and APPROVED_COMMIT_SCOPE=CHANGE_PATHS"]

  SET_SCOPE --> STATE_REFS{"Relevant initial REFERENCE_URLS supplied?"}
  STATE_REFS -->|yes| PASS_STATE_REFS["Pass supplied relevant URLs only to scoped-state-summarizer"]
  STATE_REFS -->|no| STATE["Dispatch scoped-state-summarizer with STATE_REFRESH_MODE=initial"]
  PASS_STATE_REFS --> STATE

  STATE --> STATE_STATUS{"SCOPED_STATE status"}
  STATE_STATUS -->|PASS| ADOPT_STATE["Adopt scoped summary and Reference need as source of truth"]
  STATE_STATUS -->|NO_SCOPED_CHANGES| NO_CHANGES["COMMIT_SCOPED_CHANGES: NO_SCOPED_CHANGES"]
  STATE_STATUS -->|NEEDS_CONTEXT| ASK_STATE["Ask one targeted state/context question"]
  ASK_STATE --> NEEDS_STATE["COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT"]
  STATE_STATUS -->|BLOCKED| STATE_BLOCKED["COMMIT_SCOPED_CHANGES: BLOCKED"]
  STATE_STATUS -->|ERROR| STATE_ERROR["COMMIT_SCOPED_CHANGES: ERROR"]

  ADOPT_STATE --> PLAN_REF{"Planner Reference need named?"}
  PLAN_REF -->|yes| SELECT_PLAN_REF["Look up external-sources.md and pass only relevant URL to planner"]
  PLAN_REF -->|no| PLAN["Dispatch commit-boundary-planner"]
  SELECT_PLAN_REF --> PLAN

  PLAN --> PLAN_STATUS{"COMMIT_PLAN status"}
  PLAN_STATUS -->|PASS| ADOPT_PLAN["Adopt groups, messages, verification, staging notes, risks, and gates"]
  PLAN_STATUS -->|NEEDS_DECISION| ASK_PLAN["Ask smallest planner decision question"]
  ASK_PLAN --> NEEDS_PLAN["COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT"]
  PLAN_STATUS -->|BLOCKED| PLAN_BLOCKED["COMMIT_SCOPED_CHANGES: BLOCKED"]
  PLAN_STATUS -->|ERROR| PLAN_ERROR["COMMIT_SCOPED_CHANGES: ERROR"]

  ADOPT_PLAN --> SCOPE_GATE{"G_SCOPE_EXPANSION needed?"}
  SCOPE_GATE -->|yes| ASK_EXPAND["Ask approval for exact extra paths, reason, risk, reversibility, safer alternative"]
  ASK_EXPAND --> EXPAND_DECISION{"Expansion approved?"}
  EXPAND_DECISION -->|yes| EXPAND_SCOPE["Add only approved exact paths to APPROVED_COMMIT_SCOPE"]
  EXPAND_DECISION -->|no| EXPAND_DECLINED["COMMIT_SCOPED_CHANGES: BLOCKED"]
  SCOPE_GATE -->|no| OMISSION_GATE{"G_IN_SCOPE_OMISSION needed?"}
  EXPAND_SCOPE --> OMISSION_GATE

  OMISSION_GATE -->|yes| ASK_OMIT["Ask approval for exact omitted changes, reason, risk, reversibility, safer alternative"]
  ASK_OMIT --> OMIT_DECISION{"Omission approved?"}
  OMIT_DECISION -->|yes| EXEC_REF{"Executor Reference need for next group?"}
  OMIT_DECISION -->|no| OMIT_DECLINED["COMMIT_SCOPED_CHANGES: BLOCKED"]
  OMISSION_GATE -->|no| EXEC_REF

  EXEC_REF -->|yes| SELECT_EXEC_REF["Look up external-sources.md and pass only relevant URL to executor"]
  EXEC_REF -->|no| EXECUTE["Dispatch scoped-commit-executor for one approved group"]
  SELECT_EXEC_REF --> EXECUTE

  EXECUTE --> EXEC_WORK["Executor reinspects state, confirms approved scope, records staged baseline, isolates preserved staged entries, stages approved group, reviews staged diff, verifies, commits, and checks preservation"]
  EXEC_WORK --> EXEC_STATUS{"COMMIT_EXECUTE status"}
  EXEC_STATUS -->|PASS| RECORD_COMMIT["Record short SHA, message, summary, verification, preservation evidence"]
  EXEC_STATUS -->|VERIFY_FAILED| RECOVERY{"Recovery classification"}
  RECOVERY -->|same-scope-same-group-retry under cap| RETRY["Increment attempt counter and retry same approved group"]
  RETRY --> EXECUTE
  RECOVERY -->|needs-user-decision| ASK_VERIFY["Ask one targeted verification recovery question"]
  ASK_VERIFY --> NEEDS_VERIFY["COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT"]
  RECOVERY -->|terminal or attempts exhausted| VERIFY_FAILED["COMMIT_SCOPED_CHANGES: VERIFY_FAILED"]
  EXEC_STATUS -->|BLOCKED| EXEC_BLOCKED["COMMIT_SCOPED_CHANGES: BLOCKED"]
  EXEC_STATUS -->|COMMIT_ERROR| COMMIT_ERROR["COMMIT_SCOPED_CHANGES: COMMIT_ERROR"]
  EXEC_STATUS -->|ERROR| EXEC_ERROR["COMMIT_SCOPED_CHANGES: ERROR"]

  RECORD_COMMIT --> REFRESH["Dispatch scoped-state-summarizer with STATE_REFRESH_MODE=post-commit"]
  REFRESH --> REFRESH_STATUS{"Post-commit SCOPED_STATE status"}
  REFRESH_STATUS -->|NO_SCOPED_CHANGES| SUCCESS_DATA["Prepare success report data"]
  REFRESH_STATUS -->|PASS| ADOPT_REFRESH["Adopt refreshed scoped summary and refreshed Reference need"]
  REFRESH_STATUS -->|NEEDS_CONTEXT| ASK_REFRESH["Ask one targeted refresh question"]
  ASK_REFRESH --> NEEDS_REFRESH["COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT"]
  REFRESH_STATUS -->|BLOCKED| REFRESH_BLOCKED["COMMIT_SCOPED_CHANGES: BLOCKED"]
  REFRESH_STATUS -->|ERROR| REFRESH_ERROR["COMMIT_SCOPED_CHANGES: ERROR"]

  ADOPT_REFRESH --> REMAINING_CHANGED{"Remaining scoped changes differ from approved plan?"}
  REMAINING_CHANGED -->|yes| PLAN_REF
  REMAINING_CHANGED -->|no| MORE_GROUPS{"More approved groups?"}
  MORE_GROUPS -->|yes| EXEC_REF
  MORE_GROUPS -->|no| SUCCESS_DATA

  NEEDS_PATHS --> FORMAT["Load report-contract-orchestrator.md and format final report or status"]
  NO_AUTH --> FORMAT
  NO_CHANGES --> FORMAT
  NEEDS_STATE --> FORMAT
  STATE_BLOCKED --> FORMAT
  STATE_ERROR --> FORMAT
  NEEDS_PLAN --> FORMAT
  PLAN_BLOCKED --> FORMAT
  PLAN_ERROR --> FORMAT
  EXPAND_DECLINED --> FORMAT
  OMIT_DECLINED --> FORMAT
  NEEDS_VERIFY --> FORMAT
  VERIFY_FAILED --> FORMAT
  EXEC_BLOCKED --> FORMAT
  COMMIT_ERROR --> FORMAT
  EXEC_ERROR --> FORMAT
  NEEDS_REFRESH --> FORMAT
  REFRESH_BLOCKED --> FORMAT
  REFRESH_ERROR --> FORMAT
  SUCCESS_DATA --> FORMAT
  FORMAT --> DONE(["Return compact report/status and stop current run"])

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class HAS_PATHS,HAS_AUTH,STATE_REFS,STATE_STATUS,PLAN_REF,PLAN_STATUS,SCOPE_GATE,EXPAND_DECISION,OMISSION_GATE,OMIT_DECISION,EXEC_REF,EXEC_STATUS,RECOVERY,REFRESH_STATUS,REMAINING_CHANGED,MORE_GROUPS decision;
  class SCOPE_GATE,OMISSION_GATE guard;
  class LOAD,INTAKE,SET_SCOPE,PASS_STATE_REFS,STATE,ADOPT_STATE,SELECT_PLAN_REF,PLAN,ADOPT_PLAN,EXPAND_SCOPE,SELECT_EXEC_REF,EXECUTE,EXEC_WORK,RETRY,RECORD_COMMIT,REFRESH,ADOPT_REFRESH check;
  class ASK_PATHS,ASK_STATE,ASK_PLAN,ASK_EXPAND,ASK_OMIT,ASK_VERIFY,ASK_REFRESH human;
  class SUCCESS_DATA,FORMAT,DONE output;
  class NEEDS_PATHS,NO_AUTH,NO_CHANGES,NEEDS_STATE,STATE_BLOCKED,STATE_ERROR,NEEDS_PLAN,PLAN_BLOCKED,PLAN_ERROR,EXPAND_DECLINED,OMIT_DECLINED,NEEDS_VERIFY,VERIFY_FAILED,EXEC_BLOCKED,COMMIT_ERROR,EXEC_ERROR,NEEDS_REFRESH,REFRESH_BLOCKED,REFRESH_ERROR stop;
```

Readiness rule: continue only when commit authority is explicit, `CHANGE_PATHS` is unambiguous, planned groups stay inside `APPROVED_COMMIT_SCOPE`, required human gates have been approved, the executor can preserve unrelated staged entries, verification has passed or been safely routed, and post-commit refresh has supplied the next source of truth.

Output contract: every success, no-change, blocked, waiting, verification-failed, commit-error, or error result loads `references/report-contract-orchestrator.md`. Success reports list created commits, summaries, verification, remaining scoped changes, unrelated changes left untouched, post-commit refreshes, and fetched references. Status reports use `COMMIT_SCOPED_CHANGES: BLOCKED | NEEDS_CONTEXT | NO_SCOPED_CHANGES | VERIFY_FAILED | COMMIT_ERROR | ERROR` with commits created before status, reason, and next step.

Source grounding: the workflow is traced to `skills/committing-scoped-changes/SKILL.md`, `skills/committing-scoped-changes/flow-diagram.md`, `references/personality.md`, the three subagent files, and the four report-contract references in the target skill package.
