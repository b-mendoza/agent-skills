# Platform Adaptation

> Read this file when the remote is not GitHub or GitHub Enterprise, or when
> the installed `gh` workflow cannot authenticate against the repository.
>
> URLs for command syntax and platform docs live in
> `./external-resources.md`. Fetch only the entry relevant to the current
> decision.

Non-GitHub PR/MR creation uses the same orchestrator gates as GitHub:
validate auth and remote refs, compare the full branch diff, preview exact
fields, wait for user approval, create, verify, and return the URL.

## GitLab Strategy

Use GitLab merge-request semantics while preserving the skill contracts:

- Confirm `glab` (or the team's standard GitLab tooling) is installed and
  authenticated.
- Fetch remote refs, verify the target branch, and verify the source branch
  is remotely comparable.
- Request explicit user approval before pushing a missing or stale source
  branch.
- Use `glab mr create` (or the documented team workflow) to map approved
  preview fields to target branch, source branch, title, description, draft
  state, reviewers, and labels.
- Verify the created MR URL and branch fields before returning
  `PR_SUBMIT: PASS`.

For exact `glab` flags, label commands, or Code Owners syntax, consult the
"GitLab" section of `./external-resources.md`.

## Bitbucket Strategy

Bitbucket workflows vary by team and hosting setup. Preserve the
preview-first flow and use the repository's standard CLI or API wrapper when
available.

- Detect the supported Bitbucket CLI/API path for the repository.
- Return `BLOCKED` when no safe create workflow is discoverable and ask which
  team workflow to use.
- Reuse the approved title, body, reviewer, label, draft/ready, base, and
  head values.
- Suggest labels only when the tooling can list existing labels reliably.
- Verify the resulting PR URL and base/head branches.

For exact REST endpoints or default-reviewer behavior, consult the
"Bitbucket" section of `./external-resources.md`.

## Unknown or Self-Hosted Platforms

When the platform classifier returns `unknown`:

- Do not improvise a create command. Return `BLOCKED` and ask the user which
  hosting platform and tooling to use.
- If the user names a tool (for example, a custom REST wrapper or
  `git push --set-upstream` plus an HTTP API), reuse the approved preview
  values exactly and verify the resulting URL before reporting success.

## Failure Mapping

Use the orchestrator failure envelope in `./execution-contracts.md` for
non-GitHub flows too:

- `AUTH` for missing, unauthenticated, or unauthorized platform tooling.
- `BASE_BRANCH_MISSING` for a missing target branch.
- `HEAD_BRANCH_UNPUSHED` when the source branch cannot be compared remotely.
- `EMPTY_DIFF` when the compare range has no meaningful changes.
- `BLOCKED` when the platform workflow cannot be determined safely.
- `CANCELLED` when the user declines a non-push confirmation gate.
- `CREATE_ERROR` when creation or verification fails after approval.
