# Skill Structure Guide

Read this file when designing artifact boundaries, directory layout, input and
output contracts, or portability rules.

## Loading Architecture

| Level | File type | Load timing | Contents |
| ----- | --------- | ----------- | -------- |
| 0 | `SKILL.md` | When the skill triggers | Identity, inputs, routing, subagent registry, short workflow, validation gates |
| 1 | `references/*.md` | Just in time | Detailed templates, examples, checklists, mode guides, external source links |
| 2 | `subagents/*.md` | Only on dispatch | Specialist instructions, contracts, scope, escalation |
| Script | `scripts/*` | Execute, not read, when deterministic work is needed | Validation, conversion, parsing, or other fragile logic |

Keep `SKILL.md` under 500 lines. Put static explanations, large examples, and
templates in one-hop reference files. Avoid reference chains where a reference
file requires another reference file before it is useful.

## Portable Directory Shape

```text
skill-name/
├── SKILL.md
├── subagents/
│   ├── role-noun.md
│   └── reviewer.md
├── references/
│   ├── mode-guide.md
│   └── templates.md
├── scripts/
└── assets/
```

Use only the directories the package needs. Paths in generated files are
relative to the skill root and use forward slashes.

## Frontmatter

Use the lowest common denominator unless a runtime-specific feature is required:

```yaml
---
name: "skill-name"
description: "Third-person description of what the skill does and when to use it."
---
```

For subagents, `name` matches the subagent file basename and `description`
states when the orchestrator should delegate to it. Add runtime-specific fields
only when the target runtime requires them and the source docs have been checked.

## Naming

| Artifact | Convention | Example |
| -------- | ---------- | ------- |
| Skill | Gerund preferred; kebab-case; matches containing folder | `reviewing-pull-requests` |
| Subagent | Role noun; kebab-case; matches file basename | `test-runner` |
| Reference | Topic or phase name | `quality-checklist.md` |
| Script | Verb-object name | `validate-contracts.py` |

When improving an existing skill, preserve the existing directory and
frontmatter name unless the user explicitly asks for a rename.

## Artifact Selection

| Artifact | Use when |
| -------- | -------- |
| Skill | The user needs reusable orchestration, routing, or a domain workflow |
| Subagent | Work is self-contained and can return a concise result to the orchestrator |
| Slash command | The workflow is short, explicit, and invoked by name |
| Reference | Content is static, detailed, example-heavy, or phase-specific |
| Script | Deterministic validation or transformation is more reliable as code |

## Subagent Registry

Place the registry near the top of `SKILL.md` for any skill that delegates:

```markdown
## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `<role-noun>` | `./subagents/<role-noun>.md` | Returns a concise verdict, summary, or artifact path |
```

The orchestrator uses the registry to choose a subagent without reading every
subagent definition.

## Contracts

Every skill and subagent defines explicit inputs and outputs. Prefer passing
rich source values, such as URLs or file paths, over pre-extracted fragments
when the receiving artifact can derive what it needs.

Input table:

```markdown
| Input | Required | Example |
| ----- | -------- | ------- |
| `SOURCE_URL` | Yes | `https://example.com/item/123` |
```

Output contract:

````markdown
## Output Format

```markdown
STATUS: PASS | FAIL | BLOCKED
Summary:
Artifacts:
Next action:
```
````

## Standalone Packaging

A downloaded skill cannot rely on source-repository docs, task files, local
paths, or project-specific configuration. Include required behavior in the
skill package, accept instance-specific values as inputs, and link external
websites only as optional just-in-time source material.
