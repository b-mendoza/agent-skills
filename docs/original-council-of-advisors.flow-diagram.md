# Council of Advisors Workflow

The orchestrator coordinates a decision council, enforces framing and validation gates, and assembles the final handoff. It may dispatch the named seats and validate their packets; it must preserve analysis-seat independence, stop for user framing confirmation, avoid invented external facts, and escalate after repeated gate failure.

```mermaid
flowchart TD
  START([Start: decision request]) --> INTAKE[Capture subject, claim, outcome, assumptions, constraints, and current lean]
  INTAKE --> SUBJECT{Decision subject clear?}
  SUBJECT -->|no| ASK_SUBJECT([Needs input: ask one focused clarification])
  SUBJECT -->|yes| PACKET[Paraphrase decision packet]
  PACKET --> CONFIRM{G_FRAMING_CONFIRMED: user confirms packet?}
  CONFIRM -->|no| REFRAME[Revise framing and ask again]
  REFRAME --> CONFIRM
  CONFIRM -->|yes| REV[Dispatch reversibility-seat]

  REV --> REV_GATE{G_REVERSIBILITY: required fields and matching depth?}
  REV_GATE -->|fail| REV_REPAIR[Redispatch reversibility-seat with missing-field reason]
  REV_REPAIR --> REV_GATE
  REV_GATE -->|type_1| DEPTH_DEEP[Bind depth_setting: deep]
  REV_GATE -->|type_2| DEPTH_STANDARD[Bind depth_setting: standard]

  DEPTH_DEEP --> PARALLEL[Dispatch seven analysis seats independently]
  DEPTH_STANDARD --> PARALLEL
  PARALLEL --> ADV[adversary-seat: inversion and failure modes]
  PARALLEL --> OPT[optimistic-seat: asymmetric upside]
  PARALLEL --> ORIG[originality-seat: prior art and differentiation]
  PARALLEL --> SECOND[second-order-seat: consequence tree]
  PARALLEL --> SKILL[paradox-of-skill-seat: skill versus luck]
  PARALLEL --> FOCUS[focus-seat: opportunity cost]
  PARALLEL --> QUESTIONS[power-questions-seat: ranked high-leverage questions]

  ADV --> PACKETS[Collect seven advisor packets]
  OPT --> PACKETS
  ORIG --> PACKETS
  SECOND --> PACKETS
  SKILL --> PACKETS
  FOCUS --> PACKETS
  QUESTIONS --> PACKETS

  PACKETS --> REASON_GATE{G_REASONING_CHAINS_PRESENT?}
  REASON_GATE -->|fail, cycles remain| SEAT_REPAIR[Redispatch only failing seat with missing-field reason]
  SEAT_REPAIR --> PACKETS
  REASON_GATE -->|fail, fourth attempt| BLOCKED([Blocked: repeated packet gate failure])
  REASON_GATE -->|pass| ORIG_GATE{G_ORIGINALITY}

  ORIG_GATE -->|prior art absent| CHAIR_INPUT[Prepare chair input packets]
  ORIG_GATE -->|prior art plus differentiation| CHAIR_INPUT
  ORIG_GATE -->|prior art, no differentiation| ORIG_BRANCH[Produce Differentiate, Pivot, or Abandon branch]
  ORIG_BRANCH --> CHAIR_INPUT

  CHAIR_INPUT --> CHAIR[Dispatch chair-seat with full council packets]
  CHAIR --> DISSENT_GATE{G_DISSENT_PRESERVED?}
  DISSENT_GATE -->|fail| CHAIR_REPAIR[Redispatch chair-seat with missing dissent or schema reason]
  CHAIR_REPAIR --> DISSENT_GATE
  DISSENT_GATE -->|pass| CONFIDENCE{Chair confidence?}

  CONFIDENCE -->|high| EDUCATE[Build educate-me lesson cards and solo drill]
  CONFIDENCE -->|medium| KILL{required_kill_criterion present?}
  KILL -->|no| CHAIR_KILL_REPAIR[Redispatch chair-seat for kill criterion]
  CHAIR_KILL_REPAIR --> CONFIDENCE
  KILL -->|yes| EDUCATE
  CONFIDENCE -->|low, cycles remain| LOW_REPAIR[Return to low-confidence or unverified-premise seats]
  LOW_REPAIR --> PACKETS
  CONFIDENCE -->|low after 3 cycles and type_1| OVERRIDE[Set recommendation: do_not_commit_yet]
  CONFIDENCE -->|low after 3 cycles and type_2| EDUCATE
  OVERRIDE --> EDUCATE

  EDUCATE --> LESSON_GATE{G_LESSON_CARDS_PRESENT?}
  LESSON_GATE -->|fail| FILL_LESSONS[Generate missing deterministic cards or drill]
  FILL_LESSONS --> LESSON_GATE
  LESSON_GATE -->|pass| HANDOFF[Assemble final YAML handoff with packets and gate verdicts]
  HANDOFF --> READY([Ready])

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class SUBJECT,CONFIRM,REV_GATE,REASON_GATE,ORIG_GATE,DISSENT_GATE,CONFIDENCE,KILL,LESSON_GATE decision;
  class REV,PARALLEL,ADV,OPT,ORIG,SECOND,SKILL,FOCUS,QUESTIONS,CHAIR check;
  class ASK_SUBJECT,CONFIRM human;
  class REFRAME,REV_REPAIR,SEAT_REPAIR,ORIG_BRANCH,CHAIR_REPAIR,CHAIR_KILL_REPAIR,LOW_REPAIR,FILL_LESSONS refine;
  class HANDOFF,EDUCATE output;
  class READY success;
  class BLOCKED stop;
  class DEPTH_DEEP,DEPTH_STANDARD,OVERRIDE guard;
```

Readiness rule: the workflow is ready only when the final handoff includes the recommendation, confidence, every seat packet, every gate verdict, nine lesson cards, and the 9-question solo drill. A gate that fails a fourth time routes to `blocked` rather than silent continuation.

Build notes: generated as a new whole-process diagram following the `generate-flow-diagram` skill. The candidate represents intake, boundary, dispatch, validation, synthesis, human confirmation, repair loops, terminal states, and output contract checks from `skills/council-of-advisors/SKILL.md` and `references/decision-gates.md`; Mermaid syntax and one-diagram output were reviewed against the helper skill's local quality checklist.
