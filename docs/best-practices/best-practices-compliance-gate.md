# Best-Practices Compliance as a Quality Gate

## What it is

Treat the `docs/best-practices/` index as a first-class quality gate for every
skill in this repository. When a workflow audits, validates, or otherwise
reviews a skill package, it must explicitly check the package against the
applicable tier of best practices and report each checked item as a pass, fail,
or not-applicable result. "We followed the rules" is not a check; the check is
"the package observably conforms to each named rule, with file paths and line
ranges as evidence."

## Why it matters

`docs/best-practices/` is the canonical, evolving definition of what "good"
looks like for skills authored in this repo. If audits and validations do not
actively consult that index, three failure modes follow:

1. **Drift.** When a new best practice is added, existing skills silently fall
   out of conformance because nothing checks them.
2. **Duplication.** Skills accumulate parallel checklists that re-state the
   same rules in slightly different words, and the parallel copies fall out of
   sync with the canonical doc.
3. **Selective enforcement.** Authors apply the rules they remember and skip
   the ones they don't, with no observable mechanism to catch the gaps.

Treating the index as a gate eliminates all three.

## Rules

1. **The index is the source of truth.** Every audit and validation step that
   reviews a skill package loads `docs/best-practices/README.md` first to
   enumerate the practices that apply. The reviewer must run concrete checks
   against mandatory safety and portability practices, then apply architecture,
   evidence, and style checks according to the skill's risk and scope.

2. **Applicability is explicit.** Not every practice applies to every skill.
   When a practice does not apply (for example, `template-extraction` for a
   skill with no templates over 80 lines), the reviewer must report it as
   `not applicable` with a one-line reason. Silent omission counts as failure.

3. **Use applicability tiers.** Classify each check before evaluating it:
   - `mandatory` — safety, portability, mutation scope, output contracts, or
     lifecycle rules whose failure can cause agent misbehavior or data loss.
   - `recommended` — architecture and maintainability rules that should apply
     to most non-trivial skills but may be intentionally scoped down.
   - `optional-style` — house conventions and UI affordances that improve
     consistency but should not block a skill unless the workflow requires
     strict repo style.

4. **Per-practice verdict is concrete.** Each applicable practice produces one
   of three verdicts:
   - `pass` — the package observably conforms; evidence is a path and a
     short quote or line range, not a paraphrase.
   - `fail` — the package observably deviates; the deviation is named with
     the same evidence specificity.
   - `not applicable` — the practice does not apply; the reason is named.

5. **Evidence is observable, not declarative.** "The skill follows progressive
   disclosure" is not evidence. "SKILL.md is 312 lines (under the 500-line
   cap); `references/` holds 4 detail files loaded just-in-time, named in the
   Progressive Disclosure Map table at lines 87-94" is evidence. Reviewers
   may grep, line-count, link-check, or read for structure, but they may not
   accept self-report.

6. **The gate reports back to the orchestrator in a structured form.**
   Validators and auditors that run this gate must include a
   `Best-practices compliance` section in their output. The section lists each
   checked practice with its tier, verdict, and evidence. Mandatory failures
   enter the gap inventory as material gaps unless the user explicitly
   approves skipping them; recommended and optional-style failures are reported
   with their impact so the orchestrator can decide whether they matter for
   the current workflow.

7. **A skill that deviates from a mandatory or recommended practice must
   declare it.** If a skill
   deliberately deviates from a practice (for example,
   `improving-skill-definition` deliberately deviates from the standalone-package
   rule because it is the repo's single non-portable skill), the skill's
   `SKILL.md` must state the deviation and the reason. The gate then records
   the practice as `pass — declared exception: <reason>` rather than as
   `fail`.

8. **Updating a best practice may flag existing skills.** When a best practice
   is added or changed, prior `pass` verdicts may become stale. Reviewers do
   not retroactively annotate every existing skill, but the next time a skill
   is reviewed, the gate is run against the current index, not against a
   snapshot.

9. **The gate is a check, not a rewrite trigger.** Reporting a `fail` does not
   authorize the reviewer to fix it. The audit surfaces it as a material gap,
   the user approves the fix, and the editor applies it. This preserves the
   approval-before-mutation contract that lives elsewhere in the workflow.

## Output shape

```markdown
## Best-Practices Compliance

| Practice | Tier | Verdict | Evidence |
| -------- | ---- | ------- | -------- |
| progressive-disclosure | recommended | pass | SKILL.md is 312 lines; ./references/ holds 4 JIT files referenced in Progressive Disclosure Map (SKILL.md lines 87-94) |
| context-window-protection | mandatory | pass | Orchestrator dispatches all raw inspection to subagents; SKILL.md line 22 "Raw target-package inspection ... happen in subagents" |
| handoff-file-dispatch | recommended | fail | Editor dispatch passes audit report + approved gaps + personality decision inline; expected handoff file at `.handoffs/<skill-name>/skill-definition-editor-instructions.md` was not created |
| template-extraction | recommended | not applicable | No bundled template exceeds 80 lines |
```

## Pairing with other gates

This gate runs alongside, not in place of, the workflow-specific gates a skill
defines (for example, the approval gate, the scope gate, the validator's
package-hygiene checks). A workflow that already has a "package hygiene" or
"authoring checklist" gate folds the best-practices-compliance section into
the same output rather than producing a separate document.

## References

- `./README.md` — the index this gate enumerates from.
- `./empirical-validation.md` — why evidence must be observable, not
  self-reported.
- `./validation-loops.md` — how gates compose with retry limits.
