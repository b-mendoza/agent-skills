# State Machine — validate-implementation-plan

Finite-state execution model for this skill and the sole source of truth for states, transitions, guards, retry budgets, and terminals. Status meanings, trust rules, and report wording live in [`references/audit-protocol.md`](./references/audit-protocol.md).

## Actions

State names say which subagent each `Dispatch*` state runs. Non-obvious actions:

- `NormalizeInputs` confirms `PLAN_PATH` and derives `SNAPSHOT_PATH` / `OUTPUT_PATH`; `AskArtifact` asks for overwrite approval or an alternate path.
- `AskOrigin` asks one baseline question and summarizes the approved answer; `ClassifyContext` classifies `SOURCE_CONTEXT_PATHS` and rejects project-specific external proof.
- `DispatchAuditors` dispatches `requirements-auditor`, `yagni-auditor`, and `assumptions-auditor` discovery in parallel; `RetryAuditor` re-dispatches **only** the failed auditor branch.
- `AskAssumptions` is orchestrator-owned: ask the auditor's proposed concise questions. `ResolveAssumptions` re-dispatches `assumptions-auditor` in resolution mode.

## Transitions

| From                   | To                     | Guard / event                                                             |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------- |
| `[*]`                  | `LoadContracts`        | run start                                                                 |
| `LoadContracts`        | `NormalizeInputs`      | audit-protocol (including trust boundary) loaded                          |
| `NormalizeInputs`      | `TerminalBlocked`      | `PLAN_PATH` missing or unreadable                                         |
| `NormalizeInputs`      | `AuthorizeArtifacts`   | `PLAN_PATH` ok; raw read limited to `plan-snapshotter`                    |
| `AuthorizeArtifacts`   | `AskArtifact`          | snapshot or report path exists without overwrite approval                 |
| `AuthorizeArtifacts`   | `EstablishOrigin`      | paths clear or overwrite already approved                                 |
| `AskArtifact`          | `TerminalBlocked`      | overwrite declined and no alternate path                                  |
| `AskArtifact`          | `EstablishOrigin`      | overwrite approved or alternate path set                                  |
| `EstablishOrigin`      | `AskOrigin`            | `ORIGIN_CONTEXT` missing or inadequate                                    |
| `EstablishOrigin`      | `ClassifyContext`      | `ORIGIN_CONTEXT` adequate                                                 |
| `AskOrigin`            | `TerminalBlocked`      | baseline answer declined or still inadequate                              |
| `AskOrigin`            | `ClassifyContext`      | approved summarized baseline adequate                                     |
| `ClassifyContext`      | `TerminalBlocked`      | project-specific external website proof required                          |
| `ClassifyContext`      | `DispatchSnapshot`     | roles classified; allow-list unchanged                                    |
| `DispatchSnapshot`     | `RetrySnapshot`        | not `SNAPSHOT: PASS`                                                      |
| `DispatchSnapshot`     | `DispatchRequirements` | `SNAPSHOT: PASS`                                                          |
| `RetrySnapshot`        | `DispatchSnapshot`     | recovered and `retry_count < 3`                                           |
| `RetrySnapshot`        | `TerminalBlocked`      | hard blocker after retry budget                                           |
| `RetrySnapshot`        | `TerminalError`        | internal failure after retry budget                                       |
| `DispatchRequirements` | `RetryRequirements`    | not `REQUIREMENTS: PASS`                                                  |
| `DispatchRequirements` | `GateEvidence`         | `REQUIREMENTS: PASS`                                                      |
| `RetryRequirements`    | `DispatchRequirements` | recovered and `retry_count < 3`                                           |
| `RetryRequirements`    | `TerminalBlocked`      | no credible baseline after retry budget                                   |
| `RetryRequirements`    | `TerminalError`        | internal failure after retry budget                                       |
| `GateEvidence`         | `DispatchEvidence`     | local-technical-evidence or mixed paths present                           |
| `GateEvidence`         | `DispatchAuditors`     | no local technical evidence paths                                         |
| `DispatchEvidence`     | `RetryEvidence`        | not `EVIDENCE: PASS`                                                      |
| `DispatchEvidence`     | `DispatchAuditors`     | `EVIDENCE: PASS`                                                          |
| `RetryEvidence`        | `DispatchEvidence`     | recovered and `retry_count < 3`                                           |
| `RetryEvidence`        | `RecordEvidenceGap`    | unrecovered after retry budget                                            |
| `RecordEvidenceGap`    | `DispatchAuditors`     | core audit remains viable                                                 |
| `RecordEvidenceGap`    | `TerminalBlocked`      | core audit not viable                                                     |
| `DispatchAuditors`     | `RetryAuditor`         | any of TRACEABILITY / YAGNI / ASSUMPTIONS missing PASS or valid payload   |
| `DispatchAuditors`     | `GateUnresolved`       | all three discovery PASS with valid payloads                              |
| `RetryAuditor`         | `DispatchAuditors`     | re-dispatch only failed branch; recovered and that branch's `retry_count < 3` |
| `RetryAuditor`         | `TerminalBlocked`      | hard blocker after retry budget                                           |
| `RetryAuditor`         | `TerminalError`        | internal failure after retry budget                                       |
| `GateUnresolved`       | `AskAssumptions`       | decision-relevant unresolved assumptions present                          |
| `GateUnresolved`       | `DispatchAnnotator`    | none                                                                      |
| `AskAssumptions`       | `TerminalBlocked`      | answers declined leaving decision-relevant questions open                 |
| `AskAssumptions`       | `ResolveAssumptions`   | answers approved as summarized evidence                                   |
| `ResolveAssumptions`   | `RetryResolve`         | not `ASSUMPTIONS: PASS` with resolution payload                           |
| `ResolveAssumptions`   | `GateOpenQuestions`    | `ASSUMPTIONS: PASS` with resolution payload                               |
| `RetryResolve`         | `ResolveAssumptions`   | recovered and `retry_count < 3`                                           |
| `RetryResolve`         | `TerminalError`        | unrecovered after retry budget                                            |
| `GateOpenQuestions`    | `TerminalBlocked`      | decision-relevant open questions remain                                   |
| `GateOpenQuestions`    | `DispatchAnnotator`    | none remain                                                               |
| `DispatchAnnotator`    | `RetryReport`          | not `REPORT: PASS`                                                        |
| `DispatchAnnotator`    | `MapFinalStatus`       | `REPORT: PASS`                                                            |
| `RetryReport`          | `DispatchAnnotator`    | recovered and `retry_count < 3`                                           |
| `RetryReport`          | `TerminalBlocked`      | report blocked after retry budget                                         |
| `RetryReport`          | `TerminalError`        | report internal failure after retry budget                                |
| `MapFinalStatus`       | `TerminalPass`         | report written; all nine sections present; no criticals; no unresolved hard gate; no decision-relevant open question |
| `MapFinalStatus`       | `TerminalFail`         | report written and ≥1 critical traceability gap, critical avoidable-complexity finding, or disproven risky assumption remains |
| `MapFinalStatus`       | `TerminalBlocked`      | hard gate or decision-relevant question unresolved                        |
| `MapFinalStatus`       | `TerminalError`        | unrecovered internal, parsing, malformed-output, or report-write failure remains |
| `TerminalPass`         | `[*]`                  | emit compact handoff                                                      |
| `TerminalFail`         | `[*]`                  | emit compact handoff                                                      |
| `TerminalBlocked`      | `[*]`                  | emit compact handoff                                                      |
| `TerminalError`        | `[*]`                  | emit compact handoff                                                      |

Guard terms (`ORIGIN_CONTEXT` adequate, core audit remains viable, decision-relevant) are defined in `references/audit-protocol.md` Operational Definitions.

## Terminal decisions

Sole source of truth for internal final outcomes. Select exactly one of `AUDIT: PASS`, `AUDIT: FAIL`, `AUDIT: BLOCKED`, `AUDIT: ERROR`: `TerminalPass`/`TerminalFail` only via `MapFinalStatus` after `REPORT: PASS`; `TerminalBlocked` also covers missing or declined input, failed artifact authorization, an unestablished `ORIGIN_CONTEXT`, and required external project proof; `TerminalError` covers failures left after the retry budget. These labels route the workflow; deliver the outcome's meaning as the compact prose handoff, without a public status line.
