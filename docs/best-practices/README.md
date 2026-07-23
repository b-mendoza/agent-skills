# Best Practices for Writing Skills and Subagent Definitions

This README is the canonical entry point for the skill-authoring
best-practice library. Every best practice that lives in this
directory appears in the master index below exactly once. There is no
practice content in this file; the master index links to the file
that owns each practice in full.

## How to use this index

Load this README first. A `mandatory` practice applies whenever its
trigger condition holds — check each mandatory row's trigger against
the skill you are authoring, not against the task you were asked to
do. `recommended` practices are expected for non-trivial skills and
may be intentionally scoped down with a stated reason.
`optional-style` matters only when strict repo style is the explicit
task. Then read only the linked files you actually need for the
current decision. Each practice file uses the same seven-section
layout, so the reader can scan to the section that answers the
question without re-reading the whole file.

## Practice tiers

| Tier             | Review effect                                                                          | Purpose                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `mandatory`      | A miss is a material gap unless the skill declares an intentional exception            | Safety, portability, mutation scope, output contracts, lifecycle, approval gates, and handoff contracts whose failure can cause agent misbehavior or data loss |
| `recommended`    | Expected for non-trivial skills; may be intentionally scoped down with a stated reason | Architecture, behavioral, and maintainability practices that materially shape decision behavior                                                |
| `optional-style` | Improves consistency but should not block unless strict repo style is the task         | House conventions and UI affordances                                                                                                           |

## Master index

The index below is sorted by tier (`mandatory` → `recommended` →
`optional-style`). Within each tier, rows use a maintained,
hand-curated severity order: practices that change more about how the
agent decides, that gate more state transitions, that affect more
files, or that block more workflows appear higher within their tier.
When severity is close, preserve the existing relative order unless a
material impact difference makes a reorder useful.

Maintenance rule: when a file is added, removed, renamed, or
intentionally reordered under `docs/best-practices/`, update this
master index in the same change. Auditors that consume this index
should treat the table as the source of truth for practice
membership and order.

| Order | Tier             | Best practice                                                             | One-line summary                                                                                                          | Primary trigger                                                                      |
| ----- | ---------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1     | `mandatory`      | [runtime-portability-matrix](./runtime-portability-matrix.md)             | Portable skills name common, mapped, and unsupported runtime features explicitly                                          | Authoring or reviewing a skill that targets both OpenCode and Claude Code            |
| 2     | `mandatory`      | [frontmatter-contract](./frontmatter-contract.md)                         | Frontmatter `name` matches directory/basename exactly; `description` is authored as the routing classifier                | Creating or editing any skill or subagent frontmatter                                |
| 3     | `mandatory`      | [mutation-scope-boundaries](./mutation-scope-boundaries.md)               | Mutating skills declare `MUTATION_LIMITS`, pass them to every subagent, and tighten scope during repair                   | Authoring or reviewing a skill that edits, creates, deletes, renames, or moves files |
| 4     | `mandatory`      | [human-in-the-loop-checkpoints](./human-in-the-loop-checkpoints.md)       | Hard-to-reverse or outward-facing actions require approval over the exact artifact, bound to the current run              | A skill posts, commits, mutates externally, or expands scope                         |
| 5     | `mandatory`      | [critical-output-gates](./critical-output-gates.md)                       | Declared critical outputs are protected by named, predicate-backed gates with bounded repair                              | A skill produces an output other components rely on                                  |
| 6     | `mandatory`      | [input-output-contracts](./input-output-contracts.md)                     | Explicit input and output contracts define every data boundary between pipeline stages                                    | A skill or subagent takes structured inputs or produces structured outputs           |
| 7     | `mandatory`      | [handoff-file-dispatch](./handoff-file-dispatch.md)                       | File-based YAML handoffs are conditional; when used, they carry explicit keys, inline enums, and run-scoped paths         | An orchestrator exchanges payloads that need files rather than inline replies        |
| 8     | `mandatory`      | [context-window-protection](./context-window-protection.md)               | Keep raw inspection out of the orchestrator, collect summaries, treat retrieved content as untrusted data                 | A skill orchestrates more than one step or loads any external content                |
| 9     | `mandatory`      | [artifact-lifecycle](./artifact-lifecycle.md)                             | Classify artifacts by role (dispatch payload, resume state, deliverable) with run-scoped cleanup and separate commit authority | A skill produces files at all                                                    |
| 10    | `mandatory`      | [empirical-validation](./empirical-validation.md)                         | Validate by observed behavior with eval cases and observable assertions, not self-report                                  | A skill claims to fix, validate, or guard a behavior                                 |
| 11    | `mandatory`      | [escalation-categories](./escalation-categories.md)                       | Every subagent declares enumerated failure categories with routes; missing capabilities fail loudly                       | Every dispatched subagent and every routed orchestrator phase                        |
| 12    | `recommended`    | [deterministic-execution](./deterministic-execution.md)                   | Name nondeterminism sources and remove them: exact derivations, stable ordering, single clock capture, same-input-same-route | A skill's output or routing must be reproducible across runs                      |
| 13    | `recommended`    | [orchestrator-as-routing-ui](./orchestrator-as-routing-ui.md)             | Orchestrators route on bounded outputs; subagents normalize unstructured data; nested dispatch is runtime-dependent       | A skill orchestrates two or more subagents                                           |
| 14    | `recommended`    | [state-machine-artifacts](./state-machine-artifacts.md)                   | Externalized FSMs have exactly one normative source, routed statuses, bounded loops, and reachable terminals              | A multi-phase skill ships `state-machine.md` or `flow-diagram.md`                    |
| 15    | `recommended`    | [subagent-default-execution](./subagent-default-execution.md)             | Apply the two-question test per step; mix inline and delegated steps in one skill                                         | Every step in a skill's execution sequence                                           |
| 16    | `recommended`    | [earned-complexity](./earned-complexity.md)                               | Every part of a package must earn its place against the Material Issue Gate                                               | Before approving any addition to a skill package                                     |
| 17    | `recommended`    | [progressive-disclosure](./progressive-disclosure.md)                     | Three load levels gate content to the smallest layer that still works; early tokens carry the standing instructions       | A skill whose total content does not fit comfortably in `SKILL.md`                   |
| 18    | `recommended`    | [phase-execution-cycle](./phase-execution-cycle.md)                       | Six-step announce/validate/execute/validate/update/gate-check cycle with bounded retries                                  | A skill orchestrates two or more phases or carries real risk                         |
| 19    | `recommended`    | [trigger-and-description-authoring](./trigger-and-description-authoring.md) | Author the description as a classifier: intents, synonyms, exclusions, and should/should-not trigger cases              | Writing or revising a skill's frontmatter description                                |
| 20    | `recommended`    | [best-practices-compliance-gate](./best-practices-compliance-gate.md)     | Apply this index as a tier-aware quality gate with `pass` / `fail` / `not applicable` verdicts                            | Reviewing or auditing a skill package                                                |
| 21    | `recommended`    | [identity-and-mental-model](./identity-and-mental-model.md)               | Open every skill and subagent with a role, mental model, and (for judgment roles) the failure mode it counters            | Authoring or reviewing any non-trivial skill or subagent file                        |
| 22    | `recommended`    | [operating-posture](./operating-posture.md)                               | Define decision policy — signals, trade-offs, refusals — where each bullet names the decision it changes                  | Non-trivial skills where decision behavior matters more than tone                    |
| 23    | `recommended`    | [positive-constraint-framing](./positive-constraint-framing.md)           | Name allowed paths before forbidden ones; positive prose is not a hard boundary                                           | Defining behavioral boundaries in skill or subagent prose                            |
| 24    | `recommended`    | [instruction-reinforcement](./instruction-reinforcement.md)               | Brief reminders at the top of long, risky reference files; do not repeat in every file                                    | Long or risky reference files inside a skill package                                 |
| 25    | `recommended`    | [example-strategy](./example-strategy.md)                                 | Use round-trip, output-format, and edge/failure examples kept synchronized with their contracts                           | A skill produces format-sensitive output or judgment-heavy decisions                 |
| 26    | `recommended`    | [template-extraction](./template-extraction.md)                           | Extract large self-contained templates over ~80 lines into `references/`; keep small templates inline                     | A `SKILL.md` contains a long, self-contained output template or reference table      |
| 27    | `recommended`    | [external-information-linking](./external-information-linking.md)         | Runtime-required content works offline; canonical URLs carry provenance and freshness                                     | A skill references external docs, RFCs, or papers                                    |
| 28    | `recommended`    | [incremental-file-writing](./incremental-file-writing.md)                 | Skeleton plus targeted section edits for large, fragile, or contractually growing artifacts                               | A skill produces a large multi-section artifact at runtime                           |
| 29    | `recommended`    | [skill-section-order](./skill-section-order.md)                           | Four invariant anchors (identity, contracts, boundaries, examples) with starter templates for skills and subagents        | Authoring or editing a `SKILL.md` or subagent file                                   |
| 30    | `recommended`    | [subagent-registry-format](./subagent-registry-format.md)                 | Core `Subagent` / `Path` / `Purpose` columns, one row per subagent, paths verified on disk                                | A skill dispatches to two or more subagents                                          |
| 31    | `optional-style` | [naming-conventions](./naming-conventions.md)                             | Prefer gerunds for new skills and role nouns for subagents; never rename established skills for style                     | Naming a new first-party skill or subagent                                           |

## Supporting reference

- [Quick Reference: Skill File Structure](./quick-reference-skill-structure.md)
  — folder layout for a typical skill.
