# State Machine — improving-skill-definition

Finite-state execution model for this skill. Mermaid SoT:
[`flow-diagram.md`](./flow-diagram.md). This table is the authoritative list of
states, transitions, guards, and terminals.

## States

| State | Kind | Phase / role |
| ----- | ---- | ------------ |
| `Intake` | active | Normalize path, eligibility, dependency preflight, baseline, self-improvement flag |
| `FlowLoad` | active | Load own personality and target flow; set trust model |
| `Discover` | active | Dispatch `related-skills-discoverer` |
| `Audit` | active | Dispatch six auditors; synthesize; route by status suffix |
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
| ---- | -- | ------------- |
| `[*]` | `Intake` | run start |
| `Intake` | `FlowLoad` | `SKILL_PATH` eligible; baseline copied; limits derived |
| `Intake` | `TerminalBlocked` | path missing, unreadable, or excluded |
| `FlowLoad` | `Discover` | own `flow-diagram.md` and `personality.md` readable |
| `FlowLoad` | `TerminalError` | own flow or personality unreadable |
| `Discover` | `Audit` | `RELATED_SKILLS: PASS`, or BLOCKED/ERROR with optional degrade |
| `Discover` | `TerminalBlocked` | discovery BLOCKED/ERROR and `REFERENCE_NEED` or mandate requires evidence |
| `Audit` | `TerminalError` | any slice status ends with `: ERROR` |
| `Audit` | `TerminalBlocked` | else any slice ends with `: BLOCKED` |
| `Audit` | `Approval` | else any slice ends with `: GAPS_FOUND` |
| `Audit` | `TerminalNoChange` | else all slices end with `: PASS` |
| `Approval` | `TerminalApprovalRequired` | no user reply |
| `Approval` | `Approval` | invalid reply, first time (re-ask) |
| `Approval` | `TerminalBlocked` | invalid reply, second time |
| `Approval` | `TerminalNoChange` | valid reply with approved scope `none` |
| `Approval` | `TerminalBlocked` | valid reply but mutations violate limits or identity |
| `Approval` | `EditPrep` | valid reply; scope not `none`; limits ok |
| `EditPrep` | `TerminalBlocked` | structural/semantic diagram change and `DIAGRAM_DEPENDENCY=missing` with no manual-validation path |
| `EditPrep` | `DiagramCandidate` | structural/semantic diagram change and dependency present (or manual candidate with script validation) |
| `EditPrep` | `Edit` | approved gaps are non-structural only |
| `DiagramCandidate` | `Edit` | candidate completion state is `final passed` |
| `DiagramCandidate` | `TerminalBlocked` | candidate needs input, confirmation, or blocked |
| `DiagramCandidate` | `TerminalError` | candidate error or diagram repair limit |
| `Edit` | `Validate` | `EDIT: PASS` |
| `Edit` | `TerminalBlocked` | `EDIT: BLOCKED` |
| `Edit` | `TerminalError` | `EDIT: ERROR` |
| `Validate` | `TerminalChanged` | `VALIDATION: PASS` |
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

## Terminal decisions

Exactly one of: `changed`, `no change`, `approval required`, `blocked`, `error`.

## Reachability and dead-state checks

| Property | Result |
| -------- | ------ |
| Every active state reachable from `Intake` | yes (via eligibility → FlowLoad → Discover → Audit, then branches) |
| Every terminal reachable | yes (see transition guards) |
| Dead states (no outgoing, non-terminal) | none |
| Repair loop bounded | yes — max 3 via `repair_counter` before `TerminalBlocked` |

## Self-improvement note

When the target is this package (`SELF_IMPROVEMENT_RUN=true`), synthesis marks
gaps `SAFE` or `DEFERRED`. User-approved structural redefine gaps that rewrite
the execution SoT (state machine / `flow-diagram.md` / aligned `SKILL.md`) are
`SAFE` for same-run application. Other `DEFERRED` gaps remain deferred.
