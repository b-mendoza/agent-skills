# Project State Snapshot Template

The writer returns a Markdown report body titled `# Project State Snapshot`.
The orchestrator strips all status wrappers and `Inspected:` metadata before
final output.

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

## Section Requirements

Git state must include branch/upstream, base branch or `none`, repo state,
evidence window, and context limitations. Change themes should name files or
groups, evidence, fact-or-inference cause, risk level, and what to review.

Risk rows should include severity, area, finding, evidence, why it matters,
confidence, and action. Behavioral impact must separate confirmed, likely, and
possible impacts. Validation review should distinguish observed validation from
recommended validation.

Ranked next actions use `must-do`, `should-do`, and `nice-to-have` ordering.
The final briefing should state how a developer can continue safely.

## Depth Rules

| Depth | Expected shape |
| ----- | -------------- |
| `brief` | Concise summary, top risks, minimal tables, only obvious validation gaps |
| `standard` | Complete sections with enough evidence for handoff and review |
| `deep` | More surrounding context for changed high-risk areas, within inspection budget |

## Focus Emphasis Rules

| Focus | Writer emphasis |
| ----- | --------------- |
| `full` | Balanced treatment across touched areas |
| `security` | Lead security-relevant risks in section 5; expand section 7 security notes |
| `tests` | Expand section 6; make test gaps prominent in next actions |
| `dependencies` | Expand dependency notes with semver, lockfile, and supply-chain framing |
| `config` | Expand config/tooling notes with drift, secret-bearing diff, and environment-risk framing |

Focus narrows emphasis, not evidence. Off-focus blockers still appear.

## Quiet-State Short Form

When the working tree is clean and the evidence window is empty, use only
sections 1, 2, 9, and 10. State explicitly that there are no recent changes in
the defined window. Do not invent risks, themes, or validation work.

## Claim Discipline

Use these labels when evidence is partial:

- `confirmed`: directly supported by Git evidence, inspected code, or cited source.
- `likely`: supported by local evidence but not fully validated.
- `possible`: plausible from changed files or context, but unverified.
- `unverified`: requires a command, test, owner decision, or external fact not observed.
