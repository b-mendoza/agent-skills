# Output Templates

Read this file only when assembling copy-ready files or formatting the final
response. Replace every placeholder in generated output.

## Skill Template

````markdown
---
name: "<skill-name>"
description: "<Third-person trigger description: what this skill does and when to use it.>"
---

# <Skill Title>

You are <identity>. <One short paragraph explaining what the skill does, how it
reasons, and what it delegates.>

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `<INPUT_NAME>` | Yes | `<example>` |

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| <decision or phase> | `./references/<file>.md` |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `<subagent-name>` | `./subagents/<subagent-name>.md` | <purpose> |

## Workflow

1. <Clarify or derive inputs.>
2. <Load only the reference needed for the current phase.>
3. <Dispatch the right subagent with explicit inputs.>
4. <Synthesize concise results.>
5. <Validate, fix targeted failures, and deliver.>

## Output Contract

```markdown
STATUS: PASS | FAIL | BLOCKED
Summary:
Artifacts:
Next action:
```

## Validation

- <Gate 1>
- <Gate 2>
- <Gate 3>

## Example

Input: <realistic input>

1. <Dispatch or decision>
2. <Subagent summary>
3. <Orchestrator action>
````

Omit `Subagent Registry` only when the skill has no delegated execution.

## Subagent Template

````markdown
---
name: "<role-noun>"
description: "<What this subagent does and when the orchestrator should use it.>"
---

# <Role Title>

You are a <role> subagent. Your job is to <specific work> and return <concise
handoff> to the orchestrator.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `<INPUT_NAME>` | Yes | `<example>` |

## Instructions

1. <Step 1>
2. <Step 2>
3. <Validate output before returning.>

## Output Format

```markdown
STATUS: PASS | FAIL | BLOCKED | ERROR
Summary:
Artifacts:
Findings:
Next action:
```

## Scope

Your job is to <allowed work>. Return a concise result and avoid unrelated
redesign.

## Escalation

| Status | Meaning |
| ------ | ------- |
| `FAIL` | Completed with fixable issues |
| `BLOCKED` | Missing input or unavailable dependency |
| `ERROR` | Unexpected tool, parse, or environment failure |
````

## Reference Template

```markdown
# <Reference Title>

Read this file when <specific trigger>. Keep this reference one hop from
`SKILL.md`.

## Contents

- <Section 1>
- <Section 2>
- <Section 3>

## <Section 1>

<Detailed static guidance, examples, or checklist.>
```

## Per-Step Response Template

````markdown
## Analysis
- Purpose:
- Inputs:
- Outputs:
- Artifact type:
- Rationale:
- Failure modes:
- Progressive disclosure plan:

## Files
`<relative/path>`
```markdown
<complete file content>
```

## Integration Notes
- <How this connects to the workflow>
- <Which references load when>
- <Subagent registry rows or command invocation>

## Validation
- <Review verdict>
- <Fix cycles used>
- <Residual risks>
````

## Collection Manifest Template

Use this when the orchestrator aggregates one or more `ARCHITECTURE: PASS`
results before synthesis.

```markdown
## Collection Manifest

| Item | Artifact type | Status | Files | Registry rows | Contract summary | Validation note |
| ---- | ------------- | ------ | ----- | ------------- | ---------------- | --------------- |
| <item name> | <skill/subagent/reference/script/asset> | ARCHITECTURE: PASS | `<path>` | <rows or none> | <inputs/outputs/handoff> | <self-check result> |

## Handoff Summary
- Generated files:
- References loaded:
- External docs fetched:
- Assumptions:
- Remaining risks:
```

## Review Report Template

```markdown
REVIEW: PASS | FAIL | BLOCKED | ERROR

## Findings
| Severity | File | Issue | Required Fix |
| -------- | ---- | ----- | ------------ |

## Summary
- Verdict:
- Files under review:
- Runtime constraints:
- Validation summary:
- Fix cycles recommended:
- Remaining risks:
```
