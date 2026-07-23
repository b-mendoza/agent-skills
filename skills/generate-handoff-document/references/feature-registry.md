# Feature Registry

Inline tags such as `[F-01]` are cross-cutting requirement anchors used in
`SKILL.md`, references, and subagents. This file is the package index for those
ids. Tags do not change runtime behavior by themselves; the linked contracts do.

| Id | Requirement | Primary owners |
| -- | ----------- | -------------- |
| `F-01` | Transcript materialization before subagent read; never reconstruct from memory | Orchestrator, transcript-reading subagents |
| `F-02` | Bundled reference paths passed as absolute paths | Orchestrator |
| `F-03` | Update/overwrite preserves history via `<stem>.prev.md` and carry-forward | Orchestrator, `context-extractor`, template |
| `F-04` | Mechanical verification of every stage output — producers and reviewer — before trusting a claimed status | Orchestrator, reviewer checklist |
| `F-05` | Path-safety checklist is pass/fail and named on failure | Orchestrator, `data-contracts.md` |
| `F-06` | Continuation-readiness sub-criteria are operational | `handoff-reviewer`, checklist, `data-contracts.md` |
| `F-07` | Honest emptiness: zero-states, no padding, vacuity advisory | `insight-documenter`, assembler, contracts |
| `F-08` | Pause-and-resume only for gate-changing questions; exact blocked strings; every wait state has an abandonment route | Orchestrator |
| `F-09` | Instruction/data firewall on transcripts, tracking files, prior handoffs, fetches | All stages |
| `F-10` | `PASS` requires zero warnings; nonzero warnings force `WARN`; `CLAIMS: SKIPPED` is a report line, not a warning | Status SSOT in `data-contracts.md` |
| `F-11` | Repair limit three cycles; single increment point; canonical rerun order; repair invalidates downstream verification | Orchestrator, `data-contracts.md` |
| `F-12` | `data-contracts.md` wins on status/schema mismatch | All files linking contracts |
| `F-13` | Extension-agnostic stem naming and metadata defaults | Orchestrator, contracts |
| `F-14` | Status routing: claims skip decided by orchestrator routing (never by a dispatched validator); review `FAIL` → repair | Orchestrator, reviewer |
| `F-15` | Chunked transcript processing above 2,000 lines | Transcript-reading producers |
| `F-16` | Working Artifacts manifest required for cold-start readers | Assembler, reviewer, contracts |
| `F-17` | Secrets and personal data render as `[REDACTED]` in every written artifact | All writing stages, reviewer |
| `F-18` | Failed approaches captured as `failed_approach` insights and surfaced for the next agent | `insight-documenter`, assembler, template |
