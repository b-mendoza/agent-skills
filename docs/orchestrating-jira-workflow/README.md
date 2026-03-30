# Orchestrating Jira Workflow — Architecture Reference

> A pure-coordinator orchestrator that drives Jira tickets through seven sequential phases, delegating all work to specialized subagents and downstream skills. Includes a critique mechanism to counter AI framework bias and ensure conscious, informed technology decisions.

---

## At a glance

| Metric                      | Value |
| --------------------------- | ----- |
| Sequential phases           | 7     |
| Orchestrator utility agents | 7     |
| Downstream skill subagents  | 18    |
| Total subagents in system   | 25    |
| Required external skills    | 11    |
| Non-negotiable rules        | 10    |
| Quality gates (Phase 7)     | 3     |
| Max fix cycles per task     | 3     |
| Max re-plan cycles          | 3     |

---

## High-level architecture

```mermaid
flowchart TD
    subgraph ORCH["Orchestrator (pure coordinator)"]
        direction TB
        PF[Preflight checker]
        AV[Artifact validator]
        PT[Progress tracker]
        TSC[Ticket status checker]
        CI[Codebase inspector]
        CRF[Code reference finder]
        DF[Documentation finder]
    end

    ORCH --> P1["Phase 1: Fetch"]
    P1 --> P2["Phase 2: Plan tasks"]
    P2 --> P3["Phase 3: Clarify + Critique"]
    P3 -->|"User confirmation"| P4["Phase 4: Create subtasks"]
    P4 -->|"User selects task"| P5["Phase 5: Plan task execution"]
    P5 --> P6["Phase 6: Clarify + Critique"]
    P6 -->|"User confirmation"| P7["Phase 7: Execute task"]
    P7 -->|"User selects next"| P5

    P3 -.->|"Re-plan (max 3)"| P2
    P6 -.->|"Re-plan (max 3)"| P5

    P1 --- S1["1 subagent"]
    P2 --- S2["4 subagents"]
    P3 --- S3["2 subagents"]
    P4 --- S4["1 subagent"]
    P5 --- S5["4 subagents"]
    P6 --- S6["2 subagents"]
    P7 --- S7["6 subagents"]
```

---

## Core design philosophy

The orchestrator's context window is the most expensive resource in the system. Every byte of raw file content, git diff, API response, or command output that leaks into it degrades decision-making for every subsequent step. **Delegation is not optional — it is the architecture.**

The mental model: the orchestrator is a project manager who can only communicate through written memos to specialists. It can think, decide, prioritize, and synthesize — but the moment work needs to happen, it dispatches.

### Critique as a first-class concern

AI-assisted coding tools carry a documented bias toward mainstream frameworks and libraries (the Matthew Effect). Planning subagents are subject to this same bias. The `critique-analyzer` subagent — dispatched within the `clarifying-assumptions` skill — challenges every significant technology decision by searching the web for current alternatives, cross-checking the codebase directly, and presenting trade-offs to the user. The user makes every decision; nothing is auto-acknowledged.

---

## Document index

| Document                                                          | Contents                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [01 — Pipeline and phases](./01-pipeline-and-phases.md)           | The seven sequential phases, their inputs/outputs, downstream skills, and transition gates |
| [02 — Subagent registry](./02-subagent-registry.md)               | Every subagent in the system: purpose, inputs, outputs, and constraints                    |
| [03 — Rules and constraints](./03-rules-and-constraints.md)       | The ten non-negotiable orchestrator rules plus Phase 7 safety rules                        |
| [04 — Data contracts and gates](./04-data-contracts-and-gates.md) | Artifact validation, phase transition gates, quality gate architecture, and error handling |
| [05 — Principles and patterns](./05-principles-and-patterns.md)   | Architectural principles, execution patterns, dispatch mechanics, and resumability         |
