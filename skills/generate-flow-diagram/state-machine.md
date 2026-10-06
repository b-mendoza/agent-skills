# State Machine — generate-flow-diagram

This file is the sole normative source for states, transitions, guards, counters, joins, and terminals. SKILL.md is a non-normative overview; this file wins on drift.

## Run-scoped variables

| Variable | Initial | Rules |
| --- | --- | --- |
| `RUN_MODE` | unset | Set once in `Classify` via precedence table in `SKILL.md`; immutable for the rest of the run. |
| `BUILD_ACTION` | `build` | Set to `repair` on each `PackageRepair` → `BuildCandidate` transition; reset to `build` for a new candidate. All mode-conditional builder/reviewer obligations follow `RUN_MODE`. |
| `repair_cycles` | 0 per candidate | Increment on each entry to `PackageRepair`. Cap is 3 failed review→repair loops per candidate. |
| `gap_reask_budget` | 1 | Consumed on one re-ask from `ValidateApprovedGaps` when IDs are unknown. |
| `approval_scope` | unset | Validated gap IDs or exact `none` after preflight/resume. Intake `APPROVED_REFINEMENT_GAPS` is data, not approval, until `ValidateApprovedGaps` or `PREFLIGHT: PASS` validates it against this run’s inventory. |
| `MUTATION_LIMITS` | unset | Derived once in `DeriveLimits` for `decompose` only. |
| `OTHER_DIAGRAM_DIGEST` | unset | Derived once by the orchestrator from the approved ownership plan, immediately before `StageCandidates`; immutable during staging. Projections are passed to each builder/reviewer dispatch. |

## States

| State | Kind | Phase | Actor |
| --- | --- | --- | --- |
| `Intake` | active | 1. Intake and normalize | Orchestrator |
| `Classify` | active | 1. Intake and normalize | Orchestrator |
| `RefinementPreflight` | active | 2. Refinement preflight | `refinement-analyst` |
| `AwaitRefinementApproval` | wait | 2. Refinement preflight | Orchestrator → user |
| `ValidateApprovedGaps` | active | 2. Refinement preflight (resume) | Orchestrator |
| `BuildCandidate` | active | 3. Build and review | `diagram-builder` |
| `ReviewCandidate` | active | 3. Build and review | `diagram-quality-reviewer` |
| `PackageRepair` | active | 3. Build and review (repair) | Orchestrator → builder |
| `AwaitRepairApproval` | wait | 3. Build and review | Orchestrator → user |
| `DecomposeInputGate` | active | 4. Decompose plan and approve | Orchestrator |
| `DeriveLimits` | active | 4. Decompose plan and approve | Orchestrator |
| `PlanDecompose` | active | 4. Decompose plan and approve | `decomposition-planner` |
| `AwaitDecomposeApproval` | wait | 4. Decompose plan and approve | Orchestrator → user |
| `StageCandidates` | active | 5. Decompose stage then write | builder + reviewer (per candidate) |
| `WriteBatch` | active | 5. Decompose stage then write | Orchestrator |
| `FinalPassed` | terminal | — | — |
| `DecompositionComplete` | terminal | — | — |
| `NoChangesNeeded` | terminal | — | — |
| `NeedsConfirmation` | terminal | — | — |
| `NeedsConfirmationRepair` | terminal | — | — |
| `NeedsInput` | terminal | — | — |
| `Blocked` | terminal | — | — |
| `Error` | terminal | — | — |
| `WriteError` | terminal | — | — |
| `RepairLimitReached` | terminal | — | — |

## Transitions

| From | To | Guard / event |
| --- | --- | --- |
| `[*]` | `Intake` | Skill invoked |
| `Intake` | `Classify` | `PROCESS_INPUTS` produced; missing fields that only affect wording recorded as assumptions |
| `Intake` | `NeedsInput` | Missing value changes authority, sensitive actions, outputs, evidence, confirmation, or terminals |
| `Intake` | `ValidateApprovedGaps` | Refinement resume: user replied with gap IDs or `none` plus the resume block from the confirmation stop; block fingerprint validates against the supplied baseline |
| `Intake` | `StageCandidates` | Decompose resume: user approved the plan and supplied the resume block from the confirmation stop; block validates, then the orchestrator derives `OTHER_DIAGRAM_DIGEST` before staging |
| `Intake` | `NeedsInput` | Resume reply supplied without a resume block, or the block is stale or mismatched |
| `Classify` | `BuildCandidate` | `RUN_MODE` is `new` or `repair` |
| `Classify` | `RefinementPreflight` | `RUN_MODE` is `refinement` |
| `Classify` | `DecomposeInputGate` | `RUN_MODE` is `decompose` |
| `Classify` | `NeedsInput` | No classification row matches |
| `RefinementPreflight` | `BuildCandidate` | `PREFLIGHT: PASS` (validated scope or no meaningful gaps → scope `none`) |
| `RefinementPreflight` | `AwaitRefinementApproval` | `PREFLIGHT: NEEDS_CONFIRMATION` |
| `RefinementPreflight` | `Blocked` | `PREFLIGHT: BLOCKED` |
| `RefinementPreflight` | `Error` | `PREFLIGHT: ERROR` |
| `AwaitRefinementApproval` | `NeedsConfirmation` | Gap inventory presented; run stops for user reply |
| `ValidateApprovedGaps` | `BuildCandidate` | Every supplied ID exists in retained inventory, or value is exact `none` |
| `ValidateApprovedGaps` | `AwaitRefinementApproval` | Unknown/ambiguous IDs and `gap_reask_budget` remaining (consume budget; re-ask once) |
| `ValidateApprovedGaps` | `NeedsConfirmation` | Unknown/ambiguous IDs and `gap_reask_budget` exhausted |
| `BuildCandidate` | `ReviewCandidate` | `BUILD: PASS`; unavailable parser, execution, or parser-input scratch uses `inspected-only` review |
| `BuildCandidate` | `NeedsInput` | `BUILD: NEEDS_INPUT` |
| `BuildCandidate` | `Error` | `BUILD: ERROR` |
| `ReviewCandidate` | `FinalPassed` | `REVIEW: PASS` and `RUN_MODE` ≠ `decompose` |
| `ReviewCandidate` | `Blocked` | `REVIEW: BLOCKED` |
| `ReviewCandidate` | `Error` | `REVIEW: ERROR` |
| `ReviewCandidate` | `AwaitRepairApproval` | `REVIEW: FAIL` ∧ `approval_scope` is exact `none` ∧ any failed check has `baseline_effect` `changed` or `unknown` |
| `ReviewCandidate` | `PackageRepair` | `REVIEW: FAIL` ∧ `repair_cycles` < 3 ∧ not (`approval_scope` = `none` with a `changed`/`unknown` failed check) |
| `ReviewCandidate` | `RepairLimitReached` | `REVIEW: FAIL` ∧ `repair_cycles` ≥ 3 |
| `PackageRepair` | `BuildCandidate` | Failed checks packaged; `BUILD_ACTION=repair`; increment `repair_cycles` |
| `AwaitRepairApproval` | `NeedsConfirmationRepair` | Repair-under-`none` question presented; run stops |
| `DecomposeInputGate` | `NeedsInput` | `PACKAGE_PATH` missing, or registry missing/empty and not confirmed empty |
| `DecomposeInputGate` | `NoChangesNeeded` | Empty registry confirmed: package has no subagents |
| `DecomposeInputGate` | `DeriveLimits` | Decompose inputs complete |
| `DeriveLimits` | `PlanDecompose` | One `MUTATION_LIMITS` contract derived for the run |
| `PlanDecompose` | `NeedsInput` | `PLAN: NEEDS_INPUT` |
| `PlanDecompose` | `Blocked` | `PLAN: BLOCKED` |
| `PlanDecompose` | `Error` | `PLAN: ERROR` |
| `PlanDecompose` | `NoChangesNeeded` | `PLAN: PASS` ∧ zero extract nodes ∧ every owner `keep`/`n/a` |
| `PlanDecompose` | `AwaitDecomposeApproval` | `PLAN: PASS` ∧ work remains ∧ approval path is `ask` |
| `PlanDecompose` | `StageCandidates` | `PLAN: PASS` ∧ work remains ∧ `DECOMPOSE_PLAN_APPROVAL=auto` (disclose in run report) |
| `AwaitDecomposeApproval` | `NeedsConfirmation` | Plan summary and resume block presented; run stops for approve/revise; resume re-enters via `Intake` |
| `StageCandidates` | `WriteBatch` | Every staged candidate holds `REVIEW: PASS`, and cross-candidate duplication revalidated against `OTHER_DIAGRAM_DIGEST` after any repair |
| `StageCandidates` | `RepairLimitReached` | Earliest failing candidate in approved-plan order exhausts repair budget; write no destination files |
| `StageCandidates` | `NeedsInput` | Earliest failing candidate in approved-plan order returns `BUILD: NEEDS_INPUT`; write no destination files |
| `StageCandidates` | `Blocked` | Earliest failing candidate in approved-plan order returns `REVIEW: BLOCKED`; write no destination files |
| `StageCandidates` | `Error` | Earliest failing candidate in approved-plan order returns `BUILD: ERROR` or `REVIEW: ERROR`, or has a missing/malformed/unknown staged result; write no destination files |
| `WriteBatch` | `DecompositionComplete` | `WRITE: PASS` after `MUTATION_LIMITS` enforcement |
| `WriteBatch` | `WriteError` | `WRITE: ERROR` |
| `FinalPassed` | `[*]` | Return artifact + run report |
| `DecompositionComplete` | `[*]` | Return decompose result + run report + mirror/lockfile disclosure |
| `NoChangesNeeded` | `[*]` | Touch no file |
| `NeedsConfirmation` | `[*]` | Terminal status `needs confirmation` |
| `NeedsConfirmationRepair` | `[*]` | Terminal status `needs confirmation (repair approval)` |
| `NeedsInput` | `[*]` | Terminal status `needs input` |
| `Blocked` | `[*]` | Terminal status `blocked` |
| `Error` | `[*]` | Terminal status `error` |
| `WriteError` | `[*]` | Terminal status `write error` |
| `RepairLimitReached` | `[*]` | Terminal status `repair limit reached` |

## Reachability

Every listed state is reachable from `Intake` (including the resume routes `Intake` → `ValidateApprovedGaps` and `Intake` → `StageCandidates`). Every terminal has an exit to `[*]`. `AwaitRefinementApproval`, `AwaitRepairApproval` and `AwaitDecomposeApproval` stop at their confirmation terminals and resume through `Intake` with the existing resume block. `PackageRepair` always returns to `BuildCandidate`. There are no dead states.

## Resume Blocks

A confirmation stop is a terminal; the run's context is not assumed to survive it. Each `NeedsConfirmation`-family stop therefore embeds a compact resume block in its user-facing output (templates in `references/output-templates.md`): a baseline fingerprint (first line or title of the baseline, plus its node count), the inventory or plan IDs with one-line summaries, the approval scope, and the remaining re-ask budget. Resume requires the user's decision plus that block; `Intake` rejects a missing, stale, or mismatched block as `NeedsInput` rather than guessing.

## Notes

- Status prefixes are stage-owned: `PREFLIGHT`, `PLAN`, `BUILD`, `REVIEW`, `WRITE`. Do not emit `PREFLIGHT:` from review.
- `StageCandidates` internally runs build→review→optional repair per localized diagram and slim root; the state machine treats that loop as one state with the all-pass / repair-limit guards above. When the runtime can dispatch subagents concurrently, per-candidate chains may run in parallel — each chain stays serial internally, the digest is frozen before staging, and `WriteBatch` still requires all-pass plus post-repair duplication revalidation. In parallel, finalize failure only after every earlier-ordered chain settles (finished or failed); cancel later-ordered chains or let them finish and ignore their results. The inline serial path is the portable fallback with identical statuses and semantics; it runs in approved-plan order and stops at the first failure; record parallel dispatch in the run report.
- Question budgets are local to their decision boundary (intake clarification, classification, empty-registry confirmation, gap re-ask); at most one concise clarification is asked in any single turn.
