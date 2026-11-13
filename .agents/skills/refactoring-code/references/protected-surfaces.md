# Protected Surfaces

This file is the single authoritative boundary for `refactoring-code`. Other files cite this reference instead of restating the list.

Protected surfaces are out of scope for a refactor:

- Observable behavior: return values, thrown or returned errors, persisted data, outbound calls, emitted events, contractual logs, timing semantics, and visible side effects.
- Public API shape: exported names, signatures, module entry points, wire shapes, CLI flags, configuration keys, and documented extension points.
- Test intent: assertions, expectations, fixtures, snapshots, and behavioral coverage. Mechanical test import, path, or name updates required by the approved refactor are allowed only when reported, size-checked, and reviewed for unchanged intent.
- State assumptions and side-effect ordering: initialization order, caching, transactions, retries, locking, idempotency, and cleanup behavior.
- Unrelated worktree changes: anything dirty at baseline that the refactor does not own, plus any unapproved file created or modified during the run.
- Dependency manifests and lockfiles: package manifests, lockfiles, toolchain config, build config, runtime config, and generated dependency metadata.

Naming a protected file as a target or approving a generic carve-out never authorizes changing its protected content. No general protection waiver exists.

A narrow import-boundary preservation update is allowed after a module split: a plan-listed rule may replace or extend exact module-path entries to cover the moved code under the same caller restrictions. Before approval, show the config path, exact old/new entries, moved-module mapping and evidence that the effective caller-to-module prohibition is unchanged (including path/glob resolution). Require separate explicit approval of that card choice, then verify with positive and negative boundary-check fixtures for every moved module and the old entry point. Keep rule severity, caller selectors, permitted imports, dependency versions, lockfiles, build and runtime settings unchanged. If equivalence cannot be established, stop; ordinary passing tests alone do not prove it. This exception preserves an existing contract, not permission to redesign or weaken configuration.

Crossing any other protected surface stops this workflow. Return `BLOCKED` when the run has enough information to know the proposed change is outside scope. Return `NEEDS_CLARIFICATION` when the user may want a different workflow, such as a feature change, bug fix, public API migration, test rewrite, or dependency update.

Refactor-safe mechanical updates are narrow: import paths, moved-file paths, renamed private identifiers, and type-only references that are direct compilation consequences of the approved plan. They must be reported and reviewed.
