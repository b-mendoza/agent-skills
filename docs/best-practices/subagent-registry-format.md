# subagent-registry-format

## Tier

`recommended`. Every multi-subagent skill needs a routeable registry;
the format is a load-bearing artifact for both the orchestrator and
the reader.

## When it applies

When authoring or editing a skill that dispatches to more than one
subagent, or a skill that may grow to dispatch additional subagents
later.

## The practice

Every skill that dispatches to subagents needs a registry table.
Place it near the top of the skill body, after the overview, and
use this column shape:

```markdown
## Subagent Registry

| Subagent        | Path                           | Purpose                             |
| --------------- | ------------------------------ | ----------------------------------- |
| `log-analyzer`  | `./subagents/log-analyzer.md`  | Extract errors from build/test logs |
| `code-reviewer` | `./subagents/code-reviewer.md` | Review changed files for issues     |
```

The orchestrator uses this table to choose the right subagent
without reading every definition file. Paths are relative to the
skill folder. Each row is one subagent — no nested groupings, no
multi-purpose rows.

## Rationale

The registry is the dispatch routing table. The orchestrator routes
its execution sequence on the names listed here, the validator
checks that each row's path exists, and the user reading the skill
gets a one-glance index of what the skill can dispatch. When the
table is missing, malformed, or stale, the orchestrator's "dispatch
log-analyzer" instruction loses its referent: there is no
authoritative way to look up where `log-analyzer.md` lives, and a
typo silently routes to no file at all.

The "one row per subagent" rule keeps the table parseable. A
"shared utility" row that points at two files breaks the orchestrator
contract: the orchestrator cannot tell which file to load. Multi-
purpose rows are a hint that two subagents are masquerading as one.

## Concrete examples

Good: clean three-column table; one row per subagent; paths exist.

```markdown
## Subagent Registry

| Subagent                       | Path                                           | Purpose                                       |
| ------------------------------ | ---------------------------------------------- | --------------------------------------------- |
| `flow-coherence-auditor`       | `./subagents/flow-coherence-auditor.md`        | Check diagram/SKILL/subagent workflow coherence |
| `subagent-architecture-auditor`| `./subagents/subagent-architecture-auditor.md` | Check subagent necessity and parallelism      |
| `skill-definition-editor`      | `./subagents/skill-definition-editor.md`       | Apply approved mutations only                 |
```

Bad: missing rows, nested grouping, multi-purpose row.

```markdown
## Subagent Registry

| Group | Subagents | Path | Notes |
| ----- | --------- | ---- | ----- |
| Auditors | flow, architecture, hygiene | (see folder) | various |
| Editor | skill-definition-editor | ./subagents/skill-definition-editor.md | applies fixes; also validates |

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

