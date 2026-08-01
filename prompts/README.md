# Scouting-to-Improvement Suite

Two prompts provide a small, repeatable workflow for understanding and rewriting a first-party skill.

| File | Purpose |
| --- | --- |
| [`scouting-phase.prompt.md`](./scouting-phase.prompt.md) | Document one skill and research comparable public skills. |
| [`improving-skill-phase.prompt.md`](./improving-skill-phase.prompt.md) | Assess the dossier, propose a redesign, obtain approval, rewrite, and validate. |
| [`scouting-handoff-contract.md`](./scouting-handoff-contract.md) | Defines the small three-file interface between the phases. |

## Workflow

1. Run the scouting prompt and select `skills/{skill-name}/`.
2. Phase 1 inventories the complete package without executing or modifying it, reading at decision-relevant depth and disclosing which files were sampled.
3. Phase 1 researches exact public skill definitions using terms derived from the target's purpose, mechanisms, and failure modes.
4. Review the three-file dossier under `outputs/scouting-phase-{skill-name}/`:
   - `INDEX.md`
   - `current-skill.md`
   - `public-patterns.md`
5. Run the improving prompt with that dossier. Supply `IMPROVEMENT_MANDATES` if you have specific concerns, or reply `none` when asked.
6. Phase 2 verifies that the target still matches the phase-1 file inventory and assesses the documented skill.
7. If no rewrite is warranted, phase 2 records `no_build` and stops. Otherwise it writes a proposal.
8. Review the verdict, capability changes, borrowed mechanisms, mandate dispositions, exact file operations, and validation plan.
9. Reply `approve`, `revise`, or `stop`. `revise` is where you push back on any disposition; it produces a new manifest that needs its own approval.
10. After approval, phase 2 changes only the displayed manifest and validates the replacement.

Each phase announces real transitions as `Phase N/5` (scouting) or `Phase N/6` (improvement), and each records why it stopped researching.

## Design Principles

- **Cartography before redesign.** Phase 1 reports what exists, including cited deficiencies and ranked opportunities; phase 2 designs the solutions.
- **Adversarial, not hostile.** Both phases test claims against inspected evidence, treat the existing skill as a mutable baseline rather than a quality standard, and state negative findings when evidence supports them.
- **Bounded effort.** Research and repair rounds are explicitly limited, and reading targets decision-relevant depth. Work stops at source limits or diminishing returns rather than at a clock.
- **Ideas, not copies.** Public skills contribute mechanisms and evidence. The replacement uses original wording and records source and license concerns.
- **Approval per manifest.** No skill file changes until the exact operation manifest is approved, and approval covers only the manifest displayed at that moment. Any later change to paths, operations, behavior, permissions, or scope needs a new preview and a new decision.
- **Evidence over emphasis.** Author mandates and dossier findings merge into one assessment queue prioritized by severity and evidence, never by source. Mandates are hypotheses; approval authorizes mutation, not an evidence override.
- **Earned mechanisms.** Concurrency, deterministic scripts, and state-machine artifacts are added only when evidence justifies them, and the evaluation stays visible even when the answer is no.
- **Small fixed outputs.** Phase 1 writes three files. Phase 2 writes four report files plus approved target operations.
- **Drift fails loudly.** If the target no longer matches the scouting inventory, rerun phase 1.
- **Restart instead of resume.** Interrupted or invalid runs start cleanly. There are no checkpoint schemas, handoff registries, packet hashes, or repair state machines.
- **Tool-managed files stay tool-managed.** The suite never hand-edits `.agents/skills/`, `.claude/skills/`, or `skills-lock.json`.

## Outputs

Phase 2 writes these local report files under `outputs/improving-skill-phase-{skill-name}/`:

- `INDEX.md`
- `assessment.md`
- `proposal.md`
- `validation.md`

A successful `rebuilt` result means the approved operations were applied and the structural, reference, portability, behavior-when-available, and mutation-scope checks passed. A `static_only` behavior check is disclosed as a limitation rather than presented as observed execution, and a validation step that could not run — such as `skills-ref validate` when the tool is unavailable — is reported as unavailable rather than implied to have passed.
