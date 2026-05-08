# External Sources

> Read this file only to choose public URLs for just-in-time retrieval. Fetch the
> smallest number of pages that can change the current commit decision.

These public sources replace copied static guidance. The skill remains usable
without web access because safety rules, routing, and output contracts are
bundled locally; fetched pages only clarify details when local context is not
enough.

## Fetch Policy

- Fetch a page only when its answer can change grouping, message syntax, staging
  behavior, verification, or final reporting.
- Pass URLs to the subagent doing the work instead of loading article text in the
  orchestrator.
- Return `References fetched: <url> - <one-line conclusion>`.
- If fetching fails, continue from bundled instructions when safe and report the
  missing reference in `References fetched`.

## Source Routing

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `progressive-disclosure-skill` | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure | Maintaining this skill's disclosure layers or explaining why references are loaded just in time |
| `progressive-disclosure-ux` | https://www.nngroup.com/articles/progressive-disclosure/ | A concise public explanation of hiding advanced detail until needed would help |
| `git-workflow` | https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository | The executor needs a refresher on how tracked, staged, and committed states interact |
| `git-status` | https://git-scm.com/docs/git-status | The summarizer needs exact porcelain/status behavior |
| `git-diff` | https://git-scm.com/docs/git-diff | The summarizer or executor needs exact unstaged/staged diff behavior |
| `git-add` | https://git-scm.com/docs/git-add | The executor needs exact pathspec, patch, or update staging behavior |
| `interactive-staging` | https://git-scm.com/book/en/v2/Git-Tools-Interactive-Staging | Mixed hunks require understanding whether safe non-interactive separation exists |
| `git-commit` | https://git-scm.com/docs/git-commit | Commit creation flags, message behavior, or hook effects are unclear |
| `conventional-commits` | https://www.conventionalcommits.org/en/v1.0.0/ | Type, scope, breaking-change syntax, or message format is unclear |
| `atomic-commits` | https://www.aleksandrhovhannisyan.com/blog/atomic-git-commits/ | A broad or mixed diff needs boundary rationale |
| `commit-message-style` | https://chris.beams.io/posts/git-commit/ | Repository history has no clear style and a human-readable subject/body decision is needed |
