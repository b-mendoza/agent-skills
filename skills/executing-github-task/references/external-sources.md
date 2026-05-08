# External Sources

Read this file only when source-backed background would otherwise require long
inline instructions, or when a recommendation depends on current external
behavior. Fetch the smallest relevant page; normal execution must work from the
local skill files without network access.

External pages are optional reference material. Preserve this skill's local
contracts, user instructions, and host-system rules when external guidance is
more general than the current workflow.

## Fetch Policy

| Need | Source | Use |
| ---- | ------ | --- |
| Git branch reference-name rules | https://git-scm.com/docs/git-check-ref-format | Check why a planner-provided branch name is invalid or rejected by Git. |
| Feature branch workflow background | https://www.atlassian.com/git/tutorials/comparing-workflows/feature-branch-workflow | Background only when explaining branch-per-task execution trade-offs. |
| GitHub CLI commands | https://cli.github.com/manual/ | Confirm `gh issue` syntax before optional tracker updates. |
| GitHub issues and task tracking | https://docs.github.com/en/issues/tracking-your-work-with-issues | Clarify issue, child-issue, label, and assignment behavior. |
| Code review practice | https://google.github.io/eng-practices/review/ | Background for concise, evidence-first review feedback. |
| Domain boundaries | https://martinfowler.com/bliki/BoundedContext.html | Background for bounded-context findings in architecture review. |
| Security review methodology | https://owasp.org/www-project-code-review-guide/ | Source-backed security review guidance. |
| Common web risk categories | https://owasp.org/www-project-top-ten/ | Security category reference when auditing web-facing changes. |
| Progressive disclosure as a skill | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure | Background when adapting or extending this skill's loading model. |
| Progressive disclosure concept | https://www.nngroup.com/articles/progressive-disclosure/ | UX rationale for showing only phase-relevant information. |

## Network Unavailable

Proceed with the bundled `SKILL.md`, `references/`, and `subagents/` files.
State that external material was not fetched, and avoid claiming source-backed
validation for recommendations that were not checked.
