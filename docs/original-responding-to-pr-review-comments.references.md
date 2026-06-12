# External References for `responding-to-pr-review-comments`

This list documents external resources relevant to the target skill's actual behavior: assessing PR review feedback, gathering GitHub review-comment data, preserving supported reply targets, drafting professional responses, writing a verified report, and optionally posting approved replies. The target skill's local files remain authoritative for workflow behavior.

Access date for web resources: 2026-06-12.

## Skill Source Basis

The relevance notes below are grounded in the target package:

- `skills/responding-to-pr-review-comments/SKILL.md`: inputs, workflow, subagent registry, compact state, response policy, execution steps, and final envelopes.
- `skills/responding-to-pr-review-comments/references/external-sources.md`: bundled external-source routing table and fetch policy.
- `skills/responding-to-pr-review-comments/references/status-contracts.md`: collection, assessment, drafting, verification, writing, posting, and final envelope schemas.
- `skills/responding-to-pr-review-comments/references/report-template.md`: required report sections and read-back checks.
- `skills/responding-to-pr-review-comments/subagents/*.md`: phase-specific collection, assessment, drafting, verification, report writing, and posting responsibilities.

## Review Judgment and Reply Style

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [Google Engineering Practices: How to handle reviewer comments](https://google.github.io/eng-practices/review/developer/handling-comments.html) | Guidance for developers responding to code review feedback. | Directly supports the skill's response policy: understand the comment, fix code when the feedback is valid, ask clarifying questions when needed, and respond collaboratively rather than defensively. |
| [Google Engineering Practices: The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html) | Review-standard guidance emphasizing code health, technical facts, and practical trade-offs. | Relevant to the assessor's accept-versus-pushback judgment because the skill requires evidence before pushing back and asks the user when team preference or product intent decides. |
| [Conventional Comments](https://conventionalcomments.org/) | A lightweight convention for labeling review feedback such as suggestions, issues, questions, blocking, and non-blocking comments. | Useful when interpreting reviewer intent and drafting clear replies. The target skill's `external-sources.md` routes to it for comment intent labels and communication guidance. |
| [Conventional Comments: Communication](https://conventionalcomments.org/communication/) | Communication guidance associated with Conventional Comments. | Relevant to `reply-drafter` and `response-verifier`, which check that replies are clear, calm, specific, concise, and appropriate for an international team. |

## GitHub Review Data, Targets, and Posting Mechanics

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [GitHub Docs: About pull request reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews) | GitHub documentation explaining pull request reviews and review comments. | Relevant to the collector and taxonomy phases because the skill distinguishes review comments, review summaries, and PR conversation comments. |
| [GitHub Docs: Reviewing proposed changes in a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request) | GitHub UI documentation for reviewing, commenting, replying, and resolving conversations. | Relevant when confirming how supported review-comment threads differ from unsupported targets and when explaining report-only resolved conversations. |
| [GitHub REST API: Pull request review comments](https://docs.github.com/en/rest/pulls/comments?apiVersion=2026-03-10) | REST endpoints for listing, creating, and replying to pull request review comments. | Directly relevant to `review-comment-collector` and `thread-reply-poster`, especially the skill's rule that automated posting uses supported existing review-comment reply targets. |
| [GitHub REST API: Pull request reviews](https://docs.github.com/en/rest/pulls/reviews?apiVersion=2026-03-10) | REST endpoints for pull request review objects. | Relevant to collecting review summaries, review state, review body, and submitted-at metadata. |
| [GitHub REST API: Issue comments](https://docs.github.com/en/rest/issues/comments?apiVersion=2026-03-10) | REST endpoints for issue comments, which include top-level PR conversation comments. | Relevant because the target skill preserves top-level PR comments as `requires-user-choice:issue-comment` rather than converting them into review-comment replies. |
| [GitHub REST API: Pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api) | GitHub guidance for paginating REST API responses. | Directly supports the collection completeness gate: paginated sources must be exhausted or limitations recorded before downstream assessment. |
| [GitHub REST API: Best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) | GitHub guidance for safe REST API use, including mutative request practices and rate-limit concerns. | Relevant to optional posting, where the skill sends side-effecting requests only after approval and expects compact status with read-back verification. |
| [GitHub GraphQL API Reference](https://docs.github.com/en/graphql/reference) | GitHub GraphQL schema reference, including pull request review-thread objects and fields. | Relevant to unresolved-thread metadata such as resolution state and root-thread context. The target skill records limitations rather than guessing when unresolved metadata is unavailable. |
| [GitHub CLI manual: `gh api`](https://cli.github.com/manual/gh_api) | CLI documentation for making authenticated REST and GraphQL API calls. | Relevant to the collector and poster subagents, which may use `gh api`, including pagination or GraphQL calls, while keeping raw payloads out of orchestrator state. |
| [GitHub CLI manual: `gh pr view`](https://cli.github.com/manual/gh_pr_view) | CLI documentation for viewing pull request metadata. | Relevant to initial PR metadata collection and compact PR context gathering. |

## Comparable PR Review Automation and Agent Tools

These tools are comparable because they automate parts of PR review, PR feedback generation, or PR comment workflows. They are not substitutes for the target skill's response workflow because the target skill is specifically about assessing received review comments and preparing or posting replies under approval gates.

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [GitHub Copilot code review](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review) | GitHub's Copilot feature for requesting AI code review on pull requests. | Comparable as an AI-assisted PR review workflow. It is adjacent rather than identical: Copilot reviews code and leaves feedback, while the target skill responds to received review comments. |
| [PR-Agent](https://github.com/The-PR-Agent/pr-agent) | Open-source AI-powered pull request reviewer and PR automation project. | Comparable as an agentic PR review tool that analyzes PRs and produces review-related outputs. It helps position the target skill among PR agents, though the target focuses on response triage and reply safety. |
| [Danger JS](https://danger.systems/js/) | CI-time automation for common code review chores that can leave messages in PRs. | Comparable as a PR feedback automation mechanism. It reinforces why the target skill distinguishes automated comments, human review feedback, and evidence-backed responses. |
| [CodeRabbit pull request reviews](https://docs.coderabbit.ai/overview/pull-request-review) | AI code review product that analyzes pull requests and provides feedback. | Comparable as an AI review-comment generator. The target skill is complementary: it handles how a developer or agent should assess and reply to review feedback after it exists. |
| [Reviewpad Check](https://docs.reviewpad.com/reviewpad-check/) | Pull request workflow tool that highlights PRs needing attention. | Comparable as a PR workflow triage tool. It is less directly about replying to comments but relates to prioritizing review iteration risk and PR attention. |

## Progressive Disclosure and Workflow Structure

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [Progressive Disclosure skill](https://skills.sh/flpbalada/fb-skills/progressive-disclosure) | External skill reference for staged loading. | Relevant because the target skill explicitly uses a progressive loading map and dispatches subagents only when needed. |
| [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | UX article explaining progressive disclosure as showing only relevant information at the right time. | Relevant as background for the target skill's staged loading model, compact state, and just-in-time external-source policy. |

## Gaps and Limits

- I found and verified relevant external resources for review communication, GitHub review-comment mechanics, PR automation, and progressive disclosure.
- I did not include unverifiable blog posts, forum anecdotes, or vendor marketing pages unless a documentation page or project repository was available.
- External resources are supporting references only; they do not override the target package's local contracts, status schemas, or posting rules.
