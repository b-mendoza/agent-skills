# State Machine — improving-skill-definition

This file is the sole normative source for states, transitions, guards, guard precedence, counters, joins, and terminals. SKILL.md is a non-normative overview; this file wins on drift.

## States

| State | Kind | Phase / role |
| --- | --- | --- |
| `Intake` | active | Normalize path, eligibility, package root, baseline, self-improvement flag |
| `FlowLoad` | active | Load own personality and target flow; set trust model |
| `Discover` | active | Dispatch `related-skills-discoverer` |
| `Audit` | active | Dispatch six auditors (independent read-only fan-out); join on all six reports; synthesize; route by status suffix |
| `Approval` | active | Present gaps; parse personality + scope reply |
| `EditPrep` | active | Classify approved gaps structural vs non-structural |
| `DiagramCandidate` | active | Obtain `final passed` state/flow diagram candidate |
| `Edit` | active | Dispatch `skill-definition-editor` |
| `Validate` | active | Dispatch `skill-package-validator` (Lane A / Lane B) |
| `Repair` | active | Increment `repair_counter`; re-enter edit scope |
| `TerminalChanged` | terminal | Decision: `changed` |
| `TerminalNoChange` | terminal | Decision: `no change` |
| `TerminalApprovalRequired` | terminal | Decision: `approval required` |
| `TerminalBlocked` | terminal | Decision: `blocked` |
| `TerminalError` | terminal | Decision: `error` |

## Transitions

| From | To | Guard / event |
| --- | --- | --- |
| `[*]` | `Intake` | run start |
| `Intake` | `FlowLoad` | `SKILL_PATH` eligible; `SKILL_DIR` resolved; baseline copied; limits derived |
| `Intake` | `TerminalBlocked` | path missing, unreadable, or excluded; `SKILL_DIR` unresolved (`TOOLS_MISSING`); or `MUTATION_LIMITS` cannot be derived unambiguously |
| `FlowLoad` | `Discover` | own `references/personality.md` readable |
| `FlowLoad` | `TerminalError` | own `references/personality.md` unreadable |
| `Discover` | `Audit` | `RELATED_SKILLS: PASS`, or BLOCKED/ERROR with optional degrade |
| `Discover` | `TerminalBlocked` | discovery BLOCKED/ERROR and `REFERENCE_NEED` or mandate requires evidence |
| `Audit` | `TerminalError` | any slice status ends with `: ERROR` |
| `Audit` | `TerminalBlocked` | else any slice ends with `: BLOCKED` |
| `Audit` | `Approval` | else any slice ends with `: GAPS_FOUND` |
| `Audit` | `TerminalNoChange` | else all slices end with `: PASS` |
| `Approval` | `TerminalApprovalRequired` | no user reply (see Approval wait contract) |
| `Approval` | `Approval` | invalid reply, first time (re-ask) |
| `Approval` | `TerminalBlocked` | invalid reply, second time |
| `Approval` | `TerminalApprovalRequired` | no reply after the one re-ask |
| `Approval` | `TerminalNoChange` | valid reply with approved scope `none` |
| `Approval` | `TerminalBlocked` | valid reply but mutations violate limits or identity |
| `Approval` | `EditPrep` | valid reply; scope not `none`; limits ok |
| `EditPrep` | `DiagramCandidate` | approved structural/semantic diagram change |
| `EditPrep` | `Edit` | no diagram candidate required |
| `DiagramCandidate` | `Edit` | candidate completion state is `final passed` |
| `DiagramCandidate` | `DiagramCandidate` | helper exit 1, 3, or 4, or inspection failure, and `diagram_repair_counter < 3`; increment counter; repair only approved candidate |
| `DiagramCandidate` | `TerminalBlocked` | candidate missing (helper exit 66), required input missing, or inspection blocked |
| `DiagramCandidate` | `TerminalError` | helper exit other than 0, 1, 2, 3, 4, or 66; unexpected inspection error; or syntax/inspection failure at `diagram_repair_counter >= 3` |
| `Edit` | `Validate` | `EDIT: PASS` (at least one applied in-scope mutation) |
| `Edit` | `TerminalNoChange` | `EDIT: NO_CHANGE` (every approved item no-op, already satisfied, or deferred; empty baseline diff) |
| `Edit` | `TerminalBlocked` | `EDIT: BLOCKED` |
| `Edit` | `TerminalError` | `EDIT: ERROR` |
| `Validate` | `TerminalChanged` | `VALIDATION: PASS` and non-empty authorized baseline diff |
| `Validate` | `Repair` | `VALIDATION: FAIL` and `repair_counter < 3` |
| `Validate` | `TerminalBlocked` | `VALIDATION: FAIL` and `repair_counter >= 3` |
| `Validate` | `TerminalBlocked` | `VALIDATION: BLOCKED` |
| `Validate` | `TerminalError` | `VALIDATION: ERROR` |
| `Repair` | `EditPrep` | re-enter scoped to Lane A findings and approved gaps only |
| `TerminalChanged` | `[*]` | emit handoff + cleanup |
| `TerminalNoChange` | `[*]` | emit handoff + cleanup |
| `TerminalApprovalRequired` | `[*]` | emit handoff; preserve `HANDOFF_DIR` |
| `TerminalBlocked` | `[*]` | emit handoff + outcome-dependent preserve |
| `TerminalError` | `[*]` | emit handoff + outcome-dependent preserve |

## Diagram candidate validation

Author `flowchart` or `stateDiagram-v2` Mermaid manually at `DIAGRAM_CANDIDATE_PATH`, a run-owned file under `HANDOFF_DIR`, never a source or destination path. Destination writes occur only in `Edit` after the candidate reaches `final passed`. Run `bash "${SKILL_DIR}/scripts/check-mermaid.sh" "$DIAGRAM_CANDIDATE_PATH"`. Inspect the candidate against the approved gaps and target contracts: states, transitions, statuses, approval gates, retry bounds, cleanup, and related `SKILL.md`/registry entries must agree. `final passed` requires passing coherence inspection plus either helper exit 0 (`parsed`) or helper exit 2 with passing manual Mermaid syntax/structural inspection (`inspected-only`). Every exit 2, including failed local version preflight or browser startup, uses inspection. Disclose the `inspected-only` fallback policy at approval, then record the actual method, helper exit code, and candidate path; never claim parsing for the fallback. Initialize `diagram_repair_counter=0` per candidate. Candidate application and Lane A checks follow the editor and validator contracts.

## Audit fan-out and join

The six auditors are an independent, read-only fan-out: each reads the target and writes only its own named report file in `HANDOFF_DIR`. A runtime that supports concurrent subagent dispatch may dispatch them concurrently; otherwise dispatch them serially — the outcomes are equivalent because `Audit` joins only when all six contracted reports exist. A missing or malformed report after one re-request is treated as that slice returning `: ERROR`. Synthesis reads the reports in registry order and applies the Audit guard order above, so report-arrival order never selects the route.

## Approval wait contract

"No reply" is an observable condition, not a timeout: the orchestrator presents the approval request and ends its turn. If the run resumes without a valid approval message for this run's handoff, that is "no user reply" → `TerminalApprovalRequired` with `HANDOFF_DIR` preserved. An invalid reply is re-asked once; a second invalid reply → `TerminalBlocked`; silence after the re-ask → `TerminalApprovalRequired`.

## Status-routing note

Discovery is an optional evidence phase, so its `: BLOCKED`/`: ERROR` statuses degrade the run (or block it when `REFERENCE_NEED` or a mandate requires evidence) instead of terminating as runtime errors. Audit statuses instead follow the Audit guards above.

## Reachability and dead-state checks

| Property | Result |
| --- | --- |
| Every active state reachable from `Intake` | yes (via eligibility → FlowLoad → Discover → Audit, then branches) |
| Every terminal reachable | yes (see transition guards) |
| Dead states (no outgoing, non-terminal) | none |
| Repair loop bounded | yes — max 3 via `repair_counter` before `TerminalBlocked` |

