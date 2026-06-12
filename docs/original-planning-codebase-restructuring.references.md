# External References for `planning-codebase-restructuring`

These references were selected because they describe techniques, tools, or process models comparable to the target skill's source-defined behavior: read-only architecture mapping, domain-first restructuring, DDD and Screaming Architecture analysis, evidence precedence, migration planning, validation gates, and decision documentation. They are not additional instructions for the skill; local repository evidence and the skill source remain authoritative.

## References

| Resource | What It Is | Why It Is Relevant |
| --- | --- | --- |
| [Domain-Driven Design Reference, Eric Evans and Domain Language](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf) | A compact DDD reference from Domain Language summarizing core DDD terms and practices, including ubiquitous language and bounded contexts. | The skill explicitly aligns restructuring plans with DDD, domain language, bounded contexts, and evidence-backed domain modeling. |
| [Bounded Context, Martin Fowler](https://martinfowler.com/bliki/BoundedContext.html) | A short explanation of bounded contexts as a strategic DDD pattern for managing large models and teams. | The `domain-analyst` subagent identifies bounded-context candidates and ambiguous terms only when supported by evidence. |
| [Screaming Architecture, Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html) | The original article arguing that software architecture should make system use cases obvious rather than foregrounding frameworks. | The target skill's core principle is that architecture should reveal the domain first and technical machinery second. |
| [The Clean Architecture, Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) | An architecture article centered on dependency direction and keeping frameworks outside core business rules. | The `restructuring-strategist` subagent defines dependency direction, framework-specific boundaries, ports, adapters, and migration guardrails. |
| [Team Topologies Key Concepts](https://teamtopologies.com/key-concepts) | A software-organization model focused on team types, interaction modes, flow, and cognitive load. | The skill inspects ownership boundaries, shared utilities, workflow evidence, and complexity signals; Team Topologies is a comparable lens for aligning architecture boundaries with delivery flow and cognitive load. |
| [Architectural Decision Records](https://adr.github.io/) | A reference site for architecture decision records and decision logs. | The skill produces a decision artifact with evidence, tradeoffs, risks, approval gates, and migration consequences; ADR practice is a nearby documentation pattern. |
| [ADR Tools](https://github.com/npryce/adr-tools) | A command-line tool for creating and maintaining Markdown architecture decision records in a repository. | It is relevant as tooling for preserving the kind of architecture decisions and rationale that the skill's reviewed final report may produce. |
| [ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html) | Documentation for a Java library that checks package, layer, slice, dependency, and cycle rules through tests. | The target skill includes validation planning and dependency guardrails; ArchUnit is a comparable implementation-time validation mechanism for architecture rules. |
| [Lattix Dependency Structure Matrix Documentation](https://docs.lattix.com/lattix/userGuide/Working_with_the_Dependency_Structure_Matrix_DSM.html) | Documentation for visualizing system organization and dependencies through dependency structure matrices. | The `architecture-cartographer` subagent maps dependencies and integration points; DSM tools are comparable evidence sources for structural coupling and change impact. |
| [CodeScene](https://codescene.com/) | A code analysis platform focused on technical debt, code health, change patterns, and prioritization. | The skill looks for complexity signals, safety nets, and migration risk; CodeScene is a comparable tool for prioritizing high-impact codebase restructuring work from repository evidence. |
| [OpenRewrite Documentation](https://docs.openrewrite.org/) | Documentation for an open-source automated refactoring ecosystem built around repeatable recipes. | The target skill is planning-only by default but includes migration strategy, validation, and approval gates; OpenRewrite is relevant when an approved later phase needs repeatable, bounded refactoring execution. |

## Fit Notes

- Closest conceptual matches: Domain-Driven Design, bounded contexts, Screaming Architecture, and Clean Architecture directly match the skill's stated mental model and analysis vocabulary.
- Closest workflow matches: ADRs and ADR Tools match the skill's final report as a decision artifact with rationale, tradeoffs, and consequences.
- Closest validation and evidence matches: ArchUnit, Lattix DSM, CodeScene, and OpenRewrite relate to architecture rule validation, dependency evidence, prioritization, and controlled migration execution.
- Gap: none of the listed resources is the same kind of multi-subagent orchestration skill. They are comparable external practices and tools, not replacements for the target skill's source-defined pipeline.

## Verification Notes

- Sources were checked on 2026-06-12.
- No unverified or unnamed references were added.
- The references file intentionally does not document `prompt-structurer` or `generate-flow-diagram`; those were helper skills used to produce the required artifacts, not comparable resources for the target skill.

