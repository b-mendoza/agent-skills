# Refactoring Web Resources

> Read this file only when `refactor-strategist` needs external conceptual guidance. Fetch the smallest matching URL set and keep article text out of orchestrator handoffs.

This file is the skill's local reference router. It keeps static refactoring guidance out of the prompt while preserving standalone execution: the skill carries the routing table, and the strategist retrieves selected web pages only when needed.

## Fetch Policy

1. Start from project evidence: `BEHAVIOR_MAP`, code shape, tests, and user scope.
2. Fetch at most two URLs for one strategy decision unless the user asks for deeper research.
3. Use fetched guidance to justify the minimal plan, not to broaden scope.
4. If a URL is unavailable, record it as unavailable and continue from code evidence when safe.

## Resource Index

| Need | Fetch When | URLs |
| ---- | ---------- | ---- |
| Refactoring boundary | The user asks what qualifies as a refactor, or the plan risks changing behavior | https://martinfowler.com/bliki/DefinitionOfRefactoring.html |
| Small mechanical moves | A strategy needs a named refactoring move | https://refactoring.com/catalog/ |
| Code smells | The design diagnosis needs smell vocabulary without inventing architecture | https://refactoring.guru/refactoring/smells |
| Legacy safety | Behavior is under-tested and characterization tests may be relevant | https://michaelfeathers.silvrback.com/characterization-testing |
| YAGNI | A proposed layer, option, or extension point serves only future flexibility | https://martinfowler.com/bliki/Yagni.html |
| Simplicity | The trade-off is simpler data/control flow versus convenient abstraction | https://www.infoq.com/presentations/Simple-Made-Easy/ |
| Hasty DRY | Duplication may be cheaper than the wrong shared abstraction | https://kentcdodds.com/blog/aha-programming |
| Wrong abstraction | A shared abstraction is harder to change than duplicated direct code | https://www.sandimetz.com/blog/2016/1/20/the-wrong-abstraction |
| Functional Core / Imperative Shell | Pure decisions and side effects are tangled | https://www.destroyallsoftware.com/talks/boundaries |
| Domain clarity | Names and module boundaries should reflect business behavior | https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html, https://martinfowler.com/bliki/UbiquitousLanguage.html |
| Bounded context | One term or model means different things in different parts of the system | https://martinfowler.com/bliki/BoundedContext.html |
| SOLID discipline | A current design problem maps directly to responsibility, dependency, or substitution pressure | https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html |

## Citation Format

In `STRATEGY`, report fetched references as exact URLs:

```text
References fetched: https://martinfowler.com/bliki/Yagni.html, https://www.sandimetz.com/blog/2016/1/20/the-wrong-abstraction
```

When no web guidance is needed, report:

```text
References fetched: none
```
