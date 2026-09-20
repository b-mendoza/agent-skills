# subagent-roles

📝 Name and scope each subagent by one of seven roles (scout, analyst, planner, executor, writer, reviewer, adjudicator) when adding, splitting, or justifying it; roles are vocabulary, not a roster.

✅ This rule is `recommended`: expected for non-trivial skills; scope it down with a stated reason.

A role names a responsibility, not a process step. Use the table to say what a subagent is for, what it consumes and returns, and when the job warrants a dispatch of its own. Adjacent roles may share one file while the job stays small (scout+analyst on a short evidence-and-recommend pass; planner+executor when the plan is a few steps the same specialist applies); split when the combined context, mutation scope, or independence requirement no longer fits one dispatch. A second subagent whose output has the same consumer as an existing one is a smell. There is no validator role: checking a payload's shape against its contract is the script's job ([validate-routed-fields-with-a-script](./validate-routed-fields-with-a-script.md)), not a dispatch.

| Role | Responsibility | Inputs → outputs | Reach for it when |
| --- | --- | --- | --- |
| Scout | Gathers evidence without deciding. | Paths, queries, URLs → findings, inventories, compact evidence packets | The orchestrator needs facts it must not load raw, and those facts must not become a verdict in the same pass |
| Analyst | Interprets evidence into a decision or recommendation. | Evidence packets → verdict, recommendation, rationale | Someone must choose or rank, and that choice is the artifact |
| Planner | Turns a decision into an ordered, bounded plan. | Approved decision or brief → sequenced steps with owners, limits, and done-conditions | The next actor would otherwise invent the order of work |
| Executor | Applies an approved change to code, tracker state, or an external system. | Approved plan or exact edit list → the mutation plus a bounded receipt | The step implements, commits, or posts, and isolation or a narrower `MUTATION_LIMITS` scope is worth the dispatch |
| Writer | Produces prose artifacts: reports, docs, summaries, handoff files. | Structured findings or a template → user-facing or downstream prose | The output is a document someone will read, not a status; writing `report.md` does not make this an executor |
| Reviewer (optional) | Judges the semantic quality of one artifact. | Code, plan, or report → findings with evidence and severity | The artifact is too large or too numerous for the orchestrator to judge in its own context; shape belongs to the script |
| Adjudicator | Cross-judges sibling outputs: confirm, adjust, or drop. | Two or more parallel payloads → one reconciled set with dispositions | Parallel producers returned overlapping or conflicting work; one producer leaves nothing to adjudicate |

Whether to dispatch at all is decided per step by [delegate-by-default](./delegate-by-default.md); whether a new subagent earns its place by [earn-every-part](./earn-every-part.md). The orchestrator routes on what these roles return ([keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md)); it is not itself one of them.

## Examples

```markdown
<!-- ❌ roles filled from the palette; a shape check dispatched; an adjudicator with a single producer -->
skills/summarize-repo/subagents/
  repo-scout.md
  repo-analyst.md
  repo-writer.md
  repo-validator.md      # checks that line 1 matches `SUMMARY:` — a script's job
  repo-reviewer.md       # re-reads one short summary the orchestrator can judge itself
  repo-adjudicator.md    # one writer upstream; nothing to cross-judge

<!-- ✅ each file named for the job it does; the adjudicator exists because chunk reviewers run in parallel -->
skills/review-pull-request/subagents/
  pr-context-collector.md   # scout: compact PR facts, no verdict
  chunk-reviewer.md         # reviewer: one dimension, findings with evidence; several run in parallel
  finding-adjudicator.md    # adjudicator: confirm, adjust, or drop across chunks; merges duplicates
  comment-drafter.md        # writer: the canonical review package, shape-checked by a script before routing
  review-poster.md          # executor: posts the exact package only after `APPROVED`

<!-- ✅ adjacent roles combined while the job is small -->
skills/clarifying-assumptions/subagents/
  critique-analyzer.md      # scout+analyst: gathers evidence and returns the verdict plus a path in one pass
```

## Related rules

- [delegate-by-default](./delegate-by-default.md)
- [earn-every-part](./earn-every-part.md)
- [list-subagents-in-a-registry](./list-subagents-in-a-registry.md)
- [validate-routed-fields-with-a-script](./validate-routed-fields-with-a-script.md)
