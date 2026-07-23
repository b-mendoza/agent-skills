# subagent-registry-format

## Tier

`recommended`. Every multi-subagent skill needs a routeable registry;
the format is a load-bearing artifact for both the orchestrator and
the reader.

## When it applies

A registry is required when authoring or editing a skill that
dispatches two or more subagents. It is recommended for a skill with
one subagent when growth or dynamic routing is expected.

## The practice

A registry is required for every skill that dispatches two or more
subagents. It is recommended for a one-subagent skill when growth or
dynamic routing is expected. Place it near the top of the skill body,
after the overview, and use this core column shape:

```markdown
## Subagent Registry

| Subagent        | Path                           | Purpose                             |
| --------------- | ------------------------------ | ----------------------------------- |
| `log-analyzer`  | `./subagents/log-analyzer.md`  | Extract errors from build/test logs |
| `code-reviewer` | `./subagents/code-reviewer.md` | Review changed files for issues     |
```

The three core columns — `Subagent`, `Path`, and `Purpose` — are
required exactly once. Additional single-valued columns such as
`Contract` or `Pass #` are permitted when they improve routing. The
orchestrator uses the table to choose the right subagent without
reading every definition file. Paths are relative to the skill
folder. Each row is exactly one subagent — no nested groupings and no
multi-subagent or multi-purpose rows.

Verify every `Path` exists on disk. In each referenced file, verify
that the frontmatter `name` matches the file basename (for example,
`log-analyzer.md` declares `name: "log-analyzer"`).

## Rationale

The registry is the dispatch routing table. The orchestrator routes
its execution sequence on the names listed here, the validator
checks that each row's path exists and its file's frontmatter name
matches the basename, and the user reading the skill gets a
one-glance index of what the skill can dispatch. When the
table is missing, malformed, or stale, the orchestrator's "dispatch
log-analyzer" instruction loses its referent: there is no
authoritative way to look up where `log-analyzer.md` lives, and a
typo silently routes to no file at all.

The "one row per subagent" rule keeps the table parseable. A
"shared utility" row that points at two files breaks the orchestrator
contract: the orchestrator cannot tell which file to load. Multi-
purpose rows are a hint that two subagents are masquerading as one.

## Concrete examples

Good: all three core columns appear exactly once; one row per
subagent; paths exist.

```markdown
## Subagent Registry

| Subagent                        | Path                                           | Purpose                                         |
| ------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| `flow-coherence-auditor`        | `./subagents/flow-coherence-auditor.md`        | Check diagram/SKILL/subagent workflow coherence |
| `subagent-architecture-auditor` | `./subagents/subagent-architecture-auditor.md` | Check subagent necessity and parallelism        |
| `skill-definition-editor`       | `./subagents/skill-definition-editor.md`       | Apply approved mutations only                   |
```

Bad: required core columns are replaced, rows are grouped, and one
row carries multiple purposes.

```markdown
## Subagent Registry

| Group    | Subagents                   | Path                                   | Notes                         |
| -------- | --------------------------- | -------------------------------------- | ----------------------------- |
| Auditors | flow, architecture, hygiene | (see folder)                           | various                       |
| Editor   | skill-definition-editor     | ./subagents/skill-definition-editor.md | applies fixes; also validates |

(The orchestrator cannot route on "flow"; the path "(see folder)"
is not a path; "also validates" overlaps with skill-package-
validator silently.)
```

## References

- Martin Fowler, "Domain-driven design summary," accessed 2026-06-03:
  <https://martinfowler.com/bliki/DomainDrivenDesign.html>.
  Supports the principle that an explicit registry of bounded
  contexts beats implicit ad-hoc lookup.
- Anthropic Claude prompting best practices, accessed 2026-05-27:
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>.
  Supports clear structural ordering and explicit references for
  prompts.
