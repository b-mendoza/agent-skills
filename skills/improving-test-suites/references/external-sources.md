# External Sources

Local repository evidence comes first. Fetch only when a source changes a concrete classification, rewrite, validation command, or security decision. Fetch one closest-match source first; fetch a second only if the first does not answer. HTTPS only.

## Testing Philosophy And Harness Shape

| Need | URL | Relevance |
| ---- | --- | --------- |
| Behavior over implementation | `https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html` | Grounds `implementation-detail-assertion` and public-behavior rewrites |
| Public APIs over implementation details | `https://testing.googleblog.com/2015/01/testing-on-toilet-prefer-testing-public.html` | Supports public contract testing |
| Use-case confidence over coverage | `https://kentcdodds.com/blog/how-to-know-what-to-test` | Supports high-value behaviors outranking coverage metrics |
| UI implementation details | `https://kentcdodds.com/blog/testing-implementation-details` | Frontend-specific implementation-detail guidance |
| Unit-test tradeoffs | `https://abseil.io/resources/swe-book/html/ch12.html` | Test sizing and brittleness |
| Test pyramid decisions | `https://martinfowler.com/articles/practical-test-pyramid.html` | Harness-shape decisions |
| Excessive end-to-end tests | `https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html` | Consolidating slow E2E duplicates |
| Mock versus stub reasoning | `https://martinfowler.com/articles/mocksArentStubs.html` | Grounds `unstable-mock` |

## Maintainability

| Need | URL | Relevance |
| ---- | --- | --------- |
| DAMP tests and readable setup | `https://testing.googleblog.com/2019/12/testing-on-toilet-tests-too-dry-make.html` | Fixture and duplication tradeoffs |
| General code-smell language | `https://martinfowler.com/bliki/CodeSmell.html` | Shared vocabulary |
| Smell catalog | `https://refactoring.guru/refactoring/smells` | Report explanation support |

## Framework Documentation

Fetch current docs before relying on syntax, runner flags, fixture scope, or command inference.

| Need | URL | Relevance |
| ---- | --- | --------- |
| pytest layout and conftest scope | `https://docs.pytest.org/en/stable/explanation/goodpractices.html` | Helper ownership and conftest decisions |
| pytest parametrization | `https://docs.pytest.org/en/stable/example/parametrize.html` | Parametrized harness rule |
| pytest fixtures | `https://docs.pytest.org/en/stable/explanation/fixtures.html` | Fixture-scope findings |
| Testing Library principles | `https://testing-library.com/docs/guiding-principles/` | Behavior-focused UI assertions |
| Jest command syntax | `https://jestjs.io/docs/getting-started` | Command inference |
| Vitest command syntax | `https://vitest.dev/guide/` | Command inference |
| Playwright best practices | `https://playwright.dev/docs/best-practices` | E2E consolidation decisions |
| Cypress best practices | `https://docs.cypress.io/app/core-concepts/best-practices` | E2E consolidation decisions |

## API And Security Testing

| Need | URL | Relevance |
| ---- | --- | --------- |
| API risk categories | `https://owasp.org/API-Security/editions/2023/en/0x11-t10/` | Surface checklist |
| API test ideas | `https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/00-API_Testing_Overview` | Gap-to-test mappings |
| Control-level security guidance | `https://cheatsheetseries.owasp.org/` | Per-control test expectations |
| Prompt-injection background | `https://owasp.org/www-project-top-10-for-large-language-model-applications/` | Untrusted-content rationale |

## Reporting Rule

Every report lists fetched URLs, reachability gaps, and influenced decisions. The handoff surfaces materially influential URLs and the residual prompt-injection risk whenever any external source was used.
