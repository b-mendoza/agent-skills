# mutation-scope-boundaries

## Tier

`mandatory`. Implicit mutation scope is a primary data-loss failure
mode; every mutating skill needs an explicit `MUTATION_LIMITS`
contract.

## When it applies

Whenever a skill mutates files — edits, creates, deletes, renames,
or moves. Skills that produce only stdout or in-memory artifacts do
not need this practice.

## The practice

When a skill mutates files, it declares an explicit
**`MUTATION_LIMITS`** contract before any edit happens. The contract
enumerates which paths the skill is allowed to write, which paths
are categorically excluded, how the user can explicitly expand the
default scope, and how the scope tightens during repair cycles after
a failed validation.

`MUTATION_LIMITS` is derived once at intake and passed to every
dispatched subagent in the same workflow run. Every edit is gated on
the limits; a planned edit outside the limits is either blocked or
escalated to the user for an explicit scope expansion before the edit
lands.

Rules:

1. **Derive `MUTATION_LIMITS` once, during intake.** The orchestrator
   computes the limits as part of its first phase, before any audit,
   plan, or edit. The limits are a single named artifact that flows
   through the workflow, not a value re-derived in every subagent.
2. **Pass `MUTATION_LIMITS` to every dispatched subagent.** Subagents
   that plan, edit, or validate read the contract as part of their
   handoff payload. They never re-derive their own scope. This keeps
   the orchestrator's intake the single source of truth for "what may
   be written" in this run.
3. **State limits as positive obligations first.** Open the contract
   with the in-scope clause ("Write only inside …"). Reserve negation
   for the categorical exclusions list ("Out of scope: …"). This
   matches
   [positive constraint framing](./positive-constraint-framing.md)
   and gives a planner a fast in-bounds check before evaluating
   exclusions.
4. **Declare categorical exclusions explicitly.** Some paths are
   *always* out of scope and must be named so subagents don't reason
   about them as borderline cases. Typical exclusions: sibling skill
   packages, tooling-managed mirrors (`.agents/skills/`,
   `.claude/skills/`, `skills-lock.json`), repository-level docs
   (`README.md`, `CLAUDE.md`, `AGENTS.md`) unless the orchestrator
   explicitly authorized them this run, private configuration
   (`.env`, secrets), and runtime artifacts under `.handoffs/` other
   than the workflow's own per-run files.
5. **Preserve identity by default.** Unless an approved gap
   explicitly changes them, the skill must preserve: target package
   directory names, frontmatter `name` fields, declared runtime
   targets, and stated user-facing purpose. Identity-preserving
   defaults stop ad-hoc renames and re-classifications.
6. **Define an explicit scope-expansion path.** State exactly how the
   user can authorize work outside the default limits. The canonical
   form is a `SCOPE_LIMITS` input on the orchestrator that names the
   specific expanded mutation in plain language (e.g., "expand scope
   to rename directory X to Y"). Block the edit if a planned mutation
   falls outside both `MUTATION_LIMITS` and the run's `SCOPE_LIMITS`
   expansions.
7. **Re-scope tighter for repair cycles.** When a validator returns
   `FAIL` and the workflow re-dispatches the editor for a targeted
   repair, the repair-cycle scope is intersected with
   `VALIDATOR_FINDINGS`: change only files tied to the specific
   findings, not every file the editor had access to in the original
   cycle. This prevents repair cycles from widening the change set.
8. **The validator verifies mutation boundaries with baseline-aware
   observable evidence.** Capture the pre-edit working-tree state
   with `git status --short` (or equivalent) before any mutation,
   then compare it with the post-edit state. Every newly changed
   path must appear in the original mutation plan or be authorized
   by the run's `SCOPE_LIMITS`. In a dirty worktree, do not treat
   post-edit `git status` alone as proof of what the workflow
   changed. If an authorized file was already dirty, inspect the
   relevant diff hunks or use an equivalent baseline comparison to
   confirm the workflow did not overwrite unrelated user work.
   Unapproved mutations are validator findings, not silently-
   accepted edits.
9. **Declare deviations from these defaults in the skill's
   `SKILL.md`.** If a skill needs to write outside its package by
   design (cross-package refactors, repo-wide documentation passes,
   tooling-managed regen targets), the deviation must be declared in
   `SKILL.md` per
   [best practices compliance gate](./best-practices-compliance-gate.md).
   The declared deviation names why the wider scope is necessary and
   what the validator should check instead.

## Rationale

Editing skills fail in three predictable ways when mutation scope is
implicit:

1. **Silent over-reach.** A subagent decides "this related file
   looks broken, I'll fix it too." The user never approved that file
   as part of the change set. The fix is correct in isolation but
   ships an unreviewed mutation alongside the approved one.
2. **Cross-package collateral.** A change inside one skill package
   leaks into a sibling package, a tooling-managed mirror directory
   (e.g., `.agents/skills/`, `.claude/skills/`), or a lockfile that
   is supposed to be regenerated by an external tool. Recovery
   requires reverting selected hunks and re-running tooling.
3. **Repair-cycle drift.** A validator fails a check on file A; the
   repair-cycle editor "helpfully" also rewrites files B and C
   because they're nearby. The repair cycle's small targeted fix
   becomes a wider re-edit that re-introduces the conditions for
   another failure.

A declared `MUTATION_LIMITS` contract closes all three failure modes
at once. Subagents that read the contract know exactly what they may
touch; the validator has a positive list to check against; the user
can audit the expanded-scope decision in one place rather than
reconstructing it from a diff.

## Concrete examples

Good: a `MUTATION_LIMITS` block in `SKILL.md` with positive
obligations first, categorical exclusions, repair-cycle tightening.

```markdown
## Default Mutation Limits

Derive `MUTATION_LIMITS` during intake and pass them to every
dispatched subagent. Unless the user explicitly expands scope via
`SCOPE_LIMITS`, use these defaults:

- Write only inside `skills/<target>/`.
- Preserve directory names, frontmatter names, runtime target, and
  user-facing purpose unless an approved gap explicitly allows the
  change.
- Out of scope: sibling packages, `.agents/skills/`, `.claude/skills/`,
  `skills-lock.json`, repository-level docs, private configuration,
  `.handoffs/` files this run did not create.
- During repair cycles, change only files tied to `VALIDATOR_FINDINGS`
  and the original approved gaps.
```

Bad: implicit scope, no `MUTATION_LIMITS`, no repair-cycle rule.

```markdown
## Mutation
The editor fixes files related to the audit findings. Use good
judgment; ask the user if something seems risky.
(Now the editor is free to "fix nearby things," widen scope during
repair, and overwrite a sibling skill's files without anyone
noticing until the diff lands.)
```

## References

- OpenAI, "Understanding prompt injections," accessed 2026-05-27:
  <https://openai.com/safety/prompt-injections/>. Supports limiting
  agent access to only the data and actions needed for the task.
- OWASP Top 10 for LLM Applications, accessed 2026-05-27:
  <https://owasp.org/www-project-top-10-for-large-language-model-applications/>.
  Supports least-privilege and excessive-agency concerns for tool-
  using agents.

## Related practices

- [Positive constraint framing](./positive-constraint-framing.md) —
  the in-scope-first ordering rule applied to mutation contracts.
- [Best practices compliance gate](./best-practices-compliance-gate.md)
  — declared deviations from default mutation scope live in
  `SKILL.md`.
- [Input and output contracts](./input-output-contracts.md) —
  `MUTATION_LIMITS` is a contracted input that flows through the
  workflow.
- [Artifact lifecycle](./artifact-lifecycle.md) — what to do with
  the files mutation produced is the sibling practice; this one
  decides what may be written in the first place.
- [Empirical validation](./empirical-validation.md) — `git status`
  baselines and post-edit evidence are the observable boundary
  checks this practice prescribes.
- [Handoff file dispatch](./handoff-file-dispatch.md) — every
  subagent receives `MUTATION_LIMITS` in its handoff YAML.
