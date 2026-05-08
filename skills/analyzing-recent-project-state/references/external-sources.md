# External Sources

> Read this file only when local Git evidence raises a concrete question that
> public guidance can answer. Fetch the smallest relevant URL; the bundled
> `SKILL.md`, subagents, handoff template, report template, and verification
> checklist remain authoritative for execution.

This file replaces long inline heuristic explanations. Public sources cover
static knowledge (Git command semantics, code review heuristics, security
review categories, twelve-factor config, semantic versioning, API
compatibility, etc.) so the always-loaded prompt stays small. Local project
documentation, tests, code conventions, and repository history take priority
over generic external advice.

## Loading Rules

- Use bundled references first for workflow-specific behavior.
- Fetch external URLs only when an observed local change needs a heuristic,
  command-syntax clarification, or source-backed rationale.
- Fetch one source first; fetch a second only when the first does not answer
  the question.
- Apply the source to the specific finding, then return to local evidence.
- If a web source conflicts with a bundled contract or visible project
  convention, follow the local source and note the discrepancy only when it
  affects the user.

## Source Routing

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `progressive-disclosure-skill` | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure | Maintaining or explaining the staged loading model used by this skill |
| `progressive-disclosure-ux` | https://www.nngroup.com/articles/progressive-disclosure/ | A short public explanation of showing only phase-relevant information |
| `context-engineering` | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | Background on just-in-time retrieval and long-horizon agent context |
| `git-status` | https://git-scm.com/docs/git-status | Status flags, porcelain output, branch state, or short format unclear |
| `git-diff` | https://git-scm.com/docs/git-diff | Unstaged vs staged behavior, rename detection, mode changes, or `--stat` semantics unclear |
| `git-log` | https://git-scm.com/docs/git-log | Pretty formats, walk options, decoration, or graph rendering unclear |
| `git-show` | https://git-scm.com/docs/git-show | Commit + stat + summary view of HEAD or a specific revision unclear |
| `git-revisions` | https://git-scm.com/docs/gitrevisions | Revision and range syntax, including `A...B`, `A..B`, merge bases |
| `code-review-looking-for` | https://google.github.io/eng-practices/review/reviewer/looking-for.html | General code review judgment: design, functionality, complexity, naming, comments, docs |
| `code-review-navigate` | https://google.github.io/eng-practices/review/reviewer/navigate.html | How to navigate a change: where to start reading, depth, context |
| `code-smell` | https://martinfowler.com/bliki/CodeSmell.html | Source-backed definition of code smells when calling one out in the report |
| `refactoring-smells` | https://refactoring.guru/refactoring/smells | Catalog of common smells (duplication, large class, shotgun surgery, etc.) |
| `test-pyramid` | https://martinfowler.com/bliki/TestPyramid.html | Calling out brittle, missing, or over-leveled tests |
| `e2e-skepticism` | https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html | Pushing back on excessive end-to-end coverage in changed areas |
| `owasp-code-review` | https://owasp.org/www-project-code-review-guide/ | Security-sensitive change touches auth, input validation, secrets, serialization, or trust boundaries |
| `owasp-top-ten` | https://owasp.org/www-project-top-ten/ | Categorizing a security risk in user-facing terms |
| `owasp-cheatsheets` | https://cheatsheetseries.owasp.org/ | Concrete control or hardening guidance for a named security risk |
| `twelve-factor-config` | https://12factor.net/config | Environment variables, secrets, or runtime config drift between dev and prod |
| `twelve-factor-parity` | https://12factor.net/dev-prod-parity | Local vs production behavior, Docker/CI mismatch, or environment-specific bugs |
| `semver` | https://semver.org/ | Dependency bumps or public API change requires breaking-change reasoning |
| `conventional-commits` | https://www.conventionalcommits.org/en/v1.0.0/ | Commit log indicates intended scope or breaking-change signal |
| `microsoft-rest-guidelines` | https://github.com/microsoft/api-guidelines | Public REST interface, versioning, or response shape changed |
| `google-aip-compat` | https://google.aip.dev/180 | API or schema backward-compatibility judgment is required |

## How To Use Returned Web Content

When you fetch a source, summarize it into one of these forms before applying
it to the report:

```text
EXTERNAL_SOURCE: OK
Source: <url>
Used for: <decision or finding>
Relevant facts:
- <fact 1>
- <fact 2>
Workflow impact: <none | adjusted finding | added confidence note>
```

Cite the source briefly next to the finding it supports (one inline link is
enough). Do not embed long quotes from the page in the report.

## Network Unavailable

Continue from local Git evidence and bundled references. State that external
material was not fetched, avoid claiming version-specific facts, and add a
short confidence note only when missing source material would have changed
the recommendation. Use the report's existing risk and validation sections;
do not invent a separate "uncertainty" appendix.
