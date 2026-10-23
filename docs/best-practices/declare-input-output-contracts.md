# declare-input-output-contracts

> Current-state authoring reference; update when these package conventions change.

Tier: mandatory.

Use whenever a skill or subagent consumes inputs, produces artifacts or replies, or parses fields for routing.

## Declare

Declare inputs in an `Input | Required | Example` table and outputs as exact required fields, sections, and paths or reply shapes. Pass canonical identifiers and specify their derivation; if an identifier contains secrets, tokens, or private data, pass only the smallest structured fields and a redacted source reference. Dispatch instructions carry `inputs`, `outputs`, and `constraints`; reports carry `status`. Add only fields a consumer validates or uses.

Statuses, routes, ids, paths, ordering, and counters stay exact across runs; prose may vary. Use the [closed status and transition rules](./keep-routing-in-the-orchestrator.md#transitions). Keep examples synchronized with contracts. [Mutation limits and run-file lifetimes](./declare-mutation-limits.md) govern storage, not the payload grammar.

Remove nondeterminism from contract semantics: sort by named keys before emitting or aggregating, capture each run timestamp once with timezone and precision, specify canonicalization and collision algorithms, and resolve paths once before dispatch. The same inputs must produce the same route regardless of parallel completion order.

## Validate

Ship a deterministic validator under `scripts/` for every subagent field the orchestrator parses or routes on. Use POSIX `sh`/`awk` or stdlib-only Python 3, read the payload from stdin, exit zero to accept, and print one finding per defect otherwise. No network, clock, randomness, or third-party dependency. Name the invocation in `SKILL.md` and every producing subagent.

The consumer runs the validator on the received payload and routes only after exit zero. Producer self-attestation, constructor output, and passing evals do not satisfy this gate. A payload is complete only after acceptance; nonzero results enter a [bounded repair route](./keep-routing-in-the-orchestrator.md#transitions). The validator proves shape, such as enums, keys, order, counts, and nonempty values, not semantic quality.

If the host cannot execute the validator, the orchestrator raises `TOOLS_MISSING` and does not parse the payload fields. Never substitute a model's reading of the script. Resolve `SKILL_DIR` and shell permissions using the [runtime matrix](./runtime-portability-matrix.md).

Every script, not only validators, declares its interpreter, POSIX `sh` by default or `bash` with a one-line reason; usage naming all arguments and environment variables, printed on `-h` and bad arguments; exit codes mapped to escalation categories; side effects; and one runnable fixed-input smoke check or `--dry-run`. Name side effects at the `SKILL.md` call site too, so the [approval rule](./declare-mutation-limits.md#approval) can gate them.

## Example

Bad: “return something like PASS,” followed by routing on the producer's claim that it validated itself.

```markdown
## Inputs
| Input | Required | Example |
| --- | --- | --- |
| ISSUE_URL | Yes | https://tracker.example/browse/PROJ-123 |

Derive ISSUE_KEY from the final URL path segment.
Reply: line 1 PLAN: PASS | BLOCKED | ERROR; line 2 Reason: <nonempty text>.
On PASS only, line 3 Path: docs/<ISSUE_KEY>-tasks.md.
Dispatch inputs: issue_url. Outputs: the reply above. Constraints: MUTATION_LIMITS.

Consumer and producing subagent both name this invocation:
sh "${SKILL_DIR}/scripts/validate-output.sh" < "$payload"
Exit 0 → route the declared status. Nonzero with repair_count < 1 →
increment repair_count and redispatch with findings; at cap → ERROR.
repair_count starts at 0. Missing shell → TOOLS_MISSING without parsing.
```

```sh
#!/bin/sh
# scripts/validate-output.sh: checks exact status-dependent fields and order.
# Usage: sh validate-output.sh [-h] < payload. Environment: none.
# Exit 0: accepted; 1: defects, repair; 2: bad arguments, ERROR.
# Side effects: none. The caller reports unavailable sh/awk as TOOLS_MISSING.
# Smoke check: printf 'PLAN: BLOCKED\nReason: no access\n' | sh validate-output.sh
# Expected exit: 0. This checks shape, not whether the reason is sound.
```
