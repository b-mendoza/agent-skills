# Workflow Skill Architect Flow

Control-flow source of truth for `workflow-skill-architect`. High-level execution is a finite-state machine (`stateDiagram-v2`). Transition table: [`state-machine.md`](./state-machine.md).

```mermaid
stateDiagram-v2
  [*] --> ResumeGate

  ResumeGate --> Restore: RESUME_PACKET present
  ResumeGate --> Intake: no packet

  Restore --> ResumeRoute: RUN_STATE restored
  ResumeRoute --> ArchitectureLoop: pending queue item
  ResumeRoute --> Review: pending review step

  Intake --> TerminalNeedsInput: missing required input
  Intake --> Classify: WORKFLOW_OR_STEP or EXISTING_SKILL_DIR present

  Classify --> Trust: mode and scope recorded
  Trust --> ResolveSources: trust model applied

  ResolveSources --> TerminalNeedsInput: essential runtime fact unconfirmed
  ResolveSources --> TerminalBlocked: unsafe or conflicting source
  ResolveSources --> ModeFork: sources resolved

  ModeFork --> BuildReviewPacket: review mode
  ModeFork --> PlanQueue: generation mode

  BuildReviewPacket --> Review: FILES_UNDER_REVIEW ready

  PlanQueue --> TerminalReady: queue empty zero-output
  PlanQueue --> ArchitectureLoop: queue non-empty

  ArchitectureLoop --> ArchitectureLoop: PASS and items remain
  ArchitectureLoop --> TerminalNeedsInput: NEEDS_INPUT batch ready
  ArchitectureLoop --> TerminalBlocked: ARCHITECTURE BLOCKED
  ArchitectureLoop --> TerminalError: ARCHITECTURE ERROR
  ArchitectureLoop --> Synthesize: all items PASS

  Synthesize --> Review: candidate package staged

  Review --> TerminalReady: review mode PASS or FAIL delivered
  Review --> Delivery: generation PASS
  Review --> Repair: generation FAIL and REPAIR_CYCLE under 3
  Review --> TerminalBlocked: FAIL at repair cap or REVIEW BLOCKED
  Review --> TerminalError: REVIEW ERROR

  Repair --> Review: full re-review after staged repair

  Delivery --> MutationGate: delivery assembled
  MutationGate --> TerminalReady: no mutation or declined or approved applied
  MutationGate --> TerminalBlocked: mutation requested without approval

  TerminalReady --> [*]
  TerminalNeedsInput --> [*]
  TerminalBlocked --> [*]
  TerminalError --> [*]
```

## Canonical Rules

- Resume routes to the first pending queue item or the pending review step (`ResumeRoute`), never blindly into architecture when review is pending.
- Trust runs after every successful classification, including create-without- existing packages.
- Review mode: `REVIEW: PASS` and `REVIEW: FAIL` both terminate `ready`; no repair and no real-package writes.
- Generation repair: orchestrator-owned `REPAIR_CYCLE`, max 3, staged scope only, full re-review each cycle.
- Mutation: real-package writes only after explicit in-run approval that follows visibility of staged paths (see `SKILL.md` Mutation Approval).
- Every `needs_input` terminal includes a `RESUME_PACKET`.

## Mermaid validation note

Validated structurally (reachability, no dead non-terminals). Sibling `skills/generate-flow-diagram/scripts/check-mermaid.sh` returned `parser unavailable` (Chrome/puppeteer missing); recorded as fallback evidence.
