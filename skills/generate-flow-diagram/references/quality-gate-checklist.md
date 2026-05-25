# Quality Gate Checklist

> Load this file only when reviewing a candidate diagram or preparing targeted
> repair feedback. Failed checks guide the builder repair; the full reviewer
> gate runs again after each repaired candidate.

## Review Checks

| Check | Pass Condition |
| ----- | -------------- |
| Mermaid syntax | One fenced `mermaid` block; valid `flowchart` declaration; balanced brackets and quotes; no malformed arrows |
| Classes | Class assignments target only existing nodes; `classDef` ordering does not determine validity |
| Input normalization | Candidate reflects `PROCESS_INPUTS` derived from the supplied process spec or refinement baseline; unknowns are assumptions, questions, or blockers |
| Flow coverage | Intake, boundary, validation, synthesis, decisions, outputs, and terminal states are represented when relevant |
| Human gates | Every sensitive action has approve and decline paths plus audit or handoff handling |
| Branch integrity | Every branch has a destination; every decision has named outcomes |
| Validation flow | Validation checks feed synthesis, readiness, blocker, refinement, research, or escalation paths |
| Grounding | Unsupported facts are not presented as confirmed; assumptions and unknowns are labeled |
| Refinement approval | Refinement output includes only user-approved gap fixes |
| Output contract | Final Markdown has title, boundary paragraph, one Mermaid diagram, and optional templates/rules only when useful |

Fetch current Mermaid documentation from `external-sources.md` only when a syntax
uncertainty affects the verdict.

## Fix Loop

1. Return `REVIEW: FAIL` with specific failed checks.
2. Send only those failed checks to the builder as `REVIEW_FEEDBACK`.
3. Consume the repair builder return as `BUILD_VERDICT`.
4. On `BUILD: PASS`, run the full `diagram-quality-reviewer` checklist again against the updated candidate.
5. On `BUILD: NEEDS_INPUT` or `BUILD: ERROR`, stop with the builder's `Failure Details`.
6. Stop after three fix cycles for the same candidate.
7. Escalate to the user if missing information or approval blocks a valid diagram.

## Failure Severity

- `high`: invalid Mermaid, missing human gate for sensitive action, unapproved refinement change, or missing terminal states.
- `medium`: disconnected validation, unclear branch labels, unsupported assumptions, or missing output contract element.
- `low`: style inconsistency, verbose labels, or optional template mismatch.
