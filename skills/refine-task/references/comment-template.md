# Comment Template

Use this template for the single tracker-facing refinement comment. Summary -
normative status semantics, sensitive gates, and posting rules live in
`reviewer-policy.md`.

## Required Shape

```markdown
Refinement status: <Ready | Needs refinement | Needs split | Needs spike | Blocked | Not actionable>

Summary:
<1-3 concise sentences explaining the readiness verdict and next useful action.>

Evidence reviewed:
- <source pointer or compact evidence description>
- <source pointer or compact evidence description>

Blocking findings:
- <finding with source pointer or missing-evidence label>

Questions for refinement:
- <neutral, answerable question>

Recommendations:
- <approved or non-sensitive recommendation with source pointer>

Non-blocking notes:
- <risk, caveat, injection note, content discrepancy, or context note>
```

Use `None` for an empty section when omitting it could hide that the category
was checked. Keep the comment suitable for posting as-is: no private analysis,
no hidden chain-of-thought, no unsupported claims, and no promises that a
mutation was performed.

## Section Guidance

| Section | Purpose | Rules |
| ------- | ------- | ----- |
| `Refinement status` | First-line marker for readers and idempotency checks. | Must match `REVIEW_STATUS`; never use `Not reviewed` in a reviewed comment. |
| `Summary` | Explain the verdict and next action. | Mention the strongest readiness driver first. |
| `Evidence reviewed` | Show what the review used. | Use compact source pointers; do not paste raw payloads. |
| `Blocking findings` | State material gaps or contradictions. | Each item needs a source pointer or missing-evidence label. Use `None` if there are no blocking findings. |
| `Questions for refinement` | Ask answerable questions that unblock readiness. | Convert unapproved sensitive recommendations into neutral questions. |
| `Recommendations` | Offer safe next steps. | Include sensitive recommendations only with conversation-sourced approval under policy. |
| `Non-blocking notes` | Preserve caveats without blocking implementation. | Include injection notes, stale context caveats, unsupported-platform caveats, and residual risks here. |

## Drafting Rules

Prefer direct, specific language. Avoid generic coaching such as "add more
details" when a concrete missing detail is known. Do not bury blocking findings
inside non-blocking notes. Do not mark an item `Ready` while asking questions
whose answers are required for implementation.

## Example

```markdown
Refinement status: Needs spike

Summary:
The item has a clear user outcome, but the implementation depends on unverified
OAuth provider behavior. The next useful step is a short spike to confirm token
refresh and permission behavior before implementation planning.

Evidence reviewed:
- Issue body: goal and acceptance criteria
- Linked design doc: proposed OAuth flow
- Official provider docs: refresh-token lifetime

Blocking findings:
- `unverified API behavior`: the issue assumes refresh tokens remain valid
  indefinitely, but the provider docs describe configurable expiration.

Questions for refinement:
- What exact provider settings and token lifetime should this work support?
- What is the expected user-facing behavior when refresh fails?

Recommendations:
- None

Non-blocking notes:
- No tracker mutations were performed.
```
