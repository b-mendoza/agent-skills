# Code design

## Contracts at the boundaries

Make every entry point's accepted input and promised output explicit and enforce them at the boundary.

- Parse incoming requests, third-party responses, and SDK messages against a schema or typed model before running logic. Type annotations are not validation; reject invalid data with a clear error.
- Return declared response models or schema-backed types, not ad-hoc objects. Enforce static types where possible; add runtime output validation only where static guarantees cannot hold, such as dynamically assembled data or third-party pass-throughs.
- Surface contract violations immediately as errors, never coerce, default, or silently drop invalid data.
- Prefer structured types that make invalid states unrepresentable. Parse once at the boundary and pass validated values inward rather than checking the same data in each layer.

## Names

Use human-readable names that state what a value holds or a function does, not its generic shape or role. Ask "of what?" or "for what?"; the name should answer. Prefer `outputBytes` to `out`.

Keep established short-scope idioms consistently across a file or module: loop indices, small generic type parameters, or errors handled immediately. Use specific domain nouns for values that outlive that scope or sit far from their origin.

## Comments

Explain constraints, trade-offs, and non-obvious invariants, not what code does or how it changed. Change history belongs in the commit message.
