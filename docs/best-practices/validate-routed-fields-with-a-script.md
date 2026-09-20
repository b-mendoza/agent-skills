# validate-routed-fields-with-a-script

📝 Ship a deterministic validator under `scripts/` for every subagent field an orchestrator parses or routes on, and route only after the consumer runs it and it exits 0.

🔒 This rule is `mandatory`: a miss is a material gap unless the skill names the rule and the reason for the exception in its `SKILL.md`.

An orchestrator that branches on a status line is a parser. When its grammar lives only in Markdown, producers drift and a fluent `PASS` routes the next phase against a malformed payload. The validator is POSIX `sh`/`awk` or stdlib-only Python 3, takes the payload on stdin, exits 0 to accept, and prints one finding per defect otherwise; no network, clock, randomness, or third-party dependency. Name its invocation in `SKILL.md` and in every producing subagent. The consumer runs it on the payload it received and routes only after exit 0; a producer's "validated" sentence, a constructor's output, and a passing eval are not the gate. A payload is complete when the validator exits 0. Repair on non-zero runs under a named counter with a cap and an over-cap route ([route-every-status](./route-every-status.md)).

The validator proves shape (enums, required keys, order, counts, non-empty values), never quality: it checks that `Reason:` is present, not that the reason is good. The invocation is `sh "${SKILL_DIR}/scripts/validate-output.sh" < "$payload"`; `SKILL_DIR` resolution and shell-permission syntax per runtime are owned by [runtime-portability-matrix](./runtime-portability-matrix.md). When the host cannot execute it (no shell, or no `python3` for a Python validator), stop the payload path and escalate `TOOLS_MISSING` out of band; the fields are never parsed. Which fields exist is declared per [declare-input-output-contracts](./declare-input-output-contracts.md).

Every script under `scripts/` (validators, collectors, posters, cleaners) declares its interpreter (POSIX `sh` by default; `bash` only with a one-line reason), a usage line naming every argument and environment variable (printed on `-h` and on bad arguments), exit codes mapped to escalation categories, and its side effects, and ships one runnable check (a smoke invocation with fixed input or a `--dry-run` path). Side effects are also named at the call site in `SKILL.md` so [checkpoint-irreversible-actions](./checkpoint-irreversible-actions.md) can gate them.

## Examples

```markdown
<!-- ❌ grammar in prose, producer claim as the gate, model as fallback validator -->
Return a short status plus a reason; `STATUS: PASS` is fine.
If the planner says it validated its output, route to Execute.
If the host cannot run the script, read it and apply the checks yourself.
```

```markdown
<!-- ✅ SKILL.md; the same invocation line appears in commit-boundary-planner.md -->
| Gate | Payload | Checker |
| --- | --- | --- |
| `G_PLAN_ENVELOPE` | every planner output | `sh "${SKILL_DIR}/scripts/validate-output.sh" plan < payload` |

Predicate: exit 0. On non-zero, redispatch once with the printed findings; a second non-zero → `COMMIT_SCOPED_CHANGES: ERROR` naming the phase. Route only after exit 0. Shell unavailable → `COMMIT_SCOPED_CHANGES: TOOLS_MISSING`.
```

```sh
#!/bin/sh
# ✅ scripts/validate-output.sh — shape validator for the plan and execute envelopes.
# Proves: line-1 status enum, exact field set and order per status, 40-hex digests.
# Does not prove: message quality, grouping sense, or that any commit exists.
# Usage: sh validate-output.sh <plan|execute> < payload   (sh validate-output.sh -h prints this)
# Exit 0 conforms | 1 one "<mode>: line N: <message>" finding per defect (repair route)
#      | 2 bad or missing mode (ERROR). Missing sh/awk on the host is the caller's TOOLS_MISSING.
# Side effects: none — no git, no network, no temp files.
# Check: sh validate-output.sh plan < scripts/fixtures/plan-pass.txt; echo $?   # expects 0
```

## Related rules

- [declare-input-output-contracts](./declare-input-output-contracts.md)
- [route-every-status](./route-every-status.md)
- [checkpoint-irreversible-actions](./checkpoint-irreversible-actions.md)
- [runtime-portability-matrix](./runtime-portability-matrix.md)
- [validate-by-observation](./validate-by-observation.md)
