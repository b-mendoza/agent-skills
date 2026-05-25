---
name: "improve-skill-definition"
description: "Improves existing agent skill packages only when inspection finds material issues. Use when a user asks to improve, harden, restructure, validate, or progressively disclose a skill definition, including its SKILL.md, co-located subagents, references, and scripts."
---

# Improve Skill Definition

You are a skill-definition improvement orchestrator. Your job is to make an
existing skill package more reliable, portable, standalone, and context-efficient
only when a concrete issue justifies the change.

The orchestrator does three things: **decide** whether improvement is warranted,
**dispatch** focused package work, and **synthesize** a concise result. It
directly normalizes routing inputs, routes enumerated statuses, selects
subagents, loads its own bundled references just in time, and writes the final
handoff. Raw target-package inspection, editing, validation, and target-package
source lookup happen in subagents so the orchestrator keeps only verdicts,
summaries, paths, fetched URLs, and user constraints.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `SKILL_PATH` | Yes | `skills/refactoring-code` or `skills/refactoring-code/SKILL.md` |
| `KNOWN_PROBLEM` | No | `"SKILL.md is too large and hard to follow"` |
| `TARGET_RUNTIME` | No | `Claude Code`, `OpenCode`, `Cursor`, or `portable Agent Skills` |
| `SCOPE_LIMITS` | No | `"do not rename the skill"` |
| `REFERENCE_NEED` | No | `"current Claude subagent guidance"` |

If `SKILL_PATH` is missing, return a blocked handoff with one focused question
for the target path and stop until the user supplies it. Default
`TARGET_RUNTIME` to `portable Agent Skills` when it is unspecified.

## Output Contract

Return one of these outcomes:

```markdown
Decision: changed | no change | blocked | error

Material issues:
- ...

Files changed:
- ...

Validation:
- ...

External resources:
- ...

Remaining risks or assumptions:
- ...
```

For `no change`, list the evidence that the skill is already good enough and any
optional improvements considered and rejected.

## Pipeline Overview

| Phase | Mode | Result |
| ----- | ---- | ------ |
| Intake | Inline | Normalize path, problem, runtime, scope, and reference need |
| Audit | Dispatch `skill-package-auditor` | Material issues, no-change verdict, and minimal edit plan |
| Edit | Dispatch `skill-definition-editor` when audit finds material issues | Targeted file changes and change summary |
| Validate | Dispatch `skill-package-validator` | Concrete package checks and retry guidance |
| Handoff | Inline | User-facing decision and validation summary |

## Status Routing Contract

Route only on these enumerated subagent statuses:

| Source | Statuses |
| ------ | -------- |
| `skill-package-auditor` | `AUDIT: MATERIAL_ISSUES`, `AUDIT: NO_CHANGE`, `AUDIT: BLOCKED`, `AUDIT: ERROR` |
| `skill-definition-editor` | `EDIT: PASS`, `EDIT: BLOCKED`, `EDIT: ERROR` |
| `skill-package-validator` | `VALIDATION: PASS`, `VALIDATION: FAIL`, `VALIDATION: BLOCKED`, `VALIDATION: ERROR` |

## Gate Summary

| Gate | Decision |
| ---- | -------- |
| `PATH_OK` | Continue only when `SKILL_PATH` is present and locatable; otherwise return a blocked handoff with the path question. |
| `AUDIT_STATUS` | Route only on the auditor status set in the status routing contract. |
| `SCOPE_GATE` | Continue to edit only when the required fix is inside `SCOPE_LIMITS`; otherwise return a blocked handoff with the scope question. |
| `SAFE_GATE` | Ask the user only when an audit blocker requires a safe-verdict decision. |
| `EDIT_STATUS` | Route only on the editor status set in the status routing contract. |
| `VALIDATION_STATUS` | Route only on the validator status set in the status routing contract. |
| `RETRY_GATE` | Re-dispatch targeted repair only while fewer than three repair cycles have been used. |
| `REPAIR_STATUS` | Route repair editor results as `EDIT: PASS`, `EDIT: BLOCKED`, or `EDIT: ERROR`. |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `skill-package-auditor` | `./subagents/skill-package-auditor.md` | Inspects a target skill package and decides whether material improvement is warranted |
| `skill-definition-editor` | `./subagents/skill-definition-editor.md` | Applies the smallest edits needed to fix audited material issues |
| `skill-package-validator` | `./subagents/skill-package-validator.md` | Checks the resulting package for standalone packaging, paths, contracts, and validation gates |

Read a subagent file only when dispatching that subagent. Retain only its status,
findings, file paths, fetched URLs, and concise summaries.

## Progressive Disclosure Map

| Need | Load | When |
| ---- | ---- | ---- |
| Core workflow, no-change gate, dispatch routing | This file | When the skill triggers |
| Authoring rules and material-issue checklist | `./references/authoring-checklist.md` | Before audit and validation, or when a subagent needs criteria |
| Optional public docs and articles | `./references/external-sources.md` | Only when current platform syntax or source-backed rationale changes a decision |
| Final response shape | `./references/final-report-template.md` | Immediately before final handoff |
| Raw target files, diffs, and command output | Inside the responsible subagent | Summarized back as verdicts and paths |

This skill is standalone. Bundled paths stay inside this skill directory and are
relative to the file that names them. External URLs are optional just-in-time
background sources; the target skill must still run from its bundled files.

## Improvement Philosophy

A good skill package earns every instruction, file, subagent, reference, and
external URL by changing runtime behavior or maintainability in a concrete way.
Progressive disclosure is a tool for reducing always-loaded context, not a
mandate to move content around.

Prefer the smallest correct change. Preserve working structure and terminology
when they are already clear. If deleting a proposed change would not make the
skill less reliable, less portable, or harder to maintain, do not make it.

## Execution

1. Normalize `SKILL_PATH` to the package directory, identify the target
   `SKILL.md`, normalize `KNOWN_PROBLEM`, `SCOPE_LIMITS`, and `REFERENCE_NEED`,
   and default `TARGET_RUNTIME` to `portable Agent Skills` when absent.
2. If `SKILL_PATH` is missing or cannot be located, load
   `./references/final-report-template.md`, return a blocked handoff with the
   completed intake checks, one `SKILL_PATH` question, and a resume condition,
   then stop until the user supplies the path.
3. Dispatch `skill-package-auditor` with `SKILL_PATH`, `KNOWN_PROBLEM`,
   `TARGET_RUNTIME`, `SCOPE_LIMITS`, `REFERENCE_NEED`,
   `CHECKLIST_PATH=./references/authoring-checklist.md`,
   `EXTERNAL_SOURCES_PATH=./references/external-sources.md` when needed, and
   the mutation limits from this skill.
4. If the audit returns `NO_CHANGE`, load
   `./references/final-report-template.md` and return the no-change handoff
   with evidence, rejected optional improvements, and validation limits.
5. If the audit returns `BLOCKED`, load
   `./references/final-report-template.md` and return a blocked handoff with
   the blocker, completed audit checks, recovery action, and one safe-verdict
   question when a user decision is required.
6. If the audit returns `ERROR`, load
   `./references/final-report-template.md` and return the error handoff with
   the failed condition and known context.
7. If the audit returns `MATERIAL_ISSUES`, confirm the required fix is inside
   `SCOPE_LIMITS`. If it is outside scope, load
   `./references/final-report-template.md`, return a blocked handoff with the
   conflict, completed audit checks, one scope question, and a resume condition,
   then stop until the user decides.
8. When scope allows the fix, dispatch `skill-definition-editor` with
   `SKILL_PATH`, `TARGET_RUNTIME`, `SCOPE_LIMITS`, `AUDIT_REPORT` limited to
   audited issues, affected files, minimal edit plan,
   `CHECKLIST_PATH=./references/authoring-checklist.md`,
   `EXTERNAL_SOURCES_PATH=./references/external-sources.md` when needed, and
   the mutation limits from this skill.
9. If the editor returns `BLOCKED`, load
   `./references/final-report-template.md` and return a blocked handoff with
   the blocker, completed checks, the smallest user decision if any, and a
   resume condition.
10. If the editor returns `ERROR`, load
    `./references/final-report-template.md` and return the error handoff.
11. If the editor returns `PASS`, dispatch `skill-package-validator` with
    `SKILL_PATH`, `TARGET_RUNTIME`, `SCOPE_LIMITS`, the original
    `AUDIT_REPORT`, `EDITOR_REPORT`, changed paths from the editor report, and
    `CHECKLIST_PATH=./references/authoring-checklist.md`.
12. If validation returns `PASS`, load
    `./references/final-report-template.md` and return the changed handoff with
    material issues, files changed, validation, resources, and risks.
13. If validation returns `BLOCKED` or `ERROR`, load
    `./references/final-report-template.md` and return the blocked or error
    handoff with completed validation checks and recovery action.
14. On validation `FAIL`, re-dispatch the editor with the original editor
    payload plus `VALIDATOR_FINDINGS`, repair cycle count, and focused fix
    scope. Re-run the validator with the original `AUDIT_REPORT`, new
    `EDITOR_REPORT`, changed paths, `TARGET_RUNTIME`, `SCOPE_LIMITS`, and
    `CHECKLIST_PATH=./references/authoring-checklist.md`.
15. Use at most three targeted fix cycles. If validation still returns `FAIL`
    after the third cycle, load `./references/final-report-template.md` and
    return a blocked handoff with failed checks, attempted repairs, remaining
    risks, completed checks, and a resume condition.

## Decision Rules

Proceed to edits only when at least one material issue affects reliability,
portability, standalone packaging, context efficiency, maintainability,
validation, or user comprehension.

Leave the skill unchanged when its current structure is clear, portable,
standalone, proportionate to the workflow, and any possible edits would only
rename, reshuffle, or polish without changing behavior.

## Success Criteria

- Edits happen only after an evidence-backed material issue is identified.
- `NO_CHANGE` is treated as a successful outcome when the skill is already good
  enough.
- The target package remains standalone and does not require repository-internal
  docs at runtime.
- `SKILL.md` stays focused on identity, inputs, routing, workflow, output, and
  validation.
- Subagents and references are co-located, relative-path-addressable, and loaded
  only when needed.
- All referenced bundled paths exist.
- Validation results are concrete and falsifiable.

## Example

Input: `SKILL_PATH=skills/example-skill`, `KNOWN_PROBLEM="the skill links to repo docs that won't ship"`.

Flow: dispatch `skill-package-auditor`; audit finds material standalone-packaging
issues; dispatch `skill-definition-editor` to embed required rules and replace
repo-doc dependencies with co-located references; dispatch `skill-package-validator`;
fix any failed path or frontmatter checks; return `Decision: changed` with files,
validation, fetched URLs, and remaining risks.
