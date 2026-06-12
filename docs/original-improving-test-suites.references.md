# External References For `improving-test-suites`

This file lists external resources relevant to the `improving-test-suites` skill. The target skill's own source-routing table is `skills/improving-test-suites/references/external-sources.md`; the entries below are external websites, documentation, and testing resources that support similar work: trimming brittle tests, preferring public behavior, improving fixtures and readability, choosing framework-specific syntax, and reviewing API/security-sensitive coverage. URLs were verified on June 12, 2026.

## Testing Philosophy And Harness Shape

- [Testing on the Toilet: Test Behavior, Not Implementation](https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html) - Relevant because the skill's central mental model is to preserve behavior contracts and delete or rewrite implementation-detail assertions.
- [Testing on the Toilet: Prefer Testing Public APIs Over Implementation-Detail Classes](https://testing.googleblog.com/2015/01/testing-on-toilet-prefer-testing-public.html) - Relevant to the value reviewer and refactorer instructions to assert through public behavior rather than private structure.
- [How to know what to test](https://kentcdodds.com/blog/how-to-know-what-to-test) - Relevant to the skill's emphasis on use-case confidence over coverage inventory and its rule that missing tests must map to visible public contracts or realistic failure surfaces.
- [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details) - Relevant for UI, component, and hook tests where internal state or component instances can create brittle, low-value coverage.
- [Software Engineering at Google, Chapter 12: Unit Testing](https://abseil.io/resources/swe-book/html/ch12.html) - Relevant as broad testing guidance for test value, brittleness, scope, meaningful failures, and maintainable unit tests.
- [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) - Relevant when the skill balances unit, integration, contract, UI, and end-to-end coverage while avoiding a large slow harness.
- [Just Say No to More End-to-End Tests](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html) - Relevant when the skill should push back on excessive high-level tests in favor of smaller, more targeted behavior checks.
- [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) - Relevant to the skill's handling of mock-heavy suites, unstable mock interaction assertions, and collaboration-test trade-offs.

## Maintainability, Fixtures, And Test Smells

- [Testing on the Toilet: Tests Too DRY? Make Them DAMP!](https://testing.googleblog.com/2019/12/testing-on-toilet-tests-too-dry-make.html) - Relevant to the maintainability reviewer guidance to avoid over-abstracted helpers that hide the rule under test.
- [xUnit Test Patterns](https://xunitpatterns.com/) - Relevant as a catalog for test doubles, fixtures, patterns, and test smells comparable to the skill's low-value categories and maintainability review.
- [Code Smell](https://martinfowler.com/bliki/CodeSmell.html) - Relevant when a reviewer needs source-backed language for calling out smell-like test or fixture problems without treating them as automatic failures.

## Python Test Framework Sources

- [pytest Good Integration Practices](https://docs.pytest.org/en/stable/explanation/goodpractices.html) - Relevant when the skill needs current pytest suite layout, discovery, and integration-practice guidance.
- [pytest Parametrizing tests](https://docs.pytest.org/en/stable/example/parametrize.html) - Relevant to the minimal harness rule that duplicated cases for one rule can often become one parametrized test.
- [pytest About fixtures](https://docs.pytest.org/en/stable/explanation/fixtures.html) - Relevant to fixture-scope, fixture-composition, and dependency-noise decisions in the maintainability review.

## JavaScript, UI, And End-To-End Test Sources

- [Testing Library Guiding Principles](https://testing-library.com/docs/guiding-principles/) - Relevant when UI tests should resemble user-observable behavior rather than component internals.
- [Jest Getting Started](https://jestjs.io/docs/getting-started) - Relevant when the validator or refactorer needs current Jest command, matcher, mocking, or configuration syntax.
- [Vitest Guide](https://vitest.dev/guide/) - Relevant when the target suite uses Vitest and the skill needs current framework behavior or command guidance.
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) - Relevant to end-to-end test design, locator choices, and flakiness reduction when a target suite uses Playwright.
- [Cypress Best Practices](https://docs.cypress.io/app/core-concepts/best-practices) - Relevant to Cypress-specific selector strategy, test isolation, and end-to-end design decisions.

## API And Security Testing Sources

- [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) - Relevant to the API/security reviewer for categorizing authorization, authentication, unsafe consumption, and other API risks.
- [OWASP Web Security Testing Guide: API Testing Overview](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/00-API_Testing_Overview) - Relevant when the skill reviews API input validation, HTTP method/status behavior, auth boundaries, and API technology assumptions.
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) - Relevant when a concrete named security risk needs control-level or hardening guidance before recommending a security-sensitive test.

## Notes On Comparable External Tools

- I did not include unverified external agents or orchestrators. The target skill defines a specific subagent-driven workflow with status routing, scoped mutation, validation, repair, and final handoff; the verified external comparables are testing resources, framework docs, and security references that support the concrete decisions its subagents are allowed to make.
- External resources are advisory in this skill. Local tests, production code, public contracts, bundled heuristics, and co-located templates take priority; public sources are fetched only when they change a concrete keep, delete, rewrite, consolidate, add, validation, or security recommendation.
