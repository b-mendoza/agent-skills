# Code Conventions

Long-lived guidance for TypeScript code in this suite. Current file layout,
import alias, and dependency direction live in the short-lived
[layout reference](../current-layout.md).

## TypeScript design

- The suite runs TypeScript directly from source with `erasableSyntaxOnly`
  on, so write types that erase cleanly: plain union types and `const`
  objects instead of enums, explicit field assignments instead of
  constructor parameter properties, modules instead of namespaces, and
  plain functions instead of decorators.
- Prefer factory functions over classes when both are reasonable (for
  example, `createHarness()` over `new Harness()`). Factories compose
  better, avoid `this` pitfalls, and make dependencies explicit through
  parameters.
- Write interface methods in function property style:
  `method: (...) => ReturnType`. Function property style makes the member's
  variance and assignability explicit.

## Validate at the boundary

- Parse external data where it enters the system — CLI arguments in the
  runner, SDK messages in the observation harness — rather than passing raw
  strings deeper in.
- Prefer structured return types that make invalid states unrepresentable
  over primitive types a caller can misuse.
- Fail loudly, never quietly. A contract violation is an error surfaced
  immediately, with a message naming what failed to parse — never
  coerced, defaulted, or silently dropped to keep a run limping along.

## Comments

- Comment to explain _why_ — a constraint, a trade-off, a non-obvious
  invariant the code cannot express — never to narrate _what_ the code
  does or that it changed. Comments describing the change itself
  ("removed X", "now uses Y instead") belong in the commit message, not
  the source.
