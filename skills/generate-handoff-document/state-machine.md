# State Machine — generate-handoff-document

Finite-state execution model for this skill. Mermaid rendering lives in
[`flow-diagram.md`](./flow-diagram.md). Feature requirement tags are indexed in
[`references/feature-registry.md`](./references/feature-registry.md).

## Run-scoped variables

| Variable | Initial | Rules |
| -------- | ------- | ----- |
| `repair_cycles` | 0 | Increment on each entry to `PlanRepair`. Cap is 3 total repair cycles per run. |
| `TRANSCRIPT_FILE` | unset | Set in `MaterializeSource` from a readable file or written snapshot. |
| `CHUNKED` | `no` | Set `yes` when transcript line count exceeds 2,000. |
| `PRIOR_HANDOFF_FILE` | unset | Set in update mode to the existing target before merge assembly. |
| `EXTERNAL` | unset | One of `SKIPPED`, `USED`, `UNAVAILABLE` after `ExternalDecide`. |
| `CLAIMS` | unset | `PASS`/`WARN`/`ERROR` from validator, or intentional `SKIPPED`. |

## States

| State | Kind | Phase | Actor |
| ----- | ---- | ----- | ----- |
| `Intake` | active | 1. Intake and safety | Orchestrator |
| `AskTarget` | wait | 1 | Orchestrator → user |
| `PathSafety` | active | 1 | Orchestrator |
| `AskUpdateMode` | wait | 1 | Orchestrator → user |
| `DeriveContracts` | active | 1 | Orchestrator |
| `MaterializeSource` | active | 2. Source materialization | Orchestrator |
| `AskTranscript` | wait | 2 | Orchestrator → user |
| `ExternalDecide` | active | 2 | Orchestrator |
| `ExtractContext` | active | 3. Extract context | `context-extractor` + verify |
| `DocumentInsights` | active | 4. Document insights | `insight-documenter` + verify |
| `AskEmptySession` | wait | 4 | Orchestrator → user |
| `ValidateClaims` | active | 5. Validate claims | `claim-validator` + verify |
| `SkipClaims` | active | 5 | Orchestrator |
| `AssembleHandoff` | active | 6. Assemble handoff | `document-assembler` + verify |
| `ReviewHandoff` | active | 7. Review and repair | `handoff-reviewer` |
| `PlanRepair` | active | 7 | Orchestrator |
| `CompletedReviewPass` | terminal | — | — |
| `CompletedReviewWarn` | terminal | — | — |
| `CompletedDeclinedEmpty` | terminal | — | — |
| `BlockedUnclearTarget` | terminal | — | — |
| `BlockedUnsafePath` | terminal | — | — |
| `BlockedExternal` | terminal | — | — |
| `BlockedStage` | terminal | — | — |
| `BlockedArtifact` | terminal | — | — |
| `BlockedRepairExhausted` | terminal | — | — |

Producer states (`ExtractContext`, `DocumentInsights`, `ValidateClaims`,
`AssembleHandoff`) embed the dispatch-verify protocol in
[`references/data-contracts.md`](./references/data-contracts.md): one same-input
`ERROR` retry, mechanical artifact checks, then route on verified outcome.

## Transitions

| From | To | Guard / event |
| ---- | -- | ------------- |
| `[*]` | `Intake` | Skill invoked |
| `Intake` | `AskTarget` | `TARGET_FILE` unclear |
| `Intake` | `PathSafety` | `TARGET_FILE` clear |
| `AskTarget` | `PathSafety` | Answer resolves to a path |
| `AskTarget` | `BlockedUnclearTarget` | Unresolvable or abandoned |
| `PathSafety` | `AskUpdateMode` | Path safe ∧ target exists ∧ `UPDATE_MODE` absent |
| `PathSafety` | `DeriveContracts` | Path safe ∧ (target absent ∨ `UPDATE_MODE` known); backup to `<stem>.prev.md` when overwriting or updating |
| `PathSafety` | `BlockedUnsafePath` | Any path-safety criterion fails |
| `AskUpdateMode` | `AskTarget` | User chooses new path |
| `AskUpdateMode` | `DeriveContracts` | overwrite or update (after backup / `PRIOR_HANDOFF_FILE`) |
| `AskUpdateMode` | `BlockedUnclearTarget` | Abandoned |
| `DeriveContracts` | `MaterializeSource` | Sibling paths derived; absolute bundled refs resolved |
| `MaterializeSource` | `ExternalDecide` | `TRANSCRIPT_FILE` set and faithful |
| `MaterializeSource` | `AskTranscript` | Live snapshot cannot be faithful |
| `AskTranscript` | `MaterializeSource` | User supplies readable transcript file |
| `AskTranscript` | `BlockedUnclearTarget` | Abandoned without usable source |
| `ExternalDecide` | `ExtractContext` | `EXTERNAL: SKIPPED` or `USED` or optional `UNAVAILABLE` |
| `ExternalDecide` | `BlockedExternal` | Required current dependency unreachable |
| `ExtractContext` | `DocumentInsights` | Verified `CONTEXT: PASS` or `WARN` |
| `ExtractContext` | `BlockedStage` | Stage `ERROR` after retry, or unexpected fail/skip |
| `ExtractContext` | `BlockedArtifact` | Artifact verify failed twice |
| `DocumentInsights` | `AskEmptySession` | Verified insights ∧ `qa_log` and `insights` empty ∧ mandate trivial |
| `DocumentInsights` | `ValidateClaims` | Verified insights ∧ not empty-session ∧ `TRACKING_FILES` present |
| `DocumentInsights` | `SkipClaims` | Verified insights ∧ not empty-session ∧ `TRACKING_FILES` absent |
| `DocumentInsights` | `BlockedStage` | Stage error after retry / unexpected fail |
| `DocumentInsights` | `BlockedArtifact` | Artifact verify failed twice |
| `AskEmptySession` | `ValidateClaims` | User continues ∧ `TRACKING_FILES` present |
| `AskEmptySession` | `SkipClaims` | User continues ∧ `TRACKING_FILES` absent |
| `AskEmptySession` | `CompletedDeclinedEmpty` | User declines hollow handoff |
| `ValidateClaims` | `AssembleHandoff` | Verified `CLAIMS: PASS` or `WARN` |
| `ValidateClaims` | `SkipClaims` | Intentional `CLAIMS: SKIPPED` |
| `ValidateClaims` | `BlockedStage` | Stage error after retry / unexpected fail |
| `ValidateClaims` | `BlockedArtifact` | Artifact verify failed twice |
| `SkipClaims` | `AssembleHandoff` | Record `CLAIMS: SKIPPED` plus verification warning |
| `AssembleHandoff` | `ReviewHandoff` | Verified `HANDOFF: PASS` or `WARN` |
| `AssembleHandoff` | `BlockedStage` | Stage error after retry / unexpected fail |
| `AssembleHandoff` | `BlockedArtifact` | Artifact verify failed twice |
| `ReviewHandoff` | `CompletedReviewPass` | `REVIEW: PASS` |
| `ReviewHandoff` | `CompletedReviewWarn` | `REVIEW: WARN` |
| `ReviewHandoff` | `PlanRepair` | `REVIEW: FAIL` ∧ `repair_cycles` < 3 |
| `ReviewHandoff` | `BlockedRepairExhausted` | `REVIEW: FAIL` ∧ `repair_cycles` ≥ 3 |
| `ReviewHandoff` | `BlockedStage` | `REVIEW: ERROR` after retry |
| `PlanRepair` | `ExtractContext` | Earliest rerun target is context (increment `repair_cycles`) |
| `PlanRepair` | `DocumentInsights` | Earliest rerun target is insights |
| `PlanRepair` | `ValidateClaims` | Earliest rerun target is claims ∧ tracking present |
| `PlanRepair` | `SkipClaims` | Earliest rerun target is claims ∧ tracking absent |
| `PlanRepair` | `AssembleHandoff` | Earliest is assembly, or no parseable target (default) |
| `PlanRepair` | `ReviewHandoff` | Earliest rerun target is review only |
| `CompletedReviewPass` | `[*]` | Emit `Completed: review pass` |
| `CompletedReviewWarn` | `[*]` | Emit `Completed: review pass with warnings` |
| `CompletedDeclinedEmpty` | `[*]` | Emit `Completed: handoff declined (empty session)` |
| `BlockedUnclearTarget` | `[*]` | Emit `Blocked: unclear target path` |
| `BlockedUnsafePath` | `[*]` | Emit `Blocked: unsafe writes or missing readable/writable path` |
| `BlockedExternal` | `[*]` | Emit `Blocked: required external dependency unavailable` |
| `BlockedStage` | `[*]` | Emit `Blocked: subagent error, failure, or unexpected skip` |
| `BlockedArtifact` | `[*]` | Emit `Blocked: artifact contract violation` |
| `BlockedRepairExhausted` | `[*]` | Emit `Blocked: repair limit exhausted` |

## Terminal states

| Terminal state | Exact string | Kind |
| -------------- | ------------ | ---- |
| `CompletedReviewPass` | `Completed: review pass` | Success |
| `CompletedReviewWarn` | `Completed: review pass with warnings` | Success |
| `CompletedDeclinedEmpty` | `Completed: handoff declined (empty session)` | Success |
| `BlockedUnclearTarget` | `Blocked: unclear target path` | Stop |
| `BlockedUnsafePath` | `Blocked: unsafe writes or missing readable/writable path` | Stop |
| `BlockedExternal` | `Blocked: required external dependency unavailable` | Stop |
| `BlockedStage` | `Blocked: subagent error, failure, or unexpected skip` | Stop |
| `BlockedArtifact` | `Blocked: artifact contract violation` | Stop |
| `BlockedRepairExhausted` | `Blocked: repair limit exhausted` | Stop |

Readiness rule: the run is complete only at one of the three success terminals;
every other exit uses the exact blocked string above.

## Reachability

Every active and wait state is reachable from `Intake` under documented guards.
Every terminal is reachable. There are no dead states: repair re-enters the
producer chain; wait states either resume or block/decline.
