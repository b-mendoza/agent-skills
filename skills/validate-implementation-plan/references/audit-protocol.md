# Audit Protocol

Read this file before the first dispatch and whenever a subagent output is
malformed, a status needs interpretation, or the final report contract is
needed. Keep raw plan text out of the orchestrator context while applying this
protocol.

## Status Codes

| Status | Meaning | Orchestrator action |
| ------ | ------- | ------------------- |
| `PASS` | Stage completed and returned usable output | Continue |
| `BLOCKED` | Missing input, unreadable path, or unavailable required capability | Stop if the stage is a hard gate; otherwise record the gap |
| `FAIL` | Stage ran but the output cannot support reliable downstream use | Retry the named failed branch through the shared retry loop, or record the gap for optional evidence |
| `ERROR` | Unexpected tool, filesystem, parsing, or execution failure | Retry the named failed branch through the shared retry loop, then escalate or record if optional |

## Stage Success Labels

The orchestrator accepts a stage output only when the stage-specific success
label and expected payload shape are present:

| Stage | Success label | Expected payload |
| ----- | ------------- | ---------------- |
| Snapshot | `SNAPSHOT: PASS` | Snapshot path, section count, redaction state, sensitive categories, technical claim count |
| Requirements | `REQUIREMENTS: PASS` | Numbered source requirements and baseline notes |
| Technical evidence | `EVIDENCE: PASS` | JSON array of local-evidence claim reviews |
| Traceability audit | `TRACEABILITY: PASS` | JSON object with `req_annotations` and `requirement_gaps` |
| Scope audit | `YAGNI: PASS` | JSON array of scope and avoidable-complexity findings |
| Assumptions audit | `ASSUMPTIONS: PASS` | Discovery or resolution JSON matching the assumptions contract |
| Report assembly | `AUDIT: PASS | FAIL | BLOCKED | ERROR` | Completion handoff plus written `OUTPUT_PATH` when applicable |

## Severity Levels

| Severity | Use for |
| -------- | ------- |
| `critical` | The plan likely fails the request, adds unsafe scope, or depends on a disproven assumption |
| `warning` | The plan has material risk, weak support, or avoidable complexity that may still be salvageable |
| `info` | The plan is supported, a caveat is minor, or the finding is explanatory |

## Retry Loop

1. Name the contract mismatch or failed condition.
2. Re-dispatch only the subagent branch that failed.
3. Preserve the same trust limits: no widened paths, no new raw `PLAN_PATH`
   access outside `plan-snapshotter`, and no project-specific external website
   evidence.
4. Re-run only the checks that previously failed.
5. Stop after three fix cycles for the same branch.
6. Escalate to the user when a hard gate remains unresolved.

Snapshot creation and requirement extraction are hard gates. Other failed audit
branches can be recorded in the final report if enough successful branches remain
to produce a useful audit.

## Final Status Mapping

- `AUDIT: PASS`: report written, required sections present, no critical
  findings, no unresolved hard gate, and no decision-relevant open question.
- `AUDIT: FAIL`: report written and at least one critical traceability gap,
  critical avoidable-complexity finding, or disproven risky assumption remains.
- `AUDIT: BLOCKED`: required input is missing or declined, path authorization
  fails, `ORIGIN_CONTEXT` cannot be established, required external project proof
  is requested, a hard gate remains unresolved, or decision-relevant assumptions
  remain unanswered.
- `AUDIT: ERROR`: unrecovered internal, parsing, malformed-output, or
  report-write failure remains after the retry budget.

## Annotation Shape

Findings returned by auditor subagents use this shape unless their own output
contract says otherwise:

```json
{
  "plan_section": "Implementation Approach",
  "expert": "Requirements Auditor | YAGNI Auditor | Assumptions Auditor",
  "severity": "critical | warning | info",
  "text": "One concise finding with requirement numbers or evidence references when relevant."
}
```

## Report Contract

Final artifact path: `OUTPUT_PATH`

Required sections, in order:

- `## Audit Scope`
- `## Source Requirements`
- `## Findings By Plan Section`
- `## Requirement Gaps`
- `## Audit Summary`
- `## Resolved Assumptions`
- `## Open Questions`
- `## Sensitive Content Handling`

Completion handoff:

```text
AUDIT: PASS | FAIL | BLOCKED | ERROR
Output: <OUTPUT_PATH or "not written">
Sections covered: <N or "unknown">
Findings: critical=<N>, warning=<N>, info=<N>
Open questions: <N>
Reason: <one line>
```
