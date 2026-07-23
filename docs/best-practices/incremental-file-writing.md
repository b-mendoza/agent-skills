# incremental-file-writing

## Tier

`recommended`. The risk is most acute on known-fragile runtimes and large
multi-section artifacts; small files written by tolerant runtimes are safe to
write in one operation.

## When it applies

When a skill, during runtime execution, produces a large multi-section
artifact: YAML handoff payloads, audit synthesis reports, plans, validator
findings, final handoffs, or other outputs contractually expected to grow
across phases. This is runtime artifact-production guidance, not a rule for
authoring or restructuring documentation files in this repository.

## The practice

For large or serializer-sensitive artifacts, initialize a small skeleton with
one write operation, then add one logical section per targeted-edit operation
using the runtime's file-edit capability.

Rules:

1. Initialize a small header or section skeleton.
2. Add one logical section per targeted edit.
3. For runtimes known to be fragile, consider keeping each inserted string
   around 2 KB. This is an unverified repo heuristic to re-validate, not a
   platform limit.
4. Prefer skeleton-then-sections for contractually growing artifacts even when
   the active runtime shows no truncation in practice; it produces stable diffs
   across repair cycles.
5. Use targeted edits for formatting repairs instead of re-emitting the whole
   file.
6. Keep dispatcher replies compact: status plus artifact path.

A single whole-file write remains appropriate when the output is small, low in
special-character density, and not expected to grow across phases.

## Rationale

Some runtimes may truncate large payloads, corrupt special characters, or fail
without a useful error. The failure is asymmetric: a monolithic operation can
succeed locally but fail under another runtime or deployment, leaving a broken
artifact for a downstream consumer.

Incremental writing also gives a contractually growing artifact a stable shape
from its first operation. Validators and repair cycles can compare focused
section diffs instead of repeatedly replacing an opaque whole-file payload.

## Concrete examples

Runtime example below uses Claude Code-style capability names. Map them to the
active runtime's equivalent write and targeted-edit operations.

Good: create the skeleton, then insert one bounded section per targeted edit.

```text
# 1. Skeleton (one small Write operation)
Write("docs/PROJ-123-audit-synthesis.md",
      "# Audit Synthesis\n\n## Gap Inventory\n\n## Mutation Plan\n\n## Gate Plan\n")

# 2. Targeted Edit operations; ~2 KB is a heuristic, not a requirement
Edit(file_path="docs/PROJ-123-audit-synthesis.md",
     old_string="## Gap Inventory\n",
     new_string="## Gap Inventory\n\n| id | severity | required fix |\n| -- | -------- | ------------ |\n| gap-001 | high | add blocked route |\n")

Edit(file_path="docs/PROJ-123-audit-synthesis.md",
     old_string="## Mutation Plan\n",
     new_string="## Mutation Plan\n\n- Edit the status table\n- Repair the gate route\n")
```

Bad: send a roughly 15 KB multi-section document in one runtime write,
including embedded fences and pipe-heavy tables.

```text
Write("docs/PROJ-123-audit-synthesis.md",
"# Audit Synthesis\n\n## Gap Inventory\n| id | severity | ...\n| gap-001 | ...\n... (15 KB of content) ...\n")
# A fragile runtime may truncate mid-table and leave malformed output.
```

## References

- Anthropic, "Tool use," accessed 2026-06-03:
  <https://docs.anthropic.com/en/docs/build-with-claude/tool-use>.
  Supports treating tool calls as discrete transactions whose payload size
  affects reliability.
- OpenAI, "Function calling reliability," accessed 2026-06-03:
  <https://platform.openai.com/docs/guides/function-calling>.
  Supports the general principle that smaller, well-scoped tool payloads are
  more reliable than monolithic ones.
