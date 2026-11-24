# GitHub and GitHub Enterprise

Current-state reference. Update when platform capabilities or command mappings change.

## Tooling and auth

Use `gh` for CLI and REST operations. Use the explicit `[HOST/]OWNER/REPO` form for `--repo`. In REST paths use `OWNER/REPO` only, with an explicit `--hostname`. Enterprise capabilities depend on the server version and repository plan. Check the active account without refreshing or displaying its token:

```sh
gh auth status --hostname "$PLATFORM_HOST" --active --no-refresh
```

## Facts

| Capability | Supported | How | Source | Checked |
| --- | --- | --- | --- | --- |
| Open PR lookup, including fork heads | yes | List open PRs on the base repo with `head=owner:branch` and `base=branch`; compare returned head and base repository identities and refs. | <https://docs.github.com/en/rest/pulls/pulls#list-pull-requests> | 2026-11-23 |
| Create and body from file | yes | `gh pr create --base --head --title --body-file`; explicit `--head` skips implicit push and fork. For a user-owned fork use `user:branch`. The CLI does not support an organization in that selector. | local CLI help: `gh pr create --help` | 2026-11-23 |
| Create as draft | yes | `--draft`, where the repository supports it. | local CLI help: `gh pr create --help` | 2026-11-23 |
| Create with reviewers | yes | `--reviewer HANDLE`. | local CLI help: `gh pr create --help` | 2026-11-23 |
| Create with labels | yes | `--label NAME`. | local CLI help: `gh pr create --help` | 2026-11-23 |
| Create with assignees | yes | `--assignee LOGIN`. | local CLI help: `gh pr create --help` | 2026-11-23 |
| Draft → ready | yes | `gh pr ready`. | local CLI help: `gh pr ready --help` | 2026-11-23 |
| Ready → draft | yes | `gh pr ready --undo` if the plan supports it. | local CLI help: `gh pr ready --help` | 2026-11-23 |
| Reviewer eligibility | yes | Anyone with write access can be requested. Check the user with the collaborator endpoint (204: collaborator; 404: not a collaborator); the caller needs push access. Requesting a non-collaborator fails with 422. | <https://docs.github.com/en/rest/collaborators/collaborators#check-if-a-user-is-a-repository-collaborator>, <https://docs.github.com/en/rest/pulls/review-requests#request-reviewers-for-a-pull-request> | 2026-11-24 |
| Team reviewers | yes | `--reviewer ORG/TEAM-SLUG` to request a review from a team. | local CLI help: `gh pr create --help` | 2026-11-23 |
| Owners-file locations | yes | The first `CODEOWNERS` on the base branch in `.github/`, root, then `docs/`. The last matching pattern wins. Owners need write access; teams must also be visible. | <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners> | 2026-11-23 |
| PR labels and exact lookup | yes | PRs have labels. List repository labels, or use `GET /repos/{owner}/{repo}/labels/{name}` with the URL-encoded label name. | <https://docs.github.com/en/rest/issues/labels#get-a-label> | 2026-11-23 |
| Set PR labels | yes | `--label` at create; `--add-label` on edit. | local CLI help: `gh pr edit --help` | 2026-11-23 |
| PR assignees and self alias | yes | Use `--assignee LOGIN` or `--assignee @me` at create. | local CLI help: `gh pr create --help` | 2026-11-23 |
| Repository assignability check | yes | `GET /repos/{owner}/{repo}/assignees/{assignee}`: `204` if assignable, otherwise `404`. | <https://docs.github.com/en/rest/issues/assignees#check-if-a-user-can-be-assigned> | 2026-11-23 |
| Set PR assignees | yes | `--add-assignee LOGIN` (also accepts `@me`) on edit. | local CLI help: `gh pr edit --help` | 2026-11-23 |
| Readback: base ref | yes | `baseRefName`. | local CLI help: `gh pr view --help` | 2026-11-23 |
| Readback: head ref | yes | `headRefName`. | local CLI help: `gh pr view --help` | 2026-11-23 |
| Readback: head SHA | yes | `headRefOid`. | local CLI help: `gh pr view --help` | 2026-11-23 |
| Readback: title | yes | `title`. | local CLI help: `gh pr view --help` | 2026-11-23 |
| Readback: body | yes | `body`. | local CLI help: `gh pr view --help` | 2026-11-23 |
| Readback: draft state | yes | `isDraft` (boolean). | local CLI help: `gh pr view --help` | 2026-11-23 |
| Readback: reviewers | yes | `reviewRequests`. | local CLI help: `gh pr view --help` | 2026-11-23 |
| Readback: labels | yes | `labels`. | local CLI help: `gh pr view --help` | 2026-11-23 |
| Readback: assignees | yes | `assignees`. | local CLI help: `gh pr view --help` | 2026-11-23 |
| Readback: closing issues | yes | `closingIssuesReferences`. | local CLI help: `gh pr view --help` | 2026-11-23 |
| Closing keywords | yes | `close`, `closes`, `closed`; `fix`, `fixes`, `fixed`; `resolve`, `resolves`, `resolved`. | <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue> | 2026-11-23 |
| Closing keywords: default branch | yes | A PR description's keywords are interpreted only if the PR targets the default branch. | <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue> | 2026-11-23 |
| Closing keywords: cross-repo | yes | `Fixes OWNER/REPO#ISSUE-NUMBER`. | <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue> | 2026-11-23 |
| One closing keyword for a list | no | Repeat the keyword for each issue: `Closes #10, closes #20`. | <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue> | 2026-11-23 |
| Closure readback | yes | Query `gh pr view --json closingIssuesReferences`. | local CLI help: `gh pr view --help` | 2026-11-23 |
| Update title and body | yes | `gh pr edit --title TITLE --body-file FILE`. | local CLI help: `gh pr edit --help` | 2026-11-23 |
| Add reviewers on update | yes | `--add-reviewer LOGIN`; the CLI examples also accept `ORG/TEAM-SLUG`. | local CLI help: `gh pr edit --help` | 2026-11-23 |
| Add labels on update | yes | `--add-label NAME`. | local CLI help: `gh pr edit --help` | 2026-11-23 |
| Add assignees on update | yes | `--add-assignee LOGIN`. | local CLI help: `gh pr edit --help` | 2026-11-23 |
| Issue lookup | yes | REST `GET /repos/{owner}/{repo}/issues/{issue_number}`; only an issue if there is no `pull_request` key. | <https://docs.github.com/en/rest/issues/issues#get-an-issue> | 2026-11-23 |
| Shared issue and PR numbers | yes | The Issues endpoint uses the same repository number to return an issue or a PR; the latter has `pull_request`. The numeric `id` is not the number. | <https://docs.github.com/en/rest/issues/issues#get-an-issue> | 2026-11-23 |
| Comment from file | yes | `gh issue comment --body-file FILE`. Do not add `--attach`, which can rewrite the body. | local CLI help: `gh issue comment --help` | 2026-11-23 |
| Comment readback by ID | yes | `GET /repos/{owner}/{repo}/issues/comments/{comment_id}` returns raw Markdown in `body`. | <https://docs.github.com/en/rest/issues/comments#get-an-issue-comment> | 2026-11-23 |
| Stored comment is byte-for-byte unchanged | unconfirmed | The raw Markdown representation does not document whether storage normalizes text. | <https://docs.github.com/en/rest/issues/comments#get-an-issue-comment> | 2026-11-23 |
| Close as not planned | yes | `gh issue close --reason 'not planned'`. | local CLI help: `gh issue close --help` | 2026-11-23 |
| Read back close reason | yes | Query `state,stateReason` with `gh issue view`. | local CLI help: `gh issue view --help` | 2026-11-23 |
| Authenticated user | yes | REST `GET /user` returns `login` and ID. | <https://docs.github.com/en/rest/users/users#get-the-authenticated-user> | 2026-11-23 |
| Title length limit | unconfirmed | The create endpoint documents `title` but not a maximum. | <https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request> | 2026-11-23 |
| Repository identity and default branch | yes | Read `full_name`, `default_branch`, `has_issues` from the repository endpoint. | <https://docs.github.com/en/rest/repos/repos#get-a-repository> | 2026-11-23 |

Unsupported fields: none

## Commands

Use fixed argument vectors or quoted shell arguments, never shell evaluation. `BASE_REPOSITORY` is `OWNER/REPO`; `base_target` is `HOST/OWNER/REPO` on the same host as `PLATFORM_HOST`. Use positive validated numeric IDs; URL-encode individual path segments, such as `label_segment`, `assignee_segment` and `reviewer_segment`, before interpolation. For create, `create_head` is the head branch for the base repo or `user:branch` for a user-owned fork. `head_owner` is the actual source repository owner in both cases.

### Repository, authentication identity, metadata and open PRs

```sh
gh api --hostname "$PLATFORM_HOST" --method GET --include "repos/$BASE_REPOSITORY"
gh api --hostname "$PLATFORM_HOST" --method GET user
gh api --hostname "$PLATFORM_HOST" --method GET "repos/$BASE_REPOSITORY/labels/$label_segment"
gh api --hostname "$PLATFORM_HOST" --method GET --paginate "repos/$BASE_REPOSITORY/labels"
gh api --hostname "$PLATFORM_HOST" --method GET --include "repos/$BASE_REPOSITORY/assignees/$assignee_segment"
gh api --hostname "$PLATFORM_HOST" --method GET --include "repos/$BASE_REPOSITORY/collaborators/$reviewer_segment"
gh api --hostname "$PLATFORM_HOST" --method GET --paginate "repos/$BASE_REPOSITORY/pulls" \
  --raw-field state=open --raw-field "base=$TARGET_BRANCH" --raw-field "head=$head_owner:$HEAD_BRANCH"
```

Compare `head.repo.full_name`, `head.ref`, `base.repo.full_name` and `base.ref` in the results. Unlike the REST parameter, `gh pr list --head` does not accept `owner:branch`. A null repository is not an identity match. For CODEOWNERS, read the first file at the documented locations from the pinned base tree:

```sh
git show "$base_sha:$owners_path"
```

### Create, read back and update

`create_args` is an argument array: include `--draft` only for draft, and append `--reviewer "$reviewer"`, `--label "$label"` and `--assignee "$assignee"` for each applicable value. `edit_args` can contain `--title "$title"`, `--body-file "$RUN_DIR/body.md"`, `--add-reviewer "$reviewer"`, `--add-label "$label"` and `--add-assignee "$assignee"`. Do not send a value where the CLI would parse one member as a comma-separated list or otherwise reinterpret it.

```sh
gh pr create --repo "$base_target" --base="$TARGET_BRANCH" --head="$create_head" \
  --title="$title" --body-file="$RUN_DIR/body.md" "${create_args[@]}"
gh pr view "$PR_NUMBER" --repo "$base_target" \
  --json number,url,state,baseRefName,headRefName,headRefOid,title,body,isDraft,reviewRequests,labels,assignees,closingIssuesReferences
gh pr edit "$PR_NUMBER" --repo "$base_target" "${edit_args[@]}"
gh pr ready "$PR_NUMBER" --repo "$base_target"         # draft → ready
gh pr ready "$PR_NUMBER" --repo "$base_target" --undo  # ready → draft
```

Decode the JSON body without stripping newlines. Closing issue identities come from `closingIssuesReferences`, not from re-parsing the body. Description syntax:

```text
Closes #<issue-number>, closes <owner>/<repo>#<issue-number>
```

### Issues and comments

```sh
gh api --hostname "$PLATFORM_HOST" --method GET --include "repos/$BASE_REPOSITORY/issues/$ISSUE_NUMBER"
gh issue view "$ISSUE_NUMBER" --repo "$base_target" --json number,title,url,state,stateReason
gh api --hostname "$PLATFORM_HOST" --paginate "repos/$BASE_REPOSITORY/issues/$ISSUE_NUMBER/comments"
gh issue comment "$ISSUE_NUMBER" --repo "$base_target" --body-file "$RUN_DIR/comment-${QUEUE_INDEX}.md"
gh api --hostname "$PLATFORM_HOST" "repos/$BASE_REPOSITORY/issues/comments/$comment_id"
gh issue close "$ISSUE_NUMBER" --repo "$base_target" --reason 'not planned'
```

Check issue identity via `number` and `html_url` in the REST response. Do not use returned URLs as request targets. The comment response provides `issue_url`, `user`, `html_url` and `body`; use those fields for identity and exact text comparison. Read close state and reason with the same `gh issue view` command.
