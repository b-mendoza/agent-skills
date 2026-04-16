# Template Extraction

## What it is

Move large, self-contained output templates and reference data into separate
co-located files, loaded only when the subagent reaches the step that needs
them.

## Why it matters

Output templates (80-100+ lines) occupy significant context space but are only
needed at assembly time. Extracting them reduces the subagent definition's
always-loaded footprint while keeping the content accessible.

## When to extract

- Output format templates over 80 lines
- Reference data tables that are consulted, not continuously processed
- Content that is loaded at a single, well-defined execution point

## When NOT to extract

- Small templates (under 40 lines) scattered across multiple steps — extraction
  would require loading at 3+ different points, which is worse than inlining
- Behavioral content tightly coupled to instructions (format used immediately
  after its definition)
- Subagent definitions already under ~160 lines

## Example: Template extraction

```
# Before (267-line subagent)
subagents/ticket-retriever.md
  - Instructions (100 lines)
  - Document Template (90 lines)    ← extract this
  - Scope + Escalation (30 lines)

# After (185-line subagent + 90-line template)
subagents/ticket-retriever.md        (185 lines)
subagents/ticket-retriever-template.md (90 lines, loaded at assembly step)
```

The template file is read by the subagent only when it reaches the document
assembly step, not when it starts.
