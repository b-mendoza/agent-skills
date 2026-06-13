# Refinement Checks

Use these checks to evaluate implementation readiness. Summary - normative
state semantics and gate rules live in `reviewer-policy.md`.

For every check, record one outcome: `pass`, `gap`, `risk`, `contradiction`,
`invalid claim`, `split signal`, `spike signal`, or `not applicable`. Do not
fill gaps with plausible details.

## Core Checks

| Check | What To Look For | Common Non-Ready Signal |
| ----- | ---------------- | ----------------------- |
| Goal | The work item states the change or problem in implementable terms. | Vague intent such as "improve flow" without target behavior. |
| Outcome | Acceptance criteria or expected observable behavior are testable. | No done condition, only implementation hints. |
| Persona | Affected user, operator, system, or stakeholder is named or inferable from evidence. | No actor, customer, tenant, role, or system owner. |
| Journey | Before state, trigger, main path, edge cases, and end state are coherent. | Missing trigger, ambiguous happy path, or no failure behavior. |
| Scope cohesion | The item is one coherent unit of value. | Multiple unrelated outcomes or surfaces. |
| Risk | Security, data, privacy, migration, rollout, operational, or customer-impact risks are named or clearly absent. | Risky area touched with no mitigation or question. |
| Dependencies | Blocking teams, APIs, designs, migrations, flags, or upstream work are known. | External prerequisite implied but not identified. |
| Technical claims | Concrete library, SDK, API, config, version, CLI, or platform claims are verified or marked uncertain. | Claim appears stale, impossible, unsupported, or uncited. |
| Subtasks | Child work is coherent, ordered, and sufficient when the item is an epic or parent. | Children missing, overlapping, or not independently implementable. |
| Rationale | The item explains why the work matters or links to evidence. | Priority exists without reason or context. |
| Priority | Priority, severity, deadline, or ordering signal is present when it affects delivery. | Urgency implied but not supported. |

## Item-Type Focus

### Epic Or Parent Item

Check whether the parent goal is coherent, child items cover the needed work,
child items are not duplicates, dependencies between children are visible, and
acceptance criteria define parent completion rather than repeating each child.
Split signals are strong when children represent unrelated outcomes or when one
child is much larger than the rest.

### Leaf Story, Task, Or Bug

Check whether a single implementer can start without inventing product behavior,
technical approach, or validation criteria. For bugs, require observed behavior,
expected behavior, reproduction or detection signal, affected scope, and enough
environment detail to investigate.

### Sub-Item

Check whether the sub-item has a clear relationship to the parent, its own done
condition, and enough context to implement without reading the entire parent as
the only specification.

### Generic Unsupported Tracker

Run only the core checks that can be evaluated from supplied context. Mark
platform-specific checks `not applicable`, disable posting through the policy
rules, and include a caveat in run notes.

## Status Selection Guidance

Select the most specific readiness status supported by evidence:

| Signal | Likely Status |
| ------ | ------------- |
| Core checks pass and no material gaps remain | `Ready` |
| One or more details need clarification but the item is one coherent unit | `Needs refinement` |
| Scope cohesion fails or independent outcomes are bundled | `Needs split` |
| Feasibility, external behavior, technical approach, migration, security, or data impact needs research before planning | `Needs spike` |
| Implementation depends on missing access, owner decision, prerequisite work, or unavailable evidence | `Blocked` |
| The item is duplicate, obsolete, superseded, invalid, or no longer suitable work | `Not actionable` |

When multiple non-ready signals exist, pick the status that best describes the
next action needed. Example: choose `Needs spike` over `Needs refinement` when a
clarification cannot be answered until research is done.

## Evidence Requirements

Every blocking finding must identify one of:

- A source pointer from the work item, comments, linked docs, child items, code,
  or official docs.
- A missing-evidence label such as `missing acceptance criteria`,
  `missing dependency owner`, or `unverified API behavior`.
- A contradiction between live content and pasted context, with live content
  treated as authoritative when reachable.

Every technical claim that affects readiness must be verified against codebase
evidence or official documentation, or be downgraded into a question/risk.
