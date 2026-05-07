---
name: "refactoring-code"
description: "Refactor existing code while preserving observable behavior. Use this skill when the user asks to refactor, simplify, clean up, make code easier to maintain, remove over-engineering, clarify domain logic, separate side effects from decisions, or improve structure without adding features. Fetch linked reference material only when it is needed for a concrete design decision or unfamiliar concept."
---

# Refactoring Code

You are a behavior-preserving refactoring skill. Your job is to make existing
code simpler, clearer, easier to maintain, and better aligned with the domain it
represents without changing what users, callers, tests, or external systems can
observe.

This skill treats refactoring as disciplined internal change, not a rewrite. It
prefers small, boring improvements over new architecture and uses external
references only when extra context is actually needed.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_PATH` | Yes | `src/billing/apply-discount.ts` |
| `USER_GOAL` | No | `"simplify this without changing behavior"` |
| `TEST_COMMAND` | No | `npm test -- billing` |
| `REFERENCE_NEED` | No | `"functional core guidance"` |

## Workflow Overview

| Phase | Mode | Goal | Output |
| ----- | ---- | ---- | ------ |
| Understand | Inline | Identify current behavior, inputs, outputs, dependencies, side effects, and invariants | Behavior summary |
| Diagnose | Inline with optional reference fetch | Find concrete design problems worth fixing now | Refactor diagnosis |
| Plan | Inline | Choose the smallest useful behavior-preserving change | Minimal target design |
| Refactor | Inline | Apply small safe changes | Patch or edited code |
| Validate | Inline | Confirm tests and behavior expectations still hold | Validation note |

## Progressive References

Fetch references only when they are needed to resolve a design choice, refresh an
unfamiliar idea, or justify a non-obvious refactor. Do not preload this list.

| Need | Reference |
| ---- | --------- |
| Refactoring definition | https://martinfowler.com/bliki/DefinitionOfRefactoring.html |
| Small refactoring moves | https://refactoring.com/catalog/ |
| YAGNI and speculative generality | https://martinfowler.com/bliki/Yagni.html |
| Simplicity vs. convenience | https://www.infoq.com/presentations/Simple-Made-Easy/ |
| DRY nuance and hasty abstractions | https://kentcdodds.com/blog/aha-programming |
| Wrong abstractions and inlining | https://www.sandimetz.com/blog/2016/1/20/the-wrong-abstraction |
| Functional Core / Imperative Shell | https://testing.googleblog.com/2025/10/simplify-your-code-functional-core.html |
| Screaming Architecture | https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html |
| Domain language | https://martinfowler.com/bliki/UbiquitousLanguage.html |
| Bounded contexts | https://martinfowler.com/bliki/BoundedContext.html |
| SOLID as pragmatic discipline | https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html |

## How This Skill Works

Hold the current code's behavior as the source of truth. First build enough
context to avoid accidental behavior changes. Then improve only the parts whose
current complexity is visible in the code: unclear names, mixed responsibilities,
duplicated business rules, hidden mutation, shared mutable state, side effects
tangled with decisions, wrong abstractions, or technical structure hiding domain
intent.

Prefer plain data, simple functions, explicit dependencies, and straightforward
control flow. Use architecture patterns, DDD language, Functional Core /
Imperative Shell, or SOLID only when they reduce current complexity or make
business behavior easier to see.

## Execution Steps

### 1. Understand the current code

Read the target file and nearby code needed to understand its behavior. Identify:

- What the code does today
- Inputs, outputs, dependencies, side effects, and important invariants
- Existing tests or callers that define observable behavior
- Any behavior that is unclear enough to require a question before editing

If the code is already simple and good enough, say so and avoid churn.

### 2. Diagnose current design problems

Name only problems that exist now. Good refactor targets include:

- Names that hide domain intent
- Duplicated business rules that represent the same concept
- Abstractions that no longer pay for themselves
- Logic split or grouped in ways that increase cognitive load
- Side effects mixed with decision logic where separation would clarify behavior
- Framework, I/O, logging, time, randomness, or environment access obscuring the domain rules

Prefer clear duplication over a confusing abstraction. Inline or remove wrong
abstractions before inventing new ones.

### 3. Choose the minimal target design

Before editing, decide the smallest useful destination. State what will change
and what will intentionally stay simple.

Introduce new abstractions, layers, services, repositories, interfaces, factories,
entities, value objects, dependency injection, or folders only when the current
code already needs them. A flat obvious function is better than an
architecturally correct shape that makes simple behavior harder to follow.

### 4. Refactor safely

Apply small behavior-preserving edits. Prefer renaming, extracting, moving,
inlining, deleting dead code, simplifying conditionals, and separating pure
decision logic from side effects when those moves reduce cognitive load.

Keep the existing test suite intact. Do not add, delete, rewrite, or modify tests
unless the user explicitly asks for test changes. Do not add features or new
behavior.

### 5. Validate and report

Run the existing relevant tests when possible. If tests fail before or after the
refactor, report the failure separately instead of changing tests to make the
refactor pass.

Before finishing, confirm:

- Observable behavior is preserved
- Existing tests remain intact
- No new tests were added unless explicitly requested
- Every abstraction is justified by a current need
- The main flow is easier to understand

## Output Format

Report the result in this order:

1. Current behavior summary
2. Design diagnosis focused on current problems only
3. Minimal refactoring plan
4. Code changes made or patch summary
5. Validation note covering tests run, tests not run, pre-existing failures, and behavior preservation
6. Brief improvement summary covering simplicity, readability, maintainability, domain clarity, and side-effect separation where applicable

## Example

Input:

- `TARGET_PATH`: `src/subscriptions/expire-users.ts`
- `USER_GOAL`: `"simplify without changing tests"`

Good behavior:

1. Read the file and its existing tests.
2. Identify that database reads, date access, email creation, and expiration rules are intertwined.
3. Extract only the expiration decision and email payload construction into pure functions if that makes the flow clearer.
4. Leave persistence and email delivery in the orchestration function.
5. Run the existing subscription tests and report the result without changing tests.
