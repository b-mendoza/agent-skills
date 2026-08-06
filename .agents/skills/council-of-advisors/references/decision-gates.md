# Decision Gates

This file is the single normative source for gate pass conditions, caps, and failure routes. `SKILL.md` indexes gates but does not redefine them.

## Shared Budgets

| Budget | Limit | Route When Exceeded |
| --- | --- | --- |
| Per gate repair cycles | 3 targeted repair cycles, then the fourth failure stops | `status: blocked` with gate name and counter state |
| Per analysis seat schema repair | 3 targeted redispatches per seat | `status: blocked` naming the seat and gate |
| Seat `ERROR` retry | 1 retry | second `ERROR` returns `status: error` |
| Global redispatch budget | 12 total redispatches | `status: blocked` with budget use in `run_log` |
| Packet refinement after analysis `BLOCKED` | 1 consolidated packet-refinement round | second `BLOCKED` wave returns `status: needs_input` |

Exception: `G_FRAMING_CONFIRMED` does not use the generic per-gate repair counter. It allows at most 3 total confirmation attempts and terminates in `status: needs_input`, not `blocked` (see its section below).

Repair only the producing phase or seat named by the failing gate. Do not rerun unaffected seats unless packet version changed.

Low-confidence repair accounting: the redispatch set is the analysis seats whose packets the chair explicitly names as the drivers of its low confidence (empty when the chair names none). `RepairLowConfidence` has no separate cap. Every seat redispatched for low confidence, and every chair rerun it triggers, counts individually against the global redispatch budget. The planned repair (weak seats plus chair rerun) must fit within the remaining budget; otherwise skip the repair. The per-seat schema cap applies only when the named repair reason is a schema defect. The `blocked` route in the table above applies when a required redispatch cannot run within budget; a low-confidence result whose repair is skipped for budget reasons is not blocked — it proceeds to `Type1Gate`, where the Type 1 low-confidence override still protects irreversible decisions.

## G_FRAMING_CONFIRMED

Protects: confirmed decision packet before any seat runs.

Pass condition: the user explicitly confirms the paraphrased packet.

Failure route: revise the paraphrase and ask again, up to 3 total confirmation attempts (the initial ask plus up to 2 revised re-asks). If the third attempt remains unconfirmed, return `status: needs_input` with the packet draft and unresolved field. This gate is an exception to the Shared Budgets table: it does not use the generic "3 repair cycles" counter and terminates in `needs_input`, never `blocked`.

## G_REVERSIBILITY

Protects: reversibility packet and downstream depth binding.

Pass condition: all reversibility fields are present, `what_would_change_my_mind` is non-empty, and `depth_setting` matches `decision_type` (`type_1 -> deep`, `type_2 -> standard`).

Failure route: redispatch `reversibility-seat` with the missing or inconsistent field reason, within the shared budgets.

Low-confidence route: ask one targeted question about the dominant unknown reversal-cost dimension, append the answer as a packet addendum, and redispatch. If still `low`, default to `type_1` and `deep`, record `classification_basis: defaulted_low_confidence`, and continue.

Sticky Type 1 rule: after `type_1` is set, downgrading to `type_2` requires new explicit user-stated evidence about reversal cost, recorded in `run_log`.

## G_REASONING_CHAINS_PRESENT

Protects: valid analysis packets.

Pass condition: every analysis packet has the required schema fields, non-empty labeled `reasoning_chain`, tiered premise sources, non-empty `what_would_change_my_mind`, a valid confidence value, and the correct verdict for its `seat_class`.

Failure route: redispatch the failing seat with the schema or reasoning defect, within the shared budgets. Seat-emitted `FAIL` uses this route.

## G_INDEPENDENCE

Protects: dispatch hygiene and no sibling-output contamination.

Pass condition:

- The run log holds one dispatch-hygiene assertion per dispatched seat: seat, packet version, cycle, reason, and no sibling output included.
- No packet explicitly attributes content to a named sibling seat's output from this run.

Scope by execution mode: with `execution_fidelity: subagents` (isolated seat contexts), a pass asserts contextual independence. With `execution_fidelity: inline_degraded` (all seats in one context), a pass asserts payload-level isolation only — clean dispatch payloads and no explicit sibling attribution. An inline run must not claim contextual independence in the run log or handoff.

Legal phrasing: hypothetical language such as `an optimist might say` does not fail the gate unless it claims access to the sibling seat's actual output.

Failure route: missing hygiene assertion reruns affected seats with clean payloads. Explicit sibling-output attribution redispatches the contaminated seat.

## Analysis Seat Escalation

| Return | Meaning | Route |
| --- | --- | --- |
| `BLOCKED` | A required user fact or prerequisite is missing | Collect all `BLOCKED` returns from the wave, ask one consolidated clarification, append answers as packet vN+1, re-confirm framing, and rerun all seven analysis seats |
| `FAIL` | Seat completed but violated schema or gate | Redispatch that seat with the failure reason |
| `ERROR` | Runtime/tool failure prevented a safe packet | Retry that seat once; second error returns `status: error` |

Mixed-version synthesis is forbidden. Any packet refinement invalidates all prior seven analysis packets, and all seven must rerun on the new packet version.

## G_ORIGINALITY

Protects: prior-art gate routing and branch provenance.

Pass condition: one of the following is true:

- `prior_art_exists: false` with rationale.
- `prior_art_exists: true` and `differentiation_named: true` with at least one differentiation axis and validation evidence.
- A complete branch-mode output exists from `originality-seat (branch mode)`.

Failure route: redispatch `originality-seat` in branch mode. The orchestrator may choose the branch task from the packet state but does not author branch analysis.

## G_DISSENT_PRESERVED

Protects: chair minority-report integrity.

Pass condition:

- When chair confidence is `high`, `minority_report` is exactly `none — confidence is high`.
- When chair confidence is `medium` or `low`, `minority_report` contains the strongest dissenting seat's verdict or headline finding plus its reasoning summary, bounded to the stated dissenting case.

Failure route: redispatch `chair-seat` with the exact dissent defect, within the shared budgets.

## G_KILL_CRITERION

Protects: useful stop signal for the recommendation.

Pass condition: `required_kill_criterion` is present, substantive, specific, and observable at every confidence level. At `medium` confidence, it must also be time-bound or event-bound.

Failure route: redispatch `chair-seat` with the quality defect.

## Chair `FAIL` Escalation

Chair `FAIL` routes by stated cause:

- Correctable synthesis or formatting defect: 1 targeted redispatch carrying that exact defect, counted against the global redispatch budget. A second `FAIL` returns `status: blocked` with the chair's stated reason surfaced to the user.
- The chair states that any recommendation would require fabricating consensus or erasing material dissent from unchanged packets: return `status: blocked` immediately with that reason — no blind redispatch.

`G_DISSENT_PRESERVED` and `G_KILL_CRITERION` repairs keep the shared per-gate repair cap; this section governs only seat-emitted chair `FAIL`.

## G_TYPE_1_LOW_CONFIDENCE

Protects: Type 1 low-confidence safety override.

Computed verdict:

- `not_applicable` iff `decision_type: type_2`.
- `pass` iff `decision_type: type_1` and confidence is above `low`.
- `pass` iff `decision_type: type_1`, confidence is `low`, and the orchestrator set `final_recommendation: do_not_commit_yet` with `override_applied: true`.
- `fail` iff `decision_type: type_1`, confidence is `low`, and the override did not fire.

Failure route: `fail` is a blocking defect. Return `status: blocked` with the run-log explanation.

## G_LESSON_CARDS_PRESENT

Protects: educate-me transfer output.

Pass condition: nine lesson cards exist in roster order and match the template; the solo drill has nine subject-specific questions, one per seat.

Failure route: regenerate missing or malformed cards from `./references/educate-me-lesson-template.md` (operational package paths used by the orchestrator resolve from the skill root); no seat redispatch is needed. At most 3 regeneration cycles; if the gate still fails after the third, return `status: blocked` surfacing the remaining card defect. `status: error` remains reserved for actual runtime failures under the `ERROR` route.
