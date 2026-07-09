# Flow Diagram

Canonical execution model: finite state machine. Guards, budgets, and terminals
are tabulated in [`state-machine.md`](./state-machine.md). Gate predicates live
only in [`references/decision-gates.md`](./references/decision-gates.md).

```mermaid
stateDiagram-v2
  [*] --> Intake

  Intake --> AskSubject: subject missing or unintelligible
  Intake --> ClassifyStakes: subject intelligible
  AskSubject --> Intake: user answered
  AskSubject --> NeedsInput: declined or silent after ask

  ClassifyStakes --> ConfirmFraming: disclosure attached if needed
  ConfirmFraming --> DeclareResearch: G_FRAMING_CONFIRMED pass
  ConfirmFraming --> ConfirmFraming: revise under cap
  ConfirmFraming --> NeedsInput: framing cap hit

  DeclareResearch --> ClassifyReversibility: research_tools recorded
  ClassifyReversibility --> ProbeReversibility: G_REVERSIBILITY pass and confidence low
  ClassifyReversibility --> BindDepth: G_REVERSIBILITY pass and confidence not low
  ClassifyReversibility --> ClassifyReversibility: fail under repair cap
  ClassifyReversibility --> Blocked: reversibility repair cap hit
  ClassifyReversibility --> Error: seat ERROR twice

  ProbeReversibility --> ClassifyReversibility: answer appended, redispatch
  ProbeReversibility --> BindDepth: still low, default type_1 deep

  BindDepth --> ParallelAnalysis: depth_setting bound
  ParallelAnalysis --> RouteAnalysis: seven seats returned
  RouteAnalysis --> ParallelAnalysis: FAIL or schema miss under seat cap
  RouteAnalysis --> RefinePacket: BLOCKED first wave
  RouteAnalysis --> NeedsInput: BLOCKED second wave
  RouteAnalysis --> Error: seat ERROR twice
  RouteAnalysis --> Blocked: analysis gate or budget cap hit
  RouteAnalysis --> OriginalityCheck: G_REASONING_CHAINS_PRESENT and G_INDEPENDENCE pass

  RefinePacket --> ParallelAnalysis: packet vN+1 re-confirmed
  RefinePacket --> NeedsInput: re-confirm declined

  OriginalityCheck --> OriginalityBranch: G_ORIGINALITY needs branch
  OriginalityCheck --> SynthesizeChair: G_ORIGINALITY pass
  OriginalityBranch --> SynthesizeChair: branch output authored

  SynthesizeChair --> RouteConfidence: G_DISSENT_PRESERVED pass
  SynthesizeChair --> SynthesizeChair: dissent or kill fail under cap
  SynthesizeChair --> Blocked: chair repair cap hit
  SynthesizeChair --> Error: chair ERROR twice

  RouteConfidence --> Type1Gate: confidence high or medium and G_KILL_CRITERION pass
  RouteConfidence --> RepairLowConfidence: confidence low and redispatch set non-empty under cap
  RouteConfidence --> Type1Gate: confidence low and set empty or cap spent

  RepairLowConfidence --> SynthesizeChair: weak seats redispatched

  Type1Gate --> AssembleEducateMe: G_TYPE_1_LOW_CONFIDENCE pass or not_applicable
  Type1Gate --> Blocked: type-1 gate fail

  AssembleEducateMe --> AssembleEducateMe: G_LESSON_CARDS_PRESENT fail, regenerate
  AssembleEducateMe --> WriteHandoff: G_LESSON_CARDS_PRESENT pass

  WriteHandoff --> Ready: handoff written

  Ready --> [*]
  NeedsInput --> [*]
  Blocked --> [*]
  Error --> [*]
```
