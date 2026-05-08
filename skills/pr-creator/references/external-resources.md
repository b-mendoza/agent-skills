# External Resources

> Load this file when a subagent needs authoritative command syntax, platform
> behavior, PR-writing guidance, or progressive-disclosure background. Fetch
> only the URL relevant to the current decision.

This reference is standalone. It replaces in-prompt static explanations with
public web resources that the agent retrieves on demand. Prefer the official
docs and installed CLI help for command flags. Use article-style resources for
writing quality and conceptual background, never for exact command syntax.

## Retrieval Policy

Fetch an external doc when one of these applies:

- The installed CLI version differs from a remembered command syntax.
- A non-GitHub platform is detected.
- The PR-writing or Conventional Commit choice is genuinely ambiguous.
- CODEOWNERS, reviewer, or label behavior affects whether the workflow can
  continue safely.
- The skill must explain a concept (progressive disclosure, draft vs. ready,
  small-CL guidance) and an authoritative external source exists.

When in doubt, prefer one targeted fetch over re-stating remembered prose.

## Progressive Disclosure and Agent Skills Background

| Need | URL |
| ---- | --- |
| Skill-style progressive disclosure example | https://skills.sh/flpbalada/fb-skills/progressive-disclosure |
| Interaction-design explanation of progressive disclosure | https://www.nngroup.com/articles/progressive-disclosure/ |
| Anthropic agent skills overview | https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview |
| Anthropic agent skills best practices | https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices |
| Anthropic Claude Code subagents | https://docs.claude.com/en/docs/claude-code/sub-agents |
| Cursor agent skills | https://cursor.com/docs/skills |
| OpenCode agents | https://opencode.ai/docs/agents/ |

## Git Compare and Branch State

| Need | URL |
| ---- | --- |
| `git diff` ranges and `...` semantics | https://git-scm.com/docs/git-diff |
| Commit range inspection | https://git-scm.com/docs/git-log |
| Working-tree status | https://git-scm.com/docs/git-status |
| Fetching remote refs | https://git-scm.com/docs/git-fetch |
| Pushing branches | https://git-scm.com/docs/git-push |
| Listing remote branches | https://git-scm.com/docs/git-ls-remote |
| GitHub compare commits and branches | https://docs.github.com/en/pull-requests/committing-changes-to-your-project/viewing-and-comparing-commits/comparing-commits |

## GitHub and GitHub Enterprise

| Need | URL |
| ---- | --- |
| GitHub CLI manual | https://cli.github.com/manual/ |
| `gh auth status` | https://cli.github.com/manual/gh_auth_status |
| `gh repo view` | https://cli.github.com/manual/gh_repo_view |
| `gh pr create` | https://cli.github.com/manual/gh_pr_create |
| `gh pr view` | https://cli.github.com/manual/gh_pr_view |
| `gh pr ready` (draft <-> ready) | https://cli.github.com/manual/gh_pr_ready |
| `gh label list` | https://cli.github.com/manual/gh_label_list |
| Creating a pull request | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request |
| Draft pull requests | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests#draft-pull-requests |
| Requesting PR reviews | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/requesting-a-pull-request-review |
| CODEOWNERS overview and syntax | https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners |
| GitHub labels | https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels |

## PR Writing and Review Quality

| Need | URL |
| ---- | --- |
| Conventional Commits spec | https://www.conventionalcommits.org/en/v1.0.0/ |
| Google CL description guidance | https://google.github.io/eng-practices/review/developer/cl-descriptions.html |
| Google small-change guidance | https://google.github.io/eng-practices/review/developer/small-cls.html |
| Google reviewer guidance (review etiquette) | https://google.github.io/eng-practices/review/reviewer/ |
| GitHub blog on writing better commit messages | https://github.blog/developer-skills/github/writing-better-commit-messages/ |
| "How to Write a Git Commit Message" (Chris Beams) | https://cbea.ms/git-commit/ |
| Anatomy of a high-quality PR description (Conventional Commits in practice) | https://www.conventionalcommits.org/en/v1.0.0/#examples |

## GitLab

| Need | URL |
| ---- | --- |
| GitLab merge request workflow | https://docs.gitlab.com/user/project/merge_requests/creating_merge_requests/ |
| GitLab CLI project | https://gitlab.com/gitlab-org/cli |
| `glab mr create` command source docs | https://gitlab.com/gitlab-org/cli/-/blob/main/docs/source/mr/create.md |
| GitLab labels | https://docs.gitlab.com/user/project/labels/ |
| GitLab Code Owners | https://docs.gitlab.com/user/project/codeowners/ |

## Bitbucket

| Need | URL |
| ---- | --- |
| Bitbucket Cloud create pull request | https://support.atlassian.com/bitbucket-cloud/docs/create-a-pull-request/ |
| Bitbucket pull request REST API | https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/ |
| Bitbucket branch refs REST API | https://developer.atlassian.com/cloud/bitbucket/rest/api-group-refs/ |
| Bitbucket default reviewers | https://support.atlassian.com/bitbucket-cloud/docs/use-default-reviewers-on-a-repository/ |
