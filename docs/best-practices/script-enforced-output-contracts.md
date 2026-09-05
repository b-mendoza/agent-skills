# script-enforced-output-contracts

## Tier

`mandatory`. When a main or orchestrating agent parses or routes on subagent fields, a shipped deterministic validator (POSIX `sh` or stdlib-only Python 3) must accept those fields at runtime; prose, examples, producer narrative, constructors, and evals cannot grant acceptance.

## When it applies

When a main or orchestrating agent parses, routes on, or otherwise consumes machine-readable fields from a subagent payload: status lines, enums, required keys, ordered blocks, envelopes, or any other token that agent will read as data. User-facing prose with no machine-parsed fields is out of scope. Orchestrator-composed user-facing output and skill-to-skill documents this agent does not parse are out of scope.

[input-output-contracts](./input-output-contracts.md) declares the human-readable contract. This practice's validator is the normative authority for runtime acceptance of the exact machine-readable fields named there.

## The practice

Ship a deterministic validator (POSIX `sh` or stdlib-only Python 3) for every exact machine-readable field the main or orchestrating agent will parse or route on. Feed the payload on stdin. The consumer runs the validator and accepts or routes only after a passing exit.

A constructor that emits a payload from declared arguments may help a producer write. It never substitutes for the validator at the consumer gate.

Rules:

1. **Ship a consumer-side validator.** Put the validator under `scripts/` as POSIX-portable `sh` or stdlib-only Python 3. Name the exact invocation in `SKILL.md` and every producing subagent. The validator encodes the exact-field contract; a model does not assemble it at runtime.
2. **Keep declaration and acceptance aligned.** The human-readable contract names the fields, enums, and cardinality. The validator is what runtime acceptance checks. Prose, examples, producer narrative, and evals describe or exercise that shape; they do not grant acceptance. If the declared contract and the validator disagree, treat the mismatch as a defect and repair both until they name the same exact fields.
3. **Producers run the validator while writing.** Before returning, the producing subagent pipes its complete output through the validator, fixes every reported defect, and re-runs it. A constructor may emit the envelope; the producer still validates the result. A producer `PASS` or "validated" sentence does not make the payload routable.
4. **The consumer validates independently before routing.** On receipt, the main or orchestrating agent runs the same validator on the received payload and routes only after exit `0`. That re-check is the independent gate; see [critical-output-gates](./critical-output-gates.md).
5. **Validate exact shape, not subjective quality.** Status enums, required keys, line counts, field order, closed vocabularies, and other machine-parsed tokens are in scope. Variable prose and semantic judgment stay out. The validator confirms that a `Reason:` line is present and non-empty; it does not grade whether the reason is good. Opinion, reasoning quality, and recommendation fitness belong to reviewers or evals, not this script.
6. **Evals reuse the shipped validator for shape.** Shape checks invoke the same validator with the same command and exit contract the runtime uses. Evals also cover routing, semantic quality, and injection resistance the validator cannot prove. Evals do not replace the runtime validator; see [empirical-validation](./empirical-validation.md).
7. **Give the consumer a permitted shell and escalate when that capability is missing.** The orchestrating consumer must be able to invoke the shipped validator through a permitted shell. The invocation is `sh "${SKILL_DIR}/scripts/validate-output.sh"` or `python3 "${SKILL_DIR}/scripts/validate_output.py"`, with the payload on stdin (`< "$payload"` or a pipe). Exit `0` accepts; non-zero rejects and prints findings. Map the capability to the host (Claude Code Bash and OpenCode shell permission are typical adapters); the contract is the capability, not adapter syntax. Do not depend on a runtime-native structured-output API, JSON-mode flag, or vendor schema endpoint; see [runtime-portability-matrix](./runtime-portability-matrix.md). If the host cannot execute the validator, including a missing `python3` interpreter when the skill ships a Python validator, stop the normal payload and routing path. Issue `TOOLS_MISSING` through the parent workflow's escalation contract ([escalation-categories](./escalation-categories.md)). That category is out-of-band: it is not a value in the payload's closed status enum and is not bytes sent through the validator. Do not parse or route on the payload fields.

Neighboring practices stay in their lanes: declare fields in [input-output-contracts](./input-output-contracts.md); use this validator as the [critical-output-gates](./critical-output-gates.md) checker; keep exact fields deterministic per [deterministic-execution](./deterministic-execution.md); use [handoff-file-dispatch](./handoff-file-dispatch.md) when the payload needs a file; lead skill prose with the allowed invocation path per [positive-constraint-framing](./positive-constraint-framing.md).

## Rationale

An orchestrator that branches on a status line is a parser. If that parser's grammar lives only in Markdown, producers drift and a fluent `PASS` still routes the next phase against a malformed payload. A shipped validator makes the grammar executable at write time and at the routing gate. When evals invoke that same validator for shape checks, those checks cannot silently invent a second grammar.

Producer self-report cannot close the gate. The agent that wrote the payload will usually describe it as valid. A constructor that emitted the envelope is still that producer's tool. Re-running the validator at the consumer is the check that cannot flatter the producer.

Scripts are the right tool for closed enums, required keys, and ordering. They are the wrong tool for "is this analysis useful." Putting subjective quality into the script either fails good work or rubber-stamps bad work while looking like enforcement.

Evals remain necessary and insufficient. Reusing the shipped validator proves shape the same way runtime will. Separate cases still have to prove routing, semantics, and injection resistance. Only the shipped validator is present when a user actually runs the skill.

## Concrete examples

Good: a shipped validator owns runtime acceptance of the three-line envelope (POSIX `sh` shown). The producer runs it while writing; the orchestrator runs it again before routing; evals invoke the same script for shape.

```markdown
# In skill-name/SKILL.md and each producing subagent

Validator: `scripts/validate-output.sh`.
Invoke: `sh "${SKILL_DIR}/scripts/validate-output.sh" < "$payload"`
Payload on stdin. Exit 0 accepts; non-zero prints one finding per defect.

The orchestrating consumer needs a permitted shell for that command
(Claude Code Bash or OpenCode shell permission, mapped as a capability).

Producer: pipe the complete output through the validator, fix findings, re-run, then return.
Orchestrator: run the same command on the received payload before routing on line 1.
If the host cannot execute the script, stop the payload path and issue `TOOLS_MISSING`
through the parent workflow's escalation contract; do not parse the fields or send
them through the validator.
```

```sh
#!/bin/sh
# scripts/validate-output.sh — runtime acceptance for the three-line envelope
# usage: sh "${SKILL_DIR}/scripts/validate-output.sh" < "$payload"
awk '
function nonempty(s, p) {
  rest = substr(s, length(p) + 1)
  gsub(/[[:space:]]/, "", rest)
  return rest != ""
}
{
  lines[++n] = $0
}
END {
  err = 0
  if (n != 3) { printf "expected exactly 3 lines, found %d\n", n+0; err = 1 }
  if (lines[1] !~ /^STATUS: (PASS|BLOCKED|ERROR)$/) {
    printf "line 1: must be STATUS: PASS, BLOCKED, or ERROR\n"; err = 1
  }
  if (lines[2] !~ /^Reason: / || !nonempty(lines[2], "Reason: ")) {
    printf "line 2: must be Reason: with non-empty content\n"; err = 1
  }
  if (lines[3] !~ /^Next step: / || !nonempty(lines[3], "Next step: ")) {
    printf "line 3: must be Next step: with non-empty content\n"; err = 1
  }
  exit err
}
'
```

A constructor may emit those three lines from arguments so the producer fills only the prose slots. The consumer still runs `sh "${SKILL_DIR}/scripts/validate-output.sh" < "$payload"` before routing.

Bad: the contract lives in prose, a constructor or producer claim replaces the consumer gate, the agent "applies" the script by reading it, or evals are treated as runtime enforcement.

```markdown
Return a short status plus a reason. Something like `STATUS: PASS` is fine.
If the subagent says it validated, or if emit-envelope.sh printed the lines, route next.
If the host cannot run the script, read it and apply the checks yourself.
Structured-output APIs will keep the fields honest, so no script is required.
The eval suite already checks format, so production runs can skip validation.
```

## References

- [Input-output contracts](./input-output-contracts.md) — human-readable declaration of the fields this validator accepts at runtime.
- [Critical-output gates](./critical-output-gates.md) — named gates whose independent checker is this validator.
- [Empirical validation](./empirical-validation.md) — evals reuse the validator for shape and separately prove routing and semantics.
- [Deterministic execution](./deterministic-execution.md) — exact contract fields versus variable prose.
- [Handoff-file dispatch](./handoff-file-dispatch.md) — when the payload belongs in a run-scoped file rather than an inline reply.
- [Escalation categories](./escalation-categories.md) — `TOOLS_MISSING` is the out-of-band route when the host cannot execute the validator.
- [Positive-constraint framing](./positive-constraint-framing.md) — name the allowed invocation path before restrictions.
- Turpin et al., "Language Models Don't Always Say What They Think," arXiv:2305.04388: <https://arxiv.org/abs/2305.04388>. Supports treating producer self-report as fallible.
- IBM, "What is a data contract?", accessed 2026-06-03: <https://www.ibm.com/think/topics/data-contract>. Practitioner guidance on machine-readable contracts with automated enforcement.
