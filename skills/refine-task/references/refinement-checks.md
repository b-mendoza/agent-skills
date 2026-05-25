# Refinement Checks

> Read this file only when running readiness analysis. Record outcomes and
> evidence pointers, not full tracker payloads.

## Check Output Values

For each applicable check, record one value: `pass`, `gap`, `risk`,
`contradiction`, `invalid claim`, `split signal`, `spike signal`, or `not
applicable`.

## Core Checks

| Check | Review Question | Common Evidence |
| ----- | --------------- | --------------- |
| Goal | What objective is this trying to achieve, and is the problem statement explicit? | Title, problem statement, epic narrative, owner comments |
| Outcome | Are expected outcomes and acceptance criteria observable, testable, and complete? | Acceptance criteria, examples, test notes, definition of done |
| Persona | Who is affected, and what need, context, pain point, motivation, and constraint are described? | User story, customer segment, support evidence, analytics |
| Journey | Are the before state, trigger, task flow, happy path, edge path, and end state clear? | Workflow notes, designs, journey map, reproduction steps |
| Scope cohesion | Does the item mix unrelated goals, users, journeys, systems, delivery phases, or risk profiles? | Issue body, linked items, subtasks, component labels |
| Risk | What product, technical, security, data, migration, UX, rollout, support, and operational risks matter? | Architecture notes, migration plans, incidents, threat notes |
| Dependency | Are upstream decisions, APIs, teams, designs, data, flags, environments, approvals, and release timing known? | Linked issues, docs, owners, blockers, release plan |
| Technical claims | Are named libraries, frameworks, APIs, hooks, CLIs, config keys, and versions verified? | Codebase evidence, official docs, changelogs, API references |
| Subtasks | Are child tasks scoped, non-overlapping, independently verifiable, dependency-aware, and tied to parent outcomes? | Subtasks, child issues, task plan, owners, DoD |
| Rationale | Why this approach, and what alternatives or trade-offs justify it? | Decision records, comments, designs, constraints |
| Priority | Which decisions or subtasks unlock others, and what should happen first, later, or not at all? | Dependencies, risk sequence, delivery plan, release dates |

## Item Type Focus

Apply the core checks differently based on the item under review:

| Item type | Additional review focus |
| --------- | ----------------------- |
| Jira epic or GitHub parent issue | Parent outcome, coherent child grouping, child readiness, dependency order, milestone or release slice, progress signal, and whether child work can be verified independently. |
| Jira story/task/bug or GitHub leaf issue | Single user or system outcome, clear acceptance criteria, implementation boundary, direct dependencies, and whether subtasks are necessary or only administrative. |
| Jira subtask or GitHub sub-issue | Parent alignment, independently verifiable scope, blocker relationship to siblings, and whether the sub-item duplicates parent acceptance criteria instead of owning a specific slice. |
| Duplicate, obsolete, or superseded item | Evidence for non-actionability, owner confirmation needed, and a neutral lifecycle question instead of an ungated close/merge recommendation. |

For Jira or GitHub hierarchy claims, distinguish the current tracker state from a
recommended structure. The reviewer may recommend or question a parent-child
shape, but the comment should not imply that links, child work, or dependency
relationships have been changed.

## Technical Claim Verification

Use trusted docs or codebase evidence for claims involving current library,
framework, SDK, API, hook, CLI, config, or version behavior. If the host runtime
has a documentation tool, prefer official docs through that tool. Otherwise load
`external-sources.md` and fetch the official documentation or changelog named by
the issue.

Record invalid claims with four parts:

```text
Claim: <claim in the item>
Evidence: <trusted source or codebase reference>
Impact: <why this affects readiness>
Requested correction: <what owner should clarify or change>
```

## Split Signals

Consider a split when the item combines multiple goals, personas, workflows,
systems, releases, risk profiles, owners, or independent acceptance criteria.
Gate split recommendations through `reviewer-policy.md` before presenting them
as recommendations.

For parent issues and epics, a split signal may mean rebalancing child work
rather than splitting the parent itself. Name which child outcome, dependency,
or acceptance criterion creates the split pressure.

## Spike Signals

Consider a spike when implementation depends on unknown feasibility, unclear API
behavior, unresolved technical approach, data uncertainty, migration risk, or a
decision that cannot be answered by ordinary refinement. A spike recommendation
needs a research question, validation method, decision deadline, and exit
criteria.

## Evidence Discipline

Classify every finding as source-backed fact, reviewer assumption, missing
evidence, contradiction, or recommendation. Use missing evidence as evidence of a
gap; do not fill gaps with plausible details.
