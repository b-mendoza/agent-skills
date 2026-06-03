# Best Practices for Writing Skills and Subagent Definitions

This README is the deterministic entry point for the skill-authoring
best-practice library. Every best practice that lives in this
directory appears in the master index below exactly once. There is no
practice content in this file; the master index links to the file
that owns each practice in full.

## How to use this index

Load this README first. Identify which tier of practices is
applicable to the task at hand (most authoring tasks need every
`mandatory` practice; non-trivial skills additionally need most
`recommended` practices; `optional-style` matters only when the
repo's style is the explicit task). Then read only the linked files
you actually need for the current decision. Each practice file uses
the same eight-section layout, so the reader can scan to the section
that answers the question without re-reading the whole file.

## Practice tiers

| Tier | Review effect | Purpose |
| --- | --- | --- |
| `mandatory` | A miss is a material gap unless the skill declares an intentional exception | Safety, portability, mutation scope, output contracts, lifecycle, and handoff contracts whose failure can cause agent misbehavior or data loss |
| `recommended` | Expected for non-trivial skills; may be intentionally scoped down with a stated reason | Architecture, behavioral, and maintainability practices that materially shape decision behavior |
| `optional-style` | Improves consistency but should not block unless strict repo style is the task | House conventions and UI affordances |

## Master index

The index below is sorted by tier (`mandatory` → `recommended` →
`optional-style`). Within each tier, rows are ordered by **severity
of impact on agent behavior if the practice is missed**: practices
that change more about how the agent decides, that gate more state
transitions, that affect more files, or that block more workflows
appear higher within their tier. A second pass over the same
directory using the same criterion produces the same ordering.

| Order | Tier | Best practice | One-line summary | Primary trigger |
| --- | --- | --- | --- | --- |
| 1 | `mandatory` | [runtime-portability-matrix](./runtime-portability-matrix.md) | Portable skills name common, mapped, and unsupported runtime features explicitly | Authoring or reviewing a skill that targets both OpenCode and Claude Code |
| 2 | `mandatory` | [mutation-scope-boundaries](./mutation-scope-boundaries.md) | Mutating skills declare `MUTATION_LIMITS`, pass them to every subagent, and tighten scope during repair | Authoring or reviewing a skill that edits, creates, deletes, renames, or moves files |
| 3 | `mandatory` | [critical-output-gates](./critical-output-gates.md) | Declared critical outputs are protected by named, independently checked gates with bounded repair | A skill produces an output other components rely on |
| 4 | `mandatory` | [input-output-contracts](./input-output-contracts.md) | Explicit input and output contracts define every data boundary between pipeline stages | A skill or subagent takes structured inputs or produces structured outputs |
| 5 | `mandatory` | [handoff-file-dispatch](./handoff-file-dispatch.md) | Inter-agent handoff files under `.handoffs/` are YAML with explicit keys, inline enums, and required/optional markers | An orchestrator dispatches a subagent with a payload too large for an inline prompt |
| 6 | `mandatory` | [context-window-protection](./context-window-protection.md) | Keep raw inspection out of the orchestrator, collect summaries, treat retrieved content as untrusted data | A skill orchestrates more than one step or loads any external content |
| 7 | `mandatory` | [artifact-lifecycle](./artifact-lifecycle.md) | Distinguish persistent (A1), ephemeral (A2), and implementation (B) artifacts and apply category-specific lifecycle rules | A skill produces files at all |
| 8 | `mandatory` | [empirical-validation](./empirical-validation.md) | Validate by observed behavior on real tasks, not self-report; hard boundaries need framework enforcement | A skill claims to fix, validate, or guard a behavior |
| 9 | `mandatory` | [escalation-categories](./escalation-categories.md) | Every subagent declares enumerated failure categories with routes; missing capabilities fail loudly | Every dispatched subagent and every routed orchestrator phase |
| 10 | `recommended` | [orchestrator-as-routing-ui](./orchestrator-as-routing-ui.md) | Orchestrators route on bounded outputs; subagents normalize unstructured data; nested dispatch is runtime-dependent | A skill orchestrates two or more subagents |
| 11 | `recommended` | [subagent-default-execution](./subagent-default-execution.md) | Apply the two-question test per step; mix inline and delegated steps in one skill | Every step in a skill's execution sequence |
| 12 | `recommended` | [earned-complexity](./earned-complexity.md) | Every part of a package must earn its place against the Material Issue Gate | Before approving any addition to a skill package |
| 13 | `recommended` | [progressive-disclosure](./progressive-disclosure.md) | Three load levels (`SKILL.md`, `references/`, `subagents/`) gate content to the smallest layer that still works | A skill whose total content does not fit comfortably in `SKILL.md` |
| 14 | `recommended` | [phase-execution-cycle](./phase-execution-cycle.md) | Six-step announce/validate/execute/validate/update/gate-check cycle with bounded retries | A skill orchestrates two or more phases or carries real risk |
| 15 | `recommended` | [best-practices-compliance-gate](./best-practices-compliance-gate.md) | Apply this index as a tier-aware quality gate with `pass` / `fail` / `not applicable` verdicts | Reviewing or auditing a skill package |
| 16 | `recommended` | [identity-and-mental-model](./identity-and-mental-model.md) | Open every skill and subagent with a role, mental model, and (for judgment roles) the failure mode it counters | Authoring or reviewing any non-trivial skill or subagent file |
| 17 | `recommended` | [operating-posture](./operating-posture.md) | Define identity, posture, trade-offs, voice, and boundaries; posture must change observable behavior | Non-trivial skills where decision behavior matters more than tone |
| 18 | `recommended` | [positive-constraint-framing](./positive-constraint-framing.md) | Name allowed paths before forbidden ones; positive prose is not a hard boundary | Defining behavioral boundaries in skill or subagent prose |
| 19 | `recommended` | [instruction-reinforcement](./instruction-reinforcement.md) | Brief reminders at the top of long, risky reference files; do not repeat in every file | Long or risky reference files inside a skill package |
| 20 | `recommended` | [example-strategy](./example-strategy.md) | Use round-trip, output-format, and edge/failure examples for ambiguity-prone work | A skill produces format-sensitive output or judgment-heavy decisions |
| 21 | `recommended` | [template-extraction](./template-extraction.md) | Extract large self-contained templates over ~80 lines; keep small templates inline | A `SKILL.md` contains a long, self-contained output template or reference table |
| 22 | `recommended` | [external-information-linking](./external-information-linking.md) | Link to canonical URLs by default; bundle snapshots only with declared provenance | A skill references external docs, RFCs, or papers |
| 23 | `recommended` | [incremental-file-writing](./incremental-file-writing.md) | Skeleton plus targeted section edits for large, fragile, or contractually growing artifacts | A skill produces a large multi-section artifact |
| 24 | `recommended` | [skill-section-order](./skill-section-order.md) | Frontmatter, title, inputs, pipeline, registry, behavior, execution, example in that order | Authoring or editing a `SKILL.md` |
| 25 | `recommended` | [subagent-section-order](./subagent-section-order.md) | Frontmatter, title, inputs, instructions, output format, scope, escalation in that order | Authoring or editing a subagent file |
| 26 | `recommended` | [subagent-registry-format](./subagent-registry-format.md) | Three-column table (`Subagent` / `Path` / `Purpose`), one row per subagent, paths relative to skill folder | A skill dispatches to more than one subagent |
| 27 | `optional-style` | [naming-conventions](./naming-conventions.md) | Skills use gerunds, subagents use role nouns, frontmatter names match kebab-case file/directory names | Naming a new first-party skill or subagent |
| 28 | `optional-style` | [phase-transition-banner](./phase-transition-banner.md) | Forty-hyphen `Phase N/TOTAL - Name` banner before each phase; subagents do not emit phase markers | Multi-phase orchestrator wants to make phase transitions visible |

## Supporting reference

- [Quick Reference: Skill File Structure](./quick-reference-skill-structure.md)
  — folder layout for a typical skill.

## Removed / renamed files

The directory previously held a smaller number of multi-topic files;
each multi-topic file has been split into one practice per file. Any
caller that still links into an old filename should be updated to
point at the new file in the row below.

| Old file | New location |
| --- | --- |
| `context-and-payload-management.md` | Split into [progressive-disclosure](./progressive-disclosure.md), [context-window-protection](./context-window-protection.md), [template-extraction](./template-extraction.md), [handoff-file-dispatch](./handoff-file-dispatch.md), [incremental-file-writing](./incremental-file-writing.md), [external-information-linking](./external-information-linking.md) |
| `validation-and-escalation.md` | Split into [phase-execution-cycle](./phase-execution-cycle.md), [critical-output-gates](./critical-output-gates.md), [best-practices-compliance-gate](./best-practices-compliance-gate.md), [empirical-validation](./empirical-validation.md), [escalation-categories](./escalation-categories.md) |
| `behavioral-prompt-contract.md` | Split into [identity-and-mental-model](./identity-and-mental-model.md), [operating-posture](./operating-posture.md), [positive-constraint-framing](./positive-constraint-framing.md), [instruction-reinforcement](./instruction-reinforcement.md), [example-strategy](./example-strategy.md) |
| `structural-conventions.md` | Split into [skill-section-order](./skill-section-order.md), [subagent-section-order](./subagent-section-order.md), [subagent-registry-format](./subagent-registry-format.md), [naming-conventions](./naming-conventions.md) |
| `orchestrator-as-routing-ui.md` (phase-banner section) | Phase-banner content moved to [phase-transition-banner](./phase-transition-banner.md); the rest of the practice stays in [orchestrator-as-routing-ui](./orchestrator-as-routing-ui.md) |
