# declare-mutation-limits

📝 Declare `MUTATION_LIMITS` before a skill edits, creates, deletes, renames, or moves files, and pass the same value to every dispatched subagent.

🔒 This rule is `mandatory`: a miss is a material gap unless the rule allows an exception and the change's report or handoff, outside the skill package, states the rule and reason.

`MUTATION_LIMITS` is the run's write envelope. Derive it once at intake, before any audit, plan, or edit, and hand the identical value to every subagent that plans, edits, or validates; no subagent re-derives its own scope. State the allowed paths first ("Write only inside …"), then the categorical exclusions, then how the user widens scope: a `SCOPE_LIMITS` input that names the specific extra mutation in plain words. Every planned edit must fall inside the limits plus approved expansions; anything else is blocked or escalated before it lands. Repair cycles only tighten: intersect the limits with the validator's findings so a targeted fix cannot grow into a re-edit of everything the editor once had access to.

Verification is observed, not asserted. Capture `git status --porcelain` before the first mutation, compare it with the post-edit state, and treat every newly changed path outside the plan as a validator finding. In a dirty worktree the status list alone proves nothing about a file that was already modified; inspect the diff hunks of any authorized-but-dirty path to confirm the run did not overwrite unrelated user work. This closes the three ways implicit scope loses data: a subagent "fixing" a nearby file nobody approved, a change leaking into a sibling package or a tooling-managed mirror, and a repair cycle re-widening the change set.

This rule does not decide which run-local paths a skill may create or when to ask the user before a hard-to-reverse action; see [scope-run-files-to-the-run](./scope-run-files-to-the-run.md) and [declare-mutation-limits](./declare-mutation-limits.md#approval). An out-of-plan path surfaces as a routed validator status per [keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md#transitions).

## Approval

Place a named checkpoint after preparation and verification, immediately before an irreversible, outward-facing, destructive, or costly action, including expanded paths, targets, or recipients. Show the final artifact itself, exact command and arguments or file/path mapping, targets, checks passed, unresolved risks, and the `ABORT` disposition. An intent summary is not a preview.

Consent binds to this run, action, and artifact version. Changes to text, paths, commands, or targets invalidate it and require another preview. Prior-run approval and earlier-version approval are stale. Record blanket intake consent as ignored pre-approval; never consume it as authorization.

| Answer | Route |
| --- | --- |
| `APPROVED` | Execute only the previewed action and version. |
| `REVISE` | Revise within scope, show the new version, and ask again. |
| `ABORT` | Stop the action with `BLOCKED` and apply the stated artifact disposition. |
| Unclear answer | Re-ask only within a declared bound; at cap, `BLOCKED`. |
| Missing or unusable answer | `BLOCKED`, never inferred consent. |

Define all revision/re-ask counters and routes using the [transition rules](./keep-routing-in-the-orchestrator.md#transitions). Ambiguity needs a checkpoint only when interpretations lead to different irreversible or outward actions. If all interpretations are reversible and in scope, choose one, record it, and continue. Reading, read-only checks, in-scope edits, and this run's handoff writes need no ritual checkpoint.

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
- [declare-mutation-limits](./declare-mutation-limits.md#approval)
- [keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md#transitions)
- [validate-by-observation](./validate-by-observation.md)
