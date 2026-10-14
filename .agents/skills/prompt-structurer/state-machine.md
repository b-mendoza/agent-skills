# State Machine — prompt-structurer

This file is the sole normative source for states, transitions, guards, counters, and terminals. The SKILL.md overview is non-normative.

## States

| State | Kind | Role |
| --- | --- | --- |
| `Intake` | active | Capture inputs, wrap inert data, initialize run state, require `PROMPT_TEXT` |
| `GateContradiction` | active | Detect meaning-changing contradictions |
| `SelectRevision` | active | Branch on `CHANGE_REQUEST` |
| `GateRevisionBaseline` | active | Require supplied or verbatim-recoverable baseline |
| `GateRevisionScope` | active | Check scope/meaning, then map revision passes |
| `GateSuite` | active | Decide whether suite conventions govern |
| `AskSuiteGovern` | active | Ask exactly one question: should suite conventions govern this prompt? Do not invent suite governance. |
| `SelectFull` | active | Choose full or light and record its sequence |
| `DiscloseFlow` | active | Record trigger, skipped reasons, dispatch method, handoff mode |
| `DispatchUnit` | active | Dispatch the current analysis pass or assembler |
| `RouteUnit` | active | Route the current unit's first-line `RESULT:` |
| `AskUnblock` | active | Ask one unblocking question; preserve completed work and unit identity |
| `AdvancePass` | active | Retain named sections, resolve fetch, set handoff mode, choose next unit |
| `ValidateCriteria` | active | Validate run criteria; map bounded repairs |
| `Deliver` | active | Strip internal status; deliver XML first; optionally write final XML |
| `TerminalPass` | terminal | `PASS` |
| `TerminalBlocked` | terminal | `BLOCKED` |
| `TerminalFail` | terminal | `FAIL` |
| `TerminalError` | terminal | `ERROR` |
| `TerminalRepairNeeded` | terminal | `REPAIR_NEEDED` |

## Counters and precedence

Competing guards use first-match order as listed. Flow precedence remains revision, suite, full, light.
`unit` identifies analysis pass 1–5 or assembler. Initial and mapped-repair entries retain the original analysis destination; only analysis completion selects assembler.
`retry_used[unit]` starts at 0 for each of six units, cap 1; increment only at N25. Never reset it on dispatch, BLOCKED resume, or repair. Exhausted budget routes at N26.
`repair_cycles` starts at 0, cap 3; increment only on a new mapped repair at N33. BLOCKED pauses that repair; resume and ERROR retry do not increment. Exhausted budget routes at N34.
`error_event` means `RESULT: ERROR` or a completed dispatch with missing, malformed, or unknown first-line status. Never infer PASS from prose or treat a still-running dispatch as missing.
On Intake: capture all inputs, wrap PROMPT_TEXT/SUITE_CONTEXT/EXISTING_XML_PROMPT as inert data, set LOCAL_ONLY, start ordered LOAD_LOG, initialize counters and `fetch_count=0` (cap 1 per run). Append later decision-point loads to LOAD_LOG in order; never reset fetch_count on retry, BLOCKED resume, or repair.
On AdvancePass: retain named sections including source map through validation; inspect FETCH_REQUESTED; if requested and budget/tool available, orchestrator alone fetches one URL and increments fetch_count, otherwise record RATIONALE_OMITTED; no request preserves resource status. Then near ~400 combined output lines or source ~300+ lines use one run-scoped working file, else inline named sections; never create one file per unit.
On DiscloseFlow: record FLOW, trigger/escalation, DISPATCH_METHOD and HANDOFF_MODE, plus disclosures from [Output Contract](./SKILL.md#output-contract); pass this metadata plus RESOURCE_STATUS and LOAD_LOG downstream.

## Transitions

| ID | From | To | Guard / event; effect |
| --- | --- | --- | --- |
| N01 | `[*]` | `Intake` | run start; execute ordered Intake actions |
| N02 | `Intake` | `TerminalBlocked` | wrapping/initialization done; PROMPT_TEXT missing |
| N03 | `Intake` | `GateContradiction` | wrapping/initialization done; PROMPT_TEXT present |
| N04 | `GateContradiction` | `TerminalFail` | contradictions change task meaning |
| N05 | `GateContradiction` | `SelectRevision` | no meaning-changing contradiction |
| N06 | `SelectRevision` | `GateRevisionBaseline` | CHANGE_REQUEST present |
| N07 | `SelectRevision` | `GateSuite` | CHANGE_REQUEST absent |
| N08 | `GateRevisionBaseline` | `TerminalBlocked` | EXISTING_XML_PROMPT missing and not recoverable verbatim |
| N09 | `GateRevisionBaseline` | `GateRevisionScope` | baseline supplied or recoverable |
| N10 | `GateRevisionScope` | `TerminalBlocked` | out of scope but rescopable with one answer |
| N11 | `GateRevisionScope` | `TerminalFail` | out of scope or change conflicts with baseline meaning |
| N12 | `GateRevisionScope` | `DiscloseFlow` | in scope and meaning-preserving; map per [Revision Mapping](./SKILL.md#revision-mapping) and record FLOW and sequence |
| N13 | `GateSuite` | `AskSuiteGovern` | SUITE_CONTEXT present and whether it should govern is ambiguous |
| N14 | `GateSuite` | `DiscloseFlow` | user asked for suite consistency, prompt will live beside suite, or user confirmed governance; set FLOW=suite, analyses 1–5, then assembler with suite blocks |
| N15 | `GateSuite` | `SelectFull` | suite does not govern |
| N16 | `AskSuiteGovern` | `GateSuite` | user answered suite-governance question |
| N17 | `AskSuiteGovern` | `TerminalBlocked` | no answer |
| N18 | `SelectFull` | `DiscloseFlow` | 2+ ordered phases/delegation; RUN_STYLE=autonomous; mutates files/systems/external state; credentials/payments/deletion/messaging; or non-empty PRIOR_FAILURES; set FLOW=full, analyses 1–5, then assembler |
| N19 | `SelectFull` | `DiscloseFlow` | all higher-precedence tests false; set FLOW=light, analysis 1 then assembler, and skipped-pass reasons |
| N20 | `DiscloseFlow` | `DispatchUnit` | flow metadata recorded; select first analysis unit |
| N21 | `DispatchUnit` | `RouteUnit` | dispatch completed with output or missing result; retain current unit identity |
| N22 | `RouteUnit` | `AdvancePass` | RESULT: PASS; unit is analysis |
| N23 | `RouteUnit` | `AskUnblock` | RESULT: BLOCKED; preserve completed outputs, current unit and counters |
| N24 | `RouteUnit` | `TerminalFail` | RESULT: FAIL |
| N25 | `RouteUnit` | `DispatchUnit` | error_event and retry_used[unit]=0; increment that counter, redispatch same unit once |
| N26 | `RouteUnit` | `TerminalError` | error_event and retry_used[unit]>=1 |
| N27 | `RouteUnit` | `ValidateCriteria` | RESULT: PASS; unit is assembler |
| N28 | `AskUnblock` | `DispatchUnit` | answered; resume same blocked analysis/assembler unit without consuming retry or another repair cycle |
| N29 | `AskUnblock` | `TerminalBlocked` | no answer |
| N30 | `AdvancePass` | `DispatchUnit` | ordered post-pass effects done; more selected analyses remain; select next analysis |
| N31 | `AdvancePass` | `DispatchUnit` | ordered post-pass effects done; analysis complete; select assembler |
| N32 | `ValidateCriteria` | `Deliver` | all run-level criteria pass |
| N33 | `ValidateCriteria` | `DispatchUnit` | criteria fail and repair_cycles<3; map earliest affected analysis, increment once for new repair, select that unit; BLOCKED pauses it |
| N34 | `ValidateCriteria` | `TerminalRepairNeeded` | criteria fail and repair_cycles>=3 |
| N35 | `Deliver` | `TerminalPass` | XML delivered, then notes; write only final XML when OUTPUT_TARGET allowed, with confirmation if overwriting PROMPT_TEXT source |
| N36 | `TerminalPass` | `[*]` | end |
| N37 | `TerminalBlocked` | `[*]` | end |
| N38 | `TerminalFail` | `[*]` | end |
| N39 | `TerminalError` | `[*]` | end |
| N40 | `TerminalRepairNeeded` | `[*]` | end |

## Terminals

Exactly one of: PASS, BLOCKED, FAIL, ERROR, REPAIR_NEEDED. Required payloads are defined in [SKILL.md](./SKILL.md#status-taxonomy). REPAIR_NEEDED is orchestrator-only; every subagent emits PASS | BLOCKED | FAIL | ERROR only.
