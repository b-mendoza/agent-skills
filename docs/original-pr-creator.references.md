# External References for `pr-creator`

These resources are relevant to the `pr-creator` skill because the skill creates pull requests or merge requests from local git state, uses platform CLIs or APIs, validates reviewers and labels, and drafts review-ready descriptions. The local skill files remain authoritative for orchestration behavior; these sources are useful for current syntax, platform behavior, or comparable review practices.

## Skill Source Map

The skill itself already points to these external-reference categories in `skills/pr-creator/references/external-resources.md`: git state and compare behavior, GitHub CLI and GitHub PR docs, non-GitHub platform docs, writing guidance, and agent-skill progressive-disclosure background. The entries below are selected from that map and verified as relevant to `pr-creator`'s actual workflow.

## Platform and Tooling References

| Resource | What it is | Why it is relevant to `pr-creator` |
| --- | --- | --- |
| [GitHub CLI `gh pr create`](https://cli.github.com/manual/gh_pr_create) | Official GitHub CLI manual page for creating pull requests. | `pr-submitter` creates GitHub-compatible PRs with installed `gh`, preserves base/head/title/body/draft/reviewers/labels, and verifies the result. The manual is the right source for current flags and behavior. |
| [GitHub CLI `gh pr view`](https://cli.github.com/manual/gh_pr_view) | Official GitHub CLI manual page for reading PR fields. | `pr-submitter` must verify URL, base, head, title, body, state, reviewers, and labels after creation. This command is a natural verification source for GitHub repositories. |
| [GitHub CLI `gh auth status`](https://cli.github.com/manual/gh_auth_status) | Official GitHub CLI manual page for checking authentication. | `preflight-validator`, `review-metadata-suggester`, and `pr-submitter` all route `AUTH` when platform credentials or permissions fail. |
| [Creating a pull request - GitHub Docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) | GitHub's product documentation for PR creation. | Useful background for the platform artifact that `pr-creator` creates and verifies after preview approval. |
| [About pull requests - GitHub Docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests) | GitHub documentation covering pull request concepts including draft pull requests. | `PR_STATE` supports `draft` and `ready`, so current draft/ready platform semantics matter when exact behavior is uncertain. |
| [Requesting a pull request review - GitHub Docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/requesting-a-pull-request-review) | GitHub documentation for requesting reviewers. | `review-metadata-suggester` requires at least one valid reviewer from user input, CODEOWNERS, or user answer before submission. |
| [About code owners - GitHub Docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) | GitHub documentation for CODEOWNERS behavior and review requests. | `review-metadata-suggester` matches exact changed-file paths against CODEOWNERS files and only uses owners when platform metadata or docs confirm requestability. |
| [Managing labels - GitHub Docs](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels) | GitHub documentation for repository labels. | `review-metadata-suggester` may use only labels the hosting platform reports as existing and rejects invalid label overrides. |

## Git State and Compare References

| Resource | What it is | Why it is relevant to `pr-creator` |
| --- | --- | --- |
| [Git `diff` documentation](https://git-scm.com/docs/git-diff) | Official Git manual for comparing commits, branches, working trees, and ranges. | `diff-analyzer` uses the trusted compare range `<remote_name>/<target_branch>...<remote_name>/<current_branch>` only after preflight confirms remote comparability. |
| [Git `fetch` documentation](https://git-scm.com/docs/git-fetch) | Official Git manual for updating remote-tracking refs. | `preflight-validator` fetches refs from the recorded remote before validating target/source branch comparability. |
| [Git `push` documentation](https://git-scm.com/docs/git-push) | Official Git manual for publishing refs. | `preflight-validator` may push the current branch only after the orchestrator receives explicit user approval. |
| [Git `status` documentation](https://git-scm.com/docs/git-status) | Official Git manual for working-tree status. | `repo-state-inspector` reports a concise working-tree summary and the orchestrator states that uncommitted local changes remain outside the PR until committed. |
| [GitHub comparing commits](https://docs.github.com/en/pull-requests/committing-changes-to-your-project/viewing-and-comparing-commits/comparing-commits) | GitHub documentation for compare views and commit comparisons. | Relevant to understanding the platform-level compare model behind a PR's base/head relationship. |

## Non-GitHub Platform References

| Resource | What it is | Why it is relevant to `pr-creator` |
| --- | --- | --- |
| [Create merge requests - GitLab Docs](https://docs.gitlab.com/user/project/merge_requests/creating_merge_requests/) | Official GitLab documentation for merge request creation. | `platform-adaptation.md` maps GitLab flows to merge-request semantics while preserving the same safety gates. |
| [GitLab CLI project](https://gitlab.com/gitlab-org/cli) | Official GitLab CLI project. | `platform-adaptation.md` says GitLab should use the team's installed `glab` or approved API wrapper when creating merge requests. |
| [`glab mr create` documentation](https://gitlab.com/gitlab-org/cli/-/blob/main/docs/source/mr/create.md) | GitLab CLI documentation source for creating merge requests. | Relevant when exact `glab` flags or fields are uncertain for an active GitLab repository. |
| [GitLab labels](https://docs.gitlab.com/user/project/labels/) | Official GitLab label documentation. | Supports the skill's requirement to validate labels against active-platform existing labels. |
| [GitLab Code Owners](https://docs.gitlab.com/user/project/codeowners/) | Official GitLab Code Owners documentation. | Relevant when CODEOWNERS reviewer behavior must be adapted for GitLab merge requests. |
| [Bitbucket Cloud create pull request](https://support.atlassian.com/bitbucket-cloud/docs/create-a-pull-request/) | Atlassian support documentation for creating Bitbucket pull requests. | `platform-adaptation.md` includes Bitbucket as a supported non-GitHub adaptation path when safe tooling is discoverable. |
| [Bitbucket pull request REST API](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/) | Atlassian REST API documentation for Bitbucket pull requests. | Relevant when a repository uses an approved API wrapper rather than a CLI create path. |
| [Bitbucket default reviewers](https://support.atlassian.com/bitbucket-cloud/docs/use-default-reviewers-on-a-repository/) | Atlassian documentation for default reviewers. | Comparable to `review-metadata-suggester` reviewer resolution, especially on non-GitHub platforms. |

## Writing and Review References

| Resource | What it is | Why it is relevant to `pr-creator` |
| --- | --- | --- |
| [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) | Specification for commit-message type and optional scope syntax. | `diff-analyzer` returns Conventional Commit type/scope candidates and `pr-drafter` composes titles as `type(scope): description` or `type: description`. |
| [Google Engineering Practices: Writing good CL descriptions](https://google.github.io/eng-practices/review/developer/cl-descriptions.html) | Review guidance for clear changelist descriptions. | Relevant to `pr-drafter`'s body template, which requires summary, key changes, and impact grounded in diff facts. |
| [Google Engineering Practices: Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html) | Review guidance explaining why smaller changes are easier to review. | Comparable to `diff-analyzer`'s large or mixed-purpose PR confirmation gate. |
| [Google Engineering Practices: Code review standards](https://google.github.io/eng-practices/review/reviewer/standard.html) | Review guidance for assessing code changes. | Useful background for why `pr-creator` requires reviewer resolution and review-ready descriptions before submission. |

## Comparable Agent or Skill References

| Resource | What it is | Why it is relevant to `pr-creator` |
| --- | --- | --- |
| [Agent Skills overview - Claude Docs](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) | Documentation for packaging agent capabilities as skills. | `pr-creator` is itself a skill with `SKILL.md`, references, subagents, and progressive loading. |
| [Agent Skills best practices - Claude Docs](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices) | Guidance for skill structure and progressive disclosure. | Relevant to `pr-creator`'s local design, which keeps detailed contracts and source maps in references loaded only when needed. |
| [Claude Code subagents](https://docs.claude.com/en/docs/claude-code/sub-agents) | Documentation for specialized subagents in a coding-agent workflow. | `pr-creator` delegates repository inspection, preflight, diff analysis, drafting, metadata, and submission to focused subagents. |
| [OpenCode agents](https://opencode.ai/docs/agents/) | Documentation for OpenCode agent definitions. | This repository targets multiple runtimes, and `pr-creator`'s subagent registry is designed as portable specialist routing. |
| [GitHub CLI manual](https://cli.github.com/manual/) | Full command reference for GitHub CLI. | Broader command reference for `gh auth`, `gh repo`, `gh pr`, `gh label`, and verification commands referenced by the skill. |

## Verification Notes

- Verified public URLs during generation: GitHub CLI `gh pr create`, GitHub PR creation docs, GitHub CODEOWNERS docs, GitLab merge request creation docs, Git `diff` docs, GitLab CLI `mr create` source page, Bitbucket pull request REST API docs, and Google CL description guidance.
- The references above are not instructions that override `pr-creator`; they are resources to fetch when the local skill explicitly needs exact syntax, active-platform behavior, or writing/review rationale.
