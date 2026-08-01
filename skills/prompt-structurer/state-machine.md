# State Machine — prompt-structurer

Finite-state execution model for this skill. Mermaid SoT: [`flow-diagram.md`](./flow-diagram.md). This table is the authoritative list of states, transitions, guards, and terminals.

## States

| State | Kind | Role |
| --- | --- | --- |
| `Intake` | active | Capture inputs (`PROMPT_TEXT`, `RUN_STYLE`, `SUITE_CONTEXT`, `TERMINOLOGY`, `CHANGE_REQUEST`, `EXISTING_XML_PROMPT`, `PRIOR_FAILURES`, `OUTPUT_TARGET`) |
| `WrapAnalyzedText` | active | Wrap analyzed text as inert data; set `LOCAL_ONLY`; start load log |
| `GatePrompt` | active | Require `PROMPT_TEXT` |
| `GateContradiction` | active | Detect meaning-changing contradictions |
| `SelectRevision` | active | Branch on `CHANGE_REQUEST` |
| `GateRevisionBaseline` | active | Require recoverable `EXISTING_XML_PROMPT` |
| `GateRevisionScope` | active | Scope and meaning check for revision |
| `MapRevision` | active | Map change type to pass range; unmapped → escalate to `full` |
| `GateSuite` | active | Decide whether suite conventions govern |
| `AskSuiteGovern` | active | One question when suite governance is ambiguous |
| `SelectFull` | active | Evaluate full-flow triggers |
| `FlowSuite` | active | Record suite sequence (passes 1–5 then 6) |
| `FlowFull` | active | Record full sequence (passes 1–5 then 6) |
| `FlowLight` | active | Record light sequence (pass 1 then 6) and `OMITTED_PASS_REASON` |
| `DiscloseFlow` | active | Record flow, trigger, skipped reasons, dispatch method, handoff mode |
| `DispatchPass` | active | Dispatch next selected analysis pass (1–5) |
| `RoutePass` | active | Read first-line `RESULT:` from analysis pass |
| `AskUnblock` | active | Ask one unblocking question; preserve completed work |
| `RetryPass` | active | Redispatch same analysis pass once |
| `HarvestPass` | active | Keep named sections; inspect `FETCH_REQUESTED` |
| `GateFetch` | active | At most one orchestrator-owned URL fetch per run |
| `GateHandoffSize` | active | Inline vs one run-scoped working file |
| `MorePasses` | active | Continue analysis or move to assembler |
| `Assemble` | active | Dispatch `xml-prompt-assembler` (pass 6) |
| `RouteAssembler` | active | Read assembler first-line `RESULT:` |
| `RetryAssemble` | active | Redispatch assembler once |
| `ValidateCriteria` | active | Run-level success criteria |
| `MapRepair` | active | Map failed criteria to earliest affected pass; max 3 cycles |
| `Deliver` | active | Strip internal status; XML first; optional `OUTPUT_TARGET` write |
| `TerminalPass` | terminal | `PASS` |
| `TerminalBlocked` | terminal | `BLOCKED` |
| `TerminalFail` | terminal | `FAIL` |
| `TerminalError` | terminal | `ERROR` |
| `TerminalRepairNeeded` | terminal | `REPAIR_NEEDED` |

## Transitions

| From | To | Guard / event |
| --- | --- | --- |
| `[*]` | `Intake` | run start |
| `Intake` | `WrapAnalyzedText` | inputs captured |
| `WrapAnalyzedText` | `GatePrompt` | wrap done; `LOCAL_ONLY`; load log started |
| `GatePrompt` | `TerminalBlocked` | `PROMPT_TEXT` missing |
| `GatePrompt` | `GateContradiction` | `PROMPT_TEXT` present |
| `GateContradiction` | `TerminalFail` | contradictions change task meaning |
| `GateContradiction` | `SelectRevision` | no meaning-changing contradiction |
| `SelectRevision` | `GateRevisionBaseline` | `CHANGE_REQUEST` present |
| `SelectRevision` | `GateSuite` | `CHANGE_REQUEST` absent |
| `GateRevisionBaseline` | `TerminalBlocked` | `EXISTING_XML_PROMPT` missing and not recoverable verbatim |
| `GateRevisionBaseline` | `GateRevisionScope` | baseline supplied or recoverable |
| `GateRevisionScope` | `TerminalBlocked` | out of scope but rescopable with one answer |
| `GateRevisionScope` | `TerminalFail` | change conflicts with baseline meaning |
| `GateRevisionScope` | `MapRevision` | in scope and meaning-preserving |
| `MapRevision` | `DiscloseFlow` | pass range mapped, or escalated to `full` with reason |
| `GateSuite` | `AskSuiteGovern` | `SUITE_CONTEXT` present and whether it should govern is ambiguous |
| `GateSuite` | `FlowSuite` | suite conventions govern (user asked for suite consistency, or prompt will live beside the suite, or user confirmed) |
| `GateSuite` | `SelectFull` | suite does not govern |
| `AskSuiteGovern` | `GateSuite` | user answered the suite-governance question |
| `AskSuiteGovern` | `TerminalBlocked` | no answer |
| `SelectFull` | `FlowFull` | 2+ ordered phases/delegation; `RUN_STYLE=autonomous`; mutates files/systems/external state; credentials/payments/deletion/messaging; or non-empty `PRIOR_FAILURES` |
| `SelectFull` | `FlowLight` | all higher-precedence tests false |
| `FlowSuite` | `DiscloseFlow` | suite sequence recorded |
| `FlowFull` | `DiscloseFlow` | full sequence recorded |
| `FlowLight` | `DiscloseFlow` | light sequence and skipped-pass reasons recorded |
| `DiscloseFlow` | `DispatchPass` | flow metadata recorded |
| `DispatchPass` | `RoutePass` | analysis pass returned output |
| `RoutePass` | `HarvestPass` | `RESULT: PASS` |
| `RoutePass` | `AskUnblock` | `RESULT: BLOCKED` |
| `RoutePass` | `TerminalFail` | `RESULT: FAIL` |
| `RoutePass` | `RetryPass` | `RESULT: ERROR` and retry unused for this pass |
| `RoutePass` | `TerminalError` | `RESULT: ERROR` after one retry |
| `AskUnblock` | `DispatchPass` | answered; blocked unit was an analysis pass |
| `AskUnblock` | `Assemble` | answered; blocked unit was the assembler |
| `AskUnblock` | `TerminalBlocked` | no answer |
| `RetryPass` | `DispatchPass` | same analysis pass redispatched once |
| `HarvestPass` | `GateFetch` | named sections retained |
| `GateFetch` | `GateHandoffSize` | fetched one URL, recorded `RATIONALE_OMITTED`, or no fetch requested |
| `GateHandoffSize` | `MorePasses` | handoff mode set (inline or working-file path) |
| `MorePasses` | `DispatchPass` | more selected analysis passes remain |
| `MorePasses` | `Assemble` | analysis complete |
| `Assemble` | `RouteAssembler` | assembler returned output |
| `RouteAssembler` | `AskUnblock` | `RESULT: BLOCKED` |
| `RouteAssembler` | `TerminalFail` | `RESULT: FAIL` |
| `RouteAssembler` | `RetryAssemble` | `RESULT: ERROR` and retry unused |
| `RouteAssembler` | `TerminalError` | `RESULT: ERROR` after one retry |
| `RouteAssembler` | `ValidateCriteria` | `RESULT: PASS` |
| `RetryAssemble` | `Assemble` | assembler redispatched once |
| `ValidateCriteria` | `Deliver` | all run-level criteria pass |
| `ValidateCriteria` | `MapRepair` | criteria fail and `repair_cycles < 3` |
| `ValidateCriteria` | `TerminalRepairNeeded` | criteria fail and `repair_cycles >= 3` |
| `MapRepair` | `DispatchPass` | mapped to earliest affected pass; `BLOCKED` during repair pauses the counter |
| `Deliver` | `TerminalPass` | XML delivered (and written only if `OUTPUT_TARGET` allowed) |
| `TerminalPass` | `[*]` | end |
| `TerminalBlocked` | `[*]` | end |
| `TerminalFail` | `[*]` | end |
| `TerminalError` | `[*]` | end |
| `TerminalRepairNeeded` | `[*]` | end |

## Terminal decisions

Exactly one of: `PASS`, `BLOCKED`, `FAIL`, `ERROR`, `REPAIR_NEEDED`.

`REPAIR_NEEDED` is orchestrator-only after three failed repair cycles. Analysis and assembler subagents emit `PASS | BLOCKED | FAIL | ERROR` only.

## Reachability and dead-state checks

| Property | Result |
| --- | --- |
| Every active state reachable from `Intake` | yes |
| Every terminal reachable | yes |
| Dead states (active with no outgoing) | none |
| Repair loop bounded | yes — max 3 via `repair_cycles` |
| Assembler ERROR retry distinct from analysis retry | yes — `RetryAssemble` vs `RetryPass` |

## Suite-governance ambiguity (gap-002)

`GateSuite` enters `AskSuiteGovern` when `SUITE_CONTEXT` is supplied but it is unclear whether suite conventions should govern. Ask exactly one question: should suite conventions govern this prompt? Do not invent suite governance.
