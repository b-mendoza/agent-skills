# Educate-Me Lesson Template

Read this file in Phase 7 to assemble the lesson cards and the solo
drill that ship with every council run.

The objective of Phase 7 is **transfer**, not recap. Each card teaches
the mental model so the user can run a thin version of the seat solo.
Cards must not summarize this run's verdict — they teach the model that
produced it.

## Lesson card template

Emit one card per seat. Order: `reversibility`, `adversary`,
`optimistic`, `originality`, `second-order`, `paradox-of-skill`,
`focus`, `power-questions`, `chair`.

```yaml
seat: <name>
mental_model: <name from ./mental-models.md>
when_it_applies: <one sentence>
how_to_apply_it_solo:
  - <question to ask yourself>
  - <question to ask yourself>
  - <question to ask yourself>
common_failure_modes:
  - <named failure mode>
  - <named failure mode>
one_line_takeaway: <a sentence the user can repeat>
```

## 9-question solo drill template

Append the following drill, prefilled with the user's `subject` from the
decision packet so it is immediately runnable on adjacent decisions.

```markdown
## 9-Question Solo Drill for: <subject>

1. **Reversibility.** If I commit to this and it turns out wrong, how
   expensive — in money, time, reputation, relationships, optionality,
   identity — is it to walk back? Is this a one-way door or a two-way
   door?
2. **Adversary.** What would have to be true for this to fail? Who has
   tried something similar and failed, and why?
3. **Optimist.** Under what specific conditions does the upside
   materialize? What optionality does pursuing this create that not
   pursuing it forecloses?
4. **Originality.** Who already solves a near-version of this problem,
   and where is my solution measurably different?
5. **Second-order.** If this succeeds, what does the world look like in
   1, 3, and 10 years — and whose behavior changes in response?
6. **Paradox of skill.** How crowded and how skilled is this field? Is
   my skill edge enough to win, or is luck the dominant variable here?
7. **Focus.** What am I currently doing that this would displace? If I
   gave this 90 days of concentrated attention, what gets neglected?
8. **Power questions.** What is the question I am most uncomfortable
   asking myself about this — and what would the answer change?
9. **Chair.** Where do my own perspectives agree, and where do they
   disagree? Am I about to fabricate consensus to avoid sitting with
   the disagreement?
```

## Cards must teach, not summarize

The failure mode for this phase is producing cards that say "the
adversary seat thought your idea was risky because X." That is a recap
of the verdict, not a lesson. The card should say "the adversary seat
uses inversion. When you face a decision alone, ask 'what would
guarantee failure?' and refuse to do those things." Teach the model, not
the verdict.
