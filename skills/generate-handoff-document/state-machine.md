# State Machine — generate-handoff-document

Finite-state execution model for this skill. Mermaid rendering lives in [`flow-diagram.md`](./flow-diagram.md). Feature requirement tags are indexed in [`references/feature-registry.md`](./references/feature-registry.md).

## Run-scoped variables

| Variable             | Initial | Rules                                                                                                                                                    |
| -------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repair_cycles`      | 0       | Increments exactly once on each entry to `PlanRepair`, on every inbound edge; this row is the only increment rule. Cap is 3 total repair cycles per run. |
| `TRANSCRIPT_FILE`    | unset   | Set in `MaterializeSource` from a readable file or written snapshot.                                                                                     |
| `CHUNKED`            | `no`    | Set `yes` when transcript line count exceeds 2,000.                                                                                                      |
| `PRIOR_HANDOFF_FILE` | unset   | Set in update mode to the existing target before merge assembly.                                                                                         |
| `EXTERNAL`           | unset   | One of `SKIPPED`, `USED`, `UNAVAILABLE` after `ExternalDecide`.                                                                                          |
| `CLAIMS`             | unset   | `PASS`/`WARN`/`ERROR` from validator, or `SKIPPED` set by orchestrator routing when `TRACKING_FILES` is absent.                                          |

## States

| State                    | Kind     | Phase                     | Actor                         |
| ------------------------ | -------- | ------------------------- | ----------------------------- |
| `Intake`                 | active   | 1. Intake and safety      | Orchestrator                  |
| `AskTarget`              | wait     | 1                         | Orchestrator → user           |
| `PathSafety`             | active   | 1                         | Orchestrator                  |
| `AskUpdateMode`          | wait     | 1                         | Orchestrator → user           |
| `DeriveContracts`        | active   | 1                         | Orchestrator                  |
| `MaterializeSource`      | active   | 2. Source materialization | Orchestrator                  |
| `AskTranscript`          | wait     | 2                         | Orchestrator → user           |
| `ExternalDecide`         | active   | 2                         | Orchestrator                  |
| `ExtractContext`         | active   | 3. Extract context        | `context-extractor` + verify  |
| `DocumentInsights`       | active   | 4. Document insights      | `insight-documenter` + verify |
| `AskEmptySession`        | wait     | 4                         | Orchestrator → user           |
| `ValidateClaims`         | active   | 5. Validate claims        | `claim-validator` + verify    |
| `SkipClaims`             | active   | 5                         | Orchestrator                  |
| `AssembleHandoff`        | active   | 6. Assemble handoff       | `document-assembler` + verify |
| `ReviewHandoff`          | active   | 7. Review and repair      | `handoff-reviewer` + verify   |
| `PlanRepair`             | active   | 7                         | Orchestrator                  |
| `CompletedReviewPass`    | terminal | —                         | —                             |
| `CompletedReviewWarn`    | terminal | —                         | —                             |
| `CompletedDeclinedEmpty` | terminal | —                         | —                             |
| `BlockedUnclearTarget`   | terminal | —                         | —                             |
| `BlockedNoSource`        | terminal | —                         | —                             |
| `BlockedUnsafePath`      | terminal | —                         | —                             |
| `BlockedExternal`        | terminal | —                         | —                             |
| `BlockedStage`           | terminal | —                         | —                             |
| `BlockedArtifact`        | terminal | —                         | —                             |
| `BlockedRepairExhausted` | terminal | —                         | —                             |

Producer states (`ExtractContext`, `DocumentInsights`, `ValidateClaims`, `AssembleHandoff`) embed the dispatch-verify protocol in [`references/data-contracts.md`](./references/data-contracts.md): one same-input `ERROR` retry, mechanical artifact checks, then route on verified outcome. `ReviewHandoff` embeds the same protocol against the reviewer summary contract: the orchestrator parses the reviewer's first line and required summary fields before routing, and treats a missing, malformed, or unrecognized status as `REVIEW: ERROR` (one same-input retry, then block). A claimed review status is never routed on unverified.

## Transitions

| From                     | To                       | Guard / event                                                                                              |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `[*]`                    | `Intake`                 | Skill invoked                                                                                              |
| `Intake`                 | `AskTarget`              | `TARGET_FILE` unclear                                                                                      |
| `Intake`                 | `PathSafety`             | `TARGET_FILE` clear                                                                                        |
| `AskTarget`              | `PathSafety`             | Answer resolves to a path                                                                                  |
| `AskTarget`              | `BlockedUnclearTarget`   | Unresolvable or abandoned                                                                                  |
| `PathSafety`             | `AskUpdateMode`          | Path safe ∧ target exists ∧ `UPDATE_MODE` absent                                                           |
| `PathSafety`             | `DeriveContracts`        | Path safe ∧ (target absent ∨ `UPDATE_MODE` known); backup to `<stem>.prev.md` when overwriting or updating |
| `PathSafety`             | `BlockedUnsafePath`      | Any path-safety criterion fails                                                                            |
| `AskUpdateMode`          | `AskTarget`              | User chooses new path                                                                                      |
| `AskUpdateMode`          | `DeriveContracts`        | overwrite or update (after backup / `PRIOR_HANDOFF_FILE`)                                                  |
| `AskUpdateMode`          | `BlockedUnclearTarget`   | Abandoned                                                                                                  |
| `DeriveContracts`        | `MaterializeSource`      | Sibling paths derived; absolute bundled refs resolved                                                      |
| `MaterializeSource`      | `ExternalDecide`         | `TRANSCRIPT_FILE` set and faithful                                                                         |
| `MaterializeSource`      | `AskTranscript`          | Live snapshot cannot be faithful (faithfulness predicate in `references/data-contracts.md`)                |
| `AskTranscript`          | `MaterializeSource`      | User supplies readable transcript file                                                                     |
| `AskTranscript`          | `BlockedNoSource`        | Abandoned without usable source                                                                            |
| `ExternalDecide`         | `ExtractContext`         | `EXTERNAL: SKIPPED` or `USED` or optional `UNAVAILABLE`                                                    |
| `ExternalDecide`         | `BlockedExternal`        | Required current dependency unreachable                                                                    |
| `ExtractContext`         | `DocumentInsights`       | Verified `CONTEXT: PASS` or `WARN`                                                                         |
| `ExtractContext`         | `BlockedStage`           | Stage `ERROR` after retry, or unexpected fail/skip                                                         |
| `ExtractContext`         | `BlockedArtifact`        | Artifact verify failed twice                                                                               |
| `DocumentInsights`       | `AskEmptySession`        | Verified insights ∧ `qa_log` and `insights` empty ∧ mandate trivial                                        |
| `DocumentInsights`       | `ValidateClaims`         | Verified insights ∧ not empty-session ∧ `TRACKING_FILES` present                                           |
| `DocumentInsights`       | `SkipClaims`             | Verified insights ∧ not empty-session ∧ `TRACKING_FILES` absent                                            |
| `DocumentInsights`       | `BlockedStage`           | Stage error after retry / unexpected fail                                                                  |
| `DocumentInsights`       | `BlockedArtifact`        | Artifact verify failed twice                                                                               |
| `AskEmptySession`        | `ValidateClaims`         | User continues ∧ `TRACKING_FILES` present                                                                  |
| `AskEmptySession`        | `SkipClaims`             | User continues ∧ `TRACKING_FILES` absent                                                                   |
| `AskEmptySession`        | `CompletedDeclinedEmpty` | User declines hollow handoff, or abandons the question                                                     |
| `ValidateClaims`         | `AssembleHandoff`        | Verified `CLAIMS: PASS` or `WARN`                                                                          |
| `ValidateClaims`         | `BlockedStage`           | Stage error after retry / unexpected fail                                                                  |
| `ValidateClaims`         | `BlockedArtifact`        | Artifact verify failed twice                                                                               |
| `SkipClaims`             | `AssembleHandoff`        | Record `CLAIMS: SKIPPED` (report line, not a reviewer warning)                                             |
| `AssembleHandoff`        | `ReviewHandoff`          | Verified `HANDOFF: PASS` or `WARN`                                                                         |
| `AssembleHandoff`        | `BlockedStage`           | Stage error after retry / unexpected fail                                                                  |
| `AssembleHandoff`        | `BlockedArtifact`        | Artifact verify failed twice                                                                               |
| `ReviewHandoff`          | `CompletedReviewPass`    | `REVIEW: PASS`                                                                                             |
| `ReviewHandoff`          | `CompletedReviewWarn`    | `REVIEW: WARN`                                                                                             |
| `ReviewHandoff`          | `PlanRepair`             | `REVIEW: FAIL` ∧ `repair_cycles` < 3                                                                       |
| `ReviewHandoff`          | `BlockedRepairExhausted` | `REVIEW: FAIL` ∧ `repair_cycles` ≥ 3                                                                       |
| `ReviewHandoff`          | `BlockedStage`           | `REVIEW: ERROR` after retry (includes missing/malformed reviewer summary)                                  |
| `PlanRepair`             | `ExtractContext`         | Earliest rerun target is context                                                                           |
| `PlanRepair`             | `DocumentInsights`       | Earliest rerun target is insights                                                                          |
| `PlanRepair`             | `ValidateClaims`         | Earliest rerun target is claims ∧ tracking present                                                         |
| `PlanRepair`             | `SkipClaims`             | Earliest rerun target is claims ∧ tracking absent                                                          |
| `PlanRepair`             | `AssembleHandoff`        | Earliest is assembly, or no parseable target (default)                                                     |
| `PlanRepair`             | `ReviewHandoff`          | Earliest rerun target is review only                                                                       |
| `CompletedReviewPass`    | `[*]`                    | Emit `The handoff passed review.`                                                                              |
| `CompletedReviewWarn`    | `[*]`                    | Emit `The handoff passed review with warnings.`                                                                |
| `CompletedDeclinedEmpty` | `[*]`                    | Emit `No handoff was written because the empty-session handoff was declined.`                                                         |
| `BlockedUnclearTarget`   | `[*]`                    | Emit `A clear target path is needed before writing the handoff.`                                                                        |
| `BlockedNoSource`        | `[*]`                    | Emit `A usable source transcript is needed before writing the handoff.`                                                                |
| `BlockedUnsafePath`      | `[*]`                    | Emit `The handoff was not written because the path is unsafe or inaccessible.`                                            |
| `BlockedExternal`        | `[*]`                    | Emit `The handoff cannot proceed because a required external dependency is unavailable.`                                                   |
| `BlockedStage`           | `[*]`                    | Emit `The handoff cannot proceed because a stage failed or was unexpectedly skipped.`                                                |
| `BlockedArtifact`        | `[*]`                    | Emit `The handoff cannot proceed because an artifact failed its contract.`                                                                |
| `BlockedRepairExhausted` | `[*]`                    | Emit `The handoff still fails review after the repair limit.`                                                                     |

## Terminal states

| Terminal state           | Outcome in prose                                               | Kind    |
| ------------------------ | ---------------------------------------------------------- | ------- |
| `CompletedReviewPass`    | `The handoff passed review.`                                   | Success |
| `CompletedReviewWarn`    | `The handoff passed review with warnings.`                     | Success |
| `CompletedDeclinedEmpty` | `No handoff was written because the empty-session handoff was declined.`              | Success |
| `BlockedUnclearTarget`   | `A clear target path is needed before writing the handoff.`                             | Stop    |
| `BlockedNoSource`        | `A usable source transcript is needed before writing the handoff.`                     | Stop    |
| `BlockedUnsafePath`      | `The handoff was not written because the path is unsafe or inaccessible.` | Stop    |
| `BlockedExternal`        | `The handoff cannot proceed because a required external dependency is unavailable.`        | Stop    |
| `BlockedStage`           | `The handoff cannot proceed because a stage failed or was unexpectedly skipped.`     | Stop    |
| `BlockedArtifact`        | `The handoff cannot proceed because an artifact failed its contract.`                     | Stop    |
| `BlockedRepairExhausted` | `The handoff still fails review after the repair limit.`                          | Stop    |

Readiness rule: the run is complete only at one of the three success terminals; every other exit uses the corresponding blocked outcome in prose above.

## Reachability

Every active and wait state is reachable from `Intake` under documented guards. Every terminal is reachable. There are no dead states: repair re-enters the producer chain; wait states either resume or block/decline.
