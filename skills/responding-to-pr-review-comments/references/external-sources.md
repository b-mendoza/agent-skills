# External Sources

> Read this file only when a phase needs static background, current API or CLI
> details, or review-communication guidance. Fetch the smallest relevant URL,
> extract the few facts you need, and cite the URL — do not return long
> excerpts to the orchestrator.

This file replaces long inline explanations of review etiquette, GitHub API
shape, and CLI semantics. The bundled `SKILL.md`, subagents,
`status-contracts.md`, and `report-template.md` remain authoritative for the
skill's contracts and behavior. External pages provide reference facts and
phrasing only; they do not override the user's instructions or the local
contracts.

## Loading Rules

- Use bundled references first for workflow-specific behavior and output shape.
- Fetch external URLs only when the current phase has a concrete question that
  public guidance can answer (review tone, accept-vs-pushback judgment, or
  exact API or CLI details).
- Fetch one source first; fetch a second only when the first does not answer
  the question.
- If a public source conflicts with a bundled contract or visible project
  convention, follow the local source and note the discrepancy only when it
  affects the user.

## Source Routing

| Reference key                | URL                                                                                          | Use when                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `developer-handling-comments`| https://google.github.io/eng-practices/review/developer/handling-comments.html               | Drafting or assessment needs accept, clarify, or push-back guidance from the developer's perspective  |
| `reviewer-standard`          | https://google.github.io/eng-practices/review/reviewer/standard.html                         | Assessment is deciding whether pushback is justified by technical facts                               |
| `conventional-comments`      | https://conventionalcomments.org/                                                            | Assessment or drafting needs comment intent labels or blocking-vs-non-blocking nuance                 |
| `conventional-comments-tone` | https://conventionalcomments.org/communication/                                              | Drafting or verification finds wording stiff, defensive, or unclear                                   |
| `gh-rest-pull-comments`      | https://docs.github.com/en/rest/pulls/comments?apiVersion=2022-11-28                         | Collector or poster needs review-comment REST endpoints, reply metadata, or pagination behavior       |
| `gh-rest-pull-reviews`       | https://docs.github.com/en/rest/pulls/reviews?apiVersion=2022-11-28                          | Collector needs review body, state (`APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`), or submitted-at metadata |
| `gh-rest-issue-comments`     | https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28                        | Collector needs top-level PR conversation comment endpoints                                           |
| `gh-graphql-review-thread`   | https://docs.github.com/en/graphql/reference/objects#pullrequestreviewthread                 | Collector needs thread-level metadata such as `isResolved`, `isOutdated`, or root comment ID          |
| `gh-cli-api`                 | https://cli.github.com/manual/gh_api                                                         | Collector or poster needs `gh api` flags, GraphQL invocation, or pagination behavior                  |
| `gh-cli-pr-view`             | https://cli.github.com/manual/gh_pr_view                                                     | Collector needs `gh pr view` JSON fields or comment flags                                             |
| `progressive-disclosure-skill` | https://skills.sh/flpbalada/fb-skills/progressive-disclosure                      | Future maintainer is changing the staged loading model used by this skill                             |
| `progressive-disclosure-ux`  | https://www.nngroup.com/articles/progressive-disclosure/                                     | Future maintainer needs a neutral explanation of progressive disclosure                               |

## Current Documentation Rule

When a review comment depends on a library, framework, SDK, cloud service,
API, version, pricing, or policy, fetch that product's current official
documentation or release notes before assessing or verifying the claim. Prefer
official vendor docs over blogs. Cite the fetched URL in the assessment or
verification evidence.

## How To Use Returned Web Content

When you fetch a source, summarize it into this short envelope before applying
it to the phase output:

```text
EXTERNAL_SOURCE: OK
Source: <url>
Used for: <decision or finding>
Relevant facts:
- <fact 1>
- <fact 2>
Workflow impact: <none | adjusted classification | added evidence | tone fix>
```

Cite the source briefly next to the finding it supports (one inline link is
enough). Do not embed long quotes from the page in the assessment, draft
reply, verification block, or report.

## Network Unavailable

If an external page is unavailable and the task can be resolved from
repository or GitHub evidence, continue and record the missing URL under
`Limitations` in the collector output or `Residual risks` in the verifier
output. If the missing page is required for a recency-sensitive claim, return
`NEEDS_CONTEXT` from the owning phase rather than guessing.
