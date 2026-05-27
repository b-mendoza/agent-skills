# Best Practices for Writing Skills and Subagent Definitions

This directory holds detailed guidance for authoring and editing the skills in
this repo. The practices below combine durable standards, repo conventions, and
runtime mitigations. Apply them with the scope named in each file, especially
when authoring portable skills for both OpenCode and Claude Code.

Read the relevant file when you are about to author or edit a skill, subagent,
or reference document. The consolidated files below are the source of truth;
older topic-specific files were merged to reduce checklist sprawl.

## Index

1. [Context and Payload Management](./context-and-payload-management.md) —
   progressive disclosure, context-window protection, template extraction,
   handoff-file dispatch, incremental file writing, and external links.
2. [Validation and Escalation](./validation-and-escalation.md) — phase
   validation loops, critical-output gates, best-practices compliance,
   empirical validation, and escalation categories.
3. [Behavioral Prompt Contract](./behavioral-prompt-contract.md) — identity,
   operating posture, positive constraint framing, instruction reinforcement,
   and examples.
4. [Structural Conventions](./structural-conventions.md) — section ordering,
   registry shape, boundary placement, and repo naming conventions.
5. [Input and Output Contracts](./input-output-contracts.md) — explicit data
   boundaries between pipeline stages.
6. [Artifact Lifecycle Management](./artifact-lifecycle.md) — what to commit,
   what to preserve, what to delete.
7. [Earned Complexity](./earned-complexity.md) — every instruction, file,
   subagent, and reference must earn its place by observably changing runtime
   behavior or maintainability.
8. [Orchestrator as Routing UI](./orchestrator-as-routing-ui.md) — the
   orchestrator routes, subagents normalize raw inputs, nested delegation is
   runtime-dependent, and phase transitions are visible.
9. [Subagent-Default Execution](./subagent-default-execution.md) — when to
   inline vs. delegate per step, including dispatch cost tradeoffs.
10. [Runtime Portability Matrix](./runtime-portability-matrix.md) — portable
    skills separate required capabilities from runtime-specific syntax,
    permissions, tool names, and subagent behavior for OpenCode and Claude
    Code.
11. [Mutation Scope Boundaries](./mutation-scope-boundaries.md) — editing
    skills derive explicit mutation limits and gate every edit on them.

## Supporting Reference

- [Quick Reference: Skill File Structure](./quick-reference-skill-structure.md)
  — folder layout for a typical skill.

## Former Standalone Topics

These topics now live in consolidated files:

| Former topic | Current location |
| --- | --- |
| Progressive disclosure | [Context and Payload Management](./context-and-payload-management.md) |
| Context-window protection | [Context and Payload Management](./context-and-payload-management.md) |
| Template extraction | [Context and Payload Management](./context-and-payload-management.md) |
| Handoff-file dispatch | [Context and Payload Management](./context-and-payload-management.md) |
| Incremental file writing | [Context and Payload Management](./context-and-payload-management.md) |
| External information linking | [Context and Payload Management](./context-and-payload-management.md) |
| Validation loops | [Validation and Escalation](./validation-and-escalation.md) |
| Quality gates for critical outputs | [Validation and Escalation](./validation-and-escalation.md) |
| Best-practices compliance gate | [Validation and Escalation](./validation-and-escalation.md) |
| Empirical validation over self-report | [Validation and Escalation](./validation-and-escalation.md) |
| Escalation patterns | [Validation and Escalation](./validation-and-escalation.md) |
| Identity and mental model statements | [Behavioral Prompt Contract](./behavioral-prompt-contract.md) |
| Personality as operating posture | [Behavioral Prompt Contract](./behavioral-prompt-contract.md) |
| Positive constraint framing | [Behavioral Prompt Contract](./behavioral-prompt-contract.md) |
| Instruction reinforcement | [Behavioral Prompt Contract](./behavioral-prompt-contract.md) |
| Example strategy | [Behavioral Prompt Contract](./behavioral-prompt-contract.md) |
| Naming conventions | [Structural Conventions](./structural-conventions.md) |
| Phase transition banner | [Orchestrator as Routing UI](./orchestrator-as-routing-ui.md) |
