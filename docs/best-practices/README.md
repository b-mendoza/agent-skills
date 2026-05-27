# Best Practices for Writing Skills and Subagent Definitions

This directory holds detailed guidance for authoring and editing the skills in
this repo. The practices below combine durable standards, repo conventions, and
runtime mitigations. Apply them with the scope named in each file, especially
when authoring portable skills for both OpenCode and Claude Code.

The top-level [`CLAUDE.md`](../../CLAUDE.md) carries only one-line summaries
and pointers to these files. Read the relevant file when you are about to
author or edit a skill, subagent, or reference document — not before.

## Index

1. [Progressive Disclosure](./progressive-disclosure.md) — layer skill content
   so only the necessary parts load into context.
2. [Context Window Protection](./context-window-protection.md) — keep raw
   data out of the orchestrator's context.
3. [Subagent-Default Execution](./subagent-default-execution.md) — when to
   inline vs. delegate per step.
4. [Positive Constraint Framing](./positive-constraint-framing.md) — name what
   is permitted; reserve negation for safety boundaries. Includes
   reconciliation with brief in-file reminders.
5. [Instruction Reinforcement](./instruction-reinforcement.md) — short
   reminders at the top of long reference files.
6. [Structural Conventions](./structural-conventions.md) — section ordering
   for skills and subagents.
7. [Input and Output Contracts](./input-output-contracts.md) — explicit data
   boundaries between pipeline stages.
8. [Escalation Patterns](./escalation-patterns.md) — failure categories and
   reporting formats per subagent type.
9. [Template Extraction](./template-extraction.md) — when to move large
   templates into separate co-located files.
10. [Identity and Mental Model Statements](./identity-and-mental-model.md) —
    open every skill and subagent with what-it-is and why-it-exists.
11. [Example Strategy](./example-strategy.md) — concrete examples where they
    reduce ambiguity in outputs, handoffs, decisions, or failures.
12. [Validation Loops](./validation-loops.md) — phase boundaries, fix cycles,
    retry limits.
13. [Naming Conventions](./naming-conventions.md) — repo style convention:
    gerunds for skills, role nouns for subagents.
14. [Artifact Lifecycle Management](./artifact-lifecycle.md) — what to commit,
    what to preserve, what to delete.
15. [Empirical Validation over Self-Report](./empirical-validation.md) —
    validate fixes by behavior change, not by asking the agent.
16. [Handoff-File Subagent Dispatch](./handoff-file-dispatch.md) — move large
    subagent payloads to per-run files to avoid tool-call serialization
    failures and lift inline prompt-size limits.
17. [Best-Practices Compliance as a Quality Gate](./best-practices-compliance-gate.md)
    — every skill audit and validation checks the target against the applicable
    tier of this index and reports verdicts with observable evidence.
18. [Earned Complexity](./earned-complexity.md) — every instruction, file,
    subagent, and reference must earn its place by observably changing
    runtime behavior or maintainability. Includes the Material Issue Gate
    and the Improvement Decision Tests.
19. [Personality as Operating Posture](./personality-as-operating-posture.md)
    — non-trivial skills define an explicit operating posture; use a
    dedicated `references/personality.md` when the posture earns a separate
    artifact.
20. [External Information Linking](./external-information-linking.md) — link
    to external documentation rather than bundling its content; cached
    snapshots are allowed only with provenance headers and a declaration in
    `SKILL.md`.
21. [Quality Gates for Critical Outputs](./critical-output-quality-gates.md)
    — skills declare which outputs are critical and protect them with named
    gates checked by something other than the producer, with a bounded fix
    loop on failure.
22. [Orchestrator as Routing UI](./orchestrator-as-routing-ui.md) — the
    orchestrator is the routing layer that decides which subagent to
    dispatch; subagents are the backend that normalizes unstructured inputs
    into structured outputs. Nested delegation is runtime-dependent; portable
    skills chain subagents from the orchestrator/main conversation.
23. [Phase Transition Banner](./phase-transition-banner.md) — orchestrator
    skills make phase transitions visible; the forty-hyphen banner is this
    repo's preferred UI convention when no host-native progress marker exists.
24. [Incremental File Writing](./incremental-file-writing.md) — orchestrators
    and subagents materialize large or serializer-sensitive markdown artifacts
    via small per-section `Write` / `StrReplace` calls instead of one
    monolithic `Write`.
25. [Mutation Scope Boundaries](./mutation-scope-boundaries.md) — editing
    skills derive an explicit `MUTATION_LIMITS` contract during intake,
    pass it to every dispatched subagent, and gate every edit on it so
    over-reach, cross-package collateral, and repair-cycle drift are caught
    before the edit lands.
26. [Runtime Portability Matrix](./runtime-portability-matrix.md) — portable
    skills separate required capabilities from runtime-specific syntax,
    permissions, tool names, and subagent behavior for OpenCode and Claude
    Code.

## Supporting reference

- [Quick Reference: Skill File Structure](./quick-reference-skill-structure.md)
  — folder layout for a typical skill.
