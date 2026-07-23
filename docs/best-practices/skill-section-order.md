# skill-section-order

## Tier

`recommended`. Predictable structure speeds both human and agent
reading of skill and subagent files. The invariant anchors below are
the practice; the exact section sequences are starter templates, not
compliance targets. Deviating from a template is fine when the
anchors still hold.

## When it applies

When authoring or editing a `SKILL.md`, or any subagent file under
`skills/*/subagents/`.

## The practice

Order content so that four invariant anchors hold. These anchors are
what reviews check; everything else is layout preference.

1. **Identity before contracts.** Frontmatter, title, and purpose
   come first — a reader knows what the file is before what it
   consumes.
2. **Contracts before behavior.** Inputs, outputs, and the subagent
   registry appear before the execution or instruction detail that
   uses them. A dispatcher must never reach a "dispatch X" step
   before the registry has defined X.
3. **Boundaries visible before mutation.** For skills that mutate
   files, call external services, or carry other real risk, a short
   boundary summary (mutation limits, permissions, safety rules)
   appears near the top — before execution detail — even if the full
   scope section lives later.
4. **Examples near the end.** Round-trip and edge-case examples
   close the file; they illustrate the contract, they do not define
   it.

### Starter template: `SKILL.md`

```text
1. YAML frontmatter (name, description)
2. # Title + purpose paragraph
3. ## Inputs (table: name, required, example)
4. ## Output Contract (path / shape of what the skill produces)
5. ## Pipeline / Workflow overview (if multi-phase)
6. ## Subagent Registry (table: name, path, purpose)
7. ## Progressive Loading Map (table: need, load — if the skill
   ships references/)
8. ## How This Skill Works (behavioral description, identity)
9. ## Execution steps or Phase guide
10. ## Example (dispatch round-trip)
```

The Output Contract slot is required whenever a downstream consumer
parses the skill's output — see
[input and output contracts](./input-output-contracts.md). The
Progressive Loading Map is the de facto repo standard for skills
with `references/`: a small `Need | Load` table placed near the
registry so the agent knows which file to load for which decision.

### Starter template: subagent files

```text
1. YAML frontmatter (name, description)
2. # Title + mental model paragraph
3. ## Inputs (table or list)
4. ## Output Format (structured template with example)
5. ## Instructions / How to [action] (step-by-step)
6. ## Scope (allow-list: "Your job is to...")
7. ## Escalation (failure categories with report format)
```

A subagent file has two consumers: the orchestrator that dispatches
it (reads frontmatter, inputs, and output format) and the subagent
itself when invoked (reads everything). Keeping the contract
sections (inputs, output format) above the instruction body makes
the orchestrator's read cheap. Scope and escalation close the file:
they answer "where do I stop" after the subagent knows what it is
doing.

### Consistency within a package

Whatever layout a package uses, use it for every subagent in that
package. The registry's `Path` column should point at files with a
predictable shape; when each subagent orders sections differently,
every dispatch site has to scan the whole file.

## Rationale

A predictable structure lets both humans and agents skim for the
section they need without re-reading every line. But an audit of
this repository found that most mature skills deviate from any
single literal sequence while still being perfectly navigable —
because they preserve the anchors: identity first, contracts before
behavior, boundaries before risk, examples last. Enforcing an exact
sequence would generate churn without improving navigation;
enforcing the anchors catches the failures that matter (an
execution step referencing an undeclared subagent, a mutation
boundary buried below execution noise, an output shape the consumer
has to reverse-engineer).

## Concrete examples

Good: anchors hold — identity, then contracts (inputs, output,
registry), then behavior, with a boundary summary near the top of a
mutating skill.

```markdown
---
name: "improving-skill-definition"
description: "Adversarially improves existing agent skill packages..."
---

# Improve Skill Definition

You are a skill-definition improvement orchestrator. Mutations are
limited to the target package; see Default Mutation Limits below.

## Inputs

| Input        | Required | Example                   |
| ------------ | -------- | ------------------------- |
| `SKILL_PATH` | Yes      | `skills/refactoring-code` |

## Subagent Registry

| Subagent                 | Path                                    | Purpose                                |
| ------------------------ | --------------------------------------- | -------------------------------------- |
| `flow-coherence-auditor` | `./subagents/flow-coherence-auditor.md` | Check diagram/SKILL/subagent coherence |

## Execution

1. Normalize inputs and derive limits. ...
```

Bad: anchors broken — example before inputs, registry below the
execution steps that dispatch it, no boundary summary before
mutation steps.

```markdown
---
name: "improving-skill-definition"
---

# Improve Skill Definition

## Example

Try running on skills/example.

## Execution

1. Run the audit and apply fixes.
2. (Dispatches `flow-coherence-auditor`; the reader has not seen
   the registry yet, and no mutation boundary has been stated.)

## Subagent Registry

(Below the steps that needed it.)

## Inputs

(Last; a dispatcher has already had to guess.)
```

## References

- Anthropic Claude prompting best practices, accessed 2026-05-27:
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>.
  Supports clear structural ordering as a prompt-design tool.
- ISO/IEC/IEEE 26515:2018, "Developing user documentation in an
  agile environment," accessed 2026-06-03:
  <https://www.iso.org/standard/70880.html>. Supports predictable
  ordering as a documentation primitive.
