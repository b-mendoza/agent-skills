# Project State Snapshot Template

The writer returns a Markdown report body titled `# Project State Snapshot`. The orchestrator strips all status wrappers and `Inspected:` metadata before final output.

## Full Report Shape

1. `## 1. Executive Summary`
2. `## 2. Git State`
3. `## 3. Change Themes`
4. `## 4. Behavioral Impact`
5. `## 5. Risks`
6. `## 6. Test And Validation Review`
7. `## 7. Dependency, Config, Tooling, And Security Notes`
8. `## 8. Questions Before Merging`
9. `## 9. Ranked Next Actions`
10. `## 10. Final Developer Briefing`

Section names are canonical identifiers: required fixes, fix dispositions, and repair targeting all address sections by these names, so each required section's name must appear verbatim in its heading. The order and numbering above are the recommended presentation, not a gate — a report that carries its required sections under their canonical names conforms.

## Section Requirements

Git state must include branch/upstream, base branch or `none`, repo state, evidence window, context limitations, and these two required disclosure fields:

- `Assumptions:` — the `ASSUMPTIONS` input entries copied over (resolved `PROJECT_PATH`, base-ladder rung, input fallbacks, any `User decision:`), or `none` only when that input is `none`.
- `Execution mode:` — the `EXECUTION_MODE` input value, copied verbatim; never inferred from observed context.

Both fields are required in the full and quiet-state shapes and each appears exactly once in the report — inside Git State by recommended placement — so a reader can always tell a fully isolated verified run from a weaker one.

Change themes should name files or groups, evidence, fact-or-inference cause, risk level, and what to review.

Risk rows should include severity, area, finding, evidence, why it matters, confidence, and action. Behavioral impact must separate confirmed, likely, possible, and unverified impacts, using the claim-discipline labels below. Validation review should distinguish observed validation from recommended validation.

Ranked next actions use `must-do`, `should-do`, and `nice-to-have` ordering. The final briefing should state how a developer can continue safely.

## Depth Rules

| Depth | Expected shape |
| --- | --- |
| `brief` | Concise summary, top risks, minimal tables, only obvious validation gaps |
| `standard` | Complete sections with enough evidence for handoff and review |
| `deep` | More surrounding context for changed high-risk areas, within the hard inspection cap |

## Focus Emphasis Rules

| Focus | Writer emphasis |
| --- | --- |
| `full` | Balanced treatment across touched areas |
| `security` | Lead security-relevant risks in section 5; expand section 7 security notes |
| `tests` | Expand section 6; make test gaps prominent in next actions |
| `dependencies` | Expand dependency notes with semver, lockfile, and supply-chain framing |
| `config` | Expand config/tooling notes with drift, secret-bearing diff, and environment-risk framing |

Focus narrows emphasis, not evidence. Off-focus blockers still appear.

## Quiet-State Short Form

When the working tree is clean and the evidence window is empty, use only Executive Summary, Git State, Ranked Next Actions, and Final Developer Briefing. State explicitly that there are no recent changes in the defined window. Do not invent risks, themes, or validation work.

This short form is complete and correct as-is. Omitting the other six sections is the contract, not a defect, and the verifier checks it only on the rows scoped `Always`. Git State still carries `Assumptions:` and `Execution mode:`.

A filled short form looks exactly like this (values vary; shape does not):

```markdown
# Project State Snapshot

## 1. Executive Summary

No recent changes in the defined window: the working tree is clean and no commits exist between the base and HEAD.

## 2. Git State

Branch main tracking origin/main; repo state normal; base origin/main (upstream of HEAD); evidence window origin/main-to-HEAD, 0 commits; no context limitations.
Assumptions: none
Execution mode: isolated

## 9. Ranked Next Actions

- nice-to-have: nothing pending in this window; continue planned work.

## 10. Final Developer Briefing

The repository is quiet: clean tree, no unmerged recent work. Safe to start new work from main.
```

## Claim Discipline

Use these labels when evidence is partial:

- `confirmed`: directly supported by Git evidence, inspected code, or cited source.
- `likely`: supported by local evidence but not fully validated.
- `possible`: plausible from changed files or context, but unverified.
- `unverified`: requires a command, test, owner decision, or external fact not observed.
