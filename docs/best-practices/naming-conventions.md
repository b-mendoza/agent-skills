# naming-conventions

## Tier

`optional-style`. This is a repo style convention, not an evidence-
backed universal standard; it should not block a skill unless strict
repo style is the explicit task.

## When it applies

When naming a new first-party skill directory, subagent file, or
YAML frontmatter `name` field in this repository.

## The practice

Use this convention for first-party skills in this repository so file
listings, registry tables, and dispatch prompts stay predictable.

- **Skills use gerund form** because they describe ongoing
  activities: `analyzing-data`, `deploying-service`,
  `creating-jira-subtasks`, `orchestrating-jira-workflow`.
- **Subagents use role nouns** because they describe specialists
  performing work: `log-analyzer`, `code-reviewer`,
  `task-executor`, `progress-tracker`.
- **Frontmatter names use kebab-case** and match the directory or
  file name exactly.

```yaml
---
name: "orchestrating-jira-workflow"
---
```

## Rationale

The gerund/role-noun split is small but informative. A reader
glancing at a `skills/` directory listing can tell from the verb
form whether a directory is a workflow (`analyzing-data`,
gerund — an ongoing activity the skill performs) or a single role
(`code-reviewer`, role noun — a specialist that does one bounded
thing). Mixed conventions force the reader to open files to tell the
two apart.

The kebab-case-matches-directory rule closes a sneaky failure mode:
a frontmatter `name: "OrchestratingJiraWorkflow"` next to a
directory `orchestrating-jira-workflow/` causes runtime dispatch to
fail in environments that look up skills by name. Forcing identity
between the directory name, file name (for subagents), and
frontmatter `name` removes that class of bug.

The `optional-style` tier reflects that this convention is repo-
specific, not evidence-backed: another repository may pick a
different split (noun/verb, or always role nouns) and be just as
correct. The rule is for predictability inside this repo, not a
universal claim.

## Concrete examples

Good: skill is a gerund, subagent is a role noun, frontmatter
matches directory.

```text
skills/
├── orchestrating-jira-workflow/
│   ├── SKILL.md                              (frontmatter name: "orchestrating-jira-workflow")
│   └── subagents/
│       ├── ticket-fetcher.md                 (frontmatter name: "ticket-fetcher")
│       └── artifact-validator.md             (frontmatter name: "artifact-validator")
```

Bad: skill is a verb phrase, subagent is a gerund, frontmatter name
does not match the directory.

```text
skills/
├── do_jira_work/                             (snake_case + verb phrase)
│   ├── SKILL.md                              (frontmatter name: "DoJiraWork")
│   └── subagents/
│       ├── fetching-the-ticket.md            (gerund instead of role noun)
│       └── ValidatingArtifacts.md            (PascalCase, doesn't match file basename)
```

## References

- Google Developer Documentation Style Guide, "Filenames," accessed
  2026-06-03:
  <https://developers.google.com/style/filenames>. Supports kebab-
  case for filenames as a documentation convention.
- Microsoft Writing Style Guide, "Capitalization," accessed
  2026-06-03:
  <https://learn.microsoft.com/en-us/style-guide/capitalization>.
  Supports lowercase, hyphenated naming for predictable web and
  filesystem paths.
