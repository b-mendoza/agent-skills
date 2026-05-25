# Project State Snapshot Template

> Load this file only when assembling the final report. Use local evidence first;
> use `./external-sources.md` only for static background needed by a specific
> finding.

## Report Rules

- Return the report body only; omit subagent status wrappers, process logs, raw
  diffs, and full command output.
- Tie material claims to compact Git evidence, narrow local context, a cited
  fetched source, or an explicit inference label.
- Keep validation gaps, unanswered questions, and recommended commands separate
  from confirmed facts.
- Recommend repository-changing actions as next steps for the developer; do not
  present them as already performed.

## Report Shape

```markdown
# Project State Snapshot

## 1. Executive Summary

- Current branch and working tree state.
- Main change themes.
- Overall risk level.
- Most important thing to understand before continuing.

## 2. Git State

| Area | Finding |
| ---- | ------- |
| Branch | ... |
| Working tree | ... |
| Staged changes | ... |
| Unstaged changes | ... |
| Untracked files | ... |
| Recent commits reviewed | ... |
| Base comparison | ... |

## 3. Recent Change Themes

### Theme: `<name>`

- **What changed:** ...
- **Files involved:** ...
- **Evidence:** ...
- **Why it appears to have changed:** fact or labeled inference
- **Developer context:** ...
- **Risk level:** Low / Medium / High
- **What to review next:** ...

## 4. Behavioral Impact

- **Confirmed:** ...
- **Likely:** ...
- **Possible, needs verification:** ...

## 5. Risks, Gotchas, and Smells

| Severity | Area | Finding | Evidence | Why it matters | Confidence | Recommended action |
| -------- | ---- | ------- | -------- | -------------- | ---------- | ------------------ |
| High/Medium/Low | ... | ... | ... | ... | High/Medium/Low | ... |

## 6. Test and Validation Review

- Tests added, removed, changed, or missing.
- Important behavior not covered.
- Tests that look brittle, redundant, or implementation-focused.
- Project-specific validation commands to run.

## 7. Dependency, Config, Tooling, and Security Notes

Only include areas touched or clearly implicated. If nothing relevant changed,
say so briefly.

## 8. Questions Before Merging or Continuing

- ...

## 9. Recommended Next Actions

- **Must do before merge / before continuing:** ...
- **Should do soon:** ...
- **Nice to have:** ...

## 10. Final Developer Briefing

Plain-English handoff for continuing safely.
```

## Depth Rules

| Depth | Rule |
| ----- | ---- |
| `brief` | Keep the same section order with the fewest useful bullets. |
| `standard` | Include evidence-backed themes and risks without broad architecture review. |
| `deep` | Inspect additional surrounding context only for changed high-risk areas. |

## Example Risk Row

```markdown
| High | Auth | Refresh cookie handling changed | `src/auth/middleware.ts` in base delta | Authentication boundary; logout and expiry behavior need review | Medium | Re-check cookie validation and run auth regression tests. See OWASP code review guide if deeper security framing is needed. |
```
