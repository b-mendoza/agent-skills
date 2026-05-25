# Orchestrating Jira Workflow

The Jira ticket workflow orchestrator thinks, decides, and dispatches helpers. It may normalize identifiers, read progress through `progress-tracker`, choose resume points, preflight phases, invoke downstream skills, dispatch utility subagents, surface summaries, ask gates, and update progress. It retains only decision-relevant summaries, current workflow state, user confirmations, and failure reports, while treating downstream phase skills and validators as authoritative for their artifacts. Jira, file, git, code, CI, web, and platform mutations are delegated, and Jira writes or execution mutations happen only through downstream skills after the required human gates.

```mermaid
flowchart TD
  START([Start]) --> INPUTS["Collect JIRA_URL or TICKET_KEY and normalize workspace, project, and ticket key"]
  INPUTS --> PROGRESS["Read local progress summary via progress-tracker"]
  PROGRESS --> RESUME{"Existing progress or resume point found?"}

  RESUME -->|no| NEED_URL_P1{"JIRA_URL available for Phase 1 fetch?"}
  NEED_URL_P1 -->|no| BLOCKED_URL([Blocked: JIRA_URL required])
  NEED_URL_P1 -->|yes| P1["Phase 1: fetch work item with fetching-jira-ticket"]
  RESUME -->|yes| RESUME_GATE{"Resume past Phase 1?"}
  RESUME_GATE -->|declined| STOPPED([Stopped by user])
  RESUME_GATE -->|confirmed| PREFLIGHT["Preflight remaining phases using artifacts, verdicts, Jira status when available, and summaries"]
  PREFLIGHT --> PREFLIGHT_OK{"Preflight verdict passes?"}
  PREFLIGHT_OK -->|no| BLOCKED_PREFLIGHT([Blocked or escalated: preflight failure])
  PREFLIGHT_OK -->|yes| ROUTE["Choose next ready phase"]

  ROUTE -->|needs Phase 1 fetch| NEED_URL_P1
  ROUTE -->|needs Phase 2| P2
  ROUTE -->|needs Phase 3| P3
  ROUTE -->|needs Jira write approval| NEED_URL_JIRA
  ROUTE -->|needs task selection| GATE_TASK
  ROUTE -->|needs Phase 5| P5
  ROUTE -->|needs Phase 6| P6
  ROUTE -->|ready for execution| GATE_EXEC

  P1 --> V1{"Phase 1 artifact validation pass?"}
  V1 -->|no| BLOCKED_P1([Blocked: fetch artifact invalid])
  V1 -->|yes| P2["Phase 2: plan tasks with planning-jira-tasks"]
  P2 --> V2{"Task plan artifact validation pass?"}
  V2 -->|no| BLOCKED_P2([Blocked: task plan invalid])
  V2 -->|yes| P3["Phase 3: clarify assumptions and critique task plan"]

  P3 --> C3{"Validation pass and BLOCKERS_PRESENT false?"}
  C3 -->|blockers present| BLOCKED_P3([Blocked: assumptions or plan critique])
  C3 -->|RE_PLAN_NEEDED| LOOP3{"Phase 3 re-plan count fewer than 3 attempts?"}
  LOOP3 -->|yes| P2
  LOOP3 -->|no| ESCALATED3([Escalated: Phase 3 re-plan loop exhausted])
  C3 -->|yes| NEED_URL_JIRA{"JIRA_URL available for Jira writes?"}

  NEED_URL_JIRA -->|no| BLOCKED_JIRA_URL([Blocked: JIRA_URL required for Jira writes])
  NEED_URL_JIRA -->|yes| GATE_JIRA{"Approve Jira writes for creating or linking child items?"}
  GATE_JIRA -->|declined| RECORD_JIRA_DECLINE["Record declined Jira write decision and handoff"]
  RECORD_JIRA_DECLINE --> STOPPED
  GATE_JIRA -->|approved| P4["Phase 4: create child items with creating-jira-subtasks"]
  P4 --> V4{"Jira subtask creation validated?"}
  V4 -->|no| BLOCKED_P4([Blocked: Jira write failed or unverifiable])
  V4 -->|yes| GATE_TASK{"User selects task for execution planning?"}

  GATE_TASK -->|no task selected| STOPPED
  GATE_TASK -->|task selected| P5["Phase 5: plan task execution with planning-jira-task"]
  P5 --> V5{"Execution plan artifact validation pass?"}
  V5 -->|no| BLOCKED_P5([Blocked: execution plan invalid])
  V5 -->|yes| P6["Phase 6: clarify and critique execution plan"]

  P6 --> C6{"Validation pass and BLOCKERS_PRESENT false?"}
  C6 -->|blockers present| BLOCKED_P6([Blocked: execution assumptions or critique])
  C6 -->|RE_PLAN_NEEDED| LOOP6{"Phase 6 re-plan count fewer than 3 attempts?"}
  LOOP6 -->|yes| P5
  LOOP6 -->|no| ESCALATED6([Escalated: Phase 6 re-plan loop exhausted])
  C6 -->|yes| GATE_EXEC{"Confirm critiqued task plan and start real execution?"}

  GATE_EXEC -->|declined| RECORD_EXEC_DECLINE["Record declined execution decision and handoff"]
  RECORD_EXEC_DECLINE --> STOPPED
  GATE_EXEC -->|confirmed| P7["Phase 7: kick off and execute task with executing-jira-task"]
  P7 --> DOWNSTREAM{"Downstream execution complete?"}
  DOWNSTREAM -->|internal fixes needed| P7
  DOWNSTREAM -->|failed or escalated| BLOCKED_P7([Blocked or escalated: execution failure report])
  DOWNSTREAM -->|task complete| TASK_DONE([Task complete])

  TASK_DONE --> NEXT{"Choose next task or stop?"}
  NEXT -->|next task| GATE_TASK
  NEXT -->|stop| WORKFLOW_DONE([Workflow complete or stopped by user])

  P1 -.evidence.-> EVIDENCE["Evidence: progress artifacts, preflight verdicts, phase summaries, validator verdicts, clarification flags, delegated Jira status, and delegated code or docs context"]
  P2 -.updates.-> TRACK["Update progress via progress-tracker"]
  P3 -.updates.-> TRACK
  P4 -.updates.-> TRACK
  P5 -.updates.-> TRACK
  P6 -.updates.-> TRACK
  P7 -.updates.-> TRACK

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class RESUME,NEED_URL_P1,RESUME_GATE,PREFLIGHT_OK,ROUTE,V1,V2,C3,LOOP3,NEED_URL_JIRA,GATE_JIRA,V4,GATE_TASK,V5,C6,LOOP6,GATE_EXEC,DOWNSTREAM,NEXT decision;
  class PROGRESS,PREFLIGHT,V1,V2,V4,V5 check;
  class RESUME_GATE,GATE_JIRA,GATE_TASK,GATE_EXEC,NEXT human;
  class TASK_DONE,RECORD_JIRA_DECLINE,RECORD_EXEC_DECLINE,TRACK,EVIDENCE output;
  class WORKFLOW_DONE success;
  class LOOP3,LOOP6 refine;
  class BLOCKED_URL,BLOCKED_PREFLIGHT,BLOCKED_P1,BLOCKED_P2,BLOCKED_P3,BLOCKED_JIRA_URL,BLOCKED_P4,BLOCKED_P5,BLOCKED_P6,BLOCKED_P7,ESCALATED3,ESCALATED6,STOPPED stop;
```

Readiness rule: advance only when the current phase artifact validates and the gate rule for the next phase is satisfied. Jira writes require explicit approval before Phase 4, task execution requires user task selection and confirmation before Phase 7, and re-plan loops escalate after three attempts.

Completion states: ready for next phase, ready for Jira write approval, ready for task selection, ready for execution, task complete, workflow complete, blocked, needs re-plan, escalated, or stopped by user.
