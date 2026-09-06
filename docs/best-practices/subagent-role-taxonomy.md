# subagent-role-taxonomy

## Tier

`recommended`. Shared vocabulary and design triggers, not a required roster. A miss is a naming or scoping smell, not a safety failure.

## When it applies

When adding, splitting, renaming, or justifying a subagent. Use the palette to name the responsibility. Adjacent jobs can still share one file. Whether to dispatch at all is a separate, per-step call owned by [subagent default execution](./subagent-default-execution.md). Apply [earned complexity](./earned-complexity.md) before creating a specialist the orchestrator does not actually need. A skill that never dispatches a subagent does not need this file.

## The practice

Name and scope each subagent against this eight-role palette. The names are responsibilities, not process steps. One subagent may combine adjacent roles when the combined scope stays small.

| Role | Responsibility | Typical inputs → outputs | Reach for this role when |
| --- | --- | --- | --- |
| Scout | Gathers evidence and context without deciding. | Paths, queries, URLs → findings, inventories, compact evidence packets | The orchestrator needs facts it should not load raw, and those facts must not become a verdict in the same pass |
| Analyst | Interprets evidence and produces a decision or recommendation. | Evidence packets → verdict, recommendation, rationale | Someone must choose or rank, and that choice is the artifact |
| Planner | Turns a decision into an ordered, bounded implementation plan. | Approved decision or brief → sequenced steps with owners, limits, and done-conditions | The next actor would otherwise invent the order of work |
| Executor | Applies an approved change to product code, tracker state, or an external system (implement, commit, post). Persisting a report or handoff file is Writer work. | Approved plan or exact edit list → product/tracker/external mutation, plus a bounded receipt | The step implements, commits, or posts, and isolation or a narrower mutation scope is worth the dispatch |
| Writer/Synthesizer | Produces prose artifacts. Reports, docs, summaries, handoff files. | Structured findings or a template → user-facing or downstream prose | The output is a document someone will read, not a status enum. Writing `report.md` does not make this an Executor |
| Validator | Checks an output against an explicit contract. Shape, schema, envelope. Deterministic. | Payload plus named contract → pass/fail with field-level defects | A later agent will parse or route on the fields. Pair with [script-enforced output contracts](./script-enforced-output-contracts.md) |
| Reviewer | Qualitatively inspects a work product for defects a validator cannot catch. | Code, plan, or report → findings with evidence and severity | Usefulness, grounding, or judgment is the question, not whether line 1 matches `STATUS:` |
| Adjudicator | Judges sibling subagent outputs against each other. Merge, confirm, or drop. | Two or more parallel payloads → one reconciled set with dispositions | Parallel producers returned overlapping or conflicting work and an independent party must cross-judge them |

**Reviewer vs Adjudicator.** A Reviewer inspects one artifact. An Adjudicator arbitrates between outputs. One producer, one stream, nothing to adjudicate.

**Combining roles.** Adjacent pairs that often share a file while the job is still small: Scout plus Analyst on a short evidence-and-recommend pass; Planner plus Executor when the plan is a few steps and the same specialist applies them; Writer plus Validator when the writer already runs the contract script before returning. Split when the combined context, mutation scope, or independence requirement no longer fits one dispatch.

Rules:

1. **Vocabulary, not a checklist.** Do not add a Scout, a Validator, and a Reviewer because the palette lists them. Add a subagent when dispatch is the right call and the role has a concrete consumer. [Earned complexity](./earned-complexity.md) still owns the Material Issue Gate. Inline vs dispatch stays a per-step decision under [subagent default execution](./subagent-default-execution.md).
2. **Adjudicators are rare.** They exist for parallel outputs that need independent cross-judging with confirm / adjust / drop (or equivalent) dispositions. A collect-then-analyze-then-write pipeline does not get an Adjudicator so the diagram looks complete. This repo has one: [`finding-adjudicator`](../../skills/review-pull-request/subagents/finding-adjudicator.md). [`chair-seat`](../../skills/council-of-advisors/subagents/chair-seat.md) sits closest to the boundary and is Writer/Synthesizer (synthesis + recommendation), not an Adjudicator.

## Rationale

Authors reach for extra subagents because a named specialist looks architected. The cost is more contracts to keep in sync, and an orchestrator that routes on roles nobody needed. A shared palette makes the missing or extra specialist visible without turning role count into a score.

This first-party tree holds 122 named subagent definitions across 27 skills. A prior survey, spot-checked for this write-up, classified them by primary role: Reviewers 25, Analysts 23, Scouts 18, Executors 15, Validators 14, Writers/Synthesizers 13, Planners 12, Adjudicators 1. A five-role palette that drops Planner, Validator, and Writer covers 82 of 122 (~67%). The eight-role palette covers 121 of 122. The one leftover is hybrid work that already combines adjacent roles. One Adjudicator in 122 definitions is the base rate to copy, not a deficit to fill.

## Concrete examples

Good: `review-pull-request` names each specialist after the job it actually does, and adds an Adjudicator only because parallel chunk reviewers produce overlapping findings.

```markdown
# skills/review-pull-request/subagents/

pr-context-collector.md   # Scout: compact PR facts, no verdict
chunk-reviewer.md         # Reviewer: one dimension, findings not comments
finding-adjudicator.md    # Adjudicator: confirm / adjust / drop across chunks
comment-drafter.md        # Writer: canonical review package
review-poster.md          # Executor: posts after approval
```

`finding-adjudicator` re-checks cited evidence and merges duplicates. It does not inspect the PR as a fresh reviewer and it does not draft comments. `analyzing-recent-project-state` keeps a single evidence stream without an Adjudicator: [`git-evidence-collector`](../../skills/analyzing-recent-project-state/subagents/git-evidence-collector.md) (Scout), [`state-snapshot-writer`](../../skills/analyzing-recent-project-state/subagents/state-snapshot-writer.md) (Writer), [`snapshot-verifier`](../../skills/analyzing-recent-project-state/subagents/snapshot-verifier.md) (Reviewer of grounding, focus, and handoff value — not a deterministic envelope script).

Bad: eight files for a linear collect-and-write skill, including an Adjudicator with one upstream producer.

```markdown
# skills/summarize-repo/subagents/

repo-scout.md
repo-analyst.md
repo-planner.md
repo-executor.md          # no mutation in this skill
repo-writer.md
repo-validator.md
repo-reviewer.md
repo-adjudicator.md       # one writer, nothing to cross-judge
```

The orchestrator still has to load eight contracts. Two files would have done the work: a Scout that returns compact facts, and a Writer that drafts the summary and runs the output script.

## References

- [Earned complexity](./earned-complexity.md) — Material Issue Gate before adding a specialist.
- [Subagent default execution](./subagent-default-execution.md) — inline vs dispatch is a per-step decision. This palette does not override it.
- [Context window protection](./context-window-protection.md) — Scouts exist so raw inspection stays out of the orchestrator.
- [Handoff-file dispatch](./handoff-file-dispatch.md) — when a Scout or Writer payload belongs in a run-scoped file.
- [Script-enforced output contracts](./script-enforced-output-contracts.md) — the Validator's runtime gate for machine-parsed fields.
- [Orchestrator as routing UI](./orchestrator-as-routing-ui.md) — the orchestrator routes on bounded outputs. It is not itself one of these eight roles.
- [`skills/review-pull-request/subagents/finding-adjudicator.md`](../../skills/review-pull-request/subagents/finding-adjudicator.md) — Adjudicator over parallel chunk findings.
- [`skills/council-of-advisors/subagents/chair-seat.md`](../../skills/council-of-advisors/subagents/chair-seat.md) — Writer/Synthesizer at the Adjudicator boundary: synthesis and dissent over council packets, no dispositions.
