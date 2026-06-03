# artifact-lifecycle

## Tier

`mandatory`. Mishandled artifacts leak sensitive content into git,
strand resumability state, or commit ephemeral payloads into the
repository's version-control record; the rules close those failures
explicitly.

## When it applies

Whenever a skill produces files — progress files, plans, ticket
snapshots, handoff files, audit reports, validator findings, source-
code changes, tests, or generated configs.

## The practice

Distinguish between orchestration artifacts (working documents that
track or carry workflow state) and implementation artifacts (source
code, tests, configs that are the workflow's output). Apply
different lifecycle rules to each, and separate persistent
orchestration records from ephemeral dispatch payloads.

Two categories with three sub-categories:

| Category | Contents                                                                                         | Committed to git | Deleted                                                                               |
| -------- | ------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------- |
| A1       | Persistent orchestration records: progress files, plans, ticket snapshots, decision logs         | Never            | Preserve until the workflow no longer needs resumability or the user approves cleanup |
| A2       | Ephemeral orchestration payloads: handoff files, temporary dispatch instructions, retry payloads | Never            | Delete after terminal dispatch cleanup unless retained for debugging                  |
| B        | Implementation: source code, tests, configs, documentation                                       | Yes              | Normal rules                                                                          |

**Why preserve Category A1.** Persistent orchestration records
enable resumability. If a workflow is interrupted by user choice,
error, or session timeout, progress files and planning artifacts
allow the workflow to resume from exactly where it left off.
Deleting them forces a restart.

**Why delete Category A2.** Ephemeral orchestration payloads are
point-in-time instructions for a specific dispatch. Once the
dispatch succeeds, is abandoned, or reaches a terminal blocked/error
state, stale payloads become misleading. Delete them as part of
workflow cleanup unless the user asks to preserve them for
debugging.

**Sensitivity and retention.** Category A artifacts can contain user
prose, copied web content, command output, diffs, ticket text, API
responses, credentials accidentally exposed in logs, or prompt-
injection payloads. Preserve only the orchestration records needed
for resumability, store them in ignored workflow locations, and
redact or exclude secrets and unnecessary personal data before
writing them. Clean up Category A1 records when resumability is no
longer needed or when the user approves cleanup; clean up Category
A2 records at terminal dispatch cleanup unless they are
intentionally retained for debugging.

**Key rule.** Never commit Category A artifacts to version control.
They are working documents that belong to the workflow session, not
to the committed project artifact. Preserve Category A1 while it is
needed for resumability; clean up Category A2 when its dispatch
lifecycle ends. Only Category B artifacts (the actual output of the
workflow) are staged and committed.

## Rationale

Two failure modes drive every rule:

- **Untrusted content in commit history.** A handoff file generated
  during an audit can contain copied user prose, web content,
  pasted command output, ticket text, or credentials accidentally
  printed in logs. Committing it propagates that content into
  every clone of the repository and into every CI run. Categorizing
  the file as Category A2 and refusing to stage it closes the
  channel.
- **Stale ephemeral payloads.** A handoff file from a failed
  dispatch left in `.handoffs/` looks valid to a future dispatch
  that reads the same path. The future dispatch can route on stale
  state, producing a fluent-looking failure with no obvious cause.
  Deleting Category A2 at terminal cleanup closes that failure.

Resumability is the third concern, and Category A1 exists to serve
it without conflating it with ephemeral dispatch state.

## Concrete examples

Good: a planning artifact is Category A1; the handoff payload that
drove its production is Category A2; the source files it implies are
Category B. `.gitignore` excludes Category A2; Category A1 lives in
a path the repo intentionally keeps.

```text
.handoffs/improving-skill-definition/                     (A2; .gitignored)
├── flow-coherence-auditor-instructions.yaml              (delete on success)
└── flow-coherence-auditor-report.yaml                    (delete on success)

docs/PROJ-123-tasks.md                                    (A1; committed=No, preserved while in progress)

skills/improving-skill-definition/SKILL.md                (B; committed)
```

Bad: handoff payloads get staged and committed because "they look
like documentation."

```text
.handoffs/improving-skill-definition/
└── personality-auditor-instructions.yaml                 (got committed; now contains copied user prose
                                                            and pasted ticket text, forever in repo
                                                            commits)
```

## References

- OWASP Top 10 for LLM Applications, accessed 2026-05-27:
  <https://owasp.org/www-project-top-10-for-large-language-model-applications/>.
  Supports treating sensitive information disclosure and prompt
  injection as risks in agent workflows.
- NIST AI Risk Management Framework, accessed 2026-05-27:
  <https://www.nist.gov/itl/ai-risk-management-framework>. Supports
  risk-based governance and lifecycle management for AI systems.
