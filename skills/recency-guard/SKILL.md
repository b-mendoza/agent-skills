---
name: "recency-guard"
description: 'A validation framework that ensures Claude''s responses are current, accurate, complete, and clear. Use this skill whenever the user asks a factual or research question, requests analysis or recommendations (e.g., "What''s the best framework for X?", "Compare options for Y"), or any prompt where recency and accuracy matter. Also trigger when the user explicitly asks for validated, verified, or fact-checked answers. This skill should activate broadly — if the answer depends on facts that could have changed in the last few months, use it. Even questions that seem straightforward ("Is X still the recommended approach?") benefit from this skill''s validation pipeline. Do NOT trigger for purely creative writing, casual chat, or tasks that are entirely opinion-based with no factual claims.'
---

# Recency Guard

This skill enforces a 4-step validation pipeline on every response:
**Recency → Self-Verification → Completeness → Clarity**. The goal is to catch
stale information, overconfident claims, missing requirements, and unclear
writing before they reach the user.

The user sees only a clean final answer. The validation work happens internally —
do not surface the audit trail unless the user explicitly asks for it.

---

## Subagent Registry

| Subagent          | Path                             | Purpose                                                                                                  |
| ----------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `recency-checker` | `./subagents/recency-checker.md` | Web-searches every factual claim in the draft to confirm it reflects the current state of the world      |
| `claim-verifier`  | `./subagents/claim-verifier.md`  | Pressure-tests the 3 most important claims for credibility, counterexamples, and reasoning failure modes |

### Dispatch Mechanism

The subagent `.md` files above are co-located reference documents, not
auto-discovered Claude Code agents. To dispatch a subagent:

1. Read the subagent's `.md` file from the path in the registry.
2. Use the **Task tool** to spawn a subagent, passing the `.md` content as
   the system prompt and the step's inputs (draft, date, etc.) as the user
   message.
3. Collect the Task tool's return value — the subagent's structured report.
4. Apply its findings to the draft before proceeding to the next step.

Subagents run sequentially (Step 1 before Step 2) because the claim-verifier
needs the recency-checker's revised draft as input. Do not parallelize.

Note: subagents cannot spawn other subagents. Each subagent handles its own
web searches and tool calls internally — the orchestrator does not need to
provide search results.

---

## Source Quality Hierarchy

When evaluating or ranking sources — both in subagents and inline checks — apply
this tiered ranking. Higher-tier sources carry more weight and produce higher
confidence scores.

| Tier | Source Type                       | Examples                                                         |
| ---- | --------------------------------- | ---------------------------------------------------------------- |
| 1    | Official documentation & specs    | Language/framework docs, RFCs, API references, spec sheets       |
| 2    | Peer-reviewed research & data     | Academic papers, government data, audited reports                |
| 3    | Authoritative first-party content | Company engineering blogs, official announcements, changelogs    |
| 4    | Reputable journalism & analysis   | Major tech publications, industry analyst reports                |
| 5    | Community & practitioner content  | Conference talks, well-known developer blogs, Stack Overflow     |
| 6    | Unvetted community content        | Forum posts, social media threads, anonymous blogs, AI-generated |

When two sources conflict, prefer the higher-tier source. When a claim is
supported only by Tier 5–6 sources, flag it as lower confidence. If only Tier 6
sources exist, treat the claim as unverified.

---

## Confidence Scoring

Every factual claim in the draft should receive an internal confidence score.
These scores are used during the verification steps to decide what needs
qualification, revision, or removal.

| Score    | Criteria                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------- |
| **High** | Confirmed by a Tier 1–3 source published within the last 3 months. No credible counter-evidence.    |
| **Med**  | Confirmed by a Tier 3–5 source, OR by a Tier 1–3 source older than 3 months with no sign of change. |
| **Low**  | Supported only by Tier 5–6 sources, OR sources conflict, OR unable to verify after searching.       |

**How scores affect the final answer:**

- **High** — Present the claim directly. No qualifier needed.
- **Med** — Present the claim but add light context: a date stamp ("as of
  March 2026"), a hedge ("based on current documentation"), or a brief note
  about the source.
- **Low** — Either remove the claim, explicitly label it as uncertain, or
  replace it with a verifiable alternative. Never present a Low-confidence
  claim as settled fact.

---

## Pipeline Execution

After reading this file, run the pipeline in order:

### Step 1: Recency Check (subagent)

Dispatch to `recency-checker` using the mechanism described in the Subagent
Registry section above. Pass it:

- The full draft response.
- Today's date (from system context).
- The Source Quality Hierarchy and Confidence Scoring tables above (or
  instruct the subagent to reference this SKILL.md).

Collect its output: a list of claims with their confidence scores, source
tiers, and any recommended revisions or removals. Apply all revisions to
the draft before proceeding.

### Step 2: Self-Verification (subagent)

Dispatch to `claim-verifier` using the same mechanism. Pass it:

- The revised draft (post-Step 1).
- The user's original request (for context on what matters most).

Collect its output: the 3 most important claims with credibility assessments,
counterexamples considered, failure modes checked, and final confidence scores.
Apply any further revisions.

### Step 3: Completeness (inline)

Re-read the user's original request word by word. Check:

- Every requested deliverable is present in the draft.
- Every sub-question has been answered.
- No explicit constraint, scope limit, or formatting instruction was ignored.
- If something is genuinely unanswerable, acknowledge the gap instead of
  silently omitting it.

Partial coverage is not acceptable unless the user explicitly allowed it.
Missing a sub-question is one of the most common failure modes — this check
exists specifically to catch it.

### Step 4: Clarity & Readability (inline)

Edit the final draft for precision, readability, and usefulness:

- Make the structure easy to scan — but follow the formatting guidance from
  your system prompt (avoid over-formatting with excessive headers, bold, and
  bullet points unless the content genuinely requires it).
- Define necessary jargon the first time it appears.
- Surface key takeaways clearly — the user should know the bottom line within
  the first few sentences.
- Remove filler, redundancy, and vague hedging ("it's worth noting that…",
  "it should be mentioned…").
- Prefer concrete wording over abstract phrasing. "Response times increased
  40%" beats "performance was negatively impacted."
- Do not pad the answer with process narration.

---

## Uncertain Claims Summary

Internally, maintain a running list of any claims scored **Low** or flagged
during verification. After the pipeline completes:

- If all claims are High confidence, no action needed.
- If any claims are Med or Low, weave appropriate qualifiers into the final
  answer naturally (date stamps, hedges, "this could not be independently
  verified"). Do not create a visible "uncertainty" section unless the user
  asks for it.
- If the user explicitly asks for the audit trail, validation reasoning, or
  fact-checking details, produce a concise summary that includes:
  1. The 3 stress-tested claims and their confidence scores.
  2. Any claims that were revised, removed, or qualified and why.
  3. Source tiers used for each key claim.

---

## Output Rules

- **Do not** include section headers like "Final Answer" or "Validation Summary."
- **Do not** narrate the validation process ("I verified this by…", "After checking…").
- **Do not** mention this skill, its subagents, or its checks.
- **Do** produce a clean, direct answer that reads as if it were written correctly the first time.
- **Do** weave uncertainty qualifiers naturally into prose when needed — never as a bolted-on disclaimer block.
- If the user explicitly asks to see validation reasoning, then and only then include the Uncertain Claims Summary described above.
