# progressive-disclosure

## Tier

`recommended`. Most non-trivial skills benefit from staged loading; thin
utility skills may pack everything into `SKILL.md` and still be correct.

## When it applies

When authoring a skill whose total instructional surface (rules,
templates, references, subagent contracts) does not comfortably fit
under the `SKILL.md` size guidance, and the agent does not need every
piece of content for every routing decision.

## The practice

Structure skill content into three explicit load levels and gate each
piece of content to the smallest level that still works for the phase
or mode that consumes it. Level 0 (`SKILL.md`) loads on skill trigger.
Level 1 (`references/`) loads just-in-time, per phase or mode. Level 2
(`subagents/`) loads only when the orchestrator dispatches that
subagent.

| Level | What loads | When | Size guidance |
| --- | --- | --- | --- |
| 0 | `SKILL.md` body | When the skill triggers | Under 500 lines |
| 1 | `references/` files | Just-in-time, per phase or mode | Not always-loaded; budgeted to the phase or mode |
| 2 | `subagents/` definitions | Only when dispatching that subagent | Not always-loaded; keep each contract focused |

Level 0 contains core identity, input/output contracts, subagent
registry, phase guide, and routing table. Level 1 contains detailed
playbooks, templates, recovery instructions, and external-source
indexes. Level 2 contains individual subagent contracts.

## Rationale

`SKILL.md` is always loaded when the skill triggers. Every line of
always-loaded content competes with the orchestrator's working context.
A skill that bundles every reference, template, and subagent contract
into a single file taxes the orchestrator on every run, even for phases
that never consult that content. Splitting into levels lets the
orchestrator pay only for the content it actually uses for the
decision it is making right now.

Moving content out of `SKILL.md` does not make it free. Every reference
or subagent file still needs a clear load condition, a focused purpose,
and enough brevity that the agent can use it reliably in the phase
where it applies. Progressive disclosure earns its place when it makes
the orchestrator's working context smaller without making the
just-in-time content noisier.

## Concrete examples

Good: `SKILL.md` carries identity, inputs, registry, phase guide; the
critique-mode playbook is extracted because it only loads in that
mode.

```markdown
# In skill-name/SKILL.md (Level 0, always loaded)
## Modes
- `upfront`: see [`references/upfront-mode.md`](./references/upfront-mode.md)
- `critique`: see [`references/critique-mode.md`](./references/critique-mode.md)

# In skill-name/references/critique-mode.md (Level 1, loaded only in critique mode)
# Critique Mode Playbook
This guide is loaded by the orchestrator only when MODE=critique.
... (detailed step-by-step critique loop) ...
```

Bad: every mode-specific playbook is inlined into `SKILL.md`, pushing
it to 1,200 lines that load on every trigger.

```markdown
# In skill-name/SKILL.md (Level 0, always loaded)
## Modes
### Upfront Mode (350 lines of detail loaded every run)
...
### Critique Mode (400 lines of detail loaded every run)
...
### Decision Recording Mode (200 lines of detail loaded every run)
...
```

## References

- "Lost in the Middle" — TACL 2024:
  <https://aclanthology.org/2024.tacl-1.9/>. Supports caution about
  retrieval degradation in long contexts; it does not prove
  repo-specific line thresholds.
- AGENTIF benchmark — arXiv:2505.16944:
  <https://arxiv.org/abs/2505.16944>. Supports treating long, complex
  agent instructions as a reliability risk; it does not prove specific
  line-count thresholds.
- Anthropic, "Effective context engineering for AI agents," accessed
  2026-05-27:
  <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>.
  Supports just-in-time retrieval and summarization patterns over
  always-loaded context.

## Related practices

- [Template extraction](./template-extraction.md) — concrete extraction
  criteria for output templates.
- [Context window protection](./context-window-protection.md) —
  protects the orchestrator's working context once content is loaded.
- [Earned complexity](./earned-complexity.md) — extraction is permitted
  only when it earns its place.
- [Subagent default execution](./subagent-default-execution.md) — when
  Level 2 subagent files should exist at all.
