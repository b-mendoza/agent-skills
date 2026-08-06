# Skill Structure Reference

Load this reference when choosing artifact boundaries, package layout, names, frontmatter, or standalone contracts.

## Loading Levels

| Level | Files | Load When |
| --- | --- | --- |
| 0 | `SKILL.md` | Always loaded; identity, inputs, registry, routing, gates |
| 1 | `references/*.md` | Just in time for templates, checklists, source policy, examples |
| 2 | `subagents/*.md` | Only when dispatching that subagent |
| 3 | `scripts/*` | Only when deterministic executable behavior is required |

Keep `SKILL.md` under 500 lines. Move detailed templates, examples, long checklists, source inventories, and phase-specific playbooks to `references/`.

## Portable Directory Shape

```text
skill-name/
├── SKILL.md
├── subagents/
│   └── specialist-name.md
├── references/
│   └── focused-reference.md
├── assets/
│   └── copy-ready-template.md
└── scripts/
    └── optional-deterministic-helper.sh
```

Copy-ready templates for generated packages may live under `assets/`. Static policy, schemas, and checklists stay under `references/`.

## Frontmatter

Use lowest-common-denominator YAML frontmatter:

```yaml
---
name: "skill-name"
description: "Third-person trigger description with use cases."
---
```

The `name` must be lowercase kebab-case and match the containing directory for `SKILL.md` or the file basename for a subagent file. Avoid runtime-specific permission, tool, model, or import fields unless a target runtime explicitly requires them and the package declares the exception.

## Artifact Selection

| Choose | When |
| --- | --- |
| Skill | The workflow needs reusable orchestration, routing, gates, or domain guidance |
| Subagent | A step can run independently and return a bounded verdict, path, or summary |
| Slash command | The user needs a short, explicitly invoked workflow with low ambiguity |
| Reference | Content is static, template-heavy, example-heavy, or phase-specific |
| Script | Deterministic or fragile logic is safer as executable code than prose |

Prefer the smallest artifact that changes reliability, portability, maintainability, context efficiency, validation, or user comprehension. Do not add subagents or references for decoration.

## Contract Patterns

Every non-trivial skill states inputs, output contracts, status routing, mutation limits if it writes files, and validation expectations. Every subagent states inputs, instructions, output format, scope, and escalation statuses.

Use path-based handoffs when artifacts may be large. The orchestrator should retain statuses, paths, ids, and concise summaries, not raw file bodies.

## Standalone Packaging Rules

- All bundled links are relative and stay inside the package.
- Do not link to private repository docs, local absolute paths, sibling package files, or managed mirror locations.
- External URLs are optional evidence, not required package dependencies.
- A downloaded copy of the skill directory must be enough to run the workflow.

## Runtime Portability

Portable default: plain Markdown, minimal frontmatter, explicit subagent registry, and prose capability descriptions. For runtimes without a listed documentation source, use conservative portable syntax, record the assumption, and ask only if the user demanded runtime-exact syntax.
