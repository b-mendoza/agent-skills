# Review Quality Checklist

> Read this file after assembling the comment or draft. Fix only failed checks,
> then re-run this checklist. Stop after three fix cycles.

## Checklist

| Check | Pass Condition |
| ----- | -------------- |
| Boundary | The run produced at most a refinement comment or draft and did not claim any tracker mutation was performed. |
| Review state | `REVIEW: PASS` means the review output passed validation; non-ready item statuses do not use `REVIEW: FAIL` unless the output still fails this checklist after three fix cycles. |
| Write mode | `POST_ALLOWED=yes` appears only when posting the refinement comment was explicitly requested and safe. |
| Evidence | Every substantive finding, invalid claim, blocker, and recommendation has a source pointer or is marked as missing evidence. |
| Readiness | `Ready` is used only when material objective, outcome, persona/user, journey/workflow, scope, risk, dependency, acceptance criteria, task readiness, priority, and rationale gaps are resolved or accepted. |
| Hierarchy | Epic, parent issue, subtask, sub-issue, dependency, split, or child-work guidance is framed as observed state, missing evidence, neutral question, or approved recommendation; it never implies links or child work were changed. |
| Technical claims | Current library, framework, SDK, API, hook, CLI, config, or version claims were verified against trusted docs or codebase evidence. |
| Gates | Lifecycle, split, and spike recommendations are approved, neutralized as questions, or explicitly deferred. |
| Output shape | The final comment contains all required sections from `comment-template.md`. |
| Empty sections | Empty sections use `None` when omission could be ambiguous. |
| External sources | Any fetched website is listed in the compact summary or evidence reviewed section. |

## Fix Loop

1. Identify failed checks and the smallest targeted fix.
2. Revise only the affected comment section, status, gate wording, or summary.
3. Re-run this checklist.
4. Stop after three cycles and return `REVIEW: FAIL`, `POST_ALLOWED=no`, failed
   criteria, and the safest draft if the same class of issue remains.

## Common Fixes

| Failure | Targeted Fix |
| ------- | ------------ |
| Non-ready item reported as `REVIEW: FAIL` | Change to `REVIEW: PASS` when the review output is valid, then keep the non-ready value in `REVIEW_STATUS` and the comment. |
| Recommendation oversteps approval | Move it to a neutral question or mark it deferred. |
| Weak evidence | Add a source pointer or reclassify as missing evidence. |
| Premature `Ready` | Change status to `Needs refinement`, `Needs split`, `Needs spike`, or `Blocked` and name the blocker. |
| Hierarchy mutation implied | Reword as an observation, neutral question, or approved recommendation; remove any claim that the link, child issue, or dependency was changed. |
| Missing output section | Add the section with `None` if no content exists. |
| Technical claim unsupported | Fetch or cite trusted docs, or ask for owner clarification. |
