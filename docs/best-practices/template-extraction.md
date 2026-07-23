# template-extraction

## Tier

`recommended`. Template extraction earns its place when the moved content
meaningfully reduces always-loaded context; mechanical extraction for its own
sake is the opposite of the practice.

## When it applies

When a `SKILL.md` contains a long, self-contained output template, reference
table, or scaffold consulted at one well-defined workflow point rather than
throughout execution.

## The practice

Progressive disclosure owns the load-level model; this practice owns the
extract-versus-inline decision for templates and reference tables.

Move large, self-contained output templates and reference data into co-located
files under `references/`, loaded only at the step that needs them. Use
`assets/` instead when a file is copied verbatim into the produced output.
Extracted templates and reference tables never belong under `subagents/`,
which is reserved for dispatch contracts.

The thresholds below are repo heuristics, not platform limits. Use them to
trigger an [earned complexity](./earned-complexity.md) check, then decide based
on context efficiency and maintainability.

Extract:

- Output format templates over roughly 80 lines.
- Reference tables consulted at one well-defined point.
- Content needed during assembly rather than throughout execution.

Keep inline:

- Small templates under roughly 40 lines.
- Behavioral content tightly coupled to the instruction that uses it.
- Small registries and contracts needed on every route.

## Rationale

A 200-line final-report template loaded on every trigger costs context even
when a no-change branch never assembles the report. Loading
`references/final-report-template.md` immediately before assembly turns
always-loaded content into conditional content.

The reverse failure is extracting a 20-line snippet because "we should use
progressive disclosure." That adds a load step and forces maintainers to
switch files without saving meaningful context. The thresholds protect the
practice from mechanical over-extraction.

## Concrete examples

Good: a long output template is extracted under `references/` and loaded just
before final assembly.

```markdown
# In skill-name/SKILL.md

9. Emit Phase 8 - Handoff.
10. Read [`./references/final-report-template.md`](./references/final-report-template.md)
    and emit the final report against it.

# In skill-name/references/final-report-template.md (130 lines)

# Final Report Template

## Approval Required

... (full 130-line template) ...
```

Bad: a small 30-line subagent registry is extracted even though it is needed
before every dispatch. Placing it under `subagents/` would be worse: a registry
is orchestrator routing data, not a dispatch contract.

```markdown
# In skill-name/SKILL.md

2. Before each dispatch, read
   [`./references/subagent-registry.md`](./references/subagent-registry.md)
   to find the subagent path.

# In skill-name/references/subagent-registry.md (30 lines)

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
... (always-needed registry that should have stayed inline) ...
```

## References

- "Lost in the Middle" — TACL 2024:
  <https://aclanthology.org/2024.tacl-1.9/>. Supports caution about long,
  always-loaded context.
- Anthropic, "Effective context engineering for AI agents," accessed
  2026-05-27:
  <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>.
  Supports moving large reference content out of the always-loaded path.
