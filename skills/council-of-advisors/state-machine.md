# State Machine — council-of-advisors

Finite-state execution model for this skill. Mermaid rendering lives in
[`flow-diagram.md`](./flow-diagram.md). Gate predicates, repair caps, and failure
routes are normative only in
[`references/decision-gates.md`](./references/decision-gates.md).

## Run-scoped variables

| Variable | Initial | Rules |
| -------- | ------- | ----- |
| `packet_version` | 1 | Increment on consolidated packet refinement; never mix versions in one chair synthesis |
| `research_tools` | unset | Set in `DeclareResearch` to `none` or `web` |
| `depth_setting` | unset | Bound in `BindDepth` from reversibility (`type_1`→`deep`, `type_2`→`standard`) |
| `gate_repair_cycles` | 0 per gate | Cap 3 targeted repairs; fourth failure → `Blocked` |
| `seat_schema_repairs` | 0 per analysis seat | Cap 3 redispatches per seat |
| `global_redispatches` | 0 | Cap 12 total; excess → `Blocked` |
| `analysis_blocked_waves` | 0 | First wave → `RefinePacket`; second → `NeedsInput` |
| `override_applied` | false | Set true only by orchestrator on Type 1 + low confidence |

## Dispatch topology

Nine seat files; mechanical order is not nine parallel advisors:

1. `reversibility-seat` (sequential)
2. Seven analysis seats in parallel: adversary, optimistic, originality,
   second-order, paradox-of-skill, focus, power-questions
3. Optional `originality-seat` branch mode (same seat file, not a tenth seat)
4. `chair-seat` (synthesis)

## States

| State | Kind | Actor |
| ----- | ---- | ----- |
| `Intake` | active | Orchestrator |
| `AskSubject` | wait | Orchestrator → user |
| `ClassifyStakes` | active | Orchestrator |
| `ConfirmFraming` | wait | Orchestrator → user |
| `DeclareResearch` | active | Orchestrator |
| `ClassifyReversibility` | active | `reversibility-seat` |
| `ProbeReversibility` | wait | Orchestrator → user |
| `BindDepth` | active | Orchestrator |
| `ParallelAnalysis` | active | Seven analysis seats |
| `RouteAnalysis` | active | Orchestrator |
| `RefinePacket` | wait | Orchestrator → user |
| `OriginalityCheck` | active | Orchestrator |
| `OriginalityBranch` | active | `originality-seat` (branch mode) |
| `SynthesizeChair` | active | `chair-seat` |
| `RouteConfidence` | active | Orchestrator |
| `RepairLowConfidence` | active | Weak analysis seats → chair |
| `Type1Gate` | active | Orchestrator |
| `AssembleEducateMe` | active | Orchestrator |
| `WriteHandoff` | active | Orchestrator |
| `Ready` | terminal | — |
| `NeedsInput` | terminal | — |
| `Blocked` | terminal | — |
| `Error` | terminal | — |

## Transitions

| From | To | Guard / event |
| ---- | -- | ------------- |
| `[*]` | `Intake` | Skill invoked |
| `Intake` | `AskSubject` | `DECISION_SUBJECT` missing or unintelligible |
| `Intake` | `ClassifyStakes` | Subject intelligible |
| `AskSubject` | `Intake` | User answered |
| `AskSubject` | `NeedsInput` | Declined or silent |
| `ClassifyStakes` | `ConfirmFraming` | High-stakes disclosure attached when applicable |
| `ConfirmFraming` | `DeclareResearch` | `G_FRAMING_CONFIRMED` pass |
| `ConfirmFraming` | `ConfirmFraming` | Revise paraphrase under framing cap |
| `ConfirmFraming` | `NeedsInput` | Framing cap hit |
| `DeclareResearch` | `ClassifyReversibility` | `research_tools` recorded |
| `ClassifyReversibility` | `ProbeReversibility` | `G_REVERSIBILITY` pass ∧ confidence `low` |
| `ClassifyReversibility` | `BindDepth` | `G_REVERSIBILITY` pass ∧ confidence not `low` |
| `ClassifyReversibility` | `ClassifyReversibility` | Fail under repair cap |
| `ClassifyReversibility` | `Blocked` | Reversibility repair cap hit |
| `ClassifyReversibility` | `Error` | Seat `ERROR` twice |
| `ProbeReversibility` | `ClassifyReversibility` | Answer appended; redispatch |
| `ProbeReversibility` | `BindDepth` | Still low → default `type_1`/`deep` |
| `BindDepth` | `ParallelAnalysis` | `depth_setting` bound |
| `ParallelAnalysis` | `RouteAnalysis` | Seven seats returned |
| `RouteAnalysis` | `ParallelAnalysis` | `FAIL` / schema miss under seat cap |
| `RouteAnalysis` | `RefinePacket` | `BLOCKED` first wave |
| `RouteAnalysis` | `NeedsInput` | `BLOCKED` second wave |
| `RouteAnalysis` | `Error` | Seat `ERROR` twice |
| `RouteAnalysis` | `Blocked` | Analysis gate or global budget cap hit |
| `RouteAnalysis` | `OriginalityCheck` | `G_REASONING_CHAINS_PRESENT` ∧ `G_INDEPENDENCE` pass |
| `RefinePacket` | `ParallelAnalysis` | Packet `vN+1` re-confirmed |
| `RefinePacket` | `NeedsInput` | Re-confirm declined |
| `OriginalityCheck` | `OriginalityBranch` | `G_ORIGINALITY` needs branch |
| `OriginalityCheck` | `SynthesizeChair` | `G_ORIGINALITY` pass |
| `OriginalityBranch` | `SynthesizeChair` | Branch output authored with provenance |
| `SynthesizeChair` | `RouteConfidence` | `G_DISSENT_PRESERVED` pass |
| `SynthesizeChair` | `SynthesizeChair` | Dissent or kill fail under cap |
| `SynthesizeChair` | `Blocked` | Chair repair cap hit |
| `SynthesizeChair` | `Error` | Chair `ERROR` twice |
| `RouteConfidence` | `Type1Gate` | Confidence high/medium ∧ `G_KILL_CRITERION` pass |
| `RouteConfidence` | `RepairLowConfidence` | Confidence low ∧ redispatch set non-empty under cap |
| `RouteConfidence` | `Type1Gate` | Confidence low ∧ set empty or cap spent |
| `RepairLowConfidence` | `SynthesizeChair` | Weak seats redispatched; chair rerun |
| `Type1Gate` | `AssembleEducateMe` | `G_TYPE_1_LOW_CONFIDENCE` pass or not_applicable |
| `Type1Gate` | `Blocked` | Type-1 gate fail |
| `AssembleEducateMe` | `AssembleEducateMe` | `G_LESSON_CARDS_PRESENT` fail → regenerate (no seat redispatch) |
| `AssembleEducateMe` | `WriteHandoff` | `G_LESSON_CARDS_PRESENT` pass |
| `WriteHandoff` | `Ready` | Full handoff written to `HANDOFF_PATH` |
| `Ready` | `[*]` | Compact chat summary returned |
| `NeedsInput` | `[*]` | One targeted question + packet draft / unresolved field |
| `Blocked` | `[*]` | Failing gate, counters, budget, recovery action |
| `Error` | `[*]` | Failing seat or runtime operation named |

## Terminal states

| Terminal | Run status | User-facing route |
| -------- | ---------- | ----------------- |
| `Ready` | `ready` | Compact summary + handoff path |
| `NeedsInput` | `needs_input` | One clarification; include draft or field |
| `Blocked` | `blocked` | Stop with gate/budget evidence |
| `Error` | `error` | Stop naming seat or runtime failure |

## Reachability

Every listed state is reachable from `Intake` via documented guards. Terminals
each exit to `[*]`. No dead states: wait states resume or escalate; repair loops
return to the producing state within budgets in `decision-gates.md`.

## Notes

- Orchestrator never authors substantive analysis; seats own claims.
- Analysis-seat payloads contain no sibling seat output.
- `do_not_commit_yet` is orchestrator-only at `Type1Gate`; preserve
  `chair_recommendation` separately and set `override_applied`.
- Medium confidence still requires `G_KILL_CRITERION` (time/event-bound quality
  rules in `decision-gates.md`) before `Type1Gate`.
