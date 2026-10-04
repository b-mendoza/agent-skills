# State Machine — improving-skill-definition

Finite-state execution model for this skill. This file is the sole normative source for states, transitions, guards, guard precedence, and terminals. [`flow-diagram.md`](./flow-diagram.md) is an illustrative rendering and [`SKILL.md`](./SKILL.md) a compact overview; when either disagrees with this table, this table wins. Any change here updates both in the same edit.

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
| `ParserApproval` | wait | Ask once per run before npx fetch/execution |
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
| `FlowLoad` | `Discover` | own `flow-diagram.md` and `personality.md` readable |
| `FlowLoad` | `TerminalError` | own flow or personality unreadable |
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
| `DiagramCandidate` | `ParserApproval` | no retained `APPROVED` or `ABORT` decision for this exact command; helper exit 2 with exact first line `parser unavailable: npx approval required` |
| `ParserApproval` | `DiagramCandidate` | `APPROVED` bound to this run's exact command; retain permission; re-run with `--allow-npx` |
| `ParserApproval` | `DiagramCandidate` | `ABORT` bound to this run's exact command; retain denial; use `inspected-only` without npx |
| `ParserApproval` | `ParserApproval` | valid retained run/command context; `REVISE`/malformed/unusable answer and `parser_reask_count < 1`; increment; say command has no revisable parameters and re-preview once |
| `ParserApproval` | `TerminalApprovalRequired` | no answer on resume, or approval/command context missing, malformed, or unbound to this run |
| `ParserApproval` | `TerminalBlocked` | (valid retained run/command context and `REVISE`/unusable at `parser_reask_count = 1`), or checkpoint preparation returns `BLOCKED`/`TOOLS_MISSING` |
| `ParserApproval` | `TerminalError` | checkpoint preparation returns `ERROR`, or unexpected preparation/authorization failure |
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

Author `flowchart` or `stateDiagram-v2` Mermaid manually at `DIAGRAM_CANDIDATE_PATH` within this run's approved scope. Run `bash "${SKILL_DIR}/scripts/check-mermaid.sh" "$DIAGRAM_CANDIDATE_PATH"`. Inspect the candidate against the approved gaps and target contracts: states, transitions, statuses, approval gates, retry bounds, cleanup, and related `SKILL.md`/registry entries must agree. `final passed` requires passing coherence inspection plus either helper exit 0 (`parsed`) or helper exit 2 (`parser unavailable`) with passing manual Mermaid syntax/structural inspection (`inspected-only`). Disclose the `inspected-only` fallback policy at approval, then record the actual method, helper exit code, and candidate path; never claim parsing for the fallback. Initialize `diagram_repair_counter=0` per candidate. The editor still writes the passing diagram in the same edit as its related package changes, and Lane A still validates approved closure, scope, and flow coherence.

## Parser approval

Normally ask once per run: show the one literal resolved `bash <helper> --allow-npx <candidate-path>` command with actual paths and package `@mermaid-js/mermaid-cli@12.0.0`; disclose third-party fetch/execution and install scripts, npm cache writes and possible Puppeteer Chrome download; state completed local checks and remaining third-party-code risk. `ABORT` skips npx and continues `inspected-only`. Initialize `parser_reask_count=0` once per run, retain it across re-previews, cap 1; with valid retained run/command context, `REVISE`/unusable under cap increments and re-previews once, explaining no parameters are revisable at this gate; no answer on resume -> `TerminalApprovalRequired` (preserve `HANDOFF_DIR`); with valid retained run/command context, revise/unusable at cap -> `TerminalBlocked`. End the turn while waiting, without timeout. Approval binds only this run, the displayed exact command and package, not candidate contents: repairs/content edits retain it; a new/changed path or any command/package change requires a new preview before opt-in. Record APPROVED or ABORT before returning. A retained decision makes the entry guard false: APPROVED uses `--allow-npx`; ABORT skips the helper and goes straight to `inspected-only`. A new preview replaces the decision for the changed command; never reuse it for an added/changed command. Missing/malformed approval or command context, or approval that cannot be bound to this run's exact command -> `TerminalApprovalRequired`; preserve `HANDOFF_DIR` and re-preview the unbound command before execution. Preparation `BLOCKED`/`TOOLS_MISSING` -> `TerminalBlocked`; preparation `ERROR` or unexpected failure -> `TerminalError`. Other exit 2, including failed preflight, also uses inspection. Earlier-run/intake consent never counts. Record decision/method/exit under existing `Validation Evidence` when changed, `Reason` for no change, `Blocking Reason` when blocked, or `Known Context` on error.

## Audit fan-out and join

The six auditors are an independent, read-only fan-out: each reads the target and writes only its own named report file in `HANDOFF_DIR`. A runtime that supports concurrent subagent dispatch may dispatch them concurrently; otherwise dispatch them serially — the outcomes are equivalent because `Audit` joins only when all six contracted reports exist. A missing or malformed report after one re-request is treated as that slice returning `: ERROR`. Synthesis reads the reports in registry order and applies the suffix precedence (`: ERROR`, then `: BLOCKED`, then `: GAPS_FOUND`, else all `: PASS`), so report-arrival order never selects the route.

## Approval wait contract

"No reply" is an observable condition, not a timeout: the orchestrator presents the approval request and ends its turn. If the run resumes without a valid approval message for this run's handoff, that is "no user reply" → `TerminalApprovalRequired` with `HANDOFF_DIR` preserved. An invalid reply is re-asked once; a second invalid reply → `TerminalBlocked`; silence after the re-ask → `TerminalApprovalRequired`.

## Status-routing note

Discovery is an optional evidence phase, so its `: BLOCKED`/`: ERROR` statuses degrade the run (or block it when `REFERENCE_NEED` or a mandate requires evidence) instead of terminating as runtime errors. This intentionally differs from audit-phase routing, where `: ERROR` outranks all other statuses and maps to `TerminalError`.

## Terminal decisions

Exactly one of: `changed`, `no change`, `approval required`, `blocked`, `error`.

## Reachability and dead-state checks

| Property | Result |
| --- | --- |
| Every active state reachable from `Intake` | yes (via eligibility → FlowLoad → Discover → Audit, then branches) |
| Every terminal reachable | yes (see transition guards) |
| Dead states (no outgoing, non-terminal) | none |
| Repair loop bounded | yes — max 3 via `repair_counter` before `TerminalBlocked` |

## Self-improvement note

When the target is this package (`SELF_IMPROVEMENT_RUN=true`), synthesis marks gaps `SAFE` or `DEFERRED`. User-approved structural redefine gaps that rewrite the execution SoT (state machine / `flow-diagram.md` / aligned `SKILL.md`) are `SAFE` for same-run application. Other `DEFERRED` gaps remain deferred.
