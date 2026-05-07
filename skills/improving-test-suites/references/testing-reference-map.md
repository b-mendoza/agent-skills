# Testing Reference Map

Load this file only when a concrete test-suite decision needs external support.
Fetch the smallest relevant source, apply it to the local code decision, and
record the fetched URL in the review output.

## Core Testing Guidance

| Decision need | Sources |
| ------------- | ------- |
| Distinguish behavior tests from implementation-detail tests | Google Testing Blog: Test Behavior, Not Implementation, https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html; Kent C. Dodds: Testing Implementation Details, https://kentcdodds.com/blog/testing-implementation-details |
| Prefer public APIs and observable contracts over internals | Google Testing Blog: Prefer Testing Public APIs Over Implementation-Detail Classes, https://testing.googleblog.com/2015/01/testing-on-toilet-prefer-testing-public.html; Software Engineering at Google, Unit Testing, https://abseil.io/resources/swe-book/html/ch12.html |
| Decide what is worth testing | Kent C. Dodds: How to Know What to Test, https://kentcdodds.com/blog/how-to-know-what-to-test; Software Engineering at Google, Unit Testing, https://abseil.io/resources/swe-book/html/ch12.html |
| Balance unit, integration, and end-to-end coverage | Martin Fowler: The Practical Test Pyramid, https://martinfowler.com/articles/practical-test-pyramid.html |
| Structure pytest suites and reduce duplicated cases | pytest Good Integration Practices, https://docs.pytest.org/en/stable/explanation/goodpractices.html; pytest Parametrizing Tests, https://docs.pytest.org/en/stable/example/parametrize.html |
| Evaluate API and security-sensitive test coverage | OWASP API Security Top 10 2023, https://owasp.org/API-Security/editions/2023/en/0x11-t10/; OWASP Web Security Testing Guide: API Testing, https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/00-API_Testing_Overview |

## Companion Skill Sources

Use these only when the runtime has access to them and the local task benefits
from deeper workflow guidance.

| Need | Sources |
| ---- | ------- |
| TDD workflow while adding missing behavior tests | https://skills.sh/mattpocock/skills/tdd; https://skills.sh/obra/superpowers/test-driven-development |
| Security test review patterns | https://skills.sh/supercent-io/skills-template/security-best-practices |
| Subagent-driven execution patterns | https://skills.sh/obra/superpowers/subagent-driven-development |
| Architecture and contract boundary judgment | https://skills.sh/wshobson/agents/architecture-patterns |

## Freshness Policy

When the decision relies on current framework behavior, current security
guidance, or current API documentation, run the repository's `recency-guard`
skill or an equivalent freshness check before treating the reference as current.

For stable testing philosophy, local code evidence usually matters more than
freshness. Fetch a source only when it changes the current decision.
