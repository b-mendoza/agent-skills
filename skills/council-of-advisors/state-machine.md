# State Machine — council-of-advisors

Finite-state execution model for this skill. This file is the sole canonical FSM source. Gate predicates, repair caps, and failure routes are normative only in [`references/decision-gates.md`](./references/decision-gates.md).

## Run-scoped variables

| Variable | Initial | Rules |
| --- | --- | --- |
| `packet_version` | 1 | Increment on consolidated packet refinement; never mix versions in one chair synthesis |
| `research_tools` | unset | Set in `DeclareResearch` to `none` or `web` |
| `depth_setting` | unset | Bound in `BindDepth` from reversibility (`type_1`→`deep`, `type_2`→`standard`) |
| `gate_repair_cycles` | 0 per gate | Cap 3 targeted repairs; fourth failure → `Blocked`. Exception: `G_FRAMING_CONFIRMED` uses total confirmation attempts and terminates in `NeedsInput` (see `decision-gates.md`) |
| `seat_schema_repairs` | 0 per analysis seat | Cap 3 redispatches per seat |
| `global_redispatches` | 0 | Cap 12 total; excess → `Blocked` |
| `analysis_blocked_waves` | 0 | First wave → `RefinePacket`; second → `NeedsInput` |
| `override_applied` | false | Set true only by orchestrator on Type 1 + low confidence |

## Dispatch topology

Nine seat files; mechanical order is not nine parallel advisors:

1. `reversibility-seat` (sequential)
2. Seven analysis seats, logically independent, dispatched in parallel up to the runtime's concurrency limit — in bounded waves when the runtime caps concurrent subagents: adversary, optimistic, originality, second-order, paradox-of-skill, focus, power-questions. Correctness never depends on simultaneous launch; seat contracts and aggregation are identical regardless of wave layout.
3. Optional `originality-seat` branch mode (same seat file, not a tenth seat)
4. `chair-seat` (synthesis)

## States

| State                   | Kind     | Actor                            |
| ----------------------- | -------- | -------------------------------- |
| `Intake`                | active   | Orchestrator                     |
| `AskSubject`            | wait     | Orchestrator → user              |
| `ClassifyStakes`        | active   | Orchestrator                     |
| `ConfirmFraming`        | wait     | Orchestrator → user              |
| `DeclareResearch`       | active   | Orchestrator                     |
| `ClassifyReversibility` | active   | `reversibility-seat`             |
| `ProbeReversibility`    | wait     | Orchestrator → user              |
| `BindDepth`             | active   | Orchestrator                     |
| `ParallelAnalysis`      | active   | Seven analysis seats             |
| `RouteAnalysis`         | active   | Orchestrator                     |
| `RefinePacket`          | wait     | Orchestrator → user              |
| `OriginalityCheck`      | active   | Orchestrator                     |
| `OriginalityBranch`     | active   | `originality-seat` (branch mode) |
| `SynthesizeChair`       | active   | `chair-seat`                     |
| `RouteConfidence`       | active   | Orchestrator                     |
| `RepairLowConfidence`   | active   | Weak analysis seats → chair      |
| `Type1Gate`             | active   | Orchestrator                     |
| `AssembleEducateMe`     | active   | Orchestrator                     |
| `WriteHandoff`          | active   | Orchestrator                     |
| `Ready`                 | terminal | —                                |
| `NeedsInput`            | terminal | —                                |
| `Blocked`               | terminal | —                                |
| `Error`                 | terminal | —                                |

## Transitions

Competing transitions from one state use first-match order as listed.

| From | To | Guard / event |
| --- | --- | --- |
| `[*]` | `Intake` | Skill invoked |
| `Intake` | `AskSubject` | `DECISION_SUBJECT` missing or unintelligible |
| `Intake` | `ClassifyStakes` | Subject intelligible |
| `AskSubject` | `Intake` | User answered |
| `AskSubject` | `NeedsInput` | Declined or silent |
| `ClassifyStakes` | `ConfirmFraming` | High-stakes disclosure attached when applicable |
| `ConfirmFraming` | `DeclareResearch` | `G_FRAMING_CONFIRMED` pass |
| `ConfirmFraming` | `ConfirmFraming` | Unconfirmed; revise paraphrase (max 3 total confirmation attempts: initial ask plus up to 2 revised re-asks) |
| `ConfirmFraming` | `NeedsInput` | Third confirmation attempt unconfirmed |
| `DeclareResearch` | `ClassifyReversibility` | `research_tools` recorded |
| `ClassifyReversibility` | `ProbeReversibility` | `G_REVERSIBILITY` pass ∧ confidence `low` |
| `ClassifyReversibility` | `BindDepth` | `G_REVERSIBILITY` pass ∧ confidence not `low` |
| `ClassifyReversibility` | `ProbeReversibility` | Seat `BLOCKED` (cannot estimate a reversal-cost dimension); the `ProbeReversibility` default applies if still unresolved |
| `ClassifyReversibility` | `ClassifyReversibility` | Fail under repair cap |
| `ClassifyReversibility` | `Blocked` | Reversibility repair cap hit |
| `ClassifyReversibility` | `Error` | Seat `ERROR` twice |
| `ProbeReversibility` | `ClassifyReversibility` | Answer with new reversibility evidence appended; redispatch |
| `ProbeReversibility` | `BindDepth` | Still low, user declines, or reply adds no new reversibility evidence → default `type_1`/`deep`, `classification_basis: defaulted_low_confidence` (no response at all: remain waiting) |
| `BindDepth` | `ParallelAnalysis` | `depth_setting` bound |
| `ParallelAnalysis` | `RouteAnalysis` | Every dispatched seat has returned a payload or been reported missing by the runtime; completion order never selects the route |
| `RouteAnalysis` | `ParallelAnalysis` | First `ERROR` or missing result for a seat: retry that seat once |
| `RouteAnalysis` | `Error` | Seat `ERROR` or missing result twice |
| `RouteAnalysis` | `RefinePacket` | Any seat `BLOCKED`, first wave |
| `RouteAnalysis` | `NeedsInput` | Any seat `BLOCKED`, second wave |
| `RouteAnalysis` | `ParallelAnalysis` | Any `FAIL`, validator rejection, or unparseable payload under `seat_schema_repairs`; or `G_INDEPENDENCE` defect (rerun affected seats with clean payloads per `decision-gates.md`) |
| `RouteAnalysis` | `Blocked` | Analysis gate or global budget cap hit |
| `RouteAnalysis` | `OriginalityCheck` | `G_REASONING_CHAINS_PRESENT` ∧ `G_INDEPENDENCE` pass |
| `RefinePacket` | `ParallelAnalysis` | Packet `vN+1` re-confirmed |
| `RefinePacket` | `NeedsInput` | Re-confirm declined |
| `OriginalityCheck` | `OriginalityBranch` | `G_ORIGINALITY` fail (no pass condition in `decision-gates.md` holds) → redispatch `originality-seat` in branch mode |
| `OriginalityCheck` | `SynthesizeChair` | `G_ORIGINALITY` pass |
| `OriginalityBranch` | `SynthesizeChair` | Branch output authored with provenance |
| `OriginalityBranch` | `OriginalityBranch` | Malformed branch output or branch `FAIL`; redispatch under repair cap |
| `OriginalityBranch` | `RefinePacket` | Branch `BLOCKED`, counted as an `analysis_blocked_waves` wave, first wave |
| `OriginalityBranch` | `NeedsInput` | Branch `BLOCKED`, second wave |
| `OriginalityBranch` | `Blocked` | Branch repair cap hit |
| `OriginalityBranch` | `Error` | Seat `ERROR` twice |
| `SynthesizeChair` | `RouteConfidence` | `G_DISSENT_PRESERVED` ∧ `G_KILL_CRITERION` ∧ `G_RECOMMENDATION_CONSISTENCY` pass (all checked at every confidence level) |
| `SynthesizeChair` | `SynthesizeChair` | Dissent, kill, or recommendation-consistency fail under cap; or chair `FAIL` naming a correctable defect (1 targeted redispatch, counted against global budget) |
| `SynthesizeChair` | `Blocked` | Chair repair cap hit; second chair `FAIL`; or chair `FAIL` stating synthesis is substantively impossible on unchanged packets (surface the chair's reason) |
| `SynthesizeChair` | `Error` | Chair `ERROR` twice |
| `RouteConfidence` | `Type1Gate` | Confidence high/medium (dissent and kill gates already passed in `SynthesizeChair`) |
| `RouteConfidence` | `RepairLowConfidence` | Confidence low ∧ redispatch set non-empty ∧ planned repair (weak seats + chair rerun) fits within remaining global budget |
| `RouteConfidence` | `Type1Gate` | Confidence low ∧ set empty or planned repair does not fit remaining global budget (repair skipped; Type 1 override still applies) |
| `RepairLowConfidence` | `SynthesizeChair` | Weak seats redispatched; chair rerun (each redispatch and the chair rerun count individually against the global budget) |
| `Type1Gate` | `AssembleEducateMe` | `G_TYPE_1_LOW_CONFIDENCE` pass or not_applicable |
| `Type1Gate` | `Blocked` | Type-1 gate fail |
| `AssembleEducateMe` | `AssembleEducateMe` | `G_LESSON_CARDS_PRESENT` fail → regenerate (no seat redispatch; max 3 regeneration cycles) |
| `AssembleEducateMe` | `Blocked` | Still failing after third regeneration cycle; surface remaining card defect |
| `AssembleEducateMe` | `WriteHandoff` | `G_LESSON_CARDS_PRESENT` pass |
| `WriteHandoff` | `Ready` | Full handoff written to `HANDOFF_PATH` |
| `Ready` | `[*]` | Compact chat summary returned |
| `NeedsInput` | `[*]` | One targeted question + packet draft / unresolved field |
| `Blocked` | `[*]` | Failing gate, counters, budget, recovery action |
| `Error` | `[*]` | Failing seat or runtime operation named |

## Terminal states

| Terminal     | Run status    | User-facing route                         |
| ------------ | ------------- | ----------------------------------------- |
| `Ready`      | `ready`       | Compact summary + handoff path            |
| `NeedsInput` | `needs_input` | One clarification; include draft or field |
| `Blocked`    | `blocked`     | Stop with gate/budget evidence            |
| `Error`      | `error`       | Stop naming seat or runtime failure       |

## Reachability

Every listed state is reachable from `Intake` via documented guards. Terminals each exit to `[*]`. No dead states: wait states resume or escalate; repair loops return to the producing state within budgets in `decision-gates.md`.

## Notes

- Orchestrator never authors substantive analysis; seats own claims.
- Analysis-seat payloads contain no sibling seat output.
- `TOOLS_MISSING` (the shipped validator cannot run) is out-of-band, not a seat status: from any state that would run the validator, terminate `Blocked` naming the capability.
- `do_not_commit_yet` is orchestrator-only at `Type1Gate`; preserve `chair_recommendation` separately and set `override_applied`.
- Medium confidence still requires `G_KILL_CRITERION` (time/event-bound quality rules in `decision-gates.md`) before `Type1Gate`.
