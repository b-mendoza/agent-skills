# Testing Reference Map

> Fetch one smallest relevant source for the current decision; this map is a URL
> router, not a substitute for local code evidence.

Load this file only when a concrete test-suite decision needs external support.
Prefer local tests, production code, public contracts, and observed failures. Use
external sources to resolve a specific question such as behavior boundaries,
public API testing, test pyramid trade-offs, framework syntax, parametrization,
or API/security coverage. Record every fetched URL in the report.

## Source Selection

| Decision need | Fetch first | Fetch if first is unavailable or narrower |
| ------------- | ----------- | ----------------------------------------- |
| Distinguish behavior tests from implementation-detail tests | Google Testing Blog: Test Behavior, Not Implementation, https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html | Kent C. Dodds: Testing Implementation Details, https://kentcdodds.com/blog/testing-implementation-details |
| Prefer public APIs and observable contracts over internals | Google Testing Blog: Prefer Testing Public APIs Over Implementation-Detail Classes, https://testing.googleblog.com/2015/01/testing-on-toilet-prefer-testing-public.html | Software Engineering at Google, Unit Testing, https://abseil.io/resources/swe-book/html/ch12.html |
| Decide what is worth testing | Kent C. Dodds: How to Know What to Test, https://kentcdodds.com/blog/how-to-know-what-to-test | Software Engineering at Google, Unit Testing, https://abseil.io/resources/swe-book/html/ch12.html |
| Balance unit, integration, and end-to-end coverage | Martin Fowler: The Practical Test Pyramid, https://martinfowler.com/articles/practical-test-pyramid.html | none |
| Reason about mocks, stubs, and collaboration tests | Martin Fowler: Mocks Aren't Stubs, https://martinfowler.com/articles/mocksArentStubs.html | Google Testing Blog: Test Behavior, Not Implementation, https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html |
| Make tests readable without over-abstracting setup | Google Testing Blog: Tests Too DRY? Make Them DAMP!, https://testing.googleblog.com/2019/12/testing-on-toilet-tests-too-dry-make.html | Software Engineering at Google, Unit Testing, https://abseil.io/resources/swe-book/html/ch12.html |
| Structure pytest suites | pytest Good Integration Practices, https://docs.pytest.org/en/stable/explanation/goodpractices.html | none |
| Reduce duplicated pytest cases | pytest Parametrizing Tests, https://docs.pytest.org/en/stable/example/parametrize.html | none |
| Align UI tests with user-observable behavior | Testing Library Guiding Principles, https://testing-library.com/docs/guiding-principles | Kent C. Dodds: Testing Implementation Details, https://kentcdodds.com/blog/testing-implementation-details |
| Evaluate API security risks | OWASP API Security Top 10 2023, https://owasp.org/API-Security/editions/2023/en/0x11-t10/ | OWASP Web Security Testing Guide: API Testing, https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/00-API_Testing_Overview |

## Freshness Policy

Stable testing philosophy sources can be treated as background guidance after
fetching. Current framework behavior, SDK APIs, CLI syntax, or security guidance
needs current official documentation. Use a concrete official documentation URL
supplied by the user when the needed source is not listed above. If that URL is
unavailable and the decision depends on freshness, return `NEEDS_CLARIFICATION`
or record the freshness gap as a remaining risk instead of guessing.

## Reporting

When a source materially influences a decision, include the URL in `References
fetched`. When no source is needed, report `References fetched: none`. When a
source was considered but unavailable, report the URL and the fallback decision
or blocker.
