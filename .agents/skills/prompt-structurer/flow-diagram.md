# Prompt Structurer Flow

Finite-state execution model (`stateDiagram-v2`). Companion transition table:
[`state-machine.md`](./state-machine.md). `SKILL.md` must use the same gates,
status routes, and terminals.

Validated: structural reachability check (every state reachable; no dead active
states; five terminals). `check-mermaid.sh` reported `parser unavailable`
(Chrome/puppeteer missing); Mermaid authored manually per improving-phase
fallback.

```mermaid
stateDiagram-v2
  [*] --> Intake

  Intake --> WrapAnalyzedText: inputs captured
  WrapAnalyzedText --> GatePrompt: wrapped; LOCAL_ONLY; load log started

  GatePrompt --> TerminalBlocked: PROMPT_TEXT missing
  GatePrompt --> GateContradiction: PROMPT_TEXT present

  GateContradiction --> TerminalFail: contradictions change task meaning
  GateContradiction --> SelectRevision: no meaning-changing contradiction

  SelectRevision --> GateRevisionBaseline: CHANGE_REQUEST present
  SelectRevision --> GateSuite: CHANGE_REQUEST absent

  GateRevisionBaseline --> TerminalBlocked: EXISTING_XML_PROMPT missing and not recoverable
  GateRevisionBaseline --> GateRevisionScope: baseline supplied or recoverable

  GateRevisionScope --> TerminalBlocked: rescopable with one answer
  GateRevisionScope --> TerminalFail: conflicts with baseline meaning
  GateRevisionScope --> MapRevision: in scope and meaning-preserving

  MapRevision --> DiscloseFlow: pass range mapped or escalated to full

  GateSuite --> AskSuiteGovern: SUITE_CONTEXT present and governance ambiguous
  GateSuite --> FlowSuite: suite conventions govern
  GateSuite --> SelectFull: suite does not govern

  AskSuiteGovern --> GateSuite: user answered
  AskSuiteGovern --> TerminalBlocked: no answer

  SelectFull --> FlowFull: full trigger present
  SelectFull --> FlowLight: all higher tests false

  FlowSuite --> DiscloseFlow: suite sequence recorded
  FlowFull --> DiscloseFlow: full sequence recorded
  FlowLight --> DiscloseFlow: light sequence and OMITTED_PASS_REASON recorded

  DiscloseFlow --> DispatchPass: flow metadata recorded

  DispatchPass --> RoutePass: analysis pass returned RESULT

  RoutePass --> HarvestPass: RESULT PASS
  RoutePass --> AskUnblock: RESULT BLOCKED
  RoutePass --> TerminalFail: RESULT FAIL
  RoutePass --> RetryPass: RESULT ERROR and retry unused
  RoutePass --> TerminalError: RESULT ERROR after one retry

  AskUnblock --> DispatchPass: answered; re-enter blocked analysis pass
  AskUnblock --> Assemble: answered; re-enter blocked assembler
  AskUnblock --> TerminalBlocked: no answer

  RetryPass --> DispatchPass: redispatch same analysis pass once

  HarvestPass --> GateFetch: named sections kept; FETCH_REQUESTED inspected
  GateFetch --> GateHandoffSize: one URL or RATIONALE_OMITTED or none
  GateHandoffSize --> MorePasses: handoff mode set

  MorePasses --> DispatchPass: more analysis passes remain
  MorePasses --> Assemble: dispatch xml-prompt-assembler

  Assemble --> RouteAssembler: assembler returned RESULT

  RouteAssembler --> AskUnblock: RESULT BLOCKED
  RouteAssembler --> TerminalFail: RESULT FAIL
  RouteAssembler --> RetryAssemble: RESULT ERROR and retry unused
  RouteAssembler --> TerminalError: RESULT ERROR after one retry
  RouteAssembler --> ValidateCriteria: RESULT PASS

  RetryAssemble --> Assemble: redispatch assembler once

  ValidateCriteria --> Deliver: all run-level criteria pass
  ValidateCriteria --> MapRepair: criteria fail and repair_cycles under 3
  ValidateCriteria --> TerminalRepairNeeded: criteria fail and repair_cycles at 3

  MapRepair --> DispatchPass: earliest affected pass; BLOCKED pauses counter

  Deliver --> TerminalPass: XML first then notes; OUTPUT_TARGET under mutation boundary

  TerminalPass --> [*]
  TerminalBlocked --> [*]
  TerminalFail --> [*]
  TerminalError --> [*]
  TerminalRepairNeeded --> [*]
```

## Pass Sequences

| Flow | Sequence |
| ---- | -------- |
| `light` | pass 1 → pass 6 |
| `full` | passes 1–5 → pass 6 |
| `suite` | same as `full`, with suite blocks in every pass |
| `revision` | mapped range from `SKILL.md` Revision Mapping, earliest missing prerequisite first, then pass 6 |

## Terminal States

| Terminal | Status | Required payload |
| -------- | ------ | ---------------- |
| `TerminalPass` | `PASS` | Final XML, then assembly notes |
| `TerminalBlocked` | `BLOCKED` | One unblocking question plus completed work |
| `TerminalFail` | `FAIL` | Conflicting statements plus clarification |
| `TerminalError` | `ERROR` | Failing pass, retry record, completed outputs |
| `TerminalRepairNeeded` | `REPAIR_NEEDED` | Unvalidated XML, failing criteria with owning pass, cycles used |
