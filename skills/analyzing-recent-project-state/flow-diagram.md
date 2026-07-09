# Flow Diagram

Canonical execution model: finite state machine. Guards and terminals are
tabulated in [`state-machine.md`](./state-machine.md).

```mermaid
stateDiagram-v2
  [*] --> Intake

  Intake --> ResolvePath: inputs normalized

  ResolvePath --> ResolveBase: path ok or workspace assumed
  ResolvePath --> AskPath: path unclear and ask_token and interactive
  ResolvePath --> EnvNeedsContext: path unclear and no ask available

  AskPath --> ResolvePath: user answered
  AskPath --> EnvNeedsContext: declined or silent

  ResolveBase --> CarryMutation: base resolved
  ResolveBase --> AskBase: merge-base ambiguity and ask_token and interactive
  ResolveBase --> EnvNeedsContext: merge-base ambiguity and no ask available

  AskBase --> ResolveBase: user answered
  AskBase --> EnvNeedsContext: declined or silent

  CarryMutation --> CollectEvidence: mutation carried or none

  CollectEvidence --> WriteSnapshot: GIT_EVIDENCE PASS
  CollectEvidence --> EnvNotGit: NOT_GIT
  CollectEvidence --> EnvPathError: PATH_ERROR
  CollectEvidence --> EnvError: ERROR or unroutable after one retry
  CollectEvidence --> AskCollector: NEEDS_CONTEXT and ask_token and interactive
  CollectEvidence --> EnvNeedsContext: NEEDS_CONTEXT and no ask available

  AskCollector --> CollectEvidence: user answered
  AskCollector --> EnvNeedsContext: declined or silent

  WriteSnapshot --> VerifySnapshot: SNAPSHOT_WRITE PASS
  WriteSnapshot --> AskWriter: NEEDS_CONTEXT and ask_token and interactive
  WriteSnapshot --> EnvNeedsContext: NEEDS_CONTEXT and no ask available
  WriteSnapshot --> EnvError: ERROR or unroutable after one retry

  AskWriter --> WriteSnapshot: user answered
  AskWriter --> EnvNeedsContext: declined or silent

  VerifySnapshot --> FinalStrip: SNAPSHOT_VERIFY PASS
  VerifySnapshot --> RepairWrite: FAIL and repair_cycles under 2
  VerifySnapshot --> EnvError: FAIL after second repair or ERROR or unroutable after one retry
  VerifySnapshot --> AskVerifier: NEEDS_CONTEXT and ask_token and interactive
  VerifySnapshot --> EnvNeedsContext: NEEDS_CONTEXT and no ask available

  AskVerifier --> VerifySnapshot: user answered
  AskVerifier --> EnvNeedsContext: declined or silent

  RepairWrite --> WriteSnapshot: PRIOR_DRAFT plus TARGETED_FIXES

  FinalStrip --> SuccessReport: wrappers and Inspected log stripped
  SuccessReport --> [*]

  EnvNotGit --> [*]
  EnvPathError --> [*]
  EnvNeedsContext --> [*]
  EnvError --> [*]
```

## Gate And Branch Summary

| Gate | Guard | Pass path | Stop / alternate |
| ---- | ----- | --------- | ---------------- |
| Path gate | Path resolvable or workspace assumable | `ResolveBase` | `AskPath` if ask token left; else `EnvNeedsContext` |
| Base ambiguity gate | Two ladder candidates, different merge-bases | `CarryMutation` | `AskBase` if ask token left; else `EnvNeedsContext` |
| Ask-budget gate | `ask_token` unused | First interactive ask consumes token | Later `NEEDS_CONTEXT` → envelope |
| Mutation gate | User asked for mutation | Stay read-only; carry into risks / next actions | None |
| Evidence gate | `GIT_EVIDENCE: PASS` | `WriteSnapshot` | `EnvNotGit`, `EnvPathError`, ask, or `EnvError` |
| Write gate | `SNAPSHOT_WRITE: PASS` | `VerifySnapshot` | `NEEDS_CONTEXT` → ask or envelope; `ERROR` → envelope only |
| Verify gate | `SNAPSHOT_VERIFY: PASS` | `FinalStrip` | Repair (cap 2), ask, or `EnvError` |
| Malformed-status rule | Exactly one routable status line | Route on status | One format-reminder redispatch inside the same phase state, then `EnvError` |

## Terminal States

- Success: verified `# Project State Snapshot` body (`SuccessReport`).
- Escalation: `RECENT_STATE: <NOT_GIT | PATH_ERROR | NEEDS_CONTEXT | ERROR>` plus
  `Reason:` and `Next step:` (`EnvNotGit`, `EnvPathError`, `EnvNeedsContext`,
  `EnvError`).
