# External Sources

> Read this file only to choose public URLs for just-in-time retrieval. Fetch
> the smallest set of pages that can actually change the current GitHub task
> planning, testing, or refactoring decision.

These public sources replace copied static methodology guidance. The skill
runs offline because routing, contracts, and templates are bundled locally;
fetched pages only clarify source-backed methodology rationale that could
flip the active artifact decision.

## Fetch Policy

- Fetch a source only when it can change the current artifact decision.
- Prefer zero external fetches on routine runs; local contracts are enough when
  the decision is straightforward.
- Prefer official or primary sources for exact methodology definitions.
- Use conceptual articles to justify a narrow decision, not to broaden scope.
- Use at most two pages per stage. Summarize in one or two sentences before
  applying the concept to the artifact.
- Cite exact URLs; do not paste long excerpts into planning artifacts.
- If fetching fails, continue from local contracts and record the
  unreachable URL in the subagent's `References fetched` or `Notes`.

## Source Routing

### Skill design and orchestration

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `agent-skills-overview` | https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview | The multi-file structure, frontmatter, or loading model of this skill is in question |
| `agent-skills-best-practices` | https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices | A change to concision, layering, naming, or progressive loading is being considered |
| `claude-subagents` | https://code.claude.com/docs/en/sub-agents | Subagent isolation, dispatch boundaries, or summary-only handoff is in question |
| `context-engineering` | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | Context-window protection or handoff design could change orchestration |
| `progressive-disclosure-skill` | https://skills.sh/flpbalada/fb-skills/progressive-disclosure | Catalog-level reference for staged loading; prefer official docs if this page lacks source content |
| `progressive-disclosure-ux` | https://www.nngroup.com/articles/progressive-disclosure/ | A short public description of progressive disclosure would help |

### Task readiness and acceptance

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `github-issues` | https://docs.github.com/en/issues/tracking-your-work-with-issues/about-issues | Issue or task-issue framing needs current public GitHub guidance |
| `github-issue-forms` | https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates | Acceptance-criteria or task-template shape needs source backing |
| `definition-of-ready` | https://www.atlassian.com/agile/scrum/definition-of-ready | Task-readiness criteria are unclear or contested |
| `definition-of-done` | https://www.atlassian.com/agile/project-management/definition-of-done | Definition-of-done shape is unclear or under debate |

### Planning and user impact

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `yagni` | https://martinfowler.com/bliki/Yagni.html | A proposed abstraction or extension serves only future flexibility |
| `wrong-abstraction` | https://www.sandimetz.com/blog/2016/1/20/the-wrong-abstraction | Shared abstraction may be riskier than duplication for this task |

### Testing strategy

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `bdd-overview` | https://cucumber.io/docs/bdd/ | Behavior-driven test grouping or terminology is unclear |
| `given-when-then` | https://martinfowler.com/bliki/GivenWhenThen.html | A test group needs Given/When/Then framing |
| `test-pyramid` | https://martinfowler.com/bliki/TestPyramid.html | Testing-level tradeoffs are unclear |
| `practical-test-pyramid` | https://martinfowler.com/articles/practical-test-pyramid.html | Concrete pyramid examples or anti-patterns are needed |
| `test-double` | https://martinfowler.com/bliki/TestDouble.html | Stub, mock, fake, or spy choice is unclear |

### Refactoring scope and moves

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `definition-of-refactoring` | https://martinfowler.com/bliki/DefinitionOfRefactoring.html | A recommendation risks changing behavior rather than refactoring |
| `refactoring-catalog` | https://refactoring.com/catalog/ | A recommendation needs a named, established refactoring move |

## Network Unavailable

Continue with bundled references. Do not claim source-backed methodology
that was not fetched. Prefer the smallest safe local plan and surface
unresolved uncertainty in the subagent's `Blockers` or `Notes` field.
