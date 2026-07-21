# Scouting-to-Improvement Suite

Two reusable prompts that together audit and (optionally) rebuild a
first-party skill under `skills/`:

| File | Role |
| ---- | ---- |
| [`scouting-phase.prompt.md`](./scouting-phase.prompt.md) | Phase 1 — read-only cartography of the current skill plus bounded external pattern research. Produces a nine-file evidence dossier under `outputs/scouting-phase-{skill-name}/`. |
| [`improving-skill-phase.prompt.md`](./improving-skill-phase.prompt.md) | Phase 2 — clean-room adversarial audit of the dossier, then (after explicit approval) a rebuilt replacement under `skills/{skill-name}/`, or an evidence-backed `no_build`. |
| [`scouting-handoff-contract.md`](./scouting-handoff-contract.md) | The single normative definition of the phase boundary (schema, grammars, enums, algorithms). Both prompts cite it; phase 1 records its SHA-256 in the handoff and phase 2 verifies that hash. Editing it requires bumping the three version literals in all three files. |

## How to run the suite

1. **Session A — scout.** In a fresh session, load `scouting-phase.prompt.md`
   and select the skill. The run only reads the skill and writes the dossier.
   It ends by reporting a terminal status; only `complete` is eligible for
   phase 2.
2. **Preserve the skill reversibly.** Phase 2 requires `skills/{skill-name}/`
   to be absent, never deletes it itself, and cannot restore it from the
   dossier. Before removing it, pick one route:
   - `git_recoverable` — valid when scouting reported the skill subtree
     clean at closeout: note the already-containing commit as your restore
     handle, then delete the working-tree copy. If scouting reported it
     dirty, committing now would change the target after scouting and phase
     2 will stop as stale — either commit and re-run scouting, or use
     external quarantine and accept that continuity is unverifiable. Editing
     the skill after scouting has the same effect: phase 2 compares and will
     send you back to re-scout.
   - `external_quarantine` — move the directory outside the repository, or to
     a Git-ignored path that is not under `skills/`, `.agents/skills/`,
     `.claude/skills/`, or any run root.

   Do **not** rename it to a sibling like `skills/{skill-name}-old/` or move
   it into a runtime discovery root — that leaves a stale, discoverable copy
   active and defeats the transition. You may also defer removal: phase 2
   runs a readiness preflight first (its only write is one registered
   exchange file under the ignored `.handoffs/` root — it never touches the
   skill or creates outputs) and will tell you when it is safe to remove the
   target.
3. **Session B — improve.** Start a **new** session (the clean-room premise
   assumes no prior-skill content in context) and load
   `improving-skill-phase.prompt.md` with the dossier path and, ideally, your
   `TARGET_PRESERVATION` declaration. The run preflights, audits, proposes an
   outcome, and pauses for your approval before writing anything under
   `skills/`.
4. **After the terminal response.** Every outcome that leaves the target
   absent or partial states the exact restore action. `no_build` means the
   audit or you decided against rebuilding — restore the original from your
   handle if you want it back. `rebuilt` means the replacement passed
   scenario, compliance, structural, and mutation gates.

## Rules of the road

- **One run at a time, per repository.** Both phases treat unexpected
  Git-visible changes as drift and will block. Do not run a second scouting
  or improvement run (for any skill) concurrently with an active run, and do
  not commit unrelated work mid-run.
- **Artifacts stay local.** `outputs/scouting-phase-*/`,
  `outputs/improving-skill-phase-*/`, and `.handoffs/` are Git-ignored and
  must never be committed. Dossiers persist for resume; handoffs are
  ephemeral.
- **Repo integration is follow-up work.** Outside its Git-ignored run
  artifacts (`outputs/improving-skill-phase-*/`, `.handoffs/`), the
  improvement run mutates only `skills/{skill-name}/`. After `rebuilt` or a retirement decision, check the
  repo-level consumers yourself: the `README.md` skill catalog, cross-skill
  references, and (for vendored mirrors) the managing tool for
  `.agents/skills/` / `.claude/skills/` / `skills-lock.json`. The terminal
  response lists known follow-ups but cannot apply them.
- **Staleness.** Phase 2 checks the dossier's recorded revision against
  current `HEAD`. If the skill changed after scouting, it will tell you to
  re-scout rather than audit stale evidence.
