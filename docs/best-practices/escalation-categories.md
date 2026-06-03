# escalation-categories

## Tier

`mandatory`. Without enumerated failure categories the orchestrator
cannot route failures, the user cannot tell silent-skip from
genuine-block, and "the skill failed" collapses to a single bucket
that hides the real failure mode.

## When it applies

For every subagent that can fail to complete its contract — which is
essentially every dispatched subagent — and for every orchestrator
phase whose failure must be routed somewhere other than "throw and
hope."

## The practice

Define failure categories and reporting formats for every subagent so
the orchestrator can route failures without reading raw error
details. Use a consistent vocabulary across the skill and across
related skills so handoffs compose.

Common categories:

| Category | Meaning | Typical route |
| --- | --- | --- |
| `BLOCKED` | Cannot start because prerequisite input, permission, or user decision is missing | Ask user or stop |
| `FAIL` | Completed but output violates a gate or contract | Repair loop or re-plan |
| `ERROR` | Unexpected runtime/tool/filesystem failure | Retry if bounded, otherwise escalate |
| `PARTIAL` | Some items succeeded and others failed | Route remaining scope explicitly |
| `TOOLS_MISSING` | Required runtime capability is unavailable | Stop or ask user to enable/install |
| `RATE_LIMIT` | External service throttled after retry | Wait, reschedule, or escalate |

Judgment-heavy subagents should fail loudly when a missing capability
defeats their purpose. For example, a bias-correction subagent that
cannot perform the required current research should report a failure
instead of silently regurgitating stale training data.

## Rationale

A subagent that returns "I did my best, here's a guess" when its
input was unreadable, its runtime capability missing, or its source
of truth stale, is silently downgrading from contract violation to
opinion. The orchestrator routes the opinion as if it were a verdict;
downstream phases consume it; the gap is invisible until something
much later fails for an unrelated-looking reason.

Enumerated categories convert silent-skip into routed failure. The
orchestrator reads the category, picks the right repair branch
(retry, escalate, re-plan, ask user), and the failure surfaces at the
correct boundary. Judgment-heavy subagents need the rule most
because they are the ones tempted to substitute fluent prose for
contract compliance.

## Concrete examples

Good: enumerated categories, routed correctly, with a clear "fail
loudly" rule for missing capabilities.

```markdown
# In skill-name/subagents/related-skills-discoverer.md

## Escalation
| Status | When |
| ------ | ---- |
| `BLOCKED` | Required inputs are missing or web access is unavailable |
| `ERROR` | Tool or runtime failure prevents a safe report |

# In skill-name/SKILL.md
3. Dispatch `related-skills-discoverer`.
4. On `BLOCKED` or `ERROR`, degrade and continue when
   `REFERENCE_NEED` is unset; otherwise route to the blocked handoff.
```

Bad: no enumerated categories, silent fallback when web access
fails.

```markdown
# In skill-name/subagents/related-skills-discoverer.md
If the web is unavailable, return a best-effort summary based on
training-data knowledge.

# In skill-name/SKILL.md
3. Dispatch the discoverer.
4. Use whatever it returns. (Orchestrator cannot tell that the report
   is a guess; downstream phases consume stale knowledge as fresh
   evidence.)
```

## References

- IEEE, "Reliability engineering of software systems," IEEE Standard
  982.1-2005, accessed 2026-06-03:
  <https://standards.ieee.org/ieee/982.1/2767/>. Supports enumerated
  failure modes and routed failure handling as reliability
  primitives.
- OpenAI, "Safety in building agents," accessed 2026-05-27:
  <https://platform.openai.com/docs/guides/agent-builder-safety>.
  Supports fail-loud handling when a missing capability defeats the
  agent's purpose.

