# State Machine — analyzing-recent-project-state

Finite-state execution model for this skill. Mermaid rendering lives in
[`flow-diagram.md`](./flow-diagram.md).

## Run-scoped variables

| Variable | Initial | Rules |
| -------- | ------- | ----- |
| `ask_token` | available | First interactive ask consumes it. Later `NEEDS_CONTEXT` cannot ask again. |
| `repair_cycles` | 0 | Increment on each `RepairWrite` entry. Cap is 2 failed verify→repair loops. |
| `PRIOR_DRAFT` | unset | Set on `SNAPSHOT_WRITE: PASS`; required for repair redispatches. |

## States

| State | Kind | Phase banner | Actor |
| ----- | ---- | ------------ | ----- |
| `Intake` | active | Phase 1/5 — Intake | Orchestrator |
| `ResolvePath` | active | (within Intake) | Orchestrator |
| `AskPath` | wait | — | Orchestrator → user |
| `ResolveBase` | active | (within Intake) | Orchestrator |
| `AskBase` | wait | — | Orchestrator → user |
| `CarryMutation` | active | (within Intake) | Orchestrator |
| `CollectEvidence` | active | Phase 2/5 — Git evidence | `git-evidence-collector` |
| `AskCollector` | wait | — | Orchestrator → user |
| `WriteSnapshot` | active | Phase 3/5 — Snapshot writing | `state-snapshot-writer` |
| `AskWriter` | wait | — | Orchestrator → user |
| `VerifySnapshot` | active | Phase 4/5 — Verification | `snapshot-verifier` |
| `AskVerifier` | wait | — | Orchestrator → user |
| `RepairWrite` | active | Phase 3/5 — Snapshot writing (repair) | Orchestrator → writer |
| `FinalStrip` | active | Phase 5/5 — Final response | Orchestrator |
| `SuccessReport` | terminal | — | — |
| `EnvNotGit` | terminal | — | — |
| `EnvPathError` | terminal | — | — |
| `EnvNeedsContext` | terminal | — | — |
| `EnvError` | terminal | — | — |

## Transitions

| From | To | Guard / event |
| ---- | -- | ------------- |
| `[*]` | `Intake` | Skill invoked |
| `Intake` | `ResolvePath` | Inputs normalized; personality loaded |
| `ResolvePath` | `ResolveBase` | Path resolvable or workspace safely assumed |
| `ResolvePath` | `AskPath` | Path unclear ∧ `ask_token` ∧ interactive |
| `ResolvePath` | `EnvNeedsContext` | Path unclear ∧ (¬`ask_token` ∨ ¬interactive) |
| `AskPath` | `ResolvePath` | User answered (consume `ask_token`) |
| `AskPath` | `EnvNeedsContext` | Declined or silent |
| `ResolveBase` | `CarryMutation` | Ladder unambiguous (or `none`) |
| `ResolveBase` | `AskBase` | Material merge-base ambiguity ∧ `ask_token` ∧ interactive |
| `ResolveBase` | `EnvNeedsContext` | Material ambiguity ∧ (¬`ask_token` ∨ ¬interactive) |
| `AskBase` | `ResolveBase` | User answered (consume `ask_token`) |
| `AskBase` | `EnvNeedsContext` | Declined or silent |
| `CarryMutation` | `CollectEvidence` | Mutation request carried as risk/next action, or none |
| `CollectEvidence` | `WriteSnapshot` | `GIT_EVIDENCE: PASS` |
| `CollectEvidence` | `EnvNotGit` | `GIT_EVIDENCE: NOT_GIT` |
| `CollectEvidence` | `EnvPathError` | `GIT_EVIDENCE: PATH_ERROR` |
| `CollectEvidence` | `EnvError` | `GIT_EVIDENCE: ERROR` or unroutable after one format retry |
| `CollectEvidence` | `AskCollector` | `NEEDS_CONTEXT` ∧ `ask_token` ∧ interactive |
| `CollectEvidence` | `EnvNeedsContext` | `NEEDS_CONTEXT` ∧ (¬`ask_token` ∨ ¬interactive) |
| `AskCollector` | `CollectEvidence` | User answered (consume `ask_token`) |
| `AskCollector` | `EnvNeedsContext` | Declined or silent |
| `WriteSnapshot` | `VerifySnapshot` | `SNAPSHOT_WRITE: PASS` (retain draft + `Inspected:`) |
| `WriteSnapshot` | `AskWriter` | `SNAPSHOT_WRITE: NEEDS_CONTEXT` ∧ `ask_token` ∧ interactive |
| `WriteSnapshot` | `EnvNeedsContext` | `SNAPSHOT_WRITE: NEEDS_CONTEXT` ∧ (¬`ask_token` ∨ ¬interactive) |
| `WriteSnapshot` | `EnvError` | `SNAPSHOT_WRITE: ERROR` or unroutable after one format retry |
| `AskWriter` | `WriteSnapshot` | User answered (consume `ask_token`) |
| `AskWriter` | `EnvNeedsContext` | Declined or silent |
| `VerifySnapshot` | `FinalStrip` | `SNAPSHOT_VERIFY: PASS` |
| `VerifySnapshot` | `RepairWrite` | `FAIL` ∧ `repair_cycles` < 2 |
| `VerifySnapshot` | `EnvError` | `FAIL` ∧ `repair_cycles` ≥ 2; or `ERROR`; or unroutable after one format retry |
| `VerifySnapshot` | `AskVerifier` | `NEEDS_CONTEXT` ∧ `ask_token` ∧ interactive |
| `VerifySnapshot` | `EnvNeedsContext` | `NEEDS_CONTEXT` ∧ (¬`ask_token` ∨ ¬interactive) |
| `AskVerifier` | `VerifySnapshot` | User answered (consume `ask_token`) |
| `AskVerifier` | `EnvNeedsContext` | Declined or silent |
| `RepairWrite` | `WriteSnapshot` | Redispatch writer with `PRIOR_DRAFT` + `TARGETED_FIXES`; increment `repair_cycles` |
| `FinalStrip` | `SuccessReport` | Status wrappers and `Inspected:` log removed |
| `SuccessReport` | `[*]` | Return verified report body |
| `EnvNotGit` | `[*]` | Envelope `RECENT_STATE: NOT_GIT` |
| `EnvPathError` | `[*]` | Envelope `RECENT_STATE: PATH_ERROR` |
| `EnvNeedsContext` | `[*]` | Envelope `RECENT_STATE: NEEDS_CONTEXT` |
| `EnvError` | `[*]` | Envelope `RECENT_STATE: ERROR` |

## Reachability

Every listed state is reachable from `Intake` via documented guards. Terminals
`SuccessReport`, `EnvNotGit`, `EnvPathError`, `EnvNeedsContext`, and `EnvError`
each have an exit to `[*]`. There are no dead states: wait states always resume
or escalate; `RepairWrite` always returns to `WriteSnapshot`.

## Notes

- Writer `ERROR` never enters `AskWriter` (gap-003).
- Base ambiguity ask consumes `ask_token` (gap-002 / gap-004).
- Unroutable subagent output: one in-state format-reminder redispatch, then
  `EnvError` with reason `unroutable subagent output in <phase>`.
