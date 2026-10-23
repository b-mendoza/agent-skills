# progressive-disclosure

> Current-state authoring reference; update when these package conventions change.

Tier: recommended.

Use when adding, editing, extracting, or removing a skill, subagent, reference, script, contract field, or gate.

## Deletion test

Require a concrete failure or consumer need that the existing artifact cannot satisfy before adding a part. Every addition or edit must fix a concrete problem in reliability, portability, standalone packaging, context efficiency, maintainability, validation, user comprehension, or best-practices compliance; rename/reshuffle/polish changes fire none, so leave the package unchanged.

Handle nonrecurring work directly, use a script for deterministic work, and a reference for stable information without judgment or orchestration. Extend the skill that owns the trigger before adding another; a new skill needs recurring behavior and reusable judgment, orchestration, or its own invocation contract.

Prefer the smallest correct change while the structure is sound. Recommend a rebuild, merge, or removal when contracts disagree beyond a local repair, producers lack distinct consumers, or the package's gates miss its central failure mode.

## Load at consumption

Keep what every run needs in `SKILL.md`: identity, inputs, output contract, routes, registry, and standing instructions. Put safety, approval, routing, and terminal rules early. Compaction limits live in the [runtime matrix](./runtime-portability-matrix.md).

Load conditional references and assets only at the step or mode that consumes them, and subagent prompts only at dispatch. Extract material only when most runs would otherwise load it for nothing. Keep short, tightly coupled instructions and always-needed registries inline. Templates and tables never belong under `subagents/`.

## Example

Extracting an always-needed registry only adds a read and a second file to maintain. Leave it inline. A mode-specific playbook or one-time output template can be loaded on demand:

| Need | Load |
| --- | --- |
| Critique mode selected | `./references/critique-mode.md` |
| Final report assembly | `./references/final-report-template.md` |
