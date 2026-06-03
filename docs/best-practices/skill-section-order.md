# skill-section-order

## Tier

`recommended`. Predictable section ordering speeds both human and
agent reading of a `SKILL.md`; deviating is acceptable when a skill's
shape genuinely calls for it.

## When it applies

When authoring or editing a `SKILL.md` for any skill that has
inputs, a pipeline or workflow, subagents, or multiple execution
phases.

## The practice

Follow this section order in every `SKILL.md`:

```
1. YAML frontmatter (name, description)
2. # Title + purpose paragraph
3. ## Inputs (table: name, required, example)
4. ## Pipeline / Workflow overview (if multi-phase)
5. ## Subagent Registry (table: name, path, purpose)
6. ## How This Skill Works (behavioral description, identity)
7. ## Execution steps or Phase guide
8. ## Example (dispatch round-trip)
```

The ordering reflects a natural reading flow, not an absolute safety
rule:

- **Identity first** (frontmatter + title) — what is this and when
  does it trigger?
- **Contracts next** (inputs, outputs, registry) — what does it
  consume and produce?
- **Behavior then** (instructions, dispatch tables) — how does it
  work?
- **Boundaries nearby and complete** (scope, escalation) — where
  does it stop?

Detailed scope and escalation sections often work best after the
agent understands its purpose and procedure. For high-risk skills,
also include a short boundary summary near the top, close to the
identity or inputs, so the most important mutation, permission,
safety, or runtime limits are visible before execution details
begin.

## Rationale

A predictable section order lets both humans and agents skim a
`SKILL.md` for the section they need without re-reading every line.
A consumer that needs the subagent paths reads section 5 directly; a
consumer that needs the input contract reads section 3. When the
order is different per skill, every consumer must scan top to bottom
on every read, and risky boundaries can land below the
execution-detail noise the consumer was already skipping.

The "natural reading flow, not an absolute rule" caveat keeps the
practice from becoming a checkbox. A skill whose execution sequence
is one paragraph does not need a separate phase guide and example
section; the rule is "use this order when these sections exist," not
"manufacture sections to fit this order."

## Concrete examples

Good: section order follows the rule, with a high-risk boundary
summary near the top.

```markdown
---
name: "improving-skill-definition"
description: "Adversarially improves existing agent skill packages..."
---

# Improve Skill Definition

You are a skill-definition improvement orchestrator. ...

## Inputs
| Input | Required | Example |
| ----- | -------- | ------- |
| `SKILL_PATH` | Yes | `skills/refactoring-code` |

## Pipeline Overview
| Phase | Mode | Result |
| ----- | ---- | ------ |
| 1. Intake | Inline | Normalize paths, runtime, scope |
| 2. Flow Load | Inline | Load this flow and personality |

## Subagent Registry
| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `flow-coherence-auditor` | `./subagents/flow-coherence-auditor.md` | Check diagram/SKILL/subagent coherence |

## Execution
1. Emit `Phase 1/8 - Intake`; normalize inputs and derive limits.
...

## Example
Input: `SKILL_PATH=skills/example`, `KNOWN_PROBLEM="validator misses stale flow"`.
```

Bad: scrambled order; example before inputs; subagent registry
appears mid-execution.

```markdown
---
name: "improving-skill-definition"
---

# Improve Skill Definition

## Example
Try running on skills/example.

## Execution
1. Run the audit.
2. (Mid-paragraph reference to `flow-coherence-auditor`; reader has
   not seen the registry yet.)

## Subagent Registry
(Appears below execution; reader has already had to guess.)

## Inputs
(Appears last; the consumer has already attempted to dispatch
without knowing what inputs the skill requires.)
```

## References

- Anthropic Claude prompting best practices, accessed 2026-05-27:
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>.
  Supports clear structural ordering as a prompt-design tool.
- ISO/IEC/IEEE 26515:2018, "Developing user documentation in an
  agile environment," accessed 2026-06-03:
  <https://www.iso.org/standard/70879.html>. Supports predictable
  ordering as a documentation primitive.

## Related practices

- [Subagent section order](./subagent-section-order.md) — the
  sibling order for subagent files.
- [Subagent registry format](./subagent-registry-format.md) — the
  registry table referenced in section 5.
- [Naming conventions](./naming-conventions.md) — naming rules for
  the items listed in each section.
- [Identity and mental model](./identity-and-mental-model.md) —
  what section 2 (title + purpose) is for.
