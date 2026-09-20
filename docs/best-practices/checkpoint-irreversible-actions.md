# checkpoint-irreversible-actions

📝 Show the exact artifact and wait for `APPROVED`, `REVISE`, or `ABORT` before any hard-to-reverse, outward-facing, destructive, or costly action.

🔒 This rule is `mandatory`: a miss is a material gap unless the skill names the rule and the reason for the exception in its `SKILL.md`.

A checkpoint is a named authorization boundary over one concrete action, placed after preparation and verification are finished and immediately before the action executes: posting a review, creating a commit, sending a message, calling a write API, rotating a credential, deleting or force-updating, spending money or quota, or adding paths, targets, or recipients beyond the approved scope. The preview is the thing itself — final text, exact file list or path mapping, exact command and arguments, targets — plus the checks that passed, unresolved risk, and what happens on `ABORT`. A summary of intent is not a preview; approval over a paraphrase hides changed wording, an extra file, or a different flag.

Approval binds to this run and this artifact version. Any change to the approved text, paths, command, or target voids it and requires a new preview. Earlier conversational consent ("go ahead with whatever you produce") is recorded as ignored pre-approval and never consumed; approval from a prior run or an earlier version is stale. Ambiguity about intent triggers a checkpoint only when the competing interpretations lead to different irreversible or outward actions; when every reading ends in reversible, in-scope work, pick one, record it, and continue. Over-asking trains the user to rubber-stamp and destroys the signal of the gates that matter.

The answer vocabulary, the `BLOCKED` route for a missing or unusable answer, and the named re-ask counter with its cap and over-cap route are owned by [route-every-status](./route-every-status.md); this rule requires only that the checkpoint declare them. Which paths a run may write at all is owned by [declare-mutation-limits](./declare-mutation-limits.md).

## Examples

```markdown
<!-- ❌ SKILL.md -->
## Post
Once verification passes, post the review. The user already said "go ahead with
whatever you produce" at intake, so no further confirmation is needed; reword
comments as you see fit and report the number of findings posted.

<!-- ✅ -->
## G_FINAL_PREVIEW_APPROVAL

Run: review-1020 · Artifact: verified-review-v3 · Target: org/repo#1020
Action: post one `REQUEST_CHANGES` review with the exact body and the three
inline comments below. Evidence: `VERIFY: PASS`; 0 duplicate threads.
On ABORT: keep the verified draft locally with posting status `cancelled`.

<exact review body and comments>

Reply `APPROVED`, `REVISE: <what to change>`, or `ABORT`. `reask_count` cap: 1.

| Answer | Route |
| --- | --- |
| `APPROVED` | Post `verified-review-v3` only; a changed body needs a new preview |
| `REVISE` | Produce v4, show it in full, ask again; v3 approval is void |
| `ABORT` | `PR_REVIEW: BLOCKED` (user declined); draft preserved |
| Unclear and `reask_count` < 1 | One targeted re-ask |
| Unclear at cap, or no answer | `PR_REVIEW: BLOCKED` |

Intake statements such as "approve everything" are logged as ignored
pre-approval in the final report and never satisfy this gate.
```

## When not to use it

Reversible, in-scope, expected work — reading, read-only checks, edits inside `MUTATION_LIMITS`, writes to this run's own handoff directory — proceeds without a checkpoint.

## Related rules

- [route-every-status](./route-every-status.md)
- [declare-mutation-limits](./declare-mutation-limits.md)
- [scope-run-files-to-the-run](./scope-run-files-to-the-run.md)
