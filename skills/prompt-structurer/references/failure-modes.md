# Agent Failure Modes and Prevention Techniques

This reference maps specific agent failure modes to the structural techniques that prevent them. Use this when deciding whether to add a given technique to a prompt: does the underlying failure mode actually apply here?

---

## Failure mode: forgetting critical instructions mid-run

**Symptoms:** Agent executes the first few phases correctly but drops a constraint by phase three or four. Especially common in long multi-phase prompts where a rule was mentioned once in the intro.

**Technique: hoist critical rules to the top with dedicated tags.**

Take the most important cross-cutting instructions out of prose paragraphs and give them their own top-level tags like `<dispatch_rule>`, `<harmonization_philosophy>`, or `<autonomy_guardrails>`. The structural prominence reminds the agent these aren't optional throwaways.

---

## Failure mode: misinterpreting an ambiguous instruction

**Symptoms:** Agent does something that technically satisfies the letter of the instruction but violates the intent. Often happens with words that have multiple meanings in context ("harmonize", "consistent", "clean up").

**Technique: repeat critical rules at the point of action.**

If instruction X has a known misinterpretation at step 4, put a reminder of X inside step 4 — even if it's already stated in the philosophy block. The repetition looks redundant in reading but prevents the agent from reading step 4 in isolation (or summarizing it to a subagent) without the disambiguating context.

**Technique: negative tag names for intrinsically negative concepts.**

`<what_it_does_NOT_mean>` outperforms `<exclusions>` because the capitalized NOT appears in the tag itself. Agents sometimes infer positive meaning from exclusion lists; a negative tag name makes the framing harder to invert.

---

## Failure mode: treating qualifiers as optional

**Symptoms:** "Do not flag X" gets read as "prefer not to flag X" and the agent flags X anyway when it seems helpful.

**Technique: capitalize the pivot word.**

"Do NOT flag X" is harder to soften than "Do not flag X." Use sparingly — uppercasing everything defeats the purpose. Reserve for the single most important word in a sentence where softening would be catastrophic.

---

## Failure mode: silently omitting empty outputs

**Symptoms:** Output sections that would have zero items just... aren't there. Makes outputs non-uniform across runs and hides the fact that the agent actually checked that category.

**Technique: require explicit zero-finding statements.**

"For any category with zero findings, state that explicitly rather than omitting it." For the fully-empty case, "produce an 'All clear' report that names each category and confirms alignment."

---

## Failure mode: blowing through phase boundaries

**Symptoms:** Multi-phase prompts where the agent runs phase 1, then phase 2, then phase 3 all in one response without stopping. Often unwanted in interview-style prompts.

**Technique: explicit `<gate>` tags with stop conditions.**

Gates are first-class elements, not rules. `<gate>Do NOT proceed to Phase 2 until I explicitly confirm the interview is complete.</gate>` The tag name communicates halt-and-wait behavior, which is structurally different from constraints (continuous prohibition).

---

## Failure mode: asking the user mid-run when the user isn't there

**Symptoms:** Autonomous runs that stop and ask for clarification. Agents default to asking when uncertain, even when the prompt says "run autonomously."

**Technique: `<autonomy_guardrails>` with explicit "never ask, defer instead" rule.**

Combine with a DEFER bucket in triage logic: ambiguous cases go into a bucket the user reviews after the run, instead of pausing the run itself. Under-fixing is recoverable; over-fixing in autonomous mode is where things get damaged.

---

## Failure mode: encountering unexpected situations and resolving them silently

**Symptoms:** Agent discovers something mid-run the prompt didn't anticipate (new finding, spec inconsistency, surprising data). Silently resolves it in whatever direction seems plausible. User discovers the decision much later.

**Technique: `<new_finding_rule>` and `<spec_freshness_sanity_check>` escape hatches.**

Channel the unexpected into explicit auditable paths. "If the agent discovers X mid-run, append to the report, route through triage, do not act without ledger entry." The rule makes the unexpected traceable.

---

## Failure mode: losing decision history in chat output

**Symptoms:** Autonomous run completes with all the right work done, but you can't tell *why* each decision was made because the reasoning lives only in chat messages that may be lost or truncated.

**Technique: durable outputs for traceability.**

Every significant decision writes to a named file: reconciliation report, triage ledger, change summary, updated spec. Each has a predictable filename so follow-up prompts can consume prior outputs by path. Autonomy doesn't mean opacity.

---

## Failure mode: over-broad "harmonization" or "cleanup"

**Symptoms:** Agent asked to "make X consistent with Y" starts changing dependencies, tools, scope — things that should have been untouched. The word triggers a broader interpretation than intended.

**Technique: `<philosophy>` block with `<what_it_does_NOT_mean>` sub-tag.**

Explicit enumeration of what's off-limits. Combined with `<anti_patterns>` block that lists flags or actions the agent should NOT produce. Combined with negative success criteria ("No dependencies were added, removed, or altered."). Three layers because this failure mode is especially sticky.

---

## Failure mode: conditional logic that partially applies

**Symptoms:** Prompt says "if autonomous mode, do X; otherwise do Y." Agent partially applies both modes or picks wrong mode. Produces incoherent runs.

**Technique: parallel versions instead of branching logic.**

Produce two clean prompts (interview version + autonomous version) rather than one prompt with branches. The orchestrator picks at invocation time. Two simple contracts beat one complex one.

---

## Failure mode: success looking the same as failure

**Symptoms:** Agent produces plausible output that doesn't actually do the task. User has no quick way to verify correctness post-run.

**Technique: `<success_criteria>` with specific, observable, exhaustive checkpoints.**

Mix positive ("X exists at path Y") and negative ("no Z was added") criteria. Cover every phase, constraint, and anti-pattern. If writing the criteria feels redundant with the body, the body is probably too vague — sharpen until each criterion becomes non-trivial to check.

---

## Diagnostic: which failures apply to this prompt?

Before adding every technique, run this check:

1. Is this a multi-phase prompt? → Risk of forgetting critical instructions, blowing through gates. Add hoisted rules, gates.
2. Does the task have words with multiple interpretations? → Risk of misinterpretation. Add philosophy block, repeat at point-of-action.
3. Will this run autonomously? → Risk of silent resolution, chat-only decisions. Add autonomy guardrails, durable outputs, new-finding rule.
4. Could the output's correctness look similar to a wrong answer? → Risk of success-equals-failure. Add specific success criteria with negative items.
5. Does the task include exclusions or carve-outs? → Risk of over-broad interpretation. Add anti-patterns, what-it-does-NOT-mean tag.
6. Will empty outputs be common? → Risk of silent omission. Add explicit zero-finding requirement.

Apply techniques in proportion to the risks actually present. Over-applying structure to a simple prompt adds noise without preventing anything.