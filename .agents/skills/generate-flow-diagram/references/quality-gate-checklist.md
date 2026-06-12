# Quality Gate Checklist

Load this file only when reviewing a candidate diagram or preparing targeted
repair feedback. The producer's self-report is not evidence; the reviewer gate
must inspect the candidate.

## Review Checks

| Check | Pass Condition |
| ----- | -------------- |
| Mermaid syntax | `scripts/check-mermaid.sh` parsed every fenced Mermaid block when parser available; otherwise inspection records `inspected-only`; invalid parser output fails |
| Classes | Class assignments target existing nodes only |
| Input normalization | Candidate reflects `PROCESS_INPUTS`; unknowns are assumptions, questions, or blockers |
| Flow coverage | Intake, boundary, validation, synthesis, decisions, outputs, and terminal states are represented when relevant |
| Human gates | Sensitive actions and file mutations have approve and decline paths plus audit or handoff handling |
| Branch integrity | Every branch has a destination and every decision has named outcomes |
| Validation flow | Validation checks feed synthesis, readiness, blocker, refinement, research, escalation, or repair |
| Terminal states | Completion and failure states match the workflow contract |
| Grounding | Unsupported facts are not presented as confirmed |
| Refinement approval | Refinement output includes only inventory-validated approved gap fixes; `none` preserves the baseline |
| Output contract | Artifact has title, boundary paragraph, one Mermaid diagram unless explicitly expanded, and optional sections only when useful |
| Run report | Completed runs include mode, assumptions, repair cycles, validation method, dispatch method, and sources fetched |

## Scope Checks

Apply these when `DIAGRAM_SCOPE` is `orchestrator` or `subagent`, or when
`RUN_MODE=decompose`.

| Check | Pass Condition |
| ----- | -------------- |
| Scope separation | Orchestrator diagrams contain no subagent internals; subagent diagrams do not restate root phases, gates, banners, or siblings |
| No duplication | No node label, step, check, or status appears in more than one diagram of the package; `OTHER_DIAGRAM_DIGEST` is present or explicit `none` |
| Dispatch collapse | Each orchestrator dispatch is one cross-linked node, not a step-by-step subagent expansion |
| Mutation limits | Decompose write and load-wiring assumptions stay inside `MUTATION_LIMITS` |
| Staged write gate | Decompose writes are planned as one batch after every candidate passes, not per-diagram writes |

## Fix Loop

1. Return `REVIEW: FAIL` with specific failed checks.
2. Send only failed checks to `diagram-builder` as `REVIEW_FEEDBACK`.
3. Consume `BUILD_VERDICT`.
4. On `BUILD: PASS`, rerun the full checklist against the updated candidate.
5. Stop after three repair cycles for the same candidate.
6. Escalate when missing information or approval blocks a valid diagram.

## Failure Severity

- `high`: invalid Mermaid, missing human gate for sensitive action or mutation,
  unapproved refinement change, out-of-scope scoped content, duplicated content
  across diagrams, per-diagram writes in decompose, or missing run-report method
  for validity.
- `medium`: disconnected validation, unclear branches, unsupported assumptions,
  missing output-contract element, unauditable node counts, or dispatch expanded
  into internals in an orchestrator diagram.
- `low`: style inconsistency, verbose labels, optional template mismatch, or
  incomplete follow-up wording that does not affect safety.
