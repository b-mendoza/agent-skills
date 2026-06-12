# External References For `refactoring-code`

The `refactoring-code` skill already includes a bundled reference router at `skills/refactoring-code/references/refactoring-web-resources.md`. The resources below are external materials that match the skill's actual concerns: behavior-preserving refactoring, small named moves, code smells, validation of legacy behavior, avoiding speculative design, choosing module boundaries, and domain language.

| Resource | What it is | Why it is relevant to `refactoring-code` |
| --- | --- | --- |
| [Definition of Refactoring](https://martinfowler.com/bliki/DefinitionOfRefactoring.html) | Martin Fowler's definition of refactoring as internal restructuring that preserves observable behavior. | Directly matches the skill's core principle and its hard boundary against behavior changes. |
| [Catalog of Refactorings](https://refactoring.com/catalog/) | A catalog of named refactoring moves such as extract, inline, move, rename, split phase, and simplify conditional logic. | Supports the strategist and implementer when a plan needs a small named mechanical move instead of an invented design. |
| [Code Smells](https://refactoring.guru/refactoring/smells) | A taxonomy of common code problems that motivate refactoring. | Helps describe current design problems without broadening the work into architecture changes. |
| [Characterization Testing](https://michaelfeathers.silvrback.com/characterization-testing) | Michael Feathers' guidance on capturing existing behavior before changing legacy code. | Relevant to the mapper's behavior baseline and the validation warning path when existing coverage is limited. |
| [YAGNI](https://martinfowler.com/bliki/Yagni.html) | Martin Fowler's discussion of avoiding features or abstractions that are not currently needed. | Aligns with the strategist's instruction to optimize for current clarity and avoid speculative structure. |
| [AHA Programming](https://kentcdodds.com/blog/aha-programming) | Kent C. Dodds' guidance to avoid hasty abstraction and let patterns emerge. | Supports the skill's preference for removing over-engineering, delaying shared abstractions, and preserving simple duplication when it is clearer. |
| [The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction) | Sandi Metz's article on the cost of abstractions that no longer fit current requirements. | Matches the skill's anti-overengineering stance and the reviewer's abstraction check. Verified by search; direct full-page fetch was not available in this run. |
| [Boundaries](https://www.destroyallsoftware.com/talks/boundaries) | Gary Bernhardt's talk associated with Functional Core / Imperative Shell. | Relevant when the strategist considers separating pure decision logic from side-effect adapters, which the skill's file-size policy names as a split seam. |
| [Screaming Architecture](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html) | Robert C. Martin's article about organizing systems so architecture communicates domain intent. | Relevant to domain-shaped file and folder names when splitting files without changing behavior. |
| [Ubiquitous Language](https://martinfowler.com/bliki/UbiquitousLanguage.html) | Martin Fowler's DDD glossary entry on shared domain vocabulary. | Relevant when a refactor clarifies domain terms while keeping behavior stable. |
| [Bounded Context](https://martinfowler.com/bliki/BoundedContext.html) | Martin Fowler's DDD glossary entry on boundaries where a model has a particular meaning. | Useful when the strategist must avoid mixing models or moving code across domain boundaries during a split. |
| [Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html) | Robert C. Martin's discussion of responsibility and reasons for change. | Relevant to the skill's file split decisions, especially when a module mixes responsibilities. |
| [SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html) | Robert C. Martin's discussion of when SOLID principles matter. | Relevant only when the current behavior map shows real responsibility, dependency, or substitution pressure; it should not be used to justify speculative layers. |
| [Cohesion and Coupling](https://martinfowler.com/ieeeSoftware/coupling.pdf) | Martin Fowler's IEEE Software article on vocabulary for what belongs together and what should be separated. | Relevant when a split decision needs language for cohesion and coupling rather than arbitrary file chopping. |

## Notes

- These resources are not required to run the skill. The skill says external URLs are optional just-in-time fetch targets and that local code evidence remains primary.
- The skill limits fetching to concrete strategy or review decisions and records one of these statuses: `not needed`, `bundled-local-only`, `fetched`, `declined-but-safe`, or `unavailable-but-safe`.
- The reference list intentionally does not include general code-formatting or feature-design resources because the skill is scoped to behavior-preserving refactoring.
