# Planning Codebase Restructuring Flow

This workflow is a planning-only architecture review orchestrated by
`planning-codebase-restructuring`. The orchestrator owns input normalization,
mutation-boundary enforcement, subagent dispatch, status routing, candidate
report synthesis, review repair loops, and final handoff. Raw repository
inspection, domain analysis, reference assessment, target-architecture
strategy, and plan review stay inside focused subagents that return concise
statuses, summaries, blockers, paths, and open questions.

```mermaid
flowchart TD
  START([Start: codebase restructuring plan request]) --> INTAKE["Normalize inputs<br/>CODEBASE_PATH_OR_REPOSITORY_URL, TARGET_SCOPE,<br/>BUSINESS_GOALS_AND_PAIN_POINTS, optional domain language,<br/>constraints, reference URL, success criteria, mutation authorization"]
  INTAKE --> REQUIRED{"Required inputs present<br/>or safely inferable?"}
  REQUIRED -->|no| ASK_INPUT["Ask one concise question<br/>for the missing decision-changing input"]
  ASK_INPUT --> NEEDS_INPUT([Status: NEEDS_INPUT])
  REQUIRED -->|yes| BOUNDARY["Set mutation boundary<br/>Default to planning-only when authorization is absent or ambiguous<br/>Hold scope, assumptions, constraints, statuses, summaries,<br/>approval gates, blockers, and open questions"]

  BOUNDARY --> HAS_REFERENCE{"REFERENCE_URL present?"}
  HAS_REFERENCE -->|no| REF_SKIPPED["Record REFERENCE_ASSESSMENT: SKIPPED"]
  HAS_REFERENCE -->|yes| REF["Dispatch reference-assessor<br/>Assess relevance, credibility, freshness, fit,<br/>transferable patterns, and limitations"]
  REF --> REF_STATUS{"REFERENCE_ASSESSMENT status"}
  REF_STATUS -->|PASS| REF_SUMMARY["Keep reference summary only"]
  REF_STATUS -->|SKIPPED| REF_SKIPPED
  REF_STATUS -->|NEEDS_INPUT| REF_QUESTION["Ask one reference question"]
  REF_QUESTION --> NEEDS_INPUT
  REF_STATUS -->|BLOCKED| REF_BLOCKED["Record reference blocker and recovery"]
  REF_STATUS -->|ERROR| REF_ERROR["Record reference error"]

  REF_SKIPPED --> CARTOGRAPHER
  REF_SUMMARY --> CARTOGRAPHER
  CARTOGRAPHER["Dispatch architecture-cartographer<br/>Map structure, workflows, dependencies,<br/>integrations, safety nets, constraints, and evidence paths"] --> MAP_STATUS{"ARCHITECTURE_MAP status"}
  MAP_STATUS -->|PASS| MAP_SUMMARY["Keep architecture map summary"]
  MAP_STATUS -->|NEEDS_INPUT| MAP_QUESTION["Ask one scope or access question"]
  MAP_QUESTION --> NEEDS_INPUT
  MAP_STATUS -->|BLOCKED| MAP_BLOCKED["Record map blocker and recovery"]
  MAP_STATUS -->|ERROR| MAP_ERROR["Record map error"]

  MAP_SUMMARY --> DOMAIN["Dispatch domain-analyst<br/>Analyze domain language, context candidates,<br/>DDD gaps, Screaming Architecture gaps,<br/>complexity signals, contradictions, and zero-state findings"]
  DOMAIN --> DOMAIN_STATUS{"DOMAIN_ANALYSIS status"}
  DOMAIN_STATUS -->|PASS| DOMAIN_SUMMARY["Keep domain analysis summary"]
  DOMAIN_STATUS -->|NEEDS_INPUT| DOMAIN_QUESTION["Ask one domain-boundary question"]
  DOMAIN_QUESTION --> NEEDS_INPUT
  DOMAIN_STATUS -->|BLOCKED| DOMAIN_BLOCKED["Record analysis blocker and recovery"]
  DOMAIN_STATUS -->|ERROR| DOMAIN_ERROR["Record analysis error"]

  DOMAIN_SUMMARY --> STRATEGY["Dispatch restructuring-strategist<br/>Use architecture map, domain analysis, reference assessment,<br/>business goals, constraints, success criteria, and mutation boundary<br/>Return target model, folder proposal, guardrails,<br/>impact, migration, validation, and approval gates"]
  STRATEGY --> STRATEGY_STATUS{"RESTRUCTURING_PLAN status"}
  STRATEGY_STATUS -->|PASS| STRATEGY_SUMMARY["Keep restructuring plan summary"]
  STRATEGY_STATUS -->|NEEDS_INPUT| STRATEGY_QUESTION["Ask one strategy or approval-gate question"]
  STRATEGY_QUESTION --> NEEDS_INPUT
  STRATEGY_STATUS -->|BLOCKED| STRATEGY_BLOCKED["Record strategy blocker and recovery"]
  STRATEGY_STATUS -->|ERROR| STRATEGY_ERROR["Record strategy error"]

  STRATEGY_SUMMARY --> CANDIDATE["Synthesize candidate final report<br/>Use summaries only plus concise path evidence,<br/>evidence-backed findings, migration plan,<br/>validation plan, approval gates, risks, and open questions"]
  CANDIDATE --> REVIEW["Dispatch plan-reviewer<br/>Review preflight, summaries, candidate report,<br/>success criteria, evidence traceability, scope control,<br/>approval gates, migration safety, validation, and completeness"]
  REVIEW --> REVIEW_STATUS{"PLAN_REVIEW status"}
  REVIEW_STATUS -->|PASS| FINAL["Deliver reviewed final report<br/>Status: READY<br/>Include preflight, current map, domain observations,<br/>DDD gaps, Screaming Architecture proposal,<br/>complexity opportunities, reference assessment when present,<br/>migration strategy, validation plan, approval gates,<br/>risks, assumptions, blockers, and open questions"]
  FINAL --> READY([Status: READY])

  REVIEW_STATUS -->|FAIL| REPAIR_LIMIT{"Fewer than two repair cycles used?"}
  REPAIR_LIMIT -->|no| REVIEW_BLOCKED["Record unresolved review findings<br/>and attempted repairs"]
  REPAIR_LIMIT -->|yes| REPAIR_SCOPE{"Fix belongs to a subagent<br/>or candidate report section?"}
  REPAIR_SCOPE -->|subagent| REDISPATCH["Re-dispatch smallest responsible subagent<br/>with targeted reviewer findings only"]
  REPAIR_SCOPE -->|candidate report| REVISE_CANDIDATE["Revise candidate report section<br/>using existing reviewed summaries only"]
  REDISPATCH --> CANDIDATE
  REVISE_CANDIDATE --> REVIEW
  REVIEW_STATUS -->|BLOCKED| REVIEW_BLOCKED
  REVIEW_STATUS -->|ERROR| REVIEW_ERROR["Record review error"]

  REF_BLOCKED --> BLOCKED_FINAL
  MAP_BLOCKED --> BLOCKED_FINAL
  DOMAIN_BLOCKED --> BLOCKED_FINAL
  STRATEGY_BLOCKED --> BLOCKED_FINAL
  REVIEW_BLOCKED --> BLOCKED_FINAL
  BLOCKED_FINAL["Return blocked handoff<br/>Smallest stopping reason, completed phases,<br/>next decision needed, and safe partial findings"] --> BLOCKED([Status: BLOCKED])

  REF_ERROR --> ERROR_FINAL
  MAP_ERROR --> ERROR_FINAL
  DOMAIN_ERROR --> ERROR_FINAL
  STRATEGY_ERROR --> ERROR_FINAL
  REVIEW_ERROR --> ERROR_FINAL
  ERROR_FINAL["Return error handoff<br/>Failed condition, completed phases,<br/>known context, and recovery action"] --> ERROR([Status: ERROR])

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class BOUNDARY,REF_SKIPPED,REF_SUMMARY,MAP_SUMMARY,DOMAIN_SUMMARY,STRATEGY_SUMMARY guard;
  class REF,CARTOGRAPHER,DOMAIN,STRATEGY,REVIEW check;
  class REQUIRED,HAS_REFERENCE,REF_STATUS,MAP_STATUS,DOMAIN_STATUS,STRATEGY_STATUS,REVIEW_STATUS,REPAIR_LIMIT,REPAIR_SCOPE decision;
  class ASK_INPUT,REF_QUESTION,MAP_QUESTION,DOMAIN_QUESTION,STRATEGY_QUESTION human;
  class CANDIDATE,FINAL,BLOCKED_FINAL,ERROR_FINAL output;
  class READY success;
  class NEEDS_INPUT,BLOCKED,ERROR,REF_BLOCKED,MAP_BLOCKED,DOMAIN_BLOCKED,STRATEGY_BLOCKED,REVIEW_BLOCKED,REF_ERROR,MAP_ERROR,DOMAIN_ERROR,STRATEGY_ERROR,REVIEW_ERROR stop;
```

Readiness rule: return `Status: READY` only after required inputs are resolved,
the mutation boundary is set, all required subagent phases return `PASS` or
the optional reference phase is recorded as `SKIPPED`, a candidate final report
is assembled from summaries only, and `plan-reviewer` returns
`PLAN_REVIEW: PASS`.

Repair rule: `PLAN_REVIEW: FAIL` may trigger at most two targeted repair
cycles. Repairs either re-dispatch the smallest responsible subagent with the
reviewer finding or revise only the candidate report section using already
reviewed summaries. After two failed cycles, return `Status: BLOCKED`.
