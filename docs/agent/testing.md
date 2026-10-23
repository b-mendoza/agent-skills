# Testing principles

## What to test

- Test decisions the code makes: branching, routing, wiring, and transformations. Match coverage to risk; core logic needs thorough coverage, while pass-throughs and getters need little or none.
- Do not write tests whose only purpose is re-proving what static type annotations already enforce.
- Test current behavior, not hypothetical future logic. Add a transformation test when the transformation exists.
- Leave dependency internals to their maintainers. Do not assert a mock's return value back or mirror a library's internal structure. Validate externally consumed configuration through the tool's own lint, check, dry-run, or observable behavior, not by transcribing its contents into a test.

## How to assert

- Assert only fields the code controls, not the full structure of call arguments.
- Import production constants instead of duplicating them when checking that a specific constant is used; a changed constant should break that test.
- Give high-risk constants intentionally brittle wiring tests using the imported constant when a change could silently affect cost, behavior, or a contract.
- Use inline literals for simple fixtures. Use builders only when several tests share non-trivial setup.

## When tests fail

- Fix the cause rather than deleting, skipping, loosening, sleeping, or blindly retrying. Fix synchronization for flakes; fail with an actionable error for missing prerequisites. Correct a wrong test in its own explicit, explained step.
- Confirm a bug-fix test fails without the fix. Passing in both versions proves nothing about the regression.

## How to organize

- Group by behavior domain, with descriptive names rather than arbitrary codes.
- Name tests in behavior-first active voice, without alphanumeric prefixes.
