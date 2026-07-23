# deterministic-execution

## Tier

`recommended`, and load-bearing wherever routing, naming, ordering, or
structured outputs affect downstream behavior. A skill that cannot reproduce
its route and contract fields cannot be validated reliably.

## When it applies

When a skill derives identifiers or paths, aggregates enumerated or parallel
results, uses time or randomness, branches on environment facts, depends on an
external tool or service, or promises repeatable structured output.

## The practice

Design the workflow so the same normalized inputs and recorded world state take
the same route and produce semantically identical contract output. Model prose
may vary; route decisions, identifiers, ordering, statuses, paths, counters,
and other declared contract fields may not.

Rules:

1. **Inventory nondeterminism at authoring time.** Check every phase for
   wall-clock time, randomness, iteration order, concurrency scheduling,
   external-service state, model sampling, locale or timezone, and filesystem
   enumeration order. Either remove each source from semantics or record and
   control it explicitly.
2. **Canonicalize before branching.** Normalize case, whitespace, separators,
   paths, identifiers, and locale-sensitive values before comparing or routing
   on them. Specify an exact derivation algorithm; never instruct an agent to
   "derive a reasonable name."
3. **Make naming and collision handling mechanical.** Define truncation,
   fallback, and tie-breaking rules. Resolve the final identifier or path once,
   before dispatch or mutation, so every branch receives the same value and
   path failures surface early.
4. **Declare stable ordering.** Sort filesystem entries, service results,
   maps, sets, and parallel branch outputs by a named key before emitting or
   aggregating them. Parallelism is an optimization, never a semantic input:
   the parallel result must match the serial schedule.
5. **Isolate clocks and randomness.** Capture a required timestamp once into
   run state, with timezone and precision declared, then reuse it. Do not make
   routing, names, priorities, or collision decisions random. If a protocol
   requires jitter or another random operational detail, keep it outside the
   semantic output and decision contract.
6. **Record behavior-shaping dependencies.** Pin or record external tool,
   schema, API, and model versions when their behavior affects the result.
   Record environment facts the output depends on, such as locale, timezone,
   repository revision, platform capability, or service snapshot/version.
7. **Define the deterministic contract.** Name which output parts are exact
   contract and which are variable prose. Given identical normalized inputs
   and recorded world state, the skill must take the same route and reproduce
   the same structured fields; prose may vary only where downstream consumers
   do not parse or branch on it.
8. **Validate by comparison.** Following
   [empirical validation](./empirical-validation.md), run the same
   representative input more than once, including serial and parallel
   schedules when supported. Compare route logs and contract fields exactly;
   compare prose semantically only when prose is explicitly outside the
   contract.

A practical contract table makes the boundary reviewable:

| Output part | Determinism requirement |
| ----------- | ----------------------- |
| Status, route, counters, IDs, paths, ordering | Exact |
| Structured evidence and provenance fields | Exact for the same recorded world state |
| User-facing explanatory prose | May vary semantically; must not change routing meaning |
| Timestamps | Exact reuse of one recorded capture, not repeated clock reads |

## Rationale

Uncontrolled nondeterminism turns validation into anecdote. A skill may pass
once because a directory happened to enumerate in one order, a faster parallel
branch wrote first, or an external schema returned a different default. The
next run then chooses a different route without any input change.

Canonical inputs, single-point derivation, stable ordering, and recorded
world-state dependencies make failures reproducible. They also make
[empirical validation](./empirical-validation.md) meaningful: exact contract
fields can be compared without mistaking harmless prose variation for a route
change or overlooking a material structured-output difference.

## Concrete examples

Good: derive one path mechanically, resolve collisions before dispatch, and
aggregate by a declared key.

```markdown
1. Normalize `DECISION_SUBJECT`: lowercase; replace each maximal run outside
   ASCII `[a-z0-9]` with `-`; trim hyphens; truncate to 40 characters; trim a
   trailing hyphen; use `decision` if empty.
2. Set `HANDOFF_PATH=council-handoff-<slug>.md`. If occupied, try `-2`, `-3`,
   and so on. Resolve once before dispatch and pass the final path to all seats.
3. Dispatch seats serially or in bounded parallel waves. Before synthesis,
   sort returned seat packets by the registry's declared seat order.
4. Contract fields (`status`, path, seat IDs, packet order) must match across
   schedules; explanatory prose may differ without changing meaning.
```

Bad: the clock, filesystem, and scheduler all change semantics.

```markdown
Name the report `report-<current timestamp>.md`. Iterate the evidence directory
in whatever order it returns. Launch all reviewers in parallel and let each
append to the shared report when it finishes. Use the resulting section order
to decide which finding is highest priority.
```

## References

- [`skills/council-of-advisors/SKILL.md`](../../skills/council-of-advisors/SKILL.md)
  defines the exact subject-slug algorithm, `-2`, `-3` collision policy, and
  one-time early path resolution used as the flagship naming pattern.
- [`skills/council-of-advisors/state-machine.md`](../../skills/council-of-advisors/state-machine.md)
  states that bounded parallel waves must preserve contracts and aggregation
  regardless of wave layout.
- [`skills/fetching-work-item/references/jira-playbook.md`](../../skills/fetching-work-item/references/jira-playbook.md)
  demonstrates declared ordering keys: subtasks by key, linked issues by link
  type then key, attachments by filename, custom fields by field name, and
  structured values with sorted keys.
- [`skills/generate-flow-diagram/subagents/refinement-analyst.md`](../../skills/generate-flow-diagram/subagents/refinement-analyst.md)
  demonstrates stable, mechanically assigned gap IDs (`G1`, `G2`, `G3`) in a
  declared discovery order.
- [Empirical validation](./empirical-validation.md) defines the representative
  execution loop used to prove that deterministic contracts hold in behavior.
