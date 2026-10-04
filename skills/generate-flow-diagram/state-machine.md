# State Machine — generate-flow-diagram

Finite-state execution model for this skill. Mermaid rendering lives in [`flow-diagram.md`](./flow-diagram.md).

## Run-scoped variables

| Variable | Initial | Rules |
| --- | --- | --- |
| `RUN_MODE` | unset | Set once in `Classify` via precedence table in `SKILL.md`; immutable for the rest of the run. |
| `BUILD_ACTION` | `build` | Set to `repair` on each `PackageRepair` → `BuildCandidate` transition; reset to `build` for a new candidate. Internal repair never changes `RUN_MODE`. |
| `repair_cycles` | 0 per candidate | Increment on each entry to `PackageRepair`. Cap is 3 failed review→repair loops per candidate. |
| `gap_reask_budget` | 1 | Consumed on one re-ask from `ValidateApprovedGaps` when IDs are unknown. |
| `approval_scope` | unset | Validated gap IDs or exact `none` after preflight/resume. |
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
| `ParserApproval` | wait | Once-per-run parser permission before first reviewer | Orchestrator → user |
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
| `BuildCandidate` | `ParserApproval` | `BUILD: PASS`; first reviewer dispatch or a changed previously previewed command; no retained `APPROVED` or `ABORT` decision for this exact command; `command -v mmdc` fails and `command -v npx` succeeds; parser scratch for the pending candidate was prepared successfully |
| `ParserApproval` | `ReviewCandidate` | non-decompose; retained context binds the reply to this run's exact command list; record `APPROVED` -> `NPX_APPROVED: yes`, or `ABORT` -> `no`, before resuming the pending review |
| `ParserApproval` | `StageCandidates` | decompose; retained context binds the reply to this run's exact command list; record `APPROVED` -> `NPX_APPROVED: yes`, or `ABORT` -> `no`, before resuming the pending chain |
| `ParserApproval` | `ParserApproval` | valid retained run/command context; `REVISE`/malformed/unusable answer and `parser_reask_count < 1`; increment; say command has no revisable parameters and re-preview once |
| `ParserApproval` | `NeedsInput` | no answer on resume, or missing/malformed/stale/mismatched retained run/command context; request re-invocation with original inputs, restart through `Intake` → `Classify`, and re-preview before execution |
| `ParserApproval` | `Blocked` | valid retained run/command context and `REVISE`/malformed/unusable at `parser_reask_count = 1` |
| `ParserApproval` | `Blocked` | approval-checkpoint preparation returns `BLOCKED`/`TOOLS_MISSING` (not parser scratch unavailability) |
| `ParserApproval` | `Error` | checkpoint preparation returns `ERROR`, or unexpected preparation/authorization failure |
| `BuildCandidate` | `ReviewCandidate` | `BUILD: PASS` and the `ParserApproval` guard does not apply; unavailable parser scratch -> candidate content with `NPX_APPROVED: no` for `inspected-only` review |
| `BuildCandidate` | `NeedsInput` | `BUILD: NEEDS_INPUT` |
| `BuildCandidate` | `Error` | `BUILD: ERROR` |
| `ReviewCandidate` | `FinalPassed` | `REVIEW: PASS` and `RUN_MODE` ≠ `decompose` |
| `ReviewCandidate` | `Blocked` | `REVIEW: BLOCKED` |
| `ReviewCandidate` | `Error` | `REVIEW: ERROR` |
| `ReviewCandidate` | `AwaitRepairApproval` | `REVIEW: FAIL` ∧ `approval_scope` is exact `none` ∧ any failed check has `baseline_effect` `changed` or `unknown` |
| `ReviewCandidate` | `PackageRepair` | `REVIEW: FAIL` ∧ `repair_cycles` < 3 ∧ not (`approval_scope` = `none` with a `changed`/`unknown` failed check) |
| `ReviewCandidate` | `RepairLimitReached` | `REVIEW: FAIL` ∧ `repair_cycles` ≥ 3 |
| `PackageRepair` | `BuildCandidate` | Failed checks packaged; `BUILD_ACTION=repair`; `RUN_MODE` unchanged; increment `repair_cycles` |
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
| `StageCandidates` | `ParserApproval` | all parser-input command paths fixed and the pending candidate has `BUILD: PASS`; first reviewer dispatch or a changed previously previewed command list; no retained `APPROVED` or `ABORT` decision for this exact list; `command -v mmdc` fails and `command -v npx` succeeds; parser scratch for the pending candidate was prepared successfully |
| `StageCandidates` | `WriteBatch` | Every staged candidate holds `REVIEW: PASS`, and cross-candidate duplication revalidated against `OTHER_DIAGRAM_DIGEST` after any repair |
| `StageCandidates` | `RepairLimitReached` | Any candidate exhausts repair budget (write nothing) |
| `StageCandidates` | `NeedsInput` | Any staged builder returns `BUILD: NEEDS_INPUT`; write no destination files |
| `StageCandidates` | `Blocked` | Any staged reviewer returns `REVIEW: BLOCKED`; write no destination files |
| `StageCandidates` | `Error` | Any staged builder returns `BUILD: ERROR`, any staged reviewer returns `REVIEW: ERROR`, or a staged result is missing/malformed/unknown; write no destination files |
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

Every listed state is reachable from `Intake` (including the resume routes `Intake` → `ValidateApprovedGaps` and `Intake` → `StageCandidates`). Every terminal has an exit to `[*]`. `AwaitRefinementApproval`, `AwaitRepairApproval` and `AwaitDecomposeApproval` stop at their confirmation terminals and resume through `Intake` with the existing resume block. `ParserApproval` ends the turn in that wait state; a same-run reply with retained command context follows its APPROVED/REVISE/ABORT rows. Missing approval or run/command context on resume follows `NeedsInput`, then re-invocation with original inputs through `Intake` → `Classify` and a new preview. `PackageRepair` always returns to `BuildCandidate`. There are no dead states.

## Resume Blocks

A confirmation stop is a terminal; the run's context is not assumed to survive it. Each `NeedsConfirmation`-family stop therefore embeds a compact resume block in its user-facing output (templates in `references/output-templates.md`): a baseline fingerprint (first line or title of the baseline, plus its node count), the inventory or plan IDs with one-line summaries, the approval scope, and the remaining re-ask budget. Resume requires the user's decision plus that block; `Intake` rejects a missing, stale, or mismatched block as `NeedsInput` rather than guessing. After parser context loss, return `NeedsInput` and request re-invocation with original inputs through `Intake` → `Classify`. Re-run refinement preflight or decompose planning and obtain required fresh confirmation before building/staging. Earlier compact blocks are background only, not authority to resume into `StageCandidates` or proof of approved scope. Rebuild parser scratch and re-preview; never carry parser consent forward.

## Parser approval

`ParserApproval` entry guards take precedence over normal build/stage routing only when no APPROVED/ABORT decision is retained for the exact command list. Normally ask once before the first reviewer, only when `command -v mmdc` fails, `command -v npx` succeeds, and parser scratch for the pending candidate was prepared successfully. If scratch is unavailable, skip the gate and dispatch the reviewer with candidate content and `NPX_APPROVED: no` for `inspected-only` review, including within `StageCandidates`. Preview one literal resolved `bash <helper> --allow-npx <candidate-path>` line per assigned parser-input path, plus package `@mermaid-js/mermaid-cli@12.0.0`, third-party fetch/execution/install scripts, npm cache writes, possible Puppeteer Chrome download, and `ABORT` continuing `inspected-only`; state passed local checks and third-party-code risk. The orchestrator fixes run-owned parser-input paths for the candidate set derived from the approved plan and prepares only the first pending candidate before asking; preserve per-candidate build→review→repair chains, not a build-all barrier. Initialize `parser_reask_count=0` once per run, retain it across re-previews, cap 1; REVISE/malformed/unusable under cap increments and re-previews once, explaining no parameters are revisable at this gate; unusable/revise at cap with valid retained context -> `Blocked`. No answer on resume or missing/invalid retained run/command context -> `NeedsInput` and re-invocation with original inputs through `Intake` → `Classify`; re-run gates, rebuild scratch and re-preview, never execute on unbound approval. Approval-checkpoint preparation BLOCKED/TOOLS_MISSING -> `Blocked`; ERROR/unexpected failure -> `Error`. End the turn while waiting, without timeout. Record APPROVED or ABORT for this run's displayed exact list before returning: the retained decision makes the entry guard false and resumes the pending review. Pass `NPX_APPROVED: yes` only for an approved listed command, `no` after ABORT or when the gate is unnecessary. Repairs at listed paths retain the decision; new/changed command/path/package needs a new full preview replacing the decision, never silent expansion. Earlier-run/intake/plan-auto/gap/repair consent never counts; reviewers cannot ask the user. Record the decision on the existing validation-method line.

## Notes

- Status prefixes are stage-owned: `PREFLIGHT`, `PLAN`, `BUILD`, `REVIEW`, `WRITE`. Do not emit `PREFLIGHT:` from review.
- `RUN_MODE` is immutable after `Classify`. Internal repair is expressed by `BUILD_ACTION=repair`; reviewer obligations (for example refinement checks) stay keyed to `RUN_MODE`.
- `APPROVED_REFINEMENT_GAPS` supplied at intake is data only until `ValidateApprovedGaps` or a `PREFLIGHT: PASS` validation against this run's inventory.
- `DECOMPOSE_PLAN_APPROVAL=auto` skips `AwaitDecomposeApproval` but must be recorded in the run report; illustrated default remains `ask`. On both the `auto` path and decompose resume, the orchestrator derives `OTHER_DIAGRAM_DIGEST` before entering `StageCandidates`.
- `DIAGRAM_SCOPE` is inapplicable when `RUN_MODE=decompose`: the orchestrator assigns `orchestrator` scope to the root candidate and `subagent` scope (with `SCOPE_SUBAGENT_NAME`) to each localized candidate from the approved plan.
- `StageCandidates` internally runs build→review→optional repair per localized diagram and slim root; the state machine treats that loop as one state with the all-pass / repair-limit guards above. When the runtime can dispatch subagents concurrently, per-candidate chains may run in parallel — each chain stays serial internally, the digest is frozen before staging, and `WriteBatch` still requires all-pass plus post-repair duplication revalidation. The inline serial path is the portable fallback with identical statuses and semantics; record parallel dispatch in the run report.
- Question budgets are local to their decision boundary (intake clarification, classification, empty-registry confirmation, gap re-ask); at most one concise clarification is asked in any single turn.
