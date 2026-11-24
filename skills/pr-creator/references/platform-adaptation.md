# Platform Adaptation

Current-state reference. Update when platform mappings or verified capabilities change. Load for preflight capability checks or when choosing a platform adapter.

## Shared Fields

| Concept           | Required meaning                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Base repository   | Repository that receives the PR/MR.                                                                                  |
| Head repository   | Repository that contains the source branch. May differ from base in fork workflows.                                  |
| Base branch       | `TARGET_BRANCH` on `BASE_REMOTE`.                                                                                    |
| Head branch       | `HEAD_BRANCH` on `HEAD_REMOTE` (not necessarily the checkout).                                                       |
| Existing PR check | Query open PRs/MRs for the same base branch and same head branch/repository before drafting and again before create. |
| Verification      | Query the created or found PR/MR and echo platform-returned fields, including body digest evidence.                  |

## Playbook selection

On leaving `InspectRepo`, the orchestrator selects one playbook from the inspector's `Platform`. Paths in code are relative to `SKILL_DIR`; links are relative to this file.

- `github` or `github-enterprise`: [`./references/platform-github.md`](./platform-github.md)
- `gitlab`: [`./references/platform-gitlab.md`](./platform-gitlab.md)
- `bitbucket`: [`./references/platform-bitbucket.md`](./platform-bitbucket.md)
- `unknown`: select none and go to `GatePlatformTooling`.

Pass the selected path as `PLATFORM_PLAYBOOK` to preflight, the issue resolver, the metadata specialist, the submitter, the updater and the issue-updater. Each reads that file and no other playbook.

## Unsupported fields

Preflight copies the playbook's derived `Unsupported fields:` line. Its values are `assignees`, `labels`, or `closes` (closure readback), or `none`. A field appears on the line only on a sourced `no`. Pass the list as `UNSUPPORTED_FIELDS` to the metadata suggester and issue resolver. A failed read of a supported field is not evidence of absence.

- For unsupported assignees or labels, approve an empty list (including the update baseline). Nonempty requests go to `GateAssignees` on `INVALID_ASSIGNEES` or `GateLabels` on `INVALID_LABELS` rather than being silently dropped; infer no labels if the field is absent.
- If closure readback is unsupported, `GateIssueRefs` lets the user retain closing keywords with `autoClose: unverifiable` or move the issues to `related`. With no closing refs, `autoClose` is `none`.
- Carry the confirmed list into `preview` or `update` values as `unsupported`. The digest validates its consistency before a preview. Keep the same readback keys on all platforms, use `null` for an unsupported field, and do not let a platform response amend the approved list. A platform without drafts uses `ready`, not `null`; reviewers are not an `unsupported` field.

## State Capability Gate

When requested `PR_STATE` has no platform equivalent, ask before preview:

```text
Requested state `<requested>` is not supported on `<platform>`.
Choose one:
1. Proceed as `ready` and show `effective: ready` in the preview.
2. Stop without creating a PR/MR.
```

Silent substitution is forbidden. The preview must show both requested and effective state.

## Unknown Syntax Policy

A fact marked `unconfirmed` is neither supported nor unsupported. If the run needs it, the specialist returns its blocked status and names the fact; the run stops with that explanation, and the user confirms the fact or the tooling and runs again. Do not run any unverified command.

Fetch at most one authoritative source for the active platform/tooling when the exact flag, field, or capability changes a concrete command. If the exact path remains unsafe after one source, ask the user for the hosting platform or approved tooling instead of improvising.
