# list-subagents-in-a-registry

📝 List every dispatched subagent in a registry table near the top of `SKILL.md` (Subagent, Path, Purpose; one row each) so the orchestrator sees what it can dispatch before reading any subagent file.

✅ This rule is `recommended`: expected for non-trivial skills; scope it down with a stated reason.

The registry is the dispatch routing table. Place it after the overview, before `Execution`, with the columns `Subagent`, `Path`, and `Purpose` exactly once; add a single-valued column such as `Contract` or `Pass #` only when it changes a routing decision. Every `Path` is relative to the skill folder and present on disk, and the file's frontmatter `name` equals its basename ([name-matches-directory](./name-matches-directory.md)). Each row is exactly one subagent: no grouped rows, no "(see folder)" paths, no row that carries two purposes. A registry is expected once a skill dispatches two or more subagents and worth writing for one when growth or dynamic routing is expected.

Without it, an `Execution` line such as "dispatch `log-analyzer`" has no referent: a typo routes to no file, a row pointing at two files cannot be loaded, and a multi-purpose row usually hides two subagents masquerading as one. With it, the orchestrator picks a subagent from the table and opens that one file only when dispatching it ([progressive-disclosure](./progressive-disclosure.md)).

This rule does not decide whether a step is dispatched ([delegate-by-default](./delegate-by-default.md)), how `Execution` routes on what a subagent returns ([keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md)), or how each row's job is scoped ([subagent-roles](./subagent-roles.md)).

## Examples

```markdown
<!-- ❌ core columns replaced, rows grouped, one row with two purposes; nothing here can be dispatched -->
## Subagent Registry

| Group | Subagents | Path | Notes |
| --- | --- | --- | --- |
| Auditors | flow, architecture, hygiene | (see folder) | various |
| Editor | skill-definition-editor | ./subagents/skill-definition-editor.md | applies fixes; also validates |

<!-- ✅ one subagent per row; every path exists and its file declares the matching `name` -->
## Subagent Registry

| Subagent | Path | Purpose |
| --- | --- | --- |
| `git-evidence-collector` | `./subagents/git-evidence-collector.md` | Bounded local Git evidence as compact `GIT_EVIDENCE` |
| `state-snapshot-writer` | `./subagents/state-snapshot-writer.md` | Draft or minimally repair the snapshot |
| `snapshot-verifier` | `./subagents/snapshot-verifier.md` | Verify grounding, focus, and actionability |

Read a subagent file only when dispatching that phase.
```

```yaml
# ✅ subagents/snapshot-verifier.md frontmatter — `name` equals the basename the registry points at
name: "snapshot-verifier"
description: "Verifies a project state snapshot for grounding, format, and handoff value; returns SNAPSHOT_VERIFY: PASS | FAIL | ERROR."
```

## Related rules

- [keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md)
- [name-matches-directory](./name-matches-directory.md)
- [subagent-roles](./subagent-roles.md)
- [delegate-by-default](./delegate-by-default.md)
