# planning-github-task

Planning coordinator for exactly one GitHub issue task from
`docs/<ISSUE_SLUG>-tasks.md`. The agent normalizes required inputs, delegates
task-plan readiness checks to `execution-prepper`, dispatches focused planning
subagents one at a time, writes only four workflow-planning artifacts under
`docs/`, retains structured summaries instead of raw subagent context, and stops
on unresolved dependencies, ambiguity, behavior gaps, planning risk, missing
artifacts, or unexpected errors. The workflow is intentionally shared with
`planning-jira-task`; only the platform identifier, optional source snapshot,
and artifact path placeholders differ.

```mermaid
flowchart TD
  START([Start planning-github-task]) --> INTAKE[Read ISSUE_SLUG, TASK_NUMBER, optional RE_PLAN and DECISIONS_FILE]
  INTAKE --> REQUIRED_INPUTS{ISSUE_SLUG and TASK_NUMBER present?}
  REQUIRED_INPUTS -->|no| BLOCKED_INPUTS([Blocked: missing required planning input])
  REQUIRED_INPUTS -->|yes| REPLAN_CHECK{RE_PLAN requested?}

  REPLAN_CHECK -->|no| SET_PREP[Set first stage: execution-prepper]
  REPLAN_CHECK -->|yes| INVALIDATE[Identify earliest invalidated stage and downstream dependents]
  INVALIDATE --> REPLAN_LIMIT{Re-plan loop count <= 3?}
  REPLAN_LIMIT -->|no| FAIL_REPLAN([Fail: re-plan loop limit reached])
  REPLAN_LIMIT -->|yes| SET_STAGE[Set next required stage]

  SET_PREP --> DISPATCH_PREP[Dispatch execution-prepper to write brief]
  SET_STAGE --> ROUTE_STAGE{Current stage}
  ROUTE_STAGE -->|brief| DISPATCH_PREP
  ROUTE_STAGE -->|plan| CHECK_BRIEF
  ROUTE_STAGE -->|tests| CHECK_PLAN
  ROUTE_STAGE -->|refactor| CHECK_TEST_SPEC

  CHECK_BRIEF{BRIEF_FILE exists?} -->|no| BLOCKED_BRIEF([Blocked: missing brief input artifact])
  CHECK_BRIEF -->|yes| DISPATCH_PLAN[Dispatch execution-planner to write execution plan]

  CHECK_PLAN{BRIEF_FILE and PLAN_FILE exist?} -->|no| BLOCKED_PLAN([Blocked: missing planner input artifact])
  CHECK_PLAN -->|yes| DISPATCH_TESTS[Dispatch test-strategist to write test spec]

  CHECK_TEST_SPEC{BRIEF_FILE, PLAN_FILE, and TEST_SPEC_FILE exist?} -->|no| BLOCKED_TEST_SPEC([Blocked: missing refactor input artifact])
  CHECK_TEST_SPEC -->|yes| DISPATCH_REFACTOR[Dispatch refactoring-advisor to write refactoring plan]

  DISPATCH_PREP --> STATUS{Subagent status}
  DISPATCH_PLAN --> STATUS
  DISPATCH_TESTS --> STATUS
  DISPATCH_REFACTOR --> STATUS

  STATUS -->|PASS| VALIDATE_OUTPUT{Expected artifact exists?}
  STATUS -->|FAIL| FAIL_STAGE([Fail: report unresolved dependency, ambiguity, behavior gap, or planning risk])
  STATUS -->|BLOCKED| BLOCKED_STAGE([Blocked: report missing prerequisite or input artifact])
  STATUS -->|ERROR| ERROR_STAGE([Error: ask user how to proceed])

  VALIDATE_OUTPUT -->|yes| RECORD_SUMMARY[Retain structured summary, artifact path, URLs, verdicts, and next-step notes]
  VALIDATE_OUTPUT -->|no| IDENTIFY_MISSING_OWNER[Identify missing artifact owner and validation issue]
  IDENTIFY_MISSING_OWNER --> REPAIR_LIMIT{Artifact repair retries <= 3?}
  REPAIR_LIMIT -->|yes| REDISPATCH_OWNER[Redispatch only artifact owner with REPAIR_FINDINGS]
  REPAIR_LIMIT -->|no| ERROR_REPAIR([Error: artifact validation repair failed])
  REDISPATCH_OWNER --> STATUS

  RECORD_SUMMARY --> MORE_STAGES{More downstream stages required?}
  MORE_STAGES -->|yes| SET_STAGE
  MORE_STAGES -->|no| FINAL_ARTIFACTS{All four expected artifacts exist?}
  FINAL_ARTIFACTS -->|yes| REPORT[Report planning summary with artifacts, approach, tests, refactor verdict, and fetched references]
  FINAL_ARTIFACTS -->|no| IDENTIFY_MISSING_OWNER
  REPORT --> COMPLETE([Planning complete])

  class REQUIRED_INPUTS,REPLAN_CHECK,REPLAN_LIMIT,ROUTE_STAGE,CHECK_BRIEF,CHECK_PLAN,CHECK_TEST_SPEC,STATUS,VALIDATE_OUTPUT,REPAIR_LIMIT,MORE_STAGES,FINAL_ARTIFACTS decision;
  class INTAKE,INVALIDATE,SET_PREP,SET_STAGE,DISPATCH_PREP,DISPATCH_PLAN,DISPATCH_TESTS,DISPATCH_REFACTOR,RECORD_SUMMARY,IDENTIFY_MISSING_OWNER check;
  class REPORT output;
  class COMPLETE success;
  class REPAIR_LIMIT,REDISPATCH_OWNER refine;
  class BLOCKED_INPUTS,BLOCKED_BRIEF,BLOCKED_PLAN,BLOCKED_TEST_SPEC,BLOCKED_STAGE stop;
  class FAIL_REPLAN,FAIL_STAGE,ERROR_STAGE,ERROR_REPAIR stop;

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;
```

Planning summary output:

- Task: `TASK_NUMBER` and parsed task title.
- Artifacts: `docs/<ISSUE_SLUG>-task-<TASK_NUMBER>-brief.md`, `docs/<ISSUE_SLUG>-task-<TASK_NUMBER>-execution-plan.md`, `docs/<ISSUE_SLUG>-task-<TASK_NUMBER>-test-spec.md`, and `docs/<ISSUE_SLUG>-task-<TASK_NUMBER>-refactoring-plan.md`.
- Report fields: approach summary, test coverage shape, refactoring verdict, completion state, and exact References fetched URLs or `none`.

Readiness rule: `execution-prepper` is the only stage that reads raw task-plan
content and verifies dependencies, questions, decisions, and required task
fields. Downstream stages consume artifact paths and summaries. Planning is
complete only after all four expected artifacts exist and every dispatched
owner has returned `PASS`; otherwise the coordinator reports `blocked`, `fail`,
or `error` without implementing code, deleting artifacts, or mutating unrelated
files.
