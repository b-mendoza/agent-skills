# naming-conventions

## Tier

`optional-style`. This file owns only the morphology preference —
which word forms to use when naming skills and subagents. The
load-bearing identity rule (frontmatter `name` must exactly match
the kebab-case directory or file name, or runtime dispatch breaks)
is **not** optional; it lives in
[frontmatter-contract](./frontmatter-contract.md) and is checked on
every edit regardless of style.

## When it applies

When choosing a name for a new first-party skill directory or
subagent file in this repository. Established names are not renamed
to satisfy this preference.

## The practice

- **Prefer gerund form for new skills** when it reads naturally:
  `analyzing-data`, `deploying-service`, `creating-work-item-children`,
  `orchestrating-workflow`. When a noun phrase is the clearer name
  (`council-of-advisors`, `pr-creator`, `recency-guard`), use it —
  clarity beats conformance.
- **Prefer role nouns for subagents** because they describe
  specialists performing bounded work: `log-analyzer`,
  `code-reviewer`, `task-executor`, `progress-tracker`.
- **Preserve clear established names.** Renaming a published skill
  to satisfy morphology is churn: it breaks user habits, external
  references, and dispatch strings for zero behavioral gain.

## Rationale

The gerund/role-noun split is small but informative: a reader
glancing at a `skills/` listing can often tell a workflow (ongoing
activity) from a specialist (bounded role) without opening files.
But this repository's own history shows the split is a preference,
not a rule — roughly a third of first-party skills use natural noun
phrases, and they are among the most-used skills. The convention
earns a nudge at naming time, never a rename after.

## Concrete examples

Good: new workflow skill named as a gerund, subagents as role nouns.

```text
skills/
├── orchestrating-workflow/
│   └── subagents/
│       ├── ticket-fetcher.md
│       └── artifact-validator.md
```

Also good: established or naturally-nominal names kept as-is.

```text
skills/
├── council-of-advisors/     (noun phrase; the clear name for what it is)
├── pr-creator/              (role noun at the skill level; established)
```

Bad: snake_case, PascalCase, or names that fight the filesystem.

```text
skills/
├── do_jira_work/                (snake_case + verb phrase)
│   └── subagents/
│       └── ValidatingArtifacts.md  (PascalCase, gerund role)
```

## References

- Google Developer Documentation Style Guide, "Filenames," accessed
  2026-06-03:
  <https://developers.google.com/style/filenames>. Supports kebab-
  case for filenames as a documentation convention.
