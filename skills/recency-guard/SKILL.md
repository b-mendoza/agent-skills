---
name: recency-guard
description: >
  A validation framework that ensures Claude's responses are current, accurate, complete, and clear.
  Use this skill whenever the user asks a factual or research question, requests analysis or recommendations
  (e.g., "What's the best framework for X?", "Compare options for Y"), or any prompt where recency and
  accuracy matter. Also trigger when the user explicitly asks for validated, verified, or fact-checked
  answers. This skill should activate broadly — if the answer depends on facts that could have changed
  in the last few months, use it. Even questions that seem straightforward ("Is X still the recommended
  approach?") benefit from this skill's validation pipeline. Do NOT trigger for purely creative writing,
  casual chat, or tasks that are entirely opinion-based with no factual claims.
---

# Recency Guard

This skill enforces a 4-step validation pipeline on every response: Recency → Self-Verification → Completeness → Clarity. The goal is to catch stale information, overconfident claims, missing requirements, and unclear writing before they reach the user.

The user sees only a clean final answer. The validation work happens internally — do not surface the audit trail unless the user explicitly asks for it.

## How to use this skill

After reading this file, proceed as follows:

1. Draft your response to the user's question normally.
2. Before sending it, run the 4 checks below **in order**. Each check may cause you to revise the draft.
3. After all 4 checks pass, send the final revised answer to the user as a clean response (no section headers like "Final Answer" or "Validation Summary" — just the answer itself).

---

## Check 1: Recency

The current date is available in your system context. Use it as your reference point.

**Use web search to verify every factual claim.** Do not rely on training data alone for anything presented as current, recent, ongoing, standard, common, or best practice. The threshold is the **last 3 months** relative to today's date.

For each factual claim, statistic, trend, example, comparison, or recommendation in your draft:

- Search the web to confirm it reflects the state of the world right now.
- If a claim depends on older information and is still useful, you have three options: replace it with newer information, keep it but explicitly label its date ("as of January 2025…"), or remove it.
- Never imply that older conditions are still true without verification. Frameworks get deprecated, APIs change, companies pivot, best practices evolve.
- If you cannot confidently establish the recency of a claim even after searching, treat it as uncertain and say so.

**Why this matters:** Users asking factual questions are making decisions based on your answer. Stale information can lead to wasted effort, bad architectural choices, or embarrassing mistakes. The cost of one extra search is tiny compared to the cost of being wrong.

---

## Check 2: Self-Verification

Identify the **3 most important factual claims** in your draft — the ones the user is most likely to act on or that carry the most weight in your argument.

For each claim, pressure-test it:

1. State the claim in one sentence.
2. Assess whether the source or reasoning behind it is credible. A single blog post is weaker than official documentation; a trending opinion is weaker than measured data.
3. Consider whether a reasonable counterexample, exception, or opposite interpretation exists. If so, acknowledge it.
4. Check for these specific failure modes:
   - **Overstating certainty** — presenting something debatable as settled.
   - **Confusing correlation with causation** — "X happened after Y" ≠ "Y caused X."
   - **Generalizing from a narrow case** — one company's experience is not an industry trend.
   - **Presenting opinion as fact** — recommendations are opinions unless backed by data.
5. Revise, qualify, or remove any claim that does not hold up.

If you cannot verify a claim with confidence, say so explicitly in the final answer rather than presenting it as settled fact. Users respect honesty about uncertainty far more than false confidence.

---

## Check 3: Completeness

Re-read the user's original request word by word. Check:

- Every requested deliverable is present in your draft.
- Every sub-question has been answered.
- No explicit constraint, scope limit, or formatting instruction was ignored.
- If something is genuinely unanswerable, you acknowledge the gap instead of silently omitting it.

Partial coverage is not acceptable unless the user explicitly allowed it. Missing a sub-question is one of the most common failure modes — this check exists specifically to catch it.

---

## Check 4: Clarity & Readability

Edit the final draft for precision, readability, and usefulness:

- Make the structure easy to scan — but follow the formatting guidance from your system prompt (avoid over-formatting with excessive headers, bold, and bullet points unless the content genuinely requires it).
- Define necessary jargon the first time it appears.
- Surface key takeaways clearly — the user should know the bottom line within the first few sentences.
- Remove filler, redundancy, and vague hedging ("it's worth noting that…", "it should be mentioned…").
- Prefer concrete wording over abstract phrasing. "Response times increased 40%" beats "performance was negatively impacted."
- Do not pad the answer with process narration. Never describe the checks you ran or mention this skill's existence.

---

## Output rules

- **Do not** include section headers like "Final Answer" or "Validation Summary" in your response.
- **Do not** narrate the validation process to the user ("I verified this by…", "After checking…").
- **Do not** mention this skill or its checks.
- **Do** produce a clean, direct answer that reads as if it were written correctly the first time.
- If the user explicitly asks to see your validation reasoning or fact-checking audit trail, then and only then include a brief summary of the 3 claims you stress-tested and any points you flagged as uncertain or outdated.
