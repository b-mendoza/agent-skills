# External References: Analyzing Recent Project State

These references are relevant to `skills/analyzing-recent-project-state/` because the skill interprets local Git evidence, reviews recent changes for risk, separates facts from inference, and produces a safe-continuation handoff. The target skill's bundled `references/external-sources.md` is the primary source for this list; the entries below were checked against their public pages on 2026-06-12.

## Git Evidence And Revision Semantics

| Resource | What It Is | Why It Is Relevant |
| --- | --- | --- |
| [Git `status` documentation](https://git-scm.com/docs/git-status) | Official Git manual page for working-tree and index status. | The `git-evidence-collector` summarizes staged, unstaged, untracked, branch, and upstream state without returning raw command output. |
| [Git `diff` documentation](https://git-scm.com/docs/git-diff) | Official Git manual page for comparing working tree, index, commits, paths, stats, renames, and mode changes. | The collector is expected to inspect changed paths and diff stats while keeping raw diffs inside the subagent context. |
| [Git `log` documentation](https://git-scm.com/docs/git-log) | Official Git manual page for commit walks and history formatting. | The skill reviews recent commits and base-branch deltas as evidence for change themes. |
| [Git revisions documentation](https://git-scm.com/docs/gitrevisions) | Official Git reference for revision names and range syntax. | The skill asks for or infers `BASE_BRANCH`; revision-range and merge-base semantics affect whether a base comparison is trustworthy. |

## Review And Handoff Heuristics

| Resource | What It Is | Why It Is Relevant |
| --- | --- | --- |
| [Google Engineering Practices: What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html) | Public review guidance covering design, functionality, complexity, tests, naming, comments, and documentation. | The snapshot writer reports likely impact, risks, validation gaps, and next actions rather than merely listing changed files. |
| [Google Engineering Practices: Navigating a CL in review](https://google.github.io/eng-practices/review/reviewer/navigate.html) | Public guidance on choosing how to read a change during review. | The skill's `deep` mode inspects additional surrounding context only for changed high-risk areas, matching a selective review strategy. |
| [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) | A specification for structured commit messages. | The target skill treats commit messages as evidence leads, not proof of intent; this reference is useful when commit titles indicate scope or breaking-change signals. |

## Test, Security, Config, And Dependency Risk

| Resource | What It Is | Why It Is Relevant |
| --- | --- | --- |
| [Martin Fowler: Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html) | Testing strategy article describing layers of automated tests. | The snapshot template requires a test and validation review, including changed, missing, brittle, or poorly leveled tests when touched or implicated. |
| [OWASP Code Review Guide](https://owasp.org/www-project-code-review-guide/) | OWASP project for security-focused code review. | The writer may use static public guidance for security-sensitive changes involving auth, input validation, secrets, serialization, or trust boundaries. |
| [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) | OWASP practical security guidance organized by control area. | Useful when the recent changes touch a named security control and the report needs a narrow source-backed recommendation. |
| [The Twelve-Factor App: Config](https://12factor.net/config) | Public guidance on separating config from code. | The target skill has a `config` review focus and calls out secret-bearing diffs, env drift, and runtime configuration changes as validation concerns. |
| [GitHub Docs: Dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review) | GitHub documentation about reviewing dependency changes for supply-chain risk. | The skill reports dependency, lockfile, package, and tooling signals when touched by recent changes. |

## API And Compatibility Reasoning

| Resource | What It Is | Why It Is Relevant |
| --- | --- | --- |
| [Semantic Versioning 2.0.0](https://semver.org/) | Specification for version numbers and compatibility expectations. | Dependency bumps and public API changes may need breaking-change reasoning in the risks or next actions sections. |
| [Google AIP-180: Backwards compatibility](https://google.aip.dev/180) | API Improvement Proposal covering backward compatibility for APIs. | The skill may need compatibility framing when changed files affect API or schema behavior. |
| [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines) | Public REST API design and compatibility guidance. | Relevant when recent changes alter public REST interfaces, response shapes, status codes, or versioning behavior. |

## Comparable Tools And Workflows

| Resource | What It Is | Why It Is Relevant |
| --- | --- | --- |
| [GitHub pull request file review](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request) | GitHub workflow for inspecting proposed changes in a pull request. | Comparable to the skill's goal of helping a developer understand changed files, risks, and review focus before continuing. |
| [GitHub code scanning alerts](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/about-code-scanning-alerts) | GitHub documentation for reviewing static-analysis security and quality alerts. | Comparable as a source of evidence-backed findings, although the target skill does not run scanners or mutate repository state. |
| [GitHub dependency review action](https://github.com/actions/dependency-review-action) | GitHub Action that checks pull requests for dependency changes and vulnerabilities. | Comparable to the skill's dependency/config/tooling signal handling, but narrower and automated for dependency manifests. |

## Source-Grounded Limits

- The target skill uses external resources only as optional static background after local evidence raises a concrete question.
- External pages do not override the skill's read-only boundary, status routing, report template, or verification checklist.
- The target skill does not itself run GitHub review tools, dependency scanners, code scanning, or CI; those resources are comparable or supporting references, not described target-skill behavior.
