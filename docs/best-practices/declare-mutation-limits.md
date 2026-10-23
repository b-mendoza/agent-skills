# declare-mutation-limits

> Current-state authoring reference; update when these package conventions change.

Tier: mandatory.

Use before any file mutation, run-local write, or hard-to-reverse, outward-facing, destructive, or costly action.

## Allowed writes

Derive `MUTATION_LIMITS` once at intake, before audit, planning, or editing. State allowed paths first, categorical exclusions next, and how a user supplies `SCOPE_LIMITS` naming an explicit expansion. Pass identical limits to every subagent that plans, edits, or validates; none re-derives them. Block or escalate out-of-scope edits before they land. Repair scope is the intersection of these limits and the validator's findings, never the original full write scope.

Capture `git status --porcelain` before the first mutation and compare after editing. Newly changed out-of-plan paths are findings. For authorized paths already dirty, compare diff hunks too: status alone cannot show whether unrelated user work was overwritten. Protect sibling packages and tooling-managed mirrors as well as ordinary files.

## Approval

Place a named checkpoint after preparation and verification, immediately before an irreversible, outward-facing, destructive, or costly action, including expanded paths, targets, or recipients. Show the final artifact itself, exact command and arguments or file/path mapping, targets, checks passed, unresolved risks, and the `ABORT` disposition. An intent summary is not a preview.

Consent binds to this run, action, and artifact version. Changes to text, paths, commands, or targets invalidate it and require another preview. Prior-run approval and earlier-version approval are stale. Record blanket intake consent as ignored pre-approval; never consume it as authorization.

| Answer | Route |
| --- | --- |
| `APPROVED` | Execute only the previewed action and version. |
| `REVISE` | Revise within scope, show the new version, and ask again. |
| `ABORT` | Stop the action with `BLOCKED` and apply the stated artifact disposition. |
| Unclear answer | Re-ask only within a declared bound; at cap, `BLOCKED`. |
| Missing or unusable answer | `BLOCKED`, never inferred consent. |

Define all revision/re-ask counters and routes using the [transition rules](./keep-routing-in-the-orchestrator.md#transitions). Ambiguity needs a checkpoint only when interpretations lead to different irreversible or outward actions. If all interpretations are reversible and in scope, choose one, record it, and continue. Reading, read-only checks, in-scope edits, and this run's handoff writes need no ritual checkpoint.

## Run files

Return bounded results inline unless size exceeds the prompt/reply budget, a later step/session/repair or context compaction needs persistence, or a script consumes the payload. Distinguish lifetimes: dispatch payloads last through their dispatch; resume state lasts only for its stated need and exists only when native session retention is insufficient; deliverables remain under the user's contract. Never persist secrets, tokens, raw logs, full diffs, or copied third-party payloads in any of them; use paths, digests, or redacted facts.

Derive one run id at intake. Put dispatch payloads and resume state under `.handoffs/<skill>/<run-id>/` and record every created file. Before writing, require `git check-ignore --quiet -- "<path>"` to exit zero; otherwise use an already-ignored location or classify the file as a deliverable. An intended ignore rule is not evidence.

A run may list sibling run names but never inspect or delete their contents. Cleanup occurs only at a terminal status and deletes only recorded, owned paths. Debug retention requires explicit per-run opt-in naming files and the cleanup condition. A deliverable's eligibility for version control grants no permission to stage, commit, or push; each requires user and repository authority.

## Example

Bad: approve an unseen review at intake, later reword it while posting, then delete the shared handoff directory.

```text
Run: review-1020. Artifact: verified-review-v3. Target: org/repo#1020.
Action: post the exact review body and inline comments shown below.
Checks: VERIFY: PASS; no duplicate threads. Unresolved risk: none known.
On ABORT: keep the verified draft locally; do not post.
<full body and comments>
Reply APPROVED, REVISE, or ABORT. reask_count starts at 0, cap 1.
Each unclear reply increments it before re-asking; at cap or no answer → BLOCKED.
REVISE uses revision_count, initially 0, cap 2; increment before revision,
then show the new version. REVISE at cap → BLOCKED with draft retained.
```

The run records its own files, proves their ignore status before writing, and removes only those files on a terminal route. Its preview does not authorize changing the target or wording.
