# Platform Adaptation

> Read this file only when the remote is not GitHub/GitHub Enterprise or the
> installed `gh` workflow cannot authenticate against the repository.

Non-GitHub PR/MR creation uses the same orchestrator gates: validate auth and
remote refs, compare the full branch diff, preview exact fields, wait for user
approval, create, verify, and return the URL.

For command details, read `./references/external-resources.md` and fetch only the
platform docs relevant to the detected host.

## GitLab Strategy

Use GitLab merge-request semantics while preserving the skill contracts:

- Confirm `glab` or the repository's standard GitLab tooling is installed and
  authenticated.
- Fetch remote refs, verify the target branch, and verify the source branch is
  remotely comparable.
- Request explicit user approval before pushing a missing or stale source branch.
- Use `glab mr create` or the documented team workflow to map approved preview
  fields to target branch, source branch, title, description, draft state,
  reviewers, and labels.
- Verify the created MR URL and branch fields before returning `PR_SUBMIT: PASS`.

Fetch these docs only when needed:

- GitLab merge requests: https://docs.gitlab.com/user/project/merge_requests/creating_merge_requests/
- GitLab CLI: https://gitlab.com/gitlab-org/cli
- `glab mr create`: https://gitlab.com/gitlab-org/cli/-/blob/main/docs/source/mr/create.md
- GitLab labels: https://docs.gitlab.com/user/project/labels/

## Bitbucket Strategy

Bitbucket workflows vary by team and hosting setup. Preserve the preview-first
flow and use the repository's standard CLI or API wrapper when available.

- Detect the supported Bitbucket CLI/API path for the repository.
- Return `BLOCKED` when no safe create workflow is discoverable and ask which
  team workflow to use.
- Reuse the approved title, body, reviewer, label, draft/ready, base, and head
  values.
- Suggest labels only when the tooling can list existing labels reliably.
- Verify the resulting PR URL and base/head branches.

Fetch these docs only when needed:

- Bitbucket Cloud PRs: https://support.atlassian.com/bitbucket-cloud/docs/create-a-pull-request/
- Bitbucket PR REST API: https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/
- Bitbucket refs REST API: https://developer.atlassian.com/cloud/bitbucket/rest/api-group-refs/

## Failure Mapping

Use the failure envelope in `./references/execution-contracts.md` for non-GitHub
flows too:

- `AUTH` for missing, unauthenticated, or unauthorized platform tooling.
- `BASE_BRANCH_MISSING` for a missing target branch.
- `HEAD_BRANCH_UNPUSHED` when the source branch cannot be compared remotely.
- `EMPTY_DIFF` when the compare range has no meaningful changes.
- `BLOCKED` when the platform workflow cannot be determined safely.
- `CANCELLED` when the user declines a non-push confirmation gate.
- `CREATE_ERROR` when creation or verification fails after approval.
