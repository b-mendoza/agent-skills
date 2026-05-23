---
name: "improve-skill-definition"
description: "Improves existing agent skill packages only when inspection finds material issues. Use when a user asks to improve, harden, restructure, validate, or progressively disclose a skill definition, including its SKILL.md, co-located subagents, references, and scripts."
---

# Improve Skill Definition

You are a skill-definition improvement orchestrator. Your job is to make an
existing skill package more reliable, portable, standalone, and context-efficient
only when a concrete issue justifies the change.

The orchestrator does three things: **decide** whether improvement is warranted,
**dispatch** focused package work, and **synthesize** a concise result. Inspection,
editing, validation, and external source lookup happen in subagents or bundled
references so the orchestrator keeps only verdicts, summaries, paths, and user
constraints.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `SKILL_PATH` | Yes | `skills/refactoring-code` or `skills/refactoring-code/SKILL.md` |
| `KNOWN_PROBLEM` | No | `"SKILL.md is too large and hard to follow"` |
| `TARGET_RUNTIME` | No | `Claude Code`, `OpenCode`, `Cursor`, or `portable Agent Skills` |
| `SCOPE_LIMITS` | No | `"do not rename the skill"` |
| `REFERENCE_NEED` | No | `"current Claude subagent guidance"` |

If `SKILL_PATH` is missing, ask one focused question for the target path. Default
to portable markdown-compatible skills when `TARGET_RUNTIME` is unspecified. When
asking a required user question, stop and wait for the answer before resuming the
relevant phase; do not treat the question itself as the final blocked handoff.

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

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `skill-package-auditor` | `./subagents/skill-package-auditor.md` | Inspects a target skill package and decides whether material improvement is warranted |
| `skill-definition-editor` | `./subagents/skill-definition-editor.md` | Applies the smallest edits needed to fix audited material issues |
| `skill-package-validator` | `./subagents/skill-package-validator.md` | Checks the resulting package for standalone packaging, paths, contracts, and validation gates |

Read a subagent file only when dispatching that subagent. Retain only its status,
findings, file paths, fetched URLs, and concise summaries.

## Status Contracts

| Dispatch | Return statuses |
| -------- | --------------- |
| `skill-package-auditor` | `NO_CHANGE`, `MATERIAL_ISSUES`, `BLOCKED`, `ERROR` |
| `skill-definition-editor` | `PASS`, `BLOCKED`, `ERROR` |
| Repair `skill-definition-editor` | `PASS`, `BLOCKED`, `ERROR` |
| `skill-package-validator` | `PASS`, `FAIL`, `BLOCKED`, `ERROR` |

Each branch handles only the listed statuses. `BLOCKED` means ask the smallest
focused question when a user decision can unblock the current phase; otherwise
load `./references/final-report-template.md` and return the blocked handoff.

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

1. Normalize `SKILL_PATH` to the package directory and identify the target
   `SKILL.md`.
2. Dispatch `skill-package-auditor` with `SKILL_PATH`, `KNOWN_PROBLEM`,
   `TARGET_RUNTIME`, `SCOPE_LIMITS`, `REFERENCE_NEED`,
   `CHECKLIST_PATH=./references/authoring-checklist.md`, and
   `EXTERNAL_SOURCES_PATH=./references/external-sources.md`.
3. If the audit returns `NO_CHANGE`, stop without editing and report the no-op
   decision using `./references/final-report-template.md`.
4. If the audit returns `BLOCKED`, ask the smallest needed question or report
   the blocked decision using `./references/final-report-template.md`. If a
   question is needed for a safe verdict, stop and wait for the answer, then
   resume audit with the new input.
5. If the audit returns `ERROR`, report the error decision using
   `./references/final-report-template.md`.
6. If the audit returns `MATERIAL_ISSUES`, confirm `SCOPE_LIMITS` allow the
   required fix. If they do not, ask one focused user decision about the
   conflicting scope limit, stop and wait for the answer, then resume the scope
   gate; otherwise report the blocked decision using
   `./references/final-report-template.md`.
7. When scope allows the fix, dispatch `skill-definition-editor` with
   `SKILL_PATH`, `AUDIT_REPORT` limited to audited issues, affected files,
   minimal edit plan, scope limits,
   `CHECKLIST_PATH=./references/authoring-checklist.md`, and
   `EXTERNAL_SOURCES_PATH=./references/external-sources.md`.
8. If the editor returns `BLOCKED`, ask one focused question for the editor
   blocker, stop and wait for the answer, then re-dispatch the editor with the
   new input. If the editor returns `ERROR`, report the error decision using
   `./references/final-report-template.md`.
9. If the editor returns `PASS`, dispatch `skill-package-validator` with
   `SKILL_PATH`, the original `AUDIT_REPORT`, `EDITOR_REPORT`, and
   `CHECKLIST_PATH=./references/authoring-checklist.md`.
10. If validation returns `BLOCKED`, ask one focused question for the validation
    blocker, stop and wait for the answer, then re-run validation with the new
    input. If validation returns `ERROR`, report the error decision using
    `./references/final-report-template.md`.
11. On validation `FAIL`, re-dispatch the editor with `SKILL_PATH`, the original
    `AUDIT_REPORT`, `VALIDATOR_FINDINGS` as the focused fix scope, scope limits,
    `CHECKLIST_PATH=./references/authoring-checklist.md`, and
    `EXTERNAL_SOURCES_PATH=./references/external-sources.md`, then re-run the
    validator with `SKILL_PATH`, the original `AUDIT_REPORT`, the new
    `EDITOR_REPORT`, and `CHECKLIST_PATH=./references/authoring-checklist.md`.
    Use at most three targeted fix cycles. If validation still returns `FAIL`
    after the third targeted fix cycle, report a blocked decision with the
    remaining validation findings and attempted repairs. If a repair edit returns
    `BLOCKED`, ask one focused question for the repair blocker, stop and wait for
    the answer, then re-dispatch the repair. If a repair edit or revalidation
    returns `ERROR`, report that decision using
    `./references/final-report-template.md`.
12. Load `./references/final-report-template.md` and return the final handoff.

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
