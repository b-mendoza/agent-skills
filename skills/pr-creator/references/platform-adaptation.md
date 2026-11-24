# Platform Adaptation

Current-state reference. Update when platform mappings or verified capabilities change. Load for preflight capability checks or when choosing a platform adapter.

## Shared Fields

| Concept           | Required meaning                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Base repository   | Repository that receives the PR/MR.                                                                                  |
| Head repository   | Repository that contains the source branch. May differ from base in fork workflows.                                  |
| Base branch       | `TARGET_BRANCH` on `BASE_REMOTE`.                                                                                    |
| Head branch       | `CURRENT_BRANCH` on `HEAD_REMOTE`.                                                                                   |
| Existing PR check | Query open PRs/MRs for the same base branch and same head branch/repository before drafting and again before create. |
| Verification      | Query the created or found PR/MR and echo platform-returned fields, including body digest evidence.                  |

In playbook commands, `HEAD_BRANCH` means the `CURRENT_BRANCH` input.

## Playbook selection

On leaving `InspectRepo`, the orchestrator selects one playbook from the inspector's `Platform`. Paths in code are relative to `SKILL_DIR`; links are relative to this file.

- `github` or `github-enterprise`: [`./references/platform-github.md`](./platform-github.md)

Pass the selected path as `PLATFORM_PLAYBOOK` to preflight, the metadata specialist and the submitter. Each reads that file and no other playbook.

Use the selected playbook when one exists; otherwise use the existing platform guidance.

| Platform                   | Create path                                                                                                              | Draft support                                                                    | Fork notes                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| GitLab                     | Prefer `glab mr create` or GitLab API and verify with MR query.                                                          | Draft MRs supported by title/state conventions or CLI flag depending on version. | Source and target project can differ.                              |
| Bitbucket Cloud            | Use approved CLI/API path if available; otherwise ask for approved tooling.                                              | No native draft PR state.                                                        | Source and destination repositories can differ.                    |
| Unknown                    | Fetch one current platform/tooling document or ask the user which platform/tooling to use.                               | Unknown until confirmed.                                                         | Do not create until fields are mappable.                           |

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
