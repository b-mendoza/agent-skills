# External Review Heuristics

> Read this file only after local Git evidence raises a concrete review question. Fetch the smallest relevant public source and cite it next to the finding it supports.

Project documentation, tests, code conventions, and repository history take priority over generic external advice. These links replace long in-prompt heuristic explanations; use them as just-in-time references, not as rules that override the project.

## Fetch Policy

1. Choose the row whose trigger matches an observed local change.
2. Fetch one source first; fetch a second only when the first does not answer the question.
3. Apply the source to the specific finding, then return to local evidence.
4. If web access is unavailable, continue from local evidence and state which source would have helped only when confidence is affected.

## Source Routes

| Area | Fetch When | Public Sources |
| ---- | ---------- | -------------- |
| Git evidence | Command semantics, ranges, staged vs. unstaged state, merge bases, renames, mode changes, or revision syntax need clarification | [git-status](https://git-scm.com/docs/git-status), [git-diff](https://git-scm.com/docs/git-diff), [git-log](https://git-scm.com/docs/git-log), [git-show](https://git-scm.com/docs/git-show), [gitrevisions](https://git-scm.com/docs/gitrevisions) |
| General code review | Design, functionality, complexity, tests, naming, comments, docs, consistency, or context depth need judgment | [Google Engineering Practices: What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html), [Google Engineering Practices: Navigating a CL in review](https://google.github.io/eng-practices/review/reviewer/navigate.html) |
| Maintainability smells | Duplication, speculative generality, shotgun surgery, oversized units, weak boundaries, excessive coupling, or confusing abstractions appear | [Martin Fowler: Code Smell](https://martinfowler.com/bliki/CodeSmell.html), [Refactoring.Guru: Code Smells](https://refactoring.guru/refactoring/smells) |
| Testing strategy | Tests look missing, brittle, too high-level, implementation-focused, redundant, or misaligned with changed behavior | [Martin Fowler: Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html), [Google Testing Blog: Just Say No to More End-to-End Tests](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html) |
| Security-sensitive changes | Changes touch authentication, authorization, input validation, secrets, serialization, dependency trust, user data, or security boundaries | [OWASP Code Review Guide](https://owasp.org/www-project-code-review-guide/), [OWASP Top 10](https://owasp.org/www-project-top-ten/), [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) |
| Configuration and deployability | Environment variables, checked-in config, secrets, deployment-specific values, local vs. production behavior, or runtime config changed | [The Twelve-Factor App: Config](https://12factor.net/config), [Twelve-Factor App: Dev/prod parity](https://12factor.net/dev-prod-parity) |
| Dependencies and compatibility | Dependency bumps, lockfile churn, public API compatibility, release risk, or breaking-change signals need interpretation | [Semantic Versioning](https://semver.org/), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) |
| API and schema changes | Public interfaces, request/response shapes, database schemas, migrations, or compatibility contracts changed | [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines), [Google AIP: Backwards Compatibility](https://google.aip.dev/180) |
