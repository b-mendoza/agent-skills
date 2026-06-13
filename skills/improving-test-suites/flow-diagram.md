# Flow Diagram: `improving-test-suites`

This diagram is a summary. [`references/orchestration-protocol.md`](./references/orchestration-protocol.md) is the single normative routing source and overrides summary drift.

Diagram regenerated from protocol tables; edge-for-row check passed, including optional-review unrecoverable `ERROR` to `COMPLETE_ERROR`.

## Reading Conventions

- **Dispatch-retry rule.** Every edge labeled `ERROR after dispatch retry` means: on the first `ERROR` from that dispatch, retry the same dispatch once if `REPAIR_TOTAL < 3` (incrementing it); route along the drawn edge only when the retry also errors or no budget remains.
- **Ask-gate bound.** Every `ASK_*` node has the two drawn exits plus an implicit loop bound: the third occurrence of the same question at the same gate routes to `FINAL_BLOCKED`.
- **Resume packets.** Every entry into `FINAL_BLOCKED` writes a schema-valid resume packet.

```mermaid
flowchart TD
  START([Start]) --> RESUME{RESUME_PACKET supplied?}
  RESUME -->|no| RESOLVE
  RESUME -->|yes and schema-valid| REENTER[Restore state and resume at recorded re-entry point]
  RESUME -->|yes with missing required field| ASK_RESUME[Ask one focused packet question]
  ASK_RESUME -->|answered| REENTER
  ASK_RESUME -->|no answer| FINAL_BLOCKED

  RESOLVE[Expand TARGET_TEST_FILES and classify each match test or non-test] --> TARGET_OK{At least one classified test file?}
  TARGET_OK -->|no| ASK_TARGET[Ask focused target question]
  ASK_TARGET -->|answered| RESOLVE
  ASK_TARGET -->|no answer| FINAL_BLOCKED
  TARGET_OK -->|yes| WS1{Stage 1 workspace risk on resolved targets?}
  WS1 -->|yes| ASK_WS1[Ask workspace acknowledgment]
  ASK_WS1 -->|acknowledged| BASELINE
  ASK_WS1 -->|declined or no answer| FINAL_BLOCKED
  WS1 -->|no| BASELINE[Dispatch test-validator MODE=baseline]

  BASELINE --> BASE_STATUS{Baseline status}
  BASE_STATUS -->|PASS with executed tests| VALUE
  BASE_STATUS -->|FAIL zero collected| EMPTY{Answer channel exists?}
  EMPTY -->|yes| ASK_EMPTY[Report empty target and ask retarget or end]
  ASK_EMPTY -->|retarget| RESOLVE
  ASK_EMPTY -->|end| FINAL_EMPTY
  ASK_EMPTY -->|no answer| FINAL_BLOCKED
  EMPTY -->|no| FINAL_BLOCKED
  BASE_STATUS -->|FAIL with named failing tests| BASE_RECORD[Record failing baseline for the plan gate]
  BASE_RECORD --> VALUE
  BASE_STATUS -->|BLOCKED| ASK_BASE[Ask smallest command or dependency question]
  ASK_BASE -->|answered| BASELINE
  ASK_BASE -->|no answer| FINAL_BLOCKED
  BASE_STATUS -->|ERROR after dispatch retry| FINAL_ERROR

  VALUE[Dispatch test-value-reviewer] --> VALUE_STATUS{VALUE_STATUS}
  VALUE_STATUS -->|PASS| TRUNC{Any plan-feeding section truncated shown N of M?}
  TRUNC -->|yes, re-dispatch| VALUE_EX[Dispatch test-value-reviewer MODE=exhaustive]
  VALUE_EX --> VALUE_STATUS
  TRUNC -->|yes, user-approved scope note| API_ROUTE
  TRUNC -->|no| API_ROUTE
  VALUE_STATUS -->|BLOCKED or NEEDS_CLARIFICATION| ASK_VALUE[Ask smallest value question]
  ASK_VALUE -->|answered| VALUE
  ASK_VALUE -->|no answer| FINAL_BLOCKED
  VALUE_STATUS -->|ERROR after dispatch retry| FINAL_ERROR

  API_ROUTE{API or security review route?}
  API_ROUTE -->|required or optional| API[Dispatch api-security-reviewer]
  API_ROUTE -->|not needed| MAINT_ROUTE
  API --> API_STATUS{API_STATUS}
  API_STATUS -->|PASS or NOT_APPLICABLE| MAINT_ROUTE
  API_STATUS -->|BLOCKED or NEEDS_CLARIFICATION| API_CHECK{Required route or sufficiency checklist fails?}
  API_STATUS -->|ERROR after dispatch retry, recoverable question exists| API_CHECK
  API_STATUS -->|ERROR after dispatch retry, unrecoverable| FINAL_ERROR
  API_CHECK -->|yes| ASK_API[Ask smallest API or security question]
  API_CHECK -->|no| API_RISK[Record remaining risk with checklist outcome]
  ASK_API -->|answered| API
  ASK_API -->|no answer| FINAL_BLOCKED
  API_RISK --> MAINT_ROUTE

  MAINT_ROUTE{Maintainability review route?}
  MAINT_ROUTE -->|required or optional| MAINT[Dispatch test-maintainability-reviewer]
  MAINT_ROUTE -->|not needed| SYNTH
  MAINT --> MAINT_STATUS{MAINT_STATUS}
  MAINT_STATUS -->|PASS| SYNTH
  MAINT_STATUS -->|BLOCKED or NEEDS_CLARIFICATION| MAINT_CHECK{Required route or sufficiency checklist fails?}
  MAINT_STATUS -->|ERROR after dispatch retry, recoverable question exists| MAINT_CHECK
  MAINT_STATUS -->|ERROR after dispatch retry, unrecoverable| FINAL_ERROR
  MAINT_CHECK -->|yes| ASK_MAINT[Ask smallest maintainability question]
  MAINT_CHECK -->|no| MAINT_RISK[Record remaining risk with checklist outcome]
  ASK_MAINT -->|answered| MAINT
  ASK_MAINT -->|no answer| FINAL_BLOCKED
  MAINT_RISK --> SYNTH

  SYNTH[Synthesize id-stamped minimal harness decision] --> SAFE_EDIT{Safe edit justified?}
  SAFE_EDIT -->|no| VALIDATE_NOOP[Dispatch test-validator MODE=post-change CHANGED_FILES=none]
  SAFE_EDIT -->|yes| HELPER{Plan includes shared-helper edits?}
  HELPER -->|yes| CONSUMERS[Compute SHARED_HELPER_CONSUMERS by repository-wide search]
  CONSUMERS --> DUAL
  HELPER -->|no| DUAL
  DUAL{Production or non-additive shared-helper items?}
  DUAL -->|yes| ASK_DUAL[Ask dual authority naming files]
  DUAL -->|no| GATE
  ASK_DUAL -->|approved and scope permits| GATE
  ASK_DUAL -->|declined bug driver| FINAL_BUG
  ASK_DUAL -->|declined otherwise| REPLAN[Remove unapproved items]
  ASK_DUAL -->|no answer| FINAL_BLOCKED
  REPLAN -->|plan remains| GATE
  REPLAN -->|no plan remains| FINAL_NO_CHANGE

  GATE{AUTO_APPROVE=true?}
  GATE -->|yes| RAILS{Rails pass: provenance, deletion cap, no high-value deletion, baseline PASS?}
  RAILS -->|yes| WS2
  RAILS -->|no, answer channel exists| ASK_PLAN
  RAILS -->|no, headless| FINAL_BLOCKED
  GATE -->|no| ASK_PLAN[Present itemized plan, baseline result, truncation notes, excluded non-test matches]
  ASK_PLAN -->|approved| WS2
  ASK_PLAN -->|amended| AMEND[Re-gate amendments: dual authority and workspace coverage]
  AMEND --> WS2
  ASK_PLAN -->|declined| FINAL_NO_CHANGE
  ASK_PLAN -->|no answer| FINAL_BLOCKED

  WS2{Stage 2 workspace risk on exact approved edit set?}
  WS2 -->|yes| ASK_WS2[Ask workspace acknowledgment for named files]
  ASK_WS2 -->|acknowledged| REFACTOR
  ASK_WS2 -->|declined or no answer| FINAL_BLOCKED
  WS2 -->|no| REFACTOR[Dispatch test-refactorer with full input contract]

  REFACTOR --> REFACTOR_STATUS{REFACTOR_STATUS}
  REFACTOR_STATUS -->|PASS| CONFORM[Evidence-based conformance: id joins, independently verified survivors, widening present, counts]
  REFACTOR_STATUS -->|BLOCKED or NEEDS_CLARIFICATION| ASK_REFACTOR[Ask smallest scope or file question]
  ASK_REFACTOR -->|answered| REFACTOR
  ASK_REFACTOR -->|no answer| FINAL_BLOCKED
  REFACTOR_STATUS -->|FAIL production bug outside approved scope| FINAL_BUG
  REFACTOR_STATUS -->|FAIL otherwise| FINAL_BLOCKED
  REFACTOR_STATUS -->|ERROR after dispatch retry| FINAL_ERROR

  CONFORM --> CONFORM_RESULT{Conformance result}
  CONFORM_RESULT -->|pass| VALIDATE_CHANGED[Dispatch test-validator MODE=post-change with changed files and BASELINE]
  CONFORM_RESULT -->|repairable mismatch| BUDGET
  CONFORM_RESULT -->|user-decision mismatch or unclassifiable| ASK_CONFORM[Ask conformance question]
  ASK_CONFORM -->|answered| SYNTH
  ASK_CONFORM -->|no answer| FINAL_BLOCKED

  VALIDATE_NOOP --> VAL_STATUS
  VALIDATE_CHANGED --> VAL_STATUS
  VAL_STATUS{VALIDATION_STATUS with counts}
  VAL_STATUS -->|PASS counted, changed files| FINAL_CHANGED
  VAL_STATUS -->|PASS counted, no changes| FINAL_NO_CHANGE
  VAL_STATUS -->|BLOCKED| ASK_VAL[Ask smallest command, dependency, or permission question]
  ASK_VAL -->|answered| VALIDATE_CHANGED
  ASK_VAL -->|no answer| FINAL_BLOCKED
  VAL_STATUS -->|ERROR after dispatch retry| FINAL_ERROR
  VAL_STATUS -->|FAIL no changes, cause production bug exposed| FINAL_BUG
  VAL_STATUS -->|FAIL no changes otherwise| FINAL_NO_CHANGE
  VAL_STATUS -->|FAIL with changed files| LOAD_REPAIR[Load repair protocol]

  LOAD_REPAIR --> CAUSE{Baseline-diffed likely cause}
  CAUSE -->|test refactor regression| BUDGET{REPAIR_TOTAL under 3?}
  CAUSE -->|production bug exposed| ASK_DUAL_REPAIR[Ask production fix authority]
  CAUSE -->|pre-existing failure| KEEP{Answer channel exists?}
  CAUSE -->|empty-selection| BUDGET
  CAUSE -->|unknown and retry plausible| BUDGET
  CAUSE -->|unknown and retry not plausible| FINAL_FAILED
  ASK_DUAL_REPAIR -->|approved| BUDGET
  ASK_DUAL_REPAIR -->|declined| FINAL_BUG
  ASK_DUAL_REPAIR -->|no answer| FINAL_BLOCKED
  KEEP -->|yes| ASK_KEEP[Ask keep or revert changed files]
  ASK_KEEP -->|choice recorded| FINAL_FAILED
  ASK_KEEP -->|no answer| FINAL_FAILED
  KEEP -->|no, changes left in place and reported| FINAL_FAILED
  BUDGET -->|yes| INC[Increment REPAIR_TOTAL and build full repair packet]
  BUDGET -->|no, production bug identified| FINAL_BUG
  BUDGET -->|no, otherwise| FINAL_FAILED
  INC --> REPAIR_KIND{Repair kind}
  REPAIR_KIND -->|test edit| REFACTOR
  REPAIR_KIND -->|validation retry or command selection fix| VALIDATE_CHANGED

  FINAL_CHANGED[CHANGED_PASS]
  FINAL_NO_CHANGE[COMPLETE_NO_SAFE_CHANGE]
  FINAL_BUG[COMPLETE_PRODUCTION_BUG_EXPOSED]
  FINAL_FAILED[VALIDATION_FAILED with workspace state and revert record]
  FINAL_ERROR[COMPLETE_ERROR]
  FINAL_BLOCKED[COMPLETE_BLOCKED with schema-valid resume packet]
  FINAL_EMPTY[COMPLETE_EMPTY_TARGET]
```

## Terminal States

| Status | Meaning | Required handoff extras |
| ------ | ------- | ----------------------- |
| `CHANGED_PASS` | Approved or rails-checked edits applied, evidence-based conformance passed, counted validation passed against baseline | Coverage map with verification method per behavior; before/after collected counts |
| `COMPLETE_NO_SAFE_CHANGE` | No safe edit justified, plan declined, or pre-existing failures with no changes | No-op rationale or decline record; pre-existing risk notes |
| `COMPLETE_PRODUCTION_BUG_EXPOSED` | A production bug surfaced and the production fix was declined or out of scope | Behavior, failing evidence, why no unapproved production edit was made |
| `VALIDATION_FAILED` | Changed-file validation failed and repair was exhausted or not warranted | Repairs attempted count, baseline-diffed cause, raw-log path, workspace state, keep-or-revert record |
| `COMPLETE_ERROR` | A dispatch errored twice in a row or an unrecoverable optional-review error occurred | Error source and recovery context |
| `COMPLETE_BLOCKED` | An ask gate had no answer channel, an ask loop hit its bound, or headless rails failed | Schema-valid resume packet including all approvals |
| `COMPLETE_EMPTY_TARGET` | Resolved files contain zero collectable tests and the user chose to end | Empty-target evidence; pointer that creating a new harness is out of scope |

## Gate Inventory

Human gates, in order: stage-1 workspace acknowledgment; empty-target retarget-or-end; value/API/maintainability clarification; dual authority; plan approval with amendment re-gating; stage-2 workspace acknowledgment; refactor clarification; conformance user-decision; validation clarification; production-fix authority during repair; keep-or-revert after pre-existing failure with changes. Every gate has two exits, a schema-valid blocked resume packet, and a two-answered-retries loop bound.
