# template-extraction

## Tier

`recommended`. Template extraction earns its place when the moved
content meaningfully reduces always-loaded context; mechanical
extraction for its own sake is the opposite of the practice.

## When it applies

When a `SKILL.md` contains a long, self-contained output template,
reference table, or scaffold that is consulted at one well-defined
point in the workflow rather than throughout execution.

## The practice

Move large, self-contained output templates and reference data into
co-located files under `references/`, loaded only at the step that
needs them.

The line thresholds below are repo heuristics, not platform limits.
Use them to trigger a closer
[earned complexity](./earned-complexity.md) check, then keep or
extract based on whether the move improves context efficiency or
maintainability.

Extract:

- Output format templates over roughly 80 lines.
- Reference tables that are consulted at one well-defined point.
- Content loaded during assembly rather than throughout execution.

Keep inline:

- Small templates under roughly 40 lines.
- Behavioral content tightly coupled to the instruction that uses it.
- Subagent definitions already small enough to stay readable.

## Rationale

A 200-line "final report template" loaded on every skill trigger costs
context on every run, even when the workflow takes a no-change branch
that never assembles the final report. Moving the template to
`references/final-report-template.md` and loading it just before
assembly turns "always loaded" into "loaded once, on the run that
needs it."

The reverse failure is also real. Extracting a 20-line snippet because
"we should use progressive disclosure" makes the orchestrator pay
dispatch and load cost without saving meaningful context, and forces
maintainers to flip between two files to understand one rule. The
thresholds protect the practice from itself.

## Concrete examples

Good: a long output template is extracted and loaded just before the
phase that assembles the output.

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

Bad: a small 30-line subagent registry is extracted to
`references/subagent-registry.md` even though it loads on every run
and is referenced before every dispatch, so the orchestrator pays the
extra load without saving context.

```markdown
# In skill-name/SKILL.md
2. Before each dispatch, read
   [`./references/subagent-registry.md`](./references/subagent-registry.md)
   to confirm the path of the subagent.

# In skill-name/references/subagent-registry.md (30 lines)
## Subagent Registry
| Subagent | Path | Purpose |
| -------- | ---- | ------- |
... (30 lines of registry that just as well lived in SKILL.md) ...
```

## References

- "Lost in the Middle" — TACL 2024:
  <https://aclanthology.org/2024.tacl-1.9/>. Supports caution about
  long, always-loaded context.
- Anthropic, "Effective context engineering for AI agents," accessed
  2026-05-27:
  <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>.
  Supports moving large reference content out of the always-loaded
  path.

