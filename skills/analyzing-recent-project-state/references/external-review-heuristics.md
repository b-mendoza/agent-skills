# External Review Heuristics

> Read this file only after local Git evidence raises a concrete review question. Fetch the smallest relevant external reference and cite it next to the finding it supports.

Project-specific documentation, tests, code conventions, and repository history take priority over generic external advice. Use these links as heuristics for judging observed changes, not as rules that override the project.

| Area | References | Fetch When |
| ---- | ---------- | ---------- |
| Git evidence | [git-status](https://git-scm.com/docs/git-status), [git-diff](https://git-scm.com/docs/git-diff), [git-log](https://git-scm.com/docs/git-log), [git-show](https://git-scm.com/docs/git-show), [gitrevisions](https://git-scm.com/docs/gitrevisions) | Command semantics, ranges, staged vs. unstaged state, merge bases, renames, mode changes, or revision syntax need clarification |
| Code review heuristics | [Google Engineering Practices: What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html) | Design, functionality, complexity, tests, naming, comments, docs, consistency, or context depth need judgment |
| Maintainability smells | [Martin Fowler: Code Smell](https://martinfowler.com/bliki/CodeSmell.html), [Refactoring.Guru: Code Smells](https://refactoring.guru/refactoring/smells) | Duplication, speculative generality, shotgun surgery, oversized units, weak boundaries, or excessive coupling appear |
| Testing strategy | [Martin Fowler: Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html), [Google Testing Blog: Just Say No to More End-to-End Tests](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html) | Tests look missing, brittle, too high-level, implementation-focused, or misaligned with changed behavior |
| Security-sensitive changes | [OWASP Code Review Guide](https://owasp.org/www-project-code-review-guide/), [OWASP Top 10](https://owasp.org/www-project-top-ten/) | Changes touch authentication, authorization, input validation, secrets, serialization, dependency trust, user data, or security boundaries |
| Configuration and deployability | [The Twelve-Factor App: Config](https://12factor.net/config) | Environment variables, checked-in config, secrets, deployment-specific values, or local vs. production configuration changed |
| Dependencies and compatibility | [Semantic Versioning](https://semver.org/), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) | Dependency bumps, public API compatibility, commit intent, release risk, or breaking-change signals need interpretation |

When web access is unavailable, continue from local evidence and state which reference would have helped if the limitation affects confidence.
