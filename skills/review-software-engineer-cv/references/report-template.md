# Report Template

Read this file only when assembling the final user-facing CV review or rewrite.

> Every recommendation and rewrite keeps an evidence label from
> `cv-review-contract.md`.

When the limitations ledger is non-empty, keep the selected mode but add a short
partial-output note before the mode-specific sections:

```text
## Partial Output Note
- <source limitation, uncertain mapping, or verification limit>
```

Use a partial-output note only after the selected mode meets the minimum
evidence threshold in `cv-review-contract.md`. If it does not, ask for the
smallest missing source detail instead of assembling the report.

## `review` Mode

```text
## Executive Summary
- <3-5 bullets on fit, strongest signals, and biggest gaps>

## Role Target Profile
**Must-haves:** <bullets>
**Nice-to-haves:** <bullets>
**Likely hiring-manager priorities:** <bullets>

## CV To Job Match Matrix
| Job requirement | Evidence in current CV | Match strength | Recommended action | Integrity risk |
| --- | --- | --- | --- | --- |

## Highest-Impact CV Updates
1. **<CV area>** - <recommended change>
   Evidence: `<choose one: Supported | Likely but unconfirmed | Unsupported until verified>`
   Why it helps: <role-specific reason>
   Verify: <question or "No verification needed">

## Suggested Rewrites
### <Section or role/project>
Original: <quote or "Not provided">
Improved: <rewrite>
Evidence: `<choose one: Supported | Likely but unconfirmed | Unsupported until verified>`
Verify: <question or "No verification needed">
Why stronger: <short reason tied to the job posting>

## Skills Section Guidance
- Keep/elevate: <skills with evidence>
- Reorder/group: <grouping recommendations>
- Verify before adding: <skills or tools requiring applicant confirmation>
- De-emphasize/remove: <items that distract from this role>

## Applicant Questions
1. <question that could unlock a stronger truthful claim>

## Realism And Interview Defensibility Check
| Recommendation | Risk | Safer wording or next step |
| --- | --- | --- |

## Final Tailoring Checklist
- <short submission checklist>
```

## `rewrite` Mode

Return only the sections that contain rewritten text:

```text
## Rewritten Summary
Improved: <summary>
Evidence: `<label>`
Verify: <question or "No verification needed">

## Rewritten Skills Section
<grouped skills>
Evidence notes: <what is supported vs. needs verification>

## Rewritten Bullets
| Original | Improved | Evidence | Verify before use |
| --- | --- | --- | --- |

## Safer Alternatives
| Risky wording | Safer wording | Why |
| --- | --- | --- |
```

## `checklist` Mode

```text
## Submission Checklist
| Priority | Action | Why it matters for this role | Evidence label | Risk |
| --- | --- | --- | --- | --- |
```

## `questions-only` Mode

```text
## Questions To Strengthen This CV
1. <targeted question>
   Unlocks: <specific CV improvement>
   Related job signal: <requirement or responsibility>
```

## Assembly Notes

- Keep the report specific to the target job posting.
- Prefer fewer high-impact rewrites over exhaustive generic edits.
- Do not include `TAILORING_DRAFT`, `CV_REVIEW`, or other subagent status
  headers in the final user-facing output.
- Preserve the applicant's apparent seniority unless applicant context supports
  a stronger level.
- Include a partial-output note at the top when the limitations ledger is
  non-empty because missing, inaccessible, ambiguous, or unverified information
  materially limits the selected-mode output.
