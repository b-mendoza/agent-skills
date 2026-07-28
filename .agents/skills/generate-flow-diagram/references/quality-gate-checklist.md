# Quality Gate Checklist

Load this file only when reviewing a candidate diagram or preparing targeted
repair feedback. The producer's self-report is not evidence; the reviewer gate
must inspect the candidate.

## Review Checks

| ID | Check | Pass Condition |
| -- | ----- | -------------- |
| C1 | Mermaid syntax | `scripts/check-mermaid.sh` parsed every fenced Mermaid block when parser available; otherwise inspection records `inspected-only`; invalid parser output fails |
| C2 | Classes | Class assignments target existing nodes only |
| C3 | Input normalization | Candidate reflects `PROCESS_INPUTS`; unknowns are assumptions, questions, or blockers |
| C4 | Flow coverage | Intake, boundary, validation, synthesis, decisions, outputs, and terminal states are represented when relevant |
| C5 | Human gates | Sensitive actions and file mutations have approve and decline paths plus audit or handoff handling |
| C6 | Branch integrity | Every branch has a destination and every decision has named outcomes |
| C7 | Validation flow | Validation checks feed synthesis, readiness, blocker, refinement, research, escalation, or repair |
| C8 | Terminal states | Completion and failure states match the workflow contract |
| C9 | Grounding | Unsupported facts are not presented as confirmed |
| C10 | Refinement approval | Refinement output includes only inventory-validated approved gap fixes; `none` preserves the baseline |
| C11 | Output contract | Artifact has title, boundary paragraph, one Mermaid diagram unless explicitly expanded, and optional sections only when useful |
| C12 | Run report | Completed runs include mode, assumptions, repair cycles, validation method, dispatch method, and sources fetched |

## Scope Checks

Apply these when `DIAGRAM_SCOPE` is `orchestrator` or `subagent`, or when
`RUN_MODE=decompose`.

| ID | Check | Pass Condition |
| -- | ----- | -------------- |
| S1 | Scope separation | Orchestrator diagrams contain no subagent internals; subagent diagrams do not restate root phases, gates, banners, or siblings |
| S2 | No duplication | No node label, step, check, or status appears in more than one diagram of the package; `OTHER_DIAGRAM_DIGEST` is present or explicit `none` |
| S3 | Dispatch collapse | Each orchestrator dispatch is one cross-linked node, not a step-by-step subagent expansion |
| S4 | Mutation limits | Decompose write and load-wiring assumptions stay inside `MUTATION_LIMITS` |
| S5 | Staged write gate | Decompose writes are planned as one batch after every candidate passes, not per-diagram writes |

## Baseline Effect

Every failed check carries a `baseline_effect` value so the orchestrator can
route repair-under-`none` deterministically instead of by judgment:

- `unchanged` — the required fix is syntax-only or presentation-only and
  preserves every node, edge, label, ownership assignment, gate, and terminal
  of the baseline. Examples: a Mermaid syntax error, a class targeting a
  missing node, a malformed link.
- `changed` — the required fix adds, removes, renames, or rewires any node,
  edge, gate, terminal, scope, or process meaning relative to the baseline.
- `unknown` — the reviewer cannot establish the fix's effect on the baseline.

When `approval_scope` is exact `none`, the orchestrator repairs `unchanged`
failures directly and routes any `changed` or `unknown` failure to
`AwaitRepairApproval`. `unknown` is never treated as `unchanged`.

## Fix Loop

1. Return `REVIEW: FAIL` with specific failed checks, each carrying its check
   ID and `baseline_effect`.
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
