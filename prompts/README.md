# Scouting-to-Improvement Suite

Two reusable prompts that together audit and optionally rebuild a first-party
skill under `skills/`:

| File | Role |
| ---- | ---- |
| [`scouting-phase.prompt.md`](./scouting-phase.prompt.md) | Phase 1 — read-only cartography plus bounded external pattern research. Produces a nine-file dossier under `outputs/scouting-phase-{skill-name}/`. |
| [`improving-skill-phase.prompt.md`](./improving-skill-phase.prompt.md) | Phase 2 — clean-room adversarial audit, informed approval, optional replacement build, and observed validation. |
| [`scouting-handoff-contract.md`](./scouting-handoff-contract.md) | Single normative phase boundary: schemas, registries, enums, ids, hashes, baselines, custody algorithms, anchors, and zero states. Both prompts pin its SHA-256. |

The active boundary is `scouting-phase-v4` / `scouting-dossier-v4` /
`scouting-schema-v4`. V3 dossiers and pre-`improving-run-state-v2` phase-2
checkpoints are incompatible and must be regenerated. Editing the contract requires another coordinated version
bump in all three files.

## How to run the suite

1. **Session A — scout.** In a fresh session, load
   `scouting-phase.prompt.md` and select the skill. The run reads the complete
   target subtree, including hidden, untracked, and Git-ignored entries, but
   never executes target code. It writes only the local nine-file dossier. Only
   terminal `complete` is phase-2 eligible.

2. **Run phase-2 readiness before removal.** Start a new session with
   `improving-skill-phase.prompt.md` and the dossier path. Phase 2 requires
   main-thread fresh-context dispatch for its specialists. While the target is
   still present, readiness may create one registered exchange under the
   ignored `.handoffs/` root; it does not create A1 outputs or mutate the skill.
   Its target comparison retains digest values only.

3. **Preserve the skill reversibly.** After readiness passes, use one route:

   - `git_recoverable` — valid only when scouting reported
     `git_recoverable_at_closeout: true`. Record scouting's
     `repository_revision` as the restore handle, then remove the working-tree
     package. This field is stronger than a clean `git status`: it proves every
     scouted entry, including the absence of ignored/untracked/non-tree extras,
     is represented by that revision.
   - `external_quarantine` — move the directory outside the repository, or to
     a Git-ignored location that is not under `skills/`, `.agents/skills/`,
     `.claude/skills/`, or any run root. Phase 2 never reads or verifies the
     quarantined location, so continuity remains unverifiable.

   When `git_recoverable_at_closeout` is false, either make the package fully
   repository-representable and re-run scouting, or use external quarantine.
   Do not rename it to `skills/{skill-name}-old/` or put it in a runtime
   discovery root; that leaves a stale active copy.

4. **Session B — audit and decide.** Reinvoke phase 2 after the target is
   absent. It revalidates readiness, audits the dossier, creates a clean-room
   plan, and presents a deterministic approval packet. It does not write
   implementation objects until the structured reply passes the packet-bound
   approval gate.

5. **Build and validate.** If approved, phase 2 creates only manifest objects.
   Scenario validation is main-agent routed: a validator prepares sandbox and
   executor instructions, the main conversation launches the package under
   test, and a fresh validator judges transcript/effect evidence. No specialist
   launches another agent, and static prediction cannot pass release.

6. **After the terminal response.** Every outcome leaving the target absent or
   partial states the exact restore action. `no_build` is a successful audit
   decision, not a build failure. `rebuilt` means scenario, compliance,
   structural, source-binding, and mutation gates all passed.

## Optional input examples

### Exact scope expansion

`SCOPE_LIMITS` grants are exact planning permissions, not advance approval to
write. Immutable exclusions such as tooling-managed mirrors, `skills-lock.json`,
and secrets cannot be expanded.

```yaml
- path: README.md
  actions: [modify]
  destination: null
  reason: Update the first-party skill catalog entry for the approved replacement.
```

The normalized grant must appear in mutation limits, the Category B manifest,
the approval packet, and the final mutation proof before that path can change.

### Structured approval

Use the packet's current hash and the fixed reply shape:

```yaml
improving_approval:
  version: improving-approval-reply-v1
  packet_candidate_sha256: "<64-lowercase-hex>"
  decision: approve_build
  accept_all_packet_dispositions: true
  core_capability_decisions:
    CAP-0003: accept
  exception_decisions: {}
  contested_ids: []
  notes: null
```

For `approve_build`, every changed or removed core capability and every proposed
exception requires an explicit map entry. Free-form assent does not authorize
mutation.

## Rules of the road

- **One run at a time, per repository.** Both phases treat unexpected
  Git-visible or governing-source changes as drift. Do not run concurrent suite
  jobs or commit unrelated changes mid-run.
- **Artifacts stay local.** `outputs/scouting-phase-*/`,
  `outputs/improving-skill-phase-*/`, and `.handoffs/` are ignored and never
  committed. A1 persists while resumability is needed; A2 is deleted after its
  dispatch lifecycle unless explicitly retained for debugging.
- **Resume from A1 only.** A valid phase-2 resume enters the checkpointed
  `next_route`; it never recreates the provisional exchange or reinitializes
  A1. V3 checkpoints cannot resume under v4.
- **Repo integration follows the approved scope.** By default, improvement
  mutates only the replacement package. Exact non-immutable integration paths
  may be added through `SCOPE_LIMITS` and packet approval. Tooling-managed
  `.agents/skills/`, `.claude/skills/`, and `skills-lock.json` remain managing-
  tool follow-ups. Terminal output lists unresolved catalog, cross-skill, and
  mirror work.
- **Staleness is fail-loud.** Target digest drift sends the run back to
  scouting. Governing-source digest drift is disclosed as an audit/approval
  constraint. Packet, builder-envelope, source, or invocation-capability drift
  clears approval and routes through replan/reapproval before mutation.
