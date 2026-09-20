# earn-every-part

📝 Add a skill, subagent, reference, script, contract field, or gate only when it fixes a concrete problem in a named Material Issue Gate dimension; otherwise make the smaller change or none.

✅ This rule is `recommended`: expected for non-trivial skills; scope it down with a stated reason.

Every part of a skill package costs context to load, files to keep in sync, and boundaries to fail across, so each one must change runtime behaviour or maintainability in an observable way. First choose the smallest artifact that fits: handle non-recurring behaviour directly; write a script when the behaviour is fully deterministic; write a reference document when the need is stable information without judgment or orchestration; extend the skill that already owns the trigger; create a new skill only when the behaviour recurs and needs reusable judgment, orchestration, or its own invocation contract.

Then pass every addition or edit through the Material Issue Gate: it must fix a concrete problem in reliability, portability, standalone packaging (no absolute paths, sibling packages, or private config), context efficiency, maintainability, validation (a new observable check for a previously silent failure), user comprehension, or best-practices compliance (a rule miss becomes a pass or a declared exception). A change that only renames, reshuffles, or polishes fires no dimension: leave the package unchanged. The questions that decide a part's shape live with their owners: dispatch or inline in [delegate-by-default](./delegate-by-default.md), extract or keep inline in [progressive-disclosure](./progressive-disclosure.md), external information in [link-external-sources](./link-external-sources.md), observable checks over self-report in [validate-by-observation](./validate-by-observation.md).

Role names — scout, analyst, planner, executor, writer, validator, reviewer, adjudicator — are vocabulary for scoping one subagent, not a roster to fill; a second subagent whose output has the same consumer as an existing one is a smell, and an adjudicator exists only where parallel producers return overlapping work that needs independent cross-judging. Prefer the smallest correct change while the structure is sound; recommend a rebuild, merge, or removal when the diagram, `SKILL.md`, and subagents disagree on phases, gates, or statuses beyond surface repair, when several subagents return overlapping verdicts with no distinct consumer, or when the package's own gates miss its central failure mode.

## Examples

```markdown
<!-- ❌ additions justified by appearance, not by a dimension -->
Recommendation: extract the 12-row subagent registry to `references/subagent-registry.md`
because progressive disclosure is a best practice.

skills/summarize-repo/subagents/
  repo-scout.md  repo-analyst.md  repo-planner.md  repo-executor.md    # the skill never mutates
  repo-writer.md  repo-validator.md  repo-reviewer.md  repo-adjudicator.md   # one writer; nothing to cross-judge

<!-- ✅ each decision names the dimension it fires, or fires none and stops -->
Decision: leave the subagent registry inline. It is consulted on every run, so extraction
would load the same 12 rows from a second file: no context-efficiency, maintainability,
or reliability gain.

Decision: collapse to two subagents — `repo-scout` (returns compact facts) and `repo-writer`
(drafts the summary; its payload is checked by `scripts/validate-output.sh` before routing).
Dimensions fired: context efficiency (six fewer contracts loaded), maintainability.
```

## Related rules

- [dispatch-for-bounded-results](./dispatch-for-bounded-results.md)
- [load-only-what-the-step-needs](./load-only-what-the-step-needs.md)
- [link-offline-content](./link-offline-content.md)
- [validate-by-observation](./validate-by-observation.md)
- [one-normative-state-machine](./one-normative-state-machine.md)
