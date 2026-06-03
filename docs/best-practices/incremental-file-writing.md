# incremental-file-writing

## Tier

`recommended`. The risk is most acute on known-fragile runtimes and on
large multi-section artifacts; small files written by tolerant
runtimes are safe to write in one call.

## When it applies

When a skill needs to produce a large, multi-section Markdown
artifact — audit synthesis reports, plans, validator findings, final
handoffs — or any artifact whose body is contractually expected to
grow across phases.

## The practice

Avoid a single monolithic `Write` call for large or
serializer-sensitive multi-section Markdown artifacts. Initialize the
file with a small skeleton, then append or replace one logical
section at a time.

Rules:

1. Initialize with a small header or section skeleton.
2. Add one logical section per `StrReplace` or `Edit` call.
3. Use a conservative per-call string budget for known-fragile
   runtimes. Around 2 KB is an empirical safety margin observed in
   this repo, not a universal platform limit.
4. Do not use monolithic writes for large or contractually growing
   artifacts: subagent reports, audit summaries, validator findings,
   handoff files, and structured plans.
5. Do not re-emit an entire file just to fix formatting; use targeted
   edits.
6. Keep the dispatcher reply compact: status plus artifact path.

Use a single `Write` when the whole file is small, low in
special-character density, and not a contract output expected to
grow over time.

## Rationale

Some runtimes silently truncate, corrupt special characters, or fail
without a useful error when a single tool call ships a large payload.
The failure is asymmetric: a monolithic write that succeeds locally
may fail in CI or under a different model deployment, and the agent
will not realize the file is broken until a downstream consumer
parses it.

Incremental writing also matches how artifacts are read. A multi-
phase consumer that reads a `## Findings` section after each repair
cycle benefits from being able to compare deltas across edits. The
skeleton-plus-targeted-edits pattern gives the consumer a stable
file shape from the first write onwards.

## Concrete examples

Good: skeleton first, then one targeted append per section.

```text
# 1. Skeleton (one small Write call)
Write("docs/PROJ-123-audit-synthesis.md", "# Audit Synthesis\n\n## Gap Inventory\n\n## Mutation Plan\n\n## Gate Plan\n")

# 2. Targeted edits per section, each well under 2 KB
Edit(file_path="docs/PROJ-123-audit-synthesis.md",
     old_string="## Gap Inventory\n",
     new_string="## Gap Inventory\n\n| id | severity | type | required fix |\n| -- | -------- | ---- | ------------ |\n| gap-001 | high | contract | add EDIT: BLOCKED row |\n")

Edit(file_path="docs/PROJ-123-audit-synthesis.md",
     old_string="## Mutation Plan\n",
     new_string="## Mutation Plan\n\n- Edit `SKILL.md` rows 102-109\n- Edit `flow-diagram.md` STATUS_CONTRACT node\n")
```

Bad: a single monolithic write that ships a ~15 KB multi-section
document in one call, including embedded code fences and pipe-heavy
tables.

```text
Write("docs/PROJ-123-audit-synthesis.md",
"# Audit Synthesis\n\n## Gap Inventory\n| id | severity | ...\n| gap-001 | ...\n... (15 KB of content) ...\n")
# On a fragile runtime this can truncate mid-table, leaving a
# malformed file the downstream validator silently misparses.
```

## References

- Anthropic, "Tool use," accessed 2026-06-03:
  <https://docs.anthropic.com/en/docs/build-with-claude/tool-use>.
  Supports treating tool calls as discrete transactions whose payload
  size affects reliability.
- OpenAI, "Function calling reliability," accessed 2026-06-03:
  <https://platform.openai.com/docs/guides/function-calling>.
  Supports the general principle that smaller, well-scoped tool
  payloads are more reliable than monolithic ones.

## Related practices

- [Template extraction](./template-extraction.md) — large output
  templates that get extracted are exactly the kind of artifact this
  practice writes incrementally.
- [Context window protection](./context-window-protection.md) — short
  dispatcher replies (status plus path) keep the orchestrator clean.
- [Handoff file dispatch](./handoff-file-dispatch.md) — handoff YAML
  files are also written via this pattern when they grow large.
