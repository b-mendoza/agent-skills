# External Sources

> Use this index only after local evidence raises a concrete question. Fetch the
> smallest relevant URL, apply it to that finding, then return to local evidence.

This file keeps reusable static background out of the always-loaded skill and
subagent prompts. The bundled skill files define the workflow; these websites
provide optional just-in-time support for interpretation.

## Loading Rules

- Start from Git evidence, project docs, tests, and repository conventions.
- Fetch one source first. Fetch a second only when the first does not answer the
  concrete question.
- Cite fetched sources only beside the finding they support.
- Follow bundled contracts and visible project conventions over generic public
  guidance.

## Source Routing

| Key | URL | Use when |
| --- | --- | -------- |
| `git-status` | https://git-scm.com/docs/git-status | Status flags, branch state, porcelain output, or short format semantics |
| `git-diff` | https://git-scm.com/docs/git-diff | Staged/unstaged diff behavior, stats, mode changes, or rename detection |
| `git-log` | https://git-scm.com/docs/git-log | Commit walks, formatting, decoration, or graph options |
| `git-show` | https://git-scm.com/docs/git-show | Inspecting HEAD or a specific commit with stat or summary output |
| `git-revisions` | https://git-scm.com/docs/gitrevisions | Revision ranges, `A..B`, `A...B`, or merge-base semantics |
| `review-what-to-look-for` | https://google.github.io/eng-practices/review/reviewer/looking-for.html | General review judgment: design, functionality, complexity, tests, naming, docs |
| `review-navigation` | https://google.github.io/eng-practices/review/reviewer/navigate.html | Choosing where to start reading and how deeply to inspect a change |
| `code-smell` | https://martinfowler.com/bliki/CodeSmell.html | Source-backed definition of a code smell |
| `refactoring-smells` | https://refactoring.guru/refactoring/smells | Catalog lookup for duplication, large class, shotgun surgery, and related smells |
| `test-pyramid` | https://martinfowler.com/bliki/TestPyramid.html | Framing missing, brittle, or poorly leveled tests |
| `e2e-skepticism` | https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html | Pushing back on excessive end-to-end coverage |
| `owasp-code-review` | https://owasp.org/www-project-code-review-guide/ | Security-sensitive changes touching auth, input validation, secrets, serialization, or trust boundaries |
| `owasp-top-ten` | https://owasp.org/www-project-top-ten/ | Categorizing a web-app security risk in user-facing terms |
| `owasp-cheatsheets` | https://cheatsheetseries.owasp.org/ | Concrete hardening guidance for a named security control |
| `twelve-factor-config` | https://12factor.net/config | Environment variables, secrets, or runtime config drift |
| `twelve-factor-parity` | https://12factor.net/dev-prod-parity | Local, CI, staging, and production parity concerns |
| `semver` | https://semver.org/ | Dependency bumps or public API changes require breaking-change reasoning |
| `dependency-review` | https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review | Dependency additions or lockfile churn need supply-chain review framing |
| `conventional-commits` | https://www.conventionalcommits.org/en/v1.0.0/ | Commit messages indicate intended scope or breaking-change signals |
| `microsoft-rest-guidelines` | https://github.com/microsoft/api-guidelines | Public REST interface, versioning, response shape, or compatibility changed |
| `google-aip-compat` | https://google.aip.dev/180 | API or schema backward-compatibility judgment is required |

## Source Note Format

When a source is fetched, summarize it before applying it:

```text
EXTERNAL_SOURCE: OK
Source: <url>
Used for: <finding>
Relevant fact: <one or two short facts>
Workflow impact: <none | adjusted finding | confidence note>
```

## Network Unavailable

Continue from local evidence and bundled references. Avoid version-specific
claims that require web confirmation, and add a confidence note only when the
missing source would materially change the recommendation.
