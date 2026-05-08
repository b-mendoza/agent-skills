# External Resource Routing

Read this file only when a phase needs static background, current API details, or
review-communication guidance. Fetch the smallest relevant web page and return a
short finding with the URL, not a long excerpt.

## Runtime Resources

| Need | Fetch When | URL |
| ---- | ---------- | --- |
| Handle reviewer feedback respectfully | Assessment or drafting needs accept, clarify, or pushback guidance | https://google.github.io/eng-practices/review/developer/handling-comments.html |
| Resolve code-review disagreement by technical facts | Assessment is deciding whether pushback is justified | https://google.github.io/eng-practices/review/reviewer/standard.html |
| Understand review comment intent labels | Drafting or assessment needs comment taxonomy or blocking/non-blocking nuance | https://conventionalcomments.org/ |
| Improve written review tone | Drafting or verification finds wording stiff, defensive, or unclear | https://conventionalcomments.org/communication/ |
| Collect PR review comments or understand reply metadata | Collector or poster needs REST endpoint details | https://docs.github.com/en/rest/pulls/comments?apiVersion=2022-11-28 |
| Collect PR review summaries | Collector needs review body, state, or submitted-at metadata | https://docs.github.com/en/rest/pulls/reviews?apiVersion=2022-11-28 |
| Collect top-level PR conversation comments | Collector needs issue-comment endpoint details | https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28 |
| Inspect unresolved review threads | Collector needs thread-level GraphQL metadata such as resolved or outdated state | https://docs.github.com/en/graphql/reference/objects#pullrequestreviewthread |
| Use authenticated GitHub API through CLI | Collector or poster needs `gh api` flags or pagination behavior | https://cli.github.com/manual/gh_api |
| Read PR metadata through CLI | Collector needs `gh pr view` JSON fields or comment flags | https://cli.github.com/manual/gh_pr_view |
| Maintain this skill's disclosure shape | Future maintainer is changing the skill architecture | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure |
| Understand general progressive disclosure | Future maintainer needs a neutral explanation of progressive disclosure | https://www.nngroup.com/articles/progressive-disclosure/ |

## Current Documentation Rule

When a review comment depends on a library, framework, SDK, cloud service, API,
version, pricing, or policy, fetch that product's current official documentation
or release notes before assessing or verifying the claim. Prefer official vendor
docs over blogs. Cite the fetched URL in the assessment or verification evidence.

## Failure Handling

If an external page is unavailable and the task can be resolved from repository
or GitHub evidence, continue and record the missing URL under limitations. If the
missing page is required for a recency-sensitive claim, return
`NEEDS_CONTEXT` from the owning phase.
