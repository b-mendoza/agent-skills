# Platform Adaptation

> Read this file only when `remote.origin.url` does not point to GitHub.
>
> Preserve the same workflow: validate auth, compare the full branch diff, show
> a preview, wait for explicit confirmation, create the PR or MR, then return
> the resulting URL.

## GitLab

Use the same drafting logic from the main skill, then adapt creation to GitLab:

1. Confirm `glab` is installed and authenticated.
2. Verify the source branch exists on the remote. If it does not, ask the user
   for permission to push it first.
3. Reuse the same title, body, reviewer, label, and draft decisions from the
   preview loop.
4. Create the merge request with `glab mr create`, mapping:
   - base branch -> target branch
   - head branch -> source branch
   - title -> title
   - description -> description
   - draft state -> draft or ready
   - reviewers -> reviewer equivalents supported by the installed `glab` version
5. Return the created merge request URL.

If the local `glab` version exposes different flag names, use its built-in help
to map the preview fields to the correct create command instead of guessing.

## Bitbucket

Bitbucket workflows vary more by team and hosting setup, so keep the same
preview-first flow and then:

1. Detect whether the repository uses a supported Bitbucket CLI or a custom API
   wrapper.
2. Reuse the drafted title, body, reviewer, label, and draft decisions.
3. Create the pull request with the repository's standard tooling.
4. Return the resulting PR URL.

If no supported CLI or API flow is available, stop and ask the user which
Bitbucket workflow their team expects.

## Platform Invariants

Keep these rules unchanged across platforms:

- Ask for the target branch when it was not supplied.
- Base the title and description on the actual compare diff.
- Require at least one reviewer before creation.
- Show the full preview before creating anything.
- Create only after explicit confirmation.
- Return the final URL and the chosen base/head branches.
