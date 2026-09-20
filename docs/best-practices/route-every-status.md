# route-every-status

📝 Declare a closed status set for every subagent and skill, route every value in the orchestrator, and give every loop a named counter, a cap, and an over-cap route.

🔒 This rule is `mandatory`: a miss is a material gap unless the skill names the rule and the reason for the exception in its `SKILL.md`.

Every subagent declares its statuses as a closed set: its success value plus whichever of `BLOCKED | FAIL | ERROR | PARTIAL | TOOLS_MISSING | RATE_LIMIT` it can actually reach, each with the condition that produces it. The orchestrator's routing table handles every declared value, the subagent emits nothing outside the set, and a missing or unparseable status is itself routed (for example one redispatch, then `ERROR`), never inferred from prose. A `PARTIAL` report lists what succeeded and what did not so the remainder can be routed explicitly. A capability the subagent needs but cannot get (no network, no shell, no validator script) is `TOOLS_MISSING`, reported loudly; a fluent best-effort answer from stale knowledge is a contract violation dressed as a verdict, and the orchestrator would route it as if it were true.

One casing across a skill and its siblings: UPPER_SNAKE. Status lines are `<TOKEN>: <VALUE>`; a skill ends with `<SKILL_TOKEN>: PASS | GAPS_FOUND | BLOCKED | ERROR` (for example `COMMIT_SCOPED_CHANGES: BLOCKED`); checkpoint answers are `APPROVED | REVISE | ABORT`, and a missing or unusable answer routes to `BLOCKED`, never to a bespoke lowercase status. Every repair, retry, or re-ask loop has a named counter, a cap, and the route taken when the cap is reached; that is the whole definition of bounded, and the number is the skill's choice. Completion is declared the same way: a skill is done when it emits one terminal status together with the evidence that status rests on (a passing validator, a baseline diff, a written path), not when it reaches a stop-for-review point in each phase.

Consumer-side validation of the status field is owned by [validate-routed-fields-with-a-script](./validate-routed-fields-with-a-script.md); what a checkpoint shows before asking is owned by [checkpoint-irreversible-actions](./checkpoint-irreversible-actions.md); when a `state-machine.md` exists it is the normative source of transitions per [one-normative-state-machine](./one-normative-state-machine.md).

## Examples

```markdown
<!-- ❌ subagents/related-skills-discoverer.md -->
If the web is unavailable, return a best-effort summary from training knowledge.

<!-- ❌ SKILL.md -->
4. Use whatever the discoverer returns. Retry the editor until validation
   passes (a few tries is usually enough), then stop for review.

<!-- ✅ subagents/related-skills-discoverer.md -->
## Escalation

| Status | When |
| --- | --- |
| `RELATED_SKILLS: PASS` | Search completed |
| `RELATED_SKILLS: TOOLS_MISSING` | Web search is unavailable in this runtime |
| `RELATED_SKILLS: ERROR` | Tool failure persists after one retry |

<!-- ✅ SKILL.md -->
`repair_count`: validator-driven editor redispatches this run. Cap 3.

| Result | Route |
| --- | --- |
| `RELATED_SKILLS: PASS` | Continue |
| `RELATED_SKILLS: TOOLS_MISSING`, `REFERENCE_NEED` unset | Continue, `reduced_confidence: true` |
| `RELATED_SKILLS: TOOLS_MISSING`, `REFERENCE_NEED` set | `IMPROVE_SKILL: BLOCKED` |
| `RELATED_SKILLS: ERROR`, or no status line after one redispatch | `IMPROVE_SKILL: ERROR` |
| `VALIDATE: FAIL`, `repair_count` < 3 | `repair_count += 1`; redispatch the editor with the findings |
| `VALIDATE: FAIL`, `repair_count` = 3 | `IMPROVE_SKILL: BLOCKED` naming the open findings |

Done when: `IMPROVE_SKILL: PASS` with `VALIDATE: PASS` and a non-empty
authorized baseline diff; or `GAPS_FOUND | BLOCKED | ERROR` with one reason line.
```

## Related rules

- [validate-routed-fields-with-a-script](./validate-routed-fields-with-a-script.md)
- [checkpoint-irreversible-actions](./checkpoint-irreversible-actions.md)
- [one-normative-state-machine](./one-normative-state-machine.md)
- [declare-input-output-contracts](./declare-input-output-contracts.md)
