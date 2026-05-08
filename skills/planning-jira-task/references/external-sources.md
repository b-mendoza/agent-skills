# External Sources

> Read this file only to choose public URLs for just-in-time retrieval. Fetch the
> smallest number of pages that can change the current Jira task planning
> decision.

These public sources replace copied static methodology guidance. The skill is
usable without web access because routing, contracts, and templates are bundled
locally; fetched pages only clarify source-backed planning, testing,
refactoring, or progressive-disclosure rationale.

## Fetch Policy

- Fetch a source only when it can change the current artifact decision.
- Prefer official or primary sources for exact methodology definitions.
- Use conceptual articles to justify a narrow decision, not to broaden scope.
- If fetching fails, continue from local contracts when safe and record the
  unavailable URL in `References fetched` or `Notes`.

## Source Routing

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `progressive-disclosure-skill` | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure | Maintaining or explaining staged loading in this skill |
| `progressive-disclosure-ux` | https://www.nngroup.com/articles/progressive-disclosure/ | A short public explanation of showing only needed information would help |
| `context-engineering` | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | Context-window protection or subagent handoff rationale could change orchestration decisions |
| `jira-user-stories` | https://www.atlassian.com/agile/project-management/user-stories | Task readiness, acceptance criteria, or story framing needs public Jira-adjacent guidance |
| `bdd-overview` | https://cucumber.io/docs/bdd/ | Behavior-driven test grouping or terminology is unclear |
| `given-when-then` | https://martinfowler.com/bliki/GivenWhenThen.html | A test group needs Given/When/Then framing |
| `test-pyramid` | https://martinfowler.com/bliki/TestPyramid.html | Testing level tradeoffs are unclear |
| `definition-of-refactoring` | https://martinfowler.com/bliki/DefinitionOfRefactoring.html | A recommendation risks changing behavior rather than refactoring |
| `refactoring-catalog` | https://refactoring.com/catalog/ | A recommendation needs a named, established refactoring move |
| `yagni` | https://martinfowler.com/bliki/Yagni.html | A proposed abstraction or extension point serves only future flexibility |
| `wrong-abstraction` | https://www.sandimetz.com/blog/2016/1/20/the-wrong-abstraction | Shared abstraction may be riskier than duplication for this task |

## Network Unavailable

Continue with bundled references. Do not claim source-backed methodology that was
not fetched. Prefer the smallest safe local plan and make unresolved uncertainty
visible in the subagent's `Blockers` or `Notes` field.
