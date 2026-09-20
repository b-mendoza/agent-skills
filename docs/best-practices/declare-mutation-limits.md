# declare-mutation-limits

📝 Declare `MUTATION_LIMITS` before a skill edits, creates, deletes, renames, or moves files, and pass the same value to every dispatched subagent.

🔒 This rule is `mandatory`: a miss is a material gap unless the skill names the rule and the reason for the exception in its `SKILL.md`.

`MUTATION_LIMITS` is the run's write envelope. Derive it once at intake, before any audit, plan, or edit, and hand the identical value to every subagent that plans, edits, or validates; no subagent re-derives its own scope. State the allowed paths first ("Write only inside …"), then the categorical exclusions, then how the user widens scope: a `SCOPE_LIMITS` input that names the specific extra mutation in plain words. Every planned edit must fall inside the limits plus approved expansions; anything else is blocked or escalated before it lands. Repair cycles only tighten: intersect the limits with the validator's findings so a targeted fix cannot grow into a re-edit of everything the editor once had access to.

Verification is observed, not asserted. Capture `git status --porcelain` before the first mutation, compare it with the post-edit state, and treat every newly changed path outside the plan as a validator finding. In a dirty worktree the status list alone proves nothing about a file that was already modified; inspect the diff hunks of any authorized-but-dirty path to confirm the run did not overwrite unrelated user work. This closes the three ways implicit scope loses data: a subagent "fixing" a nearby file nobody approved, a change leaking into a sibling package or a tooling-managed mirror, and a repair cycle re-widening the change set.

This rule does not decide which run-local paths a skill may create or when to ask the user before a hard-to-reverse action; see [scope-run-files-to-the-run](./scope-run-files-to-the-run.md) and [checkpoint-irreversible-actions](./checkpoint-irreversible-actions.md). An out-of-plan path surfaces as a routed validator status per [route-every-status](./route-every-status.md).

## Examples

```markdown
<!-- ❌ -->
## Edit

The editor fixes the files related to the audit findings. Use good judgment
about nearby files and ask the user if something seems risky.

<!-- ✅ -->
## Mutation Limits

Derive `MUTATION_LIMITS` at intake and pass the same value to
`skill-definition-editor` and `skill-package-validator`. Unless the user
expands scope with `SCOPE_LIMITS`:

- Write only inside `skills/<target>/`.
- Preserve the directory name, frontmatter `name`, and declared runtime targets.
- Out of scope: sibling packages, `.agents/skills/`, `.claude/skills/`,
  `skills-lock.json`, `AGENTS.md`, `.env`, and any `.handoffs/` path this run
  did not create.
- Repair cycles change only files named in `VALIDATOR_FINDINGS`.

Baseline: `git status --porcelain > .handoffs/<skill>/<run-id>/baseline.txt` before
the first edit. The validator compares the post-edit status against it and
reports any path outside the plan as `VALIDATE: FAIL`; for a path already dirty
at baseline it compares diff hunks, not status.
```

## Related rules

- [scope-run-files-to-the-run](./scope-run-files-to-the-run.md)
- [checkpoint-irreversible-actions](./checkpoint-irreversible-actions.md)
- [route-every-status](./route-every-status.md)
- [validate-by-observation](./validate-by-observation.md)
