# Testing — evals specifics

General testing principles (what to test, how to assert, how to organize) live in the [root testing guide](../../../docs/agent/testing.md) and apply here. This file covers guidance specific to this suite's stack. Which checks to run, free vs. paid, lives in the short-lived [verification reference](../verification.md).

## Vitest / TypeScript

- Use `expect.objectContaining` for call assertions, matching only the fields our code controls.
- Do not use `expectTypeOf` to re-verify contracts TypeScript's annotations already enforce. If it compiles, the type is correct.
- Do not build test infrastructure (schemas, parsers) that mirrors a third-party library's internal shape — the Agent SDK's message types included. It breaks with confusing errors when the library changes internals, even though production behavior is unchanged.
