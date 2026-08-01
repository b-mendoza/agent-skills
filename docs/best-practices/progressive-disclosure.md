# progressive-disclosure

## Tier

`recommended`. Most non-trivial skills benefit from staged loading; thin utility skills may pack everything into `SKILL.md` and still be correct.

## When it applies

When authoring a skill with conditionally relevant rules, templates, references, or dispatch contracts. Staged loading is useful even when the total instructional surface fits within the `SKILL.md` size guidance, provided the agent does not need every piece for every routing decision.

## The practice

Structure skill content into three repo load levels and gate each piece to the smallest level that still works for the phase or mode that consumes it.

| Level | What loads | When | Size guidance |
| --- | --- | --- | --- |
| 0 | `SKILL.md` body | When the skill triggers | Under 500 lines and roughly 5,000 tokens |
| 1 | `references/` files | Just-in-time, per phase or mode | Budgeted to that phase or mode |
| 2 | `subagents/` definitions | Only when the orchestrator dispatches that subagent | Keep each dispatch contract focused |

Level 0 contains core identity, the minimal input/output and routing envelope, the subagent registry, critical standing instructions, and phase guidance. Level 1 contains detailed playbooks, templates, recovery instructions, and external-source indexes. Level 2 is this repo's convention for co-located subagent dispatch contracts; it is not a runtime agent registry. Runtime registration and discovery are separate portability concerns.

**Treat line and token guidance together.** Official Agent Skills guidance recommends keeping the `SKILL.md` instruction body below roughly 5,000 tokens as well as 500 lines. As of 2026-07-22, Claude Code auto-compaction reattaches only the first roughly 5,000 tokens of each skill, within a combined 25,000- token skill budget. These are current-runtime behaviors, not timeless platform guarantees; re-verify them before relying on the exact numbers. Place standing, safety-critical, approval, routing, and terminal instructions early enough to remain inside the first roughly 5,000 tokens. Passing the 500-line check is necessary but not sufficient.

### Progressive Loading Map

Use a small `Need | Load` table near the subagent registry as the de facto first-party routing standard. Add one row per concrete load condition and point directly to the file loaded at that condition. The exemplar is [`skills/council-of-advisors/SKILL.md`](../../skills/council-of-advisors/SKILL.md#progressive-loading-map).

```markdown
## Progressive Loading Map

| Need                    | Load                                    |
| ----------------------- | --------------------------------------- |
| Critique-mode procedure | `./references/critique-mode.md`         |
| Final report assembly   | `./references/final-report-template.md` |
```

## Rationale

`SKILL.md` is always loaded when the skill triggers. Every line and token of always-loaded content competes with the orchestrator's working context. A skill that bundles every reference, template, and dispatch contract into one file taxes every run, including routes that never use that content.

Moving content out of `SKILL.md` does not make it free. Every supporting file still needs a concrete load condition, focused purpose, and enough brevity to work reliably when loaded. Progressive disclosure earns its place when it reduces always-loaded context without making just-in-time content harder to find or use.

## Concrete examples

Good: `SKILL.md` carries the routing envelope and loading map; the detailed critique playbook loads only in critique mode.

```markdown
# In skill-name/SKILL.md (Level 0)

## Progressive Loading Map

| Need                   | Load                            |
| ---------------------- | ------------------------------- |
| Critique mode selected | `./references/critique-mode.md` |

# In skill-name/references/critique-mode.md (Level 1)

# Critique Mode Playbook

Load only when MODE=critique. ... (detailed critique loop) ...
```

Bad: every mode-specific playbook is inlined into a 1,200-line `SKILL.md`, with critical routing and terminal rules appearing after the first several thousand tokens.

```markdown
# In skill-name/SKILL.md (Level 0, always loaded)

### Upfront Mode (350 lines)

...

### Critique Mode (400 lines)

...

### Decision Recording Mode (200 lines)

...

### Terminal Routing (late in the file)

...
```

## References

- "Lost in the Middle" — TACL 2024: <https://aclanthology.org/2024.tacl-1.9/>. Supports caution about retrieval degradation in long contexts; it does not prove repo-specific line thresholds.
- AGENTIF benchmark — arXiv:2505.16944: <https://arxiv.org/abs/2505.16944>. Supports treating long, complex agent instructions as a reliability risk; it does not prove specific line-count thresholds.
- Anthropic, "Effective context engineering for AI agents," accessed 2026-05-27: <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>. Supports just-in-time retrieval and summarization patterns over always-loaded context.
- Agent Skills specification, accessed 2026-07-22: <https://agentskills.io/specification>. Supports the current line and token recommendations for the activated `SKILL.md` body.
- Claude Code Docs, "Skills," accessed 2026-07-22: <https://code.claude.com/docs/en/skills#skill-content-lifecycle>. Supports the current skill lifecycle and auto-compaction token-budget behavior; re-verify before relying on exact runtime limits.
