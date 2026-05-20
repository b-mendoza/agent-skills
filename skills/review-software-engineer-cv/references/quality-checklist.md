# CV Review Quality Checklist

Read this file only when validating a drafted CV review or rewrite.

## Gates

| Gate | Pass condition |
| ---- | -------------- |
| Inputs | Draft uses the provided job posting and CV, and labels missing or partial input |
| Job specificity | Recommendations tie back to visible role requirements, priorities, or repeated terms |
| Evidence labels | Every rewrite or recommended claim has one valid evidence label |
| Candidate facts | Candidate claims are grounded in the CV/applicant context or framed as questions |
| Seniority realism | Wording matches the applicant's demonstrated scope and depth |
| Technical defensibility | Tools, frameworks, architecture, scale, and metrics are supportable or explicitly unverified |
| Human readability | Advice improves clarity for hiring managers, not only keyword overlap |
| Mode compliance | Output includes only the sections requested by `OUTPUT_MODE` |
| Actionability | The user can see exactly what to change, why, and what to verify |
| Checklist | Full reviews end with a concise submission checklist |

## Review Procedure

1. Check the draft against each gate.
2. If all gates pass, return `CV_REVIEW: PASS`.
3. If a gate fails, return `CV_REVIEW: FAIL` with only targeted fixes.
4. If source limitations prevent review, return `CV_REVIEW: ERROR` with the
   smallest needed input.

## Fix Guidance

Ask the editor for the smallest change that resolves the failed gate:

- Missing evidence label: add or correct the label.
- Unsupported claim: convert to a question or safer wording.
- Generic recommendation: tie it to a job requirement or remove it.
- Overstated seniority: lower the claim to demonstrated contribution.
- Mode mismatch: remove unrelated sections.

Do not request a full rewrite when a targeted fix is enough.
