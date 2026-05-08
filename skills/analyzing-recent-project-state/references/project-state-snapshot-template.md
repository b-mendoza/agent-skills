# Project State Snapshot Template

> Read this file only when `state-snapshot-writer` is assembling the final
> report. Local Git evidence is primary; cite external sources only next to
> findings they actually support. Use `./external-sources.md` to look up
> public references such as code review guides, OWASP categories, the test
> pyramid, twelve-factor config, semantic versioning, or API compatibility
> rules instead of restating them in the report.

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
- **Why it appears to have changed:** fact or inference, clearly labeled
- **Developer context:** ...
- **Risk level:** Low / Medium / High
- **What to review next:** ...

## 4. Behavioral Impact

Separate confirmed behavior changes, likely behavior changes, and possible
behavior changes that need verification.

## 5. Risks, Gotchas, and Smells

| Severity | Area | Finding | Evidence | Why it matters | Confidence | Recommended action |
| -------- | ---- | ------- | -------- | -------------- | ---------- | ------------------ |
| High/Medium/Low | ... | ... | ... | ... | High/Medium/Low | ... |

## 6. Test and Validation Review

- Tests added, removed, or changed.
- Important behavior not covered.
- Tests that look brittle, redundant, or implementation-focused.
- Validation commands to run, adapted to this project.

## 7. Dependency, Config, Tooling, and Security Notes

Only areas touched or implicated. If nothing relevant changed, say so briefly.

## 8. Questions Before Merging or Continuing

Key questions a human developer should answer before trusting the changes.

## 9. Recommended Next Actions

- **Must do before merge / before continuing:** ...
- **Should do soon:** ...
- **Nice to have:** ...

## 10. Final Developer Briefing

Plain-English handoff for continuing safely.
```

## Depth Rules

For `OUTPUT_DEPTH=brief`, keep the same section order and use the fewest
useful bullets. For `OUTPUT_DEPTH=standard`, include evidence-backed themes
and risks without broad architecture review. For `OUTPUT_DEPTH=deep`,
inspect additional surrounding context only for changed high-risk areas.

## Example Theme

```markdown
### Theme: Token Refresh Flow

- **What changed:** Middleware now accepts a refresh cookie before rebuilding the session.
- **Files involved:** `src/auth/middleware.ts`, `tests/auth-refresh.test.ts`
- **Evidence:** Both files appear in the base delta.
- **Why it appears to have changed:** Inference. The branch reads as adding automatic token refresh to reduce forced logouts.
- **Developer context:** Authentication boundary; logout, expiry, and cookie validation all need re-review.
- **Risk level:** High
- **What to review next:** Cookie validation, expiry handling, logout invalidation, regression coverage. See OWASP code review guide via `./external-sources.md` if a deeper category is needed.
```
