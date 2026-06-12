# External references for refine-task

This file lists external resources relevant to `refine-task`, a reviewer-only refinement skill for Jira and GitHub work items. The target skill explicitly keeps external sources optional and says the skill must still run from bundled files when network access is unavailable. The resources below are therefore background, verification, and comparison references, not required runtime dependencies.

## Work item platforms and posting boundaries

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [GitHub REST API endpoints for issue comments](https://docs.github.com/en/rest/issues/comments) | Official GitHub documentation for issue comment operations and permissions. | `refine-task` allows only one possible GitHub mutation: posting the exact reviewer-provided refinement comment when explicit posting gates pass. This page is the relevant source for current comment API behavior and permission checks. |
| [Jira Cloud REST API issue comments](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/) | Official Atlassian Cloud API documentation for issue comment operations. | The Jira equivalent of the GitHub comment API. It is relevant when `WRITE_MODE=post-comment` targets a Jira item and tooling or permissions must be checked. |
| [About GitHub Issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/about-issues) | GitHub's overview of issues as work-tracking units. | Grounding for the GitHub issue and parent-issue side of `ITEM_URL` and `ITEM_CONTEXT`. |
| [Adding GitHub sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues) | GitHub documentation for parent and sub-issue hierarchy. | Relevant because `refine-task` may review child-work readiness and suggest hierarchy questions, while never creating or changing sub-issues itself. |
| [Creating GitHub issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies) | GitHub documentation for blocked-by and blocking relationships. | Relevant to the dependency checks and the rule that dependency changes are advisory or deferred, not performed by the skill. |
| [Atlassian Jira work types](https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-types/) | Atlassian support documentation for Jira work types and hierarchy concepts. | Helps interpret whether a Jira item is an epic, story, task, bug, or subtask during readiness review. |
| [Atlassian epics](https://www.atlassian.com/agile/project-management/epics) | Atlassian guidance on epics as larger bodies of work. | Relevant to epic and parent-issue review, child grouping, and split-signal assessment. |

## Refinement, stories, acceptance criteria, and spikes

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [The Scrum Guide](https://scrumguides.org/scrum-guide.html) | The official Scrum Guide, including Product Backlog refinement concepts. | Comparable process background for reviewing whether backlog items are sufficiently understood, ordered, and refined. |
| [Mountain Goat Software: User Stories](https://www.mountaingoatsoftware.com/agile/user-stories) | Mike Cohn's guide to user stories, conversation, confirmation, and splitting. | Relevant to `refine-task` checks for goal, persona, user value, acceptance criteria, and whether an item should be split. |
| [Atlassian acceptance criteria guide](https://www.atlassian.com/work-management/project-management/acceptance-criteria) | Atlassian overview of acceptance criteria and completion conditions. | Relevant to the skill's outcome and readiness checks, especially observable and testable completion criteria. |
| [Cucumber Gherkin reference](https://cucumber.io/docs/gherkin/reference/) | Official reference for Gherkin scenario syntax. | Useful when a work item uses or should use scenario-style acceptance criteria that need to be checked for clarity and testability. |
| [Mountain Goat Software: Spikes](https://www.mountaingoatsoftware.com/blog/spikes/x22) | Agile guidance on spikes as research work. | Relevant to `Needs spike` classification, where unresolved feasibility, API behavior, data uncertainty, or migration risk blocks implementation planning. |

## User, journey, risk, and security context

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [Nielsen Norman Group: Personas](https://www.nngroup.com/articles/persona/) | UX reference on personas as research-grounded representations of users. | Relevant to the persona readiness check: the skill asks who is affected and what user need, context, pain point, motivation, and constraint are described. |
| [Nielsen Norman Group: Customer journey mapping](https://www.nngroup.com/articles/customer-journey-mapping/) | UX reference on mapping user goals, actions, touchpoints, and insights. | Relevant to the journey readiness check: the skill looks for before state, trigger, happy path, edge path, and end state. |
| [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/) | OWASP application security verification framework. | Relevant when item readiness depends on security, data, permissions, or operational-risk findings that require gated recommendations. |
| [OWASP Top 10](https://owasp.org/www-project-top-ten/) | OWASP's common web application risk categories. | Useful background for security-risk classification when a work item raises application security concerns. |
| [Google SRE: Release Engineering](https://sre.google/sre-book/release-engineering/) | Google SRE book chapter on release engineering. | Relevant to rollout, release, rollback, and operational-risk questions that can block readiness or require human-gated recommendations. |

## Agent workflow and safety patterns

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [OpenAI Agents SDK: Human-in-the-loop](https://openai.github.io/openai-agents-python/human_in_the_loop/) | Documentation for requiring approval before tool calls in agent workflows. | Comparable to `refine-task` gates for posting and sensitive recommendations. |
| [AWS Step Functions error handling](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html) | AWS documentation for retry, catch, and bounded error handling patterns. | Comparable workflow-control reference for `refine-task` retry limits, blocked/error routing, and no-retry posting behavior. |
| [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Engineering article on keeping agent context focused. | Relevant to the coordinator rule that only compact verdict fields and the final comment should be retained. |
| [Anthropic Claude Code subagents](https://docs.anthropic.com/en/docs/claude-code/sub-agents) | Documentation for subagent-style task delegation. | Comparable to the skill's coordinator/subagent split: `refine-task` routes detailed review to `refinement-reviewer`. |
| [Progressive disclosure skill design note](https://skills.sh/flpbalada/fb-skills/progressive-disclosure) | Skill-design guidance on loading detail only when needed. | Relevant because `refine-task` progressively loads reviewer policy, checks, comment template, quality checklist, and external sources only at the decision point. |

## Verification notes

- These references are all external resources named or implied by `skills/refine-task/references/external-sources.md`.
- Representative platform and process pages were opened on 2026-06-12 to verify that the URLs resolve: GitHub issue comments, Jira issue comments, GitHub issues, GitHub sub-issues, GitHub dependencies, Jira work types, Atlassian epics, Scrum Guide, Mountain Goat user stories and spikes, Atlassian acceptance criteria, Cucumber Gherkin, NN/g personas and journey mapping, OWASP ASVS, and OpenAI human-in-the-loop.
- The skill itself remains source-of-truth for behavior. These references should be fetched just in time only when the user asks for source-backed rationale, current Jira/GitHub behavior matters, a technical claim requires current official documentation, or local guidance is too terse for the decision at hand.
