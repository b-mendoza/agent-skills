---
title: "Execution Pipeline Harmonization Spec: Clarifying Assumptions"
status: "validated-canonical-spec"
skill_group_slug: "clarifying-assumptions"
slug_derivation: "Derived from the shared subject matter of the compared Jira-side and GitHub-side workflows: both parent workflows dispatch the same `clarifying-assumptions` skill in plan-wide and task-level clarification phases, and the compared subagents belong to that same clarification contract surface."
canonical_spec_path: "docs/execution-pipeline-harmonization-clarifying-assumptions.spec.md"
target_skill: "skills/clarifying-assumptions/SKILL.md"
target_subagents:
  - "skills/clarifying-assumptions/subagents/critique-analyzer.md"
  - "skills/clarifying-assumptions/subagents/question-manifest-builder.md"
  - "skills/clarifying-assumptions/subagents/decision-recorder.md"
comparison_inputs:
  - "skills/orchestrating-jira-workflow/SKILL.md"
  - "skills/orchestrating-github-workflow/SKILL.md"
  - "skills/planning-jira-tasks/SKILL.md"
  - "skills/planning-github-issue-tasks/SKILL.md"
phase_inputs:
  - "docs/orchestrator-alignment-report-clarifying-assumptions.md"
  - "docs/orchestrator-alignment-ledger-clarifying-assumptions.md"
  - "docs/orchestrator-alignment-changes-clarifying-assumptions.md"
phase_decision_counts:
  FIX: 0
  PRESERVE: 0
  DEFER: 0
traceability_chain: "report -> ledger -> change summary -> spec"
---

# Canonical Harmonization Spec

## Purpose

This specification captures the current harmonized execution-pipeline contract
for the shared clarification workflow used by the Jira-side and GitHub-side
orchestrators.

It is a documentation artifact, not a runtime dependency. The skill continues to
function from its own `SKILL.md`, subagents, and references. This spec exists so
future harmonization and audit passes have one canonical, self-contained record
of the contract currently on disk.

This spec is traceable to the authoritative Phase 0-2 artifacts:

- `docs/orchestrator-alignment-report-clarifying-assumptions.md`
- `docs/orchestrator-alignment-ledger-clarifying-assumptions.md`
- `docs/orchestrator-alignment-changes-clarifying-assumptions.md`

## Run Notes

- This Phase 3 run resolved a prompt-path conflict in favor of
  `docs/execution-pipeline-harmonization-clarifying-assumptions.spec.md`.
  The task prompt also mentioned
  `docs/execution-pipeline-harmonization-child-issue-creation.spec.md`, but the
  scoped canonical reference, skill-group slug, and inspected orchestrator
  boundary all point to `clarifying-assumptions`, so this canonical spec is the
  authoritative Phase 3 target.

## Current Pass Outcome

- Phase 0 report findings: `0`
- Phase 1 triage counts: `FIX=0`, `PRESERVE=0`, `DEFER=0`
- Phase 1 spec staleness count: `SPEC_STALENESS=0`
- Phase 2 applied fixes: none
- Phase 3 canonicalization posture: document the current harmonized state on disk

Because the ledger is a zero-entry ledger, this pass made no FIX decisions,
applied no hidden runtime edits, and records the current shared contract exactly
as implemented by the existing skill and subagent files.

## Shared Contract Shape Definitions

### Canonical identity shape

| Field | Shape | Meaning |
| --- | --- | --- |
| `TICKET_KEY` | string | Shared clarification identity used in runtime inputs and artifact paths |
| Jira mapping | Jira ticket key such as `JNS-6065` | Parent workflow passes the Jira-native key directly |
| GitHub mapping | Issue slug such as `acme-app-42` | Parent workflow normalizes `ISSUE_SLUG` into `TICKET_KEY` before dispatch |
| `MODE` | enum: `upfront` or `critique` | Selects plan-wide or task-level clarification pipeline |
| `TASK_NUMBER` | integer-like string | Required only in `MODE=critique` |
| `ITERATION` | integer-like string | Optional clarification pass counter; omitted means the skill treats it as the current run |

`TICKET_KEY` is the canonical cross-platform clarification boundary. Parent
workflows may keep platform-native identifiers internally, but the shared skill
contract is normalized at dispatch time.

### Main plan input shape

The clarification skill consumes a main plan file at `docs/<TICKET_KEY>-tasks.md`
with this required section shape:

| Contract field | Accepted structure |
| --- | --- |
| Summary section | `## Ticket Summary` or `## Issue Summary` |
| Problem framing | `## Problem Framing` |
| Assumptions | `## Assumptions and Constraints` |
| Cross-cutting questions | `## Cross-Cutting Open Questions` |
| Task inventory | `## Tasks` plus task-specific headings |
| Validation surface | `## Validation Report` |
| Dependency surface | `## Dependency Graph` |

The summary heading is the only platform-native heading alias explicitly
accepted by the current shared clarification contract.

### Mode-specific upstream artifact shape

| Mode | Required artifact set |
| --- | --- |
| `upfront` | `docs/<KEY>-stage-1-detailed.md`, `docs/<KEY>-stage-2-prioritized.md` |
| `critique` | `docs/<KEY>-task-<N>-brief.md`, `docs/<KEY>-task-<N>-execution-plan.md`, `docs/<KEY>-task-<N>-test-spec.md`, `docs/<KEY>-task-<N>-refactoring-plan.md` |

The shared skill requires readable markdown at those paths and does not depend
on platform-specific fetch or planning internals once those artifacts exist.

### Shared subagent dispatch input shapes

| Dispatch target | Required fields | Conditional fields |
| --- | --- | --- |
| `critique-analyzer` | `MODE`, `TICKET_KEY`, `MAIN_PLAN_FILE`, `ARTIFACTS`, `CRITIQUE_REPORT_FILE`, `PRIOR_DECISIONS_FILE`, `PRIOR_DECISIONS_KIND` | `TASK_NUMBER` in `MODE=critique` |
| `question-manifest-builder` | `MODE`, `TICKET_KEY`, `PLAN_FILE`, `CRITIQUE_REPORT_FILE` | `TASK_NUMBER`, `CURRENT_TASK_ARTIFACTS` in `MODE=critique` |
| `decision-recorder` | `TICKET_KEY`, `MODE`, `DECISIONS` | `ITERATION`, `DEFERRED_QUESTIONS`, `IMPLEMENTATION_UPDATES`, and in `MODE=critique` also `TASK_NUMBER`, `TASK_TITLE`, `RESOLVED_IRRELEVANT` |

Current on-disk contract detail: `PRIOR_DECISIONS_FILE` and
`PRIOR_DECISIONS_KIND` are always included in `critique-analyzer` dispatches,
including `ITERATION=1`.

### Critique artifact shape

The critique artifact is written before manifest assembly and uses this stable
header shape:

```text
CRITIQUE: <PASS|WARN>
Ticket: <KEY> | Mode: <upfront|critique> | Task: <N|->
Artifact: <path>
```

The artifact body then begins at `## Critique Report` and must preserve the
mode-specific required sections:

- `MODE=upfront`: `### Problem Framing Critique`, `### Technology Critique Items`
- `MODE=critique`: `### Technology Critique Items`, `### User Impact Critique Items`

Stable critique item IDs are part of the contract shape:

- `PF<n>` for problem-framing items
- `TC<n>` for technology critique items
- `UI<n>` for user-impact items

### Manifest shape

Successful manifest output starts with this stable header shape:

```text
MANIFEST: <PASS|WARN>
Ticket: <KEY> | Mode: <upfront|critique> | Task: <N|->
Task title: <title or ->
Questions now: <N> | Deferred: <N> | Irrelevant: <N>
```

The manifest body then contains three stable sections:

- `## Questions For Now`
- `## Deferred Questions`
- `## Resolved Irrelevant`

Per-question briefs use these stable fields:

- `Item ID`
- `Category`
- `Severity`
- `Model`
- `Skippable`
- `Affects`
- `Original decision or question`
- `Critique summary`
- `Fallback/default`

Manifest-derived non-critique IDs may use deterministic patterns such as
`A<n>`, `CQ<n>`, `V<n>`, `TQ-<task>-<n>`, and `DQ-<task>-<n>`.

### Decision-recording shape

`decision-recorder` accepts a structured `DECISIONS` list whose entries include:

- `id`
- `category`
- `question`
- `outcome`
- `answer`
- `rationale`
- `fallback`
- `affected_tasks`

Canonical `category` values are:

- `problem-framing`
- `critique`
- `user-impact`
- `cross-cutting`
- `assumption`
- `task-question`
- `validation`

Canonical `outcome` values are:

- `confirmed`
- `revised`
- `skipped`
- `resolved`
- `override`
- `blocked`

The manifest `Item ID` flows unchanged into `DECISIONS.id`, plan annotations,
and any per-task decisions artifact.

### Shared write/result shape

| Surface | Stable contract |
| --- | --- |
| Upfront critique artifact | `docs/<KEY>-upfront-critique.md` |
| Task critique artifact | `docs/<KEY>-task-<N>-critique.md` |
| Main plan updates | `docs/<KEY>-tasks.md` updated in place |
| Decisions log | `## Decisions Log` table in the main plan |
| Per-task decisions file | `docs/<KEY>-task-<N>-decisions.md` in `MODE=critique` |
| Deferred marker suffix | ` [DEFERRED — will ask before Task <N> execution]` |
| Irrelevant marker suffix | ` [RESOLVED AS IRRELEVANT — <short reason>]` |
| Decision marker suffix | ` [DECISION <Item ID> — <outcome>: <short answer>]` |

### Final summary shape

Every successful clarification run ends with at least these fields:

- `Critique artifact: <path>`
- `Files updated: <path list or ->`
- `RE_PLAN_NEEDED: <true|false>`
- `BLOCKERS_PRESENT: <true|false>`

If the run stops early because a subagent returned `BLOCKED`, `FAIL`, or
`ERROR`, the same minimum summary shape still applies, with `Files updated: -`
and the blocking verdict and reason included.

## Orchestrator-Level Contract Expectations

These expectations define the shared parent-workflow boundary at the
clarification handoff without turning this spec into a runtime dependency.

### Clarification entry mapping

| Parent workflow phase | Downstream mode | Required parent-owned inputs |
| --- | --- | --- |
| Jira Phase 3 | `upfront` | `TICKET_KEY=<jira ticket key>`, `MODE=upfront`, optional `ITERATION` |
| GitHub Phase 3 | `upfront` | `TICKET_KEY=<ISSUE_SLUG>`, `MODE=upfront`, optional `ITERATION` |
| Jira Phase 6 | `critique` | `TICKET_KEY=<jira ticket key>`, `MODE=critique`, `TASK_NUMBER`, optional `ITERATION` |
| GitHub Phase 6 | `critique` | `TICKET_KEY=<ISSUE_SLUG>`, `MODE=critique`, `TASK_NUMBER`, optional `ITERATION` |

Parent orchestrators own only the normalized clarification entry contract above.
They do not precompute downstream-only fields such as `MAIN_PLAN_FILE`,
`ARTIFACTS`, `CRITIQUE_REPORT_FILE`, `PRIOR_DECISIONS_FILE`, or
`PRIOR_DECISIONS_KIND`; those remain clarification-skill-owned derivations.

### Parent gate expectations

- Validate the expected upstream planning artifacts before entering clarification.
- Treat `RE_PLAN_NEEDED=true` as a mandatory reopen of the immediately preceding
  planning phase.
- Treat `BLOCKERS_PRESENT=true` as a hard stop before child-item creation,
  downstream platform writes, or task execution.
- Require the normal parent user-approval gate before proceeding from successful
  clarification into downstream mutation or execution phases.
- Keep platform-specific wording, write targets, and later side effects outside
  the shared clarification contract.

## Pipeline Stage Names And Ordering

The harmonized clarification pipeline has exactly five stages in this fixed
order for both Jira-side and GitHub-side parent workflows:

| Order | Stage name | Canonical behavior |
| --- | --- | --- |
| 1 | `Load guidance` | Read `design-thinking-mindset` and the active mode playbook |
| 2 | `Analyze artifacts` | Dispatch `critique-analyzer`, verify artifacts and codebase, write critique artifact |
| 3 | `Build manifest` | Dispatch `question-manifest-builder` from critique artifact plus plan context |
| 4 | `Clarify inline` | Walk the manifest with the developer one item at a time and collect decisions |
| 5 | `Record decisions` | Dispatch `decision-recorder`, update artifacts, validate writes, and produce the final summary |

Presentation rules that are part of the stage contract:

- Manifest preview stays inside Stage 4, not as a separate stage.
- Final recap stays inside Stage 5 after the recorder returns.
- No platform-specific variant may rename, reorder, or merge these stages inside
  the shared clarification contract.

## Mode-Specific Pipeline Semantics

### `MODE=upfront`

- Entry point: parent workflow Phase 3 clarification boundary
- Scope: whole-plan clarification before child-item creation or execution
- Prior decisions source: main plan `## Decisions Log` shape (`PRIOR_DECISIONS_KIND=main-log`)
- Main manifest focus: problem framing, technology critique, cross-cutting open
  questions, architectural assumptions, validation failures, and Task 1
  questions
- Future-task behavior: future-task questions are deferred rather than resolved
  inline

### `MODE=critique`

- Entry point: parent workflow Phase 6 clarification boundary
- Scope: current-task clarification immediately before real task execution
- Prior decisions source: per-task decisions file shape (`PRIOR_DECISIONS_KIND=per-task`)
- Main manifest focus: current-task technology critique, user-impact critique,
  still-relevant deferred questions, and unresolved current-task assumptions
- No-longer-valid deferred items are recorded as irrelevant rather than asked
  again

## Subagent Dispatch Conventions

### General conventions

- Read the target subagent definition immediately before dispatch.
- Pass only the explicit named inputs for that subagent.
- Preserve artifact-path handoffs instead of carrying full artifact bodies inline.
- Keep Stage 2, Stage 3, and Stage 5 sequential because each depends on the
  prior stage's output.
- Re-dispatch subagents against current artifact paths on retries or later
  iterations; do not treat old subagent output as authoritative after artifacts
  change.

### Verdict routing conventions

| Source | Expected verdict family | Routing contract |
| --- | --- | --- |
| `critique-analyzer` | `CRITIQUE: PASS | WARN | FAIL` | `FAIL` stops; `WARN` may continue only if critique remains usable |
| `question-manifest-builder` | `MANIFEST: PASS | WARN | BLOCKED | FAIL` | `BLOCKED` and `FAIL` stop; `WARN` continues with surfaced omissions |
| `decision-recorder` | `RECORDING: PASS | WARN | BLOCKED | ERROR` | `BLOCKED` and `ERROR` stop; `WARN` continues with surfaced write warnings |

### Inline clarification conventions

- Ask one question per message.
- Ask only manifest-backed questions.
- Carry each `Item ID` unchanged into the decision list.
- Use Model A only for Tier 3 problem-framing hard gates.
- Use Model B for all other items.
- Respect manifest `Skippable` values instead of inventing new skip behavior.

## Platform-Specific Divergence Boundaries

Only these divergence boundaries are part of the current harmonized contract.

### 1. Parent-workflow identity shape

- Jira parents use Jira ticket keys.
- GitHub parents use `ISSUE_SLUG` locally.
- The shared clarification skill receives normalized `TICKET_KEY` in both cases.

Justification: normalization at the shared-skill boundary preserves one artifact
family and one clarification dispatch contract while letting parent workflows
keep platform-native identifiers internally.

### 2. Main-plan summary heading alias

- Jira planning outputs `## Ticket Summary`.
- GitHub planning outputs `## Issue Summary`.
- The clarification contract accepts either heading as the same summary slot.

Justification: this is the only verified platform-native heading divergence in
the compared planning outputs that the shared clarification skill explicitly
normalizes.

### 3. Upstream planning artifact provenance

- Jira clarification runs consume Jira-generated snapshot and planning artifacts.
- GitHub clarification runs consume GitHub-generated snapshot and planning artifacts.
- The shared clarification pipeline treats them only as readable markdown at the
  canonical path families already required by the skill.

Justification: provenance differences belong to fetch/planning stages, not to
the clarification pipeline once the artifact contract has been satisfied.

### 4. Parent gate wording and downstream mutation targets

- Jira parents use Jira-specific user-facing language and later Jira writes.
- GitHub parents use GitHub-specific user-facing language and later GitHub writes.
- Both parents still gate clarification results with the same branch logic:
  respect `RE_PLAN_NEEDED`, stop on `BLOCKERS_PRESENT`, and require the normal
  user approval before moving into downstream mutation or execution phases.

Justification: platform-specific wording and later side effects are downstream
workflow concerns, while clarification-owned gate semantics remain shared.

### 5. Parent validator and planning-skill parameter names

- Jira planning and validator contracts continue to use `TICKET_KEY`.
- GitHub planning and validator contracts continue to use `ISSUE_SLUG`.
- The clarification skill boundary remains normalized to `TICKET_KEY`.

Justification: those names are local to parent workflow and planning contracts;
the compared clarification boundary is shared and should stay stable.

## Decisions Made During This Pass

### Ledger-backed decision record

- `FIX`: none
- `PRESERVE`: none
- `DEFER`: none
- `SPEC_STALENESS`: none

The Phase 1 ledger is a zero-entry ledger. That means this pass made no
ledger-backed remediation decisions, no ledger-backed preserve exceptions, and
no ledger-backed deferments or spec-staleness follow-ups.

### Explicit no-FIX statement

No FIX decisions were made during this pass.

Rationale: `docs/orchestrator-alignment-ledger-clarifying-assumptions.md`
records `FIX: 0`, and
`docs/orchestrator-alignment-changes-clarifying-assumptions.md` states that no
orchestrator files were modified in Phase 2.

### Explicit no-PRESERVE statement

No ledger-backed PRESERVE decisions were made during this pass.

Rationale: the Phase 0 report found the two orchestrators already aligned at the
shared clarification boundary, so the only preserved differences are the
platform-divergence boundaries documented in this spec rather than per-finding
exceptions that needed triage.

### Canonicalization decision for this spec

- Decision: keep `clarifying-assumptions` as the canonical harmonization slug and
  update `docs/execution-pipeline-harmonization-clarifying-assumptions.spec.md`
  in place.
- Rationale: the compared Jira-side and GitHub-side workflows both dispatch the
  same shared `clarifying-assumptions` skill and the Phase 0 report found no
  shape-level drift requiring a narrower or broader subject grouping.

### Phase 2 application record for this run

- Applied FIX decisions from Phase 2: none
- Phase 2 file modifications relevant to this spec: none
- Phase 3 action taken here: reflect the verified harmonized state and the zero-
  entry ledger outcome in the canonical spec

Rationale: the Phase 1 ledger authorized no fixes, so Phase 3 preserves the
existing runtime contract and updates traceability only.

## Deferred Items

The Phase 1 triage ledger contains no `DEFER` entries.

| Entry | Status | Source rationale |
| --- | --- | --- |
| None | No deferred work recorded | The ledger reports `DEFER: 0` and contains zero triage entries |

## Spec Staleness / Follow-up

The Phase 1 triage ledger contains no `SPEC_STALENESS` entries.

| Entry | Status | Source rationale |
| --- | --- | --- |
| None | No spec follow-up recorded | The ledger reports `SPEC_STALENESS: 0` and contains zero triage entries |

## Known Non-Goals

- Defining Jira-specific fetch, child-item creation, or execution behavior
- Defining GitHub-specific fetch, `gh`, child-issue creation, or execution behavior
- Redesigning the upstream Phase 2 planning pipelines
- Defining the internals of Phase 1 fetch contracts beyond the planning and
  clarification artifacts already consumed here
- Requiring the orchestrators to mirror each other's local parameter names,
  validator inputs, or user-facing wording outside the normalized clarification
  boundary
- Reclassifying already-accepted platform divergence as drift when the shared
  clarification dispatch contract and gate semantics still match
- Making the spec file a runtime dependency for `skills/clarifying-assumptions`
- Adding new tools, dependencies, or functional behavior to the skill or its
  subagents
- Harmonizing parent workflows into identical wording, validator parameters, or
  downstream write models
- Defining implementation-code quality or execution policies for Phase 7 work

## Canonical Outcome

The current canonical model is a single shared clarification pipeline with:

- one normalized clarification identity field: `TICKET_KEY`
- one five-stage execution order
- one shared subagent chain: `critique-analyzer` -> `question-manifest-builder`
  -> `decision-recorder`
- one stable per-item identity flow from critique to manifest to recorder
- tightly bounded platform divergence only at verified parent-workflow edges

This spec is the canonical Phase 3 reference for future harmonization and audit
passes for the shared clarification workflow group.
