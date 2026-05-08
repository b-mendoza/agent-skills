# External Review Resources

> Read this file only when a phase needs current GitHub behavior, code-review
> judgment, security review guidance, writing guidance, or progressive disclosure
> background. Fetch one URL at a time, keep page contents inside the phase
> subagent, and return only the applied rule plus URL.

## Code Review Judgment

| Need | Source |
| ---- | ------ |
| General reviewer responsibilities | https://google.github.io/eng-practices/review/reviewer/ |
| What to look for in a review | https://google.github.io/eng-practices/review/reviewer/looking-for.html |
| Writing useful review comments | https://google.github.io/eng-practices/review/reviewer/comments.html |
| Security-focused review checklist | https://owasp.org/www-project-code-review-guide/ |
| Review process and high-impact risk checklist | https://docs.gitlab.com/development/code_review/ |

## GitHub Review Mechanics

| Need | Source |
| ---- | ------ |
| Pull request review decisions | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews |
| Reviewing proposed changes | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request |
| Line comments and suggestions | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request |
| Review comment REST fields | https://docs.github.com/en/rest/pulls/comments#create-a-review-comment-for-a-pull-request |
| Create pull request review REST endpoint | https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request |
| GitHub CLI review command | https://cli.github.com/manual/gh_pr_review |

## Writing And Tone

| Need | Source |
| ---- | ------ |
| Conventional review labels and structure | https://conventionalcomments.org/ |
| Plain technical writing | https://developers.google.com/tech-writing/one/just-enough-grammar |
| Common signs of synthetic writing | https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing |

## Progressive Disclosure Background

| Need | Source |
| ---- | ------ |
| Skill-style progressive disclosure example | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure |
| User-interface progressive disclosure concept | https://www.nngroup.com/articles/progressive-disclosure/ |

## Dependency-Specific Claims

When a finding depends on a library, framework, cloud service, API, SDK, or CLI,
fetch the current official documentation for that dependency with the available
documentation or web tool before treating the behavior as factual. Cite the exact
URL in `Sources checked` or `References fetched`.
