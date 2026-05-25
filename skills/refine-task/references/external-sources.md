# External Sources

Read this file only when local bundled guidance is too terse, source-backed
rationale is requested, current Jira/GitHub behavior matters, or a technical
claim requires current official documentation. Fetch one URL at a time and keep
only the relevant fact or citation.

External links are optional. The skill must still run from bundled files when
network access is unavailable.

## Progressive Disclosure And Skill Design

| Need | Source |
| ---- | ------ |
| Progressive disclosure concept and cognitive-load rationale | https://skills.sh/flpbalada/fb-skills/progressive-disclosure |
| Context engineering and keeping agents focused | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents |
| Subagent architecture concepts | https://docs.anthropic.com/en/docs/claude-code/sub-agents |

## Workflow Control And Posting Safety

| Need | Source |
| ---- | ------ |
| Bounded retry and explicit error handling patterns | https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html |
| Human approval before sensitive tool calls | https://openai.github.io/openai-agents-python/human_in_the_loop/ |
| GitHub issue comment API and posting permissions | https://docs.github.com/en/rest/issues/comments |
| Jira issue comment API and posting permissions | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/ |

## Jira And GitHub Work Items

| Need | Source |
| ---- | ------ |
| Jira issue and work item concepts | https://support.atlassian.com/jira-software-cloud/docs/what-are-issues/ |
| Jira issue types | https://support.atlassian.com/jira-software-cloud/docs/what-are-issue-types/ |
| Atlassian epics | https://www.atlassian.com/agile/project-management/epics |
| GitHub issue concepts | https://docs.github.com/en/issues/tracking-your-work-with-issues/about-issues |
| GitHub tasklists and sub-issue style planning | https://docs.github.com/en/issues/tracking-your-work-with-issues/using-tasklists |

## Refinement, Stories, And Acceptance Criteria

| Need | Source |
| ---- | ------ |
| Product backlog refinement in Scrum | https://scrumguides.org/scrum-guide.html |
| User stories and INVEST-style quality | https://www.mountaingoatsoftware.com/agile/user-stories |
| Agile user stories overview | https://www.atlassian.com/agile/project-management/user-stories |
| Acceptance criteria overview | https://www.atlassian.com/work-management/project-management/acceptance-criteria |
| Gherkin syntax for testable scenarios | https://cucumber.io/docs/gherkin/reference/ |
| Spikes as research work | https://www.mountaingoatsoftware.com/agile/user-stories/spikes |

## Design Thinking And User Journey Context

| Need | Source |
| ---- | ------ |
| Personas | https://www.nngroup.com/articles/persona/ |
| Customer journey mapping | https://www.nngroup.com/articles/customer-journey-mapping/ |
| Design thinking overview | https://www.nngroup.com/articles/design-thinking/ |

## Risk And Security Review

| Need | Source |
| ---- | ------ |
| OWASP Application Security Verification Standard | https://owasp.org/www-project-application-security-verification-standard/ |
| OWASP Top 10 web application risks | https://owasp.org/www-project-top-ten/ |
| Release and rollout risk background | https://sre.google/sre-book/release-engineering/ |

## Technical Claim Verification

For named libraries, frameworks, SDKs, APIs, CLIs, hooks, config keys, or version
claims, prefer the official documentation for that technology. If the host
runtime provides a documentation lookup tool, use it before general web search.
Otherwise fetch the official docs, changelog, or release notes named by the
issue. Do not use blogs as the sole source for current API behavior when
official docs are available.
