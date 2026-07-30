# Code Conventions

> Short-lived current-state reference. Update this file in the same change
> that alters the TypeScript or lint configuration.

- The suite runs TypeScript directly from source, so `erasableSyntaxOnly`
  is on. Write types that erase cleanly: plain union types and `const`
  objects instead of enums, explicit field assignments instead of
  constructor parameter properties, modules instead of namespaces, and
  plain functions instead of decorators.
- Lint configuration is authoritative: fix findings at the source. When a
  suppression is genuinely required, add a written justification at the
  suppression site.
- Import internal modules through the `#/*` alias (maps to `./src/*`; see
  `package.json` `imports` and `tsconfig.json` `paths`).
- Keep the dependency direction from
  [`current-layout.md`](./current-layout.md): `orchestration → cases,
fixtures, observation`; leaf capabilities import nothing internal.
