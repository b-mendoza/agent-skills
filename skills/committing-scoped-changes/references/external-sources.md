# External Sources

> Read this file only when a public page can change the next commit decision.
> Fetch the smallest number of URLs that resolve the open question and pass them
> to the working subagent. The orchestrator does not paste fetched article text
> into its own context.

External pages are progressive-disclosure material. They replace bundled static
guidance about Git mechanics, atomic-commit theory, and message conventions so
the always-loaded skill body stays small. Bundled rules in this skill package
(input contracts, subagent registry, report contracts, escalation codes) remain
authoritative for execution; web content only resolves details when local rules
are insufficient.

## Fetch Policy

- Fetch a page only when its answer can change grouping, message syntax, staging
  behavior, verification, or final reporting.
- Pass URLs to the subagent doing the work; do not load article text in the
  orchestrator.
- After a subagent fetches a URL, it returns the URL plus a one-line conclusion
  (see "Return Format" below).
- If a fetch fails, continue from bundled rules when safe and report the missing
  reference in the subagent's `References fetched` line.
- Local rules win when they conflict with web content. Note the conflict only
  when it affects the user's commit.

## Source Routing

### Skill design and progressive disclosure

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `progressive-disclosure-skill` | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure | Maintaining the skill's disclosure layers or explaining why references load just in time |
| `progressive-disclosure-ux` | https://www.nngroup.com/articles/progressive-disclosure/ | A short, public explanation of hiding advanced detail until needed would help |
| `context-engineering` | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | Just-in-time retrieval, long-horizon agent context patterns, or subagent isolation rationale |

### Git mechanics (used by state summarizer and commit executor)

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `git-workflow` | https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository | Refresher needed on how tracked, staged, and committed states interact |
| `git-status` | https://git-scm.com/docs/git-status | Exact porcelain or status field behavior is unclear |
| `git-diff` | https://git-scm.com/docs/git-diff | Exact unstaged or staged diff invocation, pathspec, or context behavior is unclear |
| `git-add` | https://git-scm.com/docs/git-add | Exact pathspec, `--patch`, or `--update` staging semantics are unclear |
| `interactive-staging` | https://git-scm.com/book/en/v2/Git-Tools-Interactive-Staging | Mixed hunks need a check on whether safe non-interactive separation exists |
| `git-commit` | https://git-scm.com/docs/git-commit | Commit creation flags, message behavior, hook side effects, or amend rules are unclear |

### Commit grouping and message style (used by boundary planner)

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `atomic-commits` | https://www.aleksandrhovhannisyan.com/blog/atomic-git-commits/ | A broad or mixed diff needs grouping rationale (one reason, independently revertable) |
| `conventional-commits` | https://www.conventionalcommits.org/en/v1.0.0/ | Type, scope, breaking-change marker, or footer syntax must be exact |
| `commit-message-style` | https://chris.beams.io/posts/git-commit/ | Repository history shows no clear style and a human-readable subject/body decision is needed |

## Return Format

When a subagent fetches a URL, summarize the fetch in one of these forms before
returning to the orchestrator.

Single-line form (preferred when the fetch only confirmed an existing decision):

```text
References fetched: <url> - <one-line conclusion>
```

Block form (use when multiple URLs were consulted or the conclusion changed the
plan):

```text
EXTERNAL_SOURCE: OK
Source: <url>
Used for: <decision or check>
Relevant facts:
- <fact 1>
- <fact 2>
Workflow impact: <none | changed grouping | changed message | changed verification | user action needed>
```

If a page cannot be fetched, return:

```text
References fetched: <url> - not fetched: <reason>
```

## When Network Access Is Unavailable

Continue with bundled rules. Avoid claiming exact flag behavior or version-
specific syntax that the unfetched page would have confirmed. Report the missing
external check only when it would have changed the commit decision.
