# Quality Checklist

Read this file before final delivery or when fixing review failures. Use it as
a validation gate, not as always-loaded prompt content.

## Core Checks

| Check | Pass condition |
| ----- | -------------- |
| Frontmatter | Each `name` is kebab-case and matches the containing folder or subagent file basename |
| Description | Third-person, specific trigger contexts, no XML tags, concise enough for discovery |
| `SKILL.md` size | Under 500 lines and limited to identity, inputs, routing, registry, workflow, output, validation |
| Path validity | Every local path referenced in `SKILL.md` exists and uses forward slashes |
| One-hop references | `SKILL.md` links directly to all bundled references; references do not form required chains |
| Standalone package | No dependency on source-repository docs, local absolute paths, tickets, branches, or private configs |
| Progressive disclosure | Detailed templates, examples, checklists, and source links live outside `SKILL.md` |
| Subagent contracts | Each subagent has inputs, instructions, output format, scope, and escalation |
| Context protection | Execution-heavy work is delegated; orchestrator receives summaries, paths, or verdicts |
| External links | Links are optional just-in-time sources; local package still explains core behavior |
| Validation loop | The skill defines run/check/fix/re-check behavior with a retry limit |
| Examples | At least one dispatch or output example shows expected behavior |

## Standalone Checks

- Generated artifacts include every file they reference, except external URLs.
- Generated text does not mention repository-local authoring guides outside the package.
- Instance-specific values are inputs, not hardcoded constants.
- Runtime-specific frontmatter is included only when the target runtime requires it.

## Progressive Disclosure Checks

- `SKILL.md` tells the agent what to load, when, and why.
- Long templates or detailed checklists are kept in bundled reference files.
- Subagent files are read only when dispatched.
- External sources replace long static explanations but do not become mandatory
  for normal execution.

## Fix Loop

1. Review against the checklist.
2. If a check fails, report the exact file and smallest required fix.
3. Apply only the targeted fix.
4. Re-run only the failed check group.
5. Stop after three fix cycles and escalate if the same class of issue remains.

## Review Output

```markdown
REVIEW: PASS | FAIL | BLOCKED | ERROR

## Findings
| Severity | File | Issue | Required Fix |
| -------- | ---- | ----- | ------------ |

## Checks
- Frontmatter:
- Referenced paths:
- Progressive disclosure:
- Standalone packaging:
- Subagent contracts:
- Validation loop:

## Summary
- Verdict:
- Fix cycles recommended:
- Remaining risks:
```
