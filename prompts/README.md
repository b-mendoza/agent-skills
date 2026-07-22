# Scouting-to-Improvement Suite

Two prompts provide a small, repeatable workflow for understanding and rewriting
a first-party skill.

| File | Purpose |
| ---- | ------- |
| [`scouting-phase.prompt.md`](./scouting-phase.prompt.md) | Document one skill and research comparable public skills. |
| [`improving-skill-phase.prompt.md`](./improving-skill-phase.prompt.md) | Assess the dossier, propose a redesign, obtain approval, rewrite, and validate. |
| [`scouting-handoff-contract.md`](./scouting-handoff-contract.md) | Defines the small three-file interface between the phases. |

## Workflow

1. Run the scouting prompt and select `skills/{skill-name}/`.
2. Phase 1 reads the complete package without executing or modifying it.
3. Phase 1 researches exact public skill definitions using terms derived from the
   target's purpose, mechanisms, and failure modes.
4. Review the three-file dossier under
   `outputs/scouting-phase-{skill-name}/`:
   - `INDEX.md`
   - `current-skill.md`
   - `public-patterns.md`
5. Run the improving prompt with that dossier.
6. Phase 2 verifies that the target still matches the phase-1 file inventory
   and assesses the documented skill.
7. If no rewrite is warranted, phase 2 records `no_build` and stops. Otherwise it
   writes a proposal.
8. Review the verdict, capability changes, borrowed mechanisms, exact file
   operations, and validation plan.
9. Reply `approve`, `revise`, or `stop`.
10. After approval, phase 2 changes only the displayed manifest and validates
    the replacement.

## Design Principles

- **Documentation before redesign.** Phase 1 reports what exists; phase 2 decides
  what should change.
- **Ideas, not copies.** Public skills contribute mechanisms and evidence. The
  replacement uses original wording and records source and license concerns.
- **One approval boundary.** No skill file changes until the exact operation
  manifest is approved.
- **Small fixed outputs.** Phase 1 writes three files. Phase 2 writes four report
  files plus approved target operations.
- **Drift fails loudly.** If the target no longer matches the scouting inventory,
  rerun phase 1.
- **Restart instead of resume.** Interrupted or invalid runs start cleanly. There
  are no checkpoint schemas, handoff registries, packet hashes, or repair state
  machines.
- **Tool-managed files stay tool-managed.** The suite never hand-edits
  `.agents/skills/`, `.claude/skills/`, or `skills-lock.json`.

## Outputs

Phase 2 writes these local report files under
`outputs/improving-skill-phase-{skill-name}/`:

- `INDEX.md`
- `assessment.md`
- `proposal.md`
- `validation.md`

A successful `rebuilt` result means the approved operations were applied and the
structural, reference, behavior-when-available, and mutation-scope checks passed.
A `static_only` behavior check is disclosed as a limitation rather than presented
as observed execution.
