# subagent-section-order

## Tier

`recommended`. Predictable order in every subagent file lets the
orchestrator and the subagent itself locate inputs, output format,
scope, and escalation without scanning the whole file.

## When it applies

When authoring or editing any subagent file under
`skills/*/subagents/`.

## The practice

Follow this section order in every subagent definition:

```
1. YAML frontmatter (name, description)
2. # Title + mental model paragraph
3. ## Inputs (table or list)
4. ## Instructions / How to [action] (step-by-step)
5. ## Output Format (structured template with example)
6. ## Scope (allow-list: "Your job is to...")
7. ## Escalation (failure categories with report format)
```

The ordering reflects a natural reading flow:

- **Identity first** (frontmatter + title) — what the subagent is.
- **Contracts next** (inputs, outputs) — what it consumes and
  produces.
- **Behavior then** (instructions) — how it works.
- **Boundaries last** (scope, escalation) — where it stops and how
  it routes failures.

## Rationale

A subagent file has two consumers: the orchestrator that dispatches
it (reads frontmatter + inputs + output format) and the subagent
itself when invoked (reads everything). A predictable order makes the
orchestrator's read cheap: it can find the input contract and the
output shape without scanning the body. When the order is
inconsistent across subagents, every dispatch site has to grep, and
the registry table's "Path" column stops being a pointer to a
predictable artifact.

The scope and escalation sections live at the end because they are
the bouncers, not the doormen: they answer "where do I stop" after
the subagent already knows what it is doing.

## Concrete examples

Good: section order is consistent across every subagent in the
package, so the orchestrator can dispatch without per-subagent
adaptation.

````markdown
---
name: "flow-coherence-auditor"
description: "Audits source-of-truth flow coherence..."
---

# Flow Coherence Auditor

You are the workflow-source-of-truth auditor. Your one job is to
determine whether the target flow-diagram.md, SKILL.md, registry,
phases, gates, statuses, and subagent paths agree.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |

## Instructions

1. Treat target `flow-diagram.md` as workflow source of truth.

## Output Format

```yaml
status: "FLOW_AUDIT: PASS" # required, one of: PASS, GAPS_FOUND, BLOCKED, ERROR
```

## Scope

Audit flow coherence only. Do not audit personality.

## Escalation

| Status | When |
````

Bad: every subagent uses a different section order; orchestrator
cannot dispatch consistently.

```markdown
---
name: "flow-coherence-auditor"
---

# Flow Coherence Auditor

## Escalation

| Status | When |

## Inputs

| Input | Required | Example |

## Scope

(Before Output Format.)

## Output Format

(After scope.)

## Instructions

(At the bottom.)
```

## References

- Anthropic Claude prompting best practices, accessed 2026-05-27:
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>.
  Supports clear structural ordering as a prompt-design tool.
- ISO/IEC/IEEE 26515:2018, "Developing user documentation in an
  agile environment," accessed 2026-06-03:
  <https://www.iso.org/standard/70880.html>. Supports predictable
  documentation ordering.
