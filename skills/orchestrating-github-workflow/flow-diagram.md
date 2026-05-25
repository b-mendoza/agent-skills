# Orchestrating GitHub Workflow

The GitHub issue workflow orchestrator thinks, decides, asks user gates, and dispatches helpers. It may derive normalized identifiers, read progress summaries, choose resume points, preflight phases, invoke downstream skills, surface summaries, and update progress through `progress-tracker`. It retains only decision-relevant summaries, current workflow state, confirmations, and failure reports. GitHub, file, git, code, CI, web, and platform mutations are delegated, and platform writes happen only through downstream skills after required user approval.

```mermaid
flowchart TD
  START([Start]) --> INPUTS["Receive ISSUE_URL or OWNER / REPO / ISSUE_NUMBER"]
  INPUTS --> NORMALIZE["Normalize OWNER, REPO, ISSUE_NUMBER, and ISSUE_SLUG"]
  NORMALIZE --> BOUNDARY["State role, authority, trust model, and mutation limits"]
  BOUNDARY --> PROGRESS["Read local progress summary via progress-tracker"]
  PROGRESS --> RESUME{"Existing progress?"}

  RESUME -->|no| PREFLIGHT_P1["Preflight Phase 1"]
  RESUME -->|yes| RESUME_POINT["Choose resume point from progress artifacts and verdicts"]
  RESUME_POINT --> RESUME_GATE{"Resume past Phase 1?"}
  RESUME_GATE -->|no| PREFLIGHT_P1
  RESUME_GATE -->|yes| ASK_RESUME["Ask user to confirm resume point"]
  ASK_RESUME -->|confirmed| PREFLIGHT_NEXT["Preflight remaining phases"]
  ASK_RESUME -->|declined| STOPPED([Stopped by user])
  PREFLIGHT_NEXT --> PHASE_ROUTE{"Next phase?"}

  PREFLIGHT_P1 --> P1["Phase 1: fetch work item with fetching-github-issue"]
  P1 --> V1{"Artifact validation pass?"}
  V1 -->|no| BLOCKED([Blocked])
  V1 -->|yes| P2["Phase 2: plan tasks with planning-github-issue-tasks"]

  PHASE_ROUTE -->|Phase 1| PREFLIGHT_P1
  PHASE_ROUTE -->|Phase 2| P2
  PHASE_ROUTE -->|Phase 3| P3
  PHASE_ROUTE -->|Phase 4| GH_WRITE_GATE
  PHASE_ROUTE -->|Phase 5| TASK_SELECT
  PHASE_ROUTE -->|Phase 6| P6
  PHASE_ROUTE -->|Phase 7| EXEC_GATE

  P2 --> V2{"Planning artifact validation pass?"}
  V2 -->|no| BLOCKED
  V2 -->|yes| P3["Phase 3: clarify assumptions and critique issue task plan"]

  P3 --> V3{"Validation pass?"}
  V3 -->|no| BLOCKED
  V3 -->|yes| P3_FLAGS{"Blockers or re-plan needed?"}
  P3_FLAGS -->|blockers present| BLOCKED
  P3_FLAGS -->|re-plan needed and fewer than 3 attempts| P2
  P3_FLAGS -->|re-plan attempts exhausted| ESCALATED([Escalated])
  P3_FLAGS -->|no blockers| GH_WRITE_READY([Ready for GitHub write approval])
  GH_WRITE_READY --> GH_WRITE_GATE{"Approve GitHub writes?"}

  GH_WRITE_GATE -->|declined| RECORD_GH_DECLINE["Record declined GitHub write decision and handoff"]
  RECORD_GH_DECLINE --> STOPPED
  GH_WRITE_GATE -->|approved| P4["Phase 4: create child items with creating-github-child-issues"]
  P4 --> V4{"Child item validation pass?"}
  V4 -->|no| BLOCKED
  V4 -->|yes| TASK_READY([Ready for task selection])
  TASK_READY --> TASK_SELECT{"User selects task?"}

  TASK_SELECT -->|selected| P5["Phase 5: plan task execution with planning-github-task"]
  TASK_SELECT -->|no tasks remain| WORKFLOW_DONE([Workflow complete])
  TASK_SELECT -->|stop| STOPPED
  P5 --> V5{"Execution planning artifact validation pass?"}
  V5 -->|no| BLOCKED
  V5 -->|yes| P6["Phase 6: clarify and critique execution plan"]

  P6 --> V6{"Validation pass?"}
  V6 -->|no| BLOCKED
  V6 -->|yes| P6_FLAGS{"Blockers or re-plan needed?"}
  P6_FLAGS -->|blockers present| BLOCKED
  P6_FLAGS -->|re-plan needed and fewer than 3 attempts| P5
  P6_FLAGS -->|re-plan attempts exhausted| ESCALATED
  P6_FLAGS -->|no blockers| EXEC_READY([Ready for execution])
  EXEC_READY --> EXEC_GATE{"Confirm real task execution?"}

  EXEC_GATE -->|declined| RECORD_EXEC_DECLINE["Record declined execution decision and handoff"]
  RECORD_EXEC_DECLINE --> STOPPED
  EXEC_GATE -->|confirmed| P7["Phase 7: kick off and execute task with executing-github-task"]
  P7 --> DOWNSTREAM["Downstream skill owns git, file, code, CI, GitHub, web, and quality fix cycles"]
  DOWNSTREAM --> TASK_DONE([Task complete])
  TASK_DONE --> NEXT_TASK{"Choose next task or stop?"}
  NEXT_TASK -->|next task| TASK_SELECT
  NEXT_TASK -->|stop| STOPPED
  NEXT_TASK -->|all tasks complete| WORKFLOW_DONE

  P1 -.evidence.-> EVIDENCE["Evidence: progress artifacts, preflight verdicts, phase summaries, validator verdicts, clarification flags, delegated GitHub status, and delegated code or docs context"]
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

  class RESUME,RESUME_GATE,PHASE_ROUTE,V1,V2,V3,P3_FLAGS,GH_WRITE_GATE,V4,TASK_SELECT,V5,V6,P6_FLAGS,EXEC_GATE,NEXT_TASK decision;
  class PREFLIGHT_P1,PREFLIGHT_NEXT,V1,V2,V3,V4,V5,V6 check;
  class ASK_RESUME,GH_WRITE_GATE,TASK_SELECT,EXEC_GATE,NEXT_TASK human;
  class GH_WRITE_READY,TASK_READY,EXEC_READY,TASK_DONE,RECORD_GH_DECLINE,RECORD_EXEC_DECLINE,TRACK,EVIDENCE output;
  class WORKFLOW_DONE success;
  class P3_FLAGS,P6_FLAGS refine;
  class BLOCKED,ESCALATED,STOPPED stop;
  class BOUNDARY guard;
```

Readiness rule: advance only when the current phase artifact validates and its gate rule is satisfied. GitHub writes require explicit approval before Phase 4, task execution requires explicit confirmation before Phase 7, and task choice is always user-controlled after Phase 4 and after each completed task.

Completion states: ready for next phase, ready for GitHub write approval, ready for task selection, ready for execution, task complete, workflow complete, blocked, needs re-plan, escalated, or stopped by user.
