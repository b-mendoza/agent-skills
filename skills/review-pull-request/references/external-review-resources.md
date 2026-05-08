# External Review Resources

> Read this file when a phase needs current GitHub mechanics, code-review
> judgment, security guidance, writing/tone rules, or progressive-disclosure
> background. Fetch one URL at a time, keep page contents inside your own
> context, and return only the applied rule plus the URL you used.

This index is the single source of static knowledge for this skill. Subagents
delegate "what is the rule?" questions here so the always-loaded prompt stays
small. Each row tells you when to fetch and what the page provides.

## Fetch Policy

1. Find the row that matches your current need.
2. Fetch only that URL with your available web/documentation tool.
3. Apply the rule to the current artifact.
4. Cite the URL in `Sources checked` or `References fetched`.
5. Discard the fetched page from your output. Never forward raw page contents
   to the orchestrator.

If no web tool is available, proceed using the bundled instructions, set
`References fetched: none`, and add a residual risk noting which rule could
not be re-verified against current docs.

## Code Review Judgment

| Need | Source |
| ---- | ------ |
| Full reviewer checklist (correctness, design, complexity, tests, naming, comments, style, consistency, docs) | https://google.github.io/eng-practices/review/reviewer/looking-for.html |
| Reviewer responsibilities, scope, and pace | https://google.github.io/eng-practices/review/reviewer/ |
| How to write useful, kind, and specific review comments | https://google.github.io/eng-practices/review/reviewer/comments.html |
| Conventional review labels (`praise`, `nitpick`, `suggestion`, `issue`, `question`, `thought`, `chore`) and decorations (`blocking`, `non-blocking`) | https://conventionalcomments.org/ |
| Security-focused code review checklist by topic | https://owasp.org/www-project-code-review-guide/ |
| GitLab review process and high-impact-risk checklist | https://docs.gitlab.com/development/code_review/ |

## GitHub Review Mechanics

| Need | Source |
| ---- | ------ |
| Pull request review decisions (`COMMENT`, `APPROVE`, `REQUEST_CHANGES`) | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews |
| Reviewing proposed changes (UI workflow) | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request |
| Adding line comments and inline `suggestion` blocks | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request |
| Review comment REST fields (`path`, `line`, `side`, `start_line`, `start_side`) | https://docs.github.com/en/rest/pulls/comments#create-a-review-comment-for-a-pull-request |
| Create-review REST endpoint (`event`, `body`, `comments[]`) | https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request |
| `gh pr review` CLI flags and behavior | https://cli.github.com/manual/gh_pr_review |
| `gh api` for arbitrary REST calls when `gh pr review` is insufficient | https://cli.github.com/manual/gh_api |

## Writing And Tone

| Need | Source |
| ---- | ------ |
| Plain technical writing principles | https://developers.google.com/tech-writing/one/just-enough-grammar |
| Patterns that signal AI-generated prose (avoid them in comments) | https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing |

## Progressive Disclosure Background

| Need | Source |
| ---- | ------ |
| Skill-style progressive disclosure example | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure |
| Anthropic Agent Skills overview (loading model, anatomy, levels) | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview |
| Anthropic Agent Skills authoring best practices | https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices |
| Nielsen Norman Group on progressive disclosure as a UX pattern | https://www.nngroup.com/articles/progressive-disclosure/ |

## Dependency-Specific Claims

When a finding depends on a library, framework, cloud service, API, SDK, or
CLI, fetch the current official documentation for that dependency before
treating the behavior as factual. Cite the exact URL in `Sources checked` or
`References fetched`. Treat training-data recall about library behavior as a
hypothesis, not a fact, until confirmed against current docs.
