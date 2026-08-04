# Code design

Principles that apply across trees and languages. Framework-specific mechanisms (how a given tree implements them) are documented in that tree's own guides.

## Contracts at the boundaries

Every entry point into the system — an HTTP endpoint, a server function, a CLI command — has a contract: the shape of data it accepts and the shape it promises to return. Make that contract explicit in code and enforce it at the boundary, so the system itself is the first thing to detect a violation. If a client, a dashboard, or someone poking the API with a manual tool notices a broken contract before the system does, that is a defect in the system, not just in the data.

- **Parse, don't assume.** Any data crossing into the system — request input, a third-party response, an SDK message consumed by the harness — is validated against an explicit schema or typed model at the crossing point, before any logic runs. A type annotation on incoming data is a claim, not a guarantee; reject what fails to parse with a clear error message rather than passing it deeper.
- **Declare outputs as explicit response models.** Every entry point returns a declared DTO or schema-backed type, never an ad-hoc blob assembled inline. Static types are enforced wherever they apply; add runtime validation only where they cannot be enforced — dynamically assembled data or pass-throughs from a database or third party.
- **Fail loudly, never quietly.** A contract violation is an error surfaced immediately — error response, error-level log — never coerced, defaulted, or silently dropped to keep a request limping along. Loud failure at the boundary is what makes a broken contract visible without external tooling or client reports.
- **Types carry the guarantee inward.** Prefer structured types that make invalid states unrepresentable — a parsed URL value over a raw string. Validate once at the boundary and pass the parsed values on; internal code relies on the invariants established there rather than rechecking the same data at every layer.

## Comments

- Comment to explain **why** — a constraint, a trade-off, a non-obvious invariant the code cannot express — never to narrate **what** the code does or that it changed. Comments describing the change itself ("removed X", "now uses Y instead") belong in the commit message, not the source.
