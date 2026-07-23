# trigger-and-description-authoring

## Tier

`recommended`. A precise description materially improves discovery and
routing; vague or overlapping descriptions cause silent false positives
and false negatives before the skill body can correct them.

## When it applies

When creating or revising a skill's frontmatter `description`, adding a
neighboring skill, changing a skill's scope, or investigating why natural
user requests route to the wrong skill or to no skill.

[`frontmatter-contract`](./frontmatter-contract.md) owns the portable
frontmatter schema, identity, and mechanical verification rules. This
document owns the method for authoring and testing the description text.

## The practice

Treat the description as a classifier contract. It is the routing
surface available when the runtime decides whether to invoke the skill;
the body cannot repair a routing decision that never loads it.

Rules:

1. **Write in third person, action-and-object first.** Open with the
   observable operation and its target: "Reviews one pull request" or
   "Creates reviewable atomic git commits," not "Helps with GitHub."
2. **Follow with explicit `Use when...` clauses.** Name representative
   intents in words users actually say. Include common noun and verb
   variants rather than relying on the skill's canonical name.
3. **Enumerate representative vocabulary, not every sentence.** Cover
   the meaningful trigger families and synonyms while keeping one
   coherent scope. A description is a classifier boundary, not a keyword
   dump.
4. **Declare material exclusions.** When neighboring skills overlap,
   state the near-miss intent and the skill that owns it. Positive scope
   and exclusions should partition the territory without leaving the
   runtime to guess from subtle wording.
5. **Keep only routing-relevant detail.** Include boundaries such as
   "exactly one PR" or "after the user asks to commit" because they
   affect dispatch. Omit subagent counts, retry caps, file layouts,
   implementation phases, and output schemas unless a detail genuinely
   distinguishes this skill from a neighbor.
6. **Test both sides of the boundary.** Maintain at least three natural
   should-trigger phrasings and three should-not-trigger near-misses.
   Each near-miss names the expected neighboring skill or `no skill`.
7. **Verify routing behavior when the runtime permits it.** Exercise the
   representative phrasings and record observed dispatch rather than
   asking the authoring agent whether the description seems clear. When
   no routing harness exists, the explicit test table is the minimum;
   do not claim behavioral validation. Follow
   [`empirical-validation`](./empirical-validation.md).

A useful construction pattern is:

```text
<Third-person action and object>. Use when <intent and synonyms>.
Does not <material near-miss>; use <neighboring skill> instead.
```

Build trigger vocabulary from user language:

| Component | Include | Avoid |
| --------- | ------- | ----- |
| Action | `review`, `audit`, `check` | Generic `help`, `handle`, `work with` |
| Object | `PR`, `pull request`, `proposed changes` | Unbounded `GitHub tasks` |
| Intent | `draft request-changes feedback`, `prepare review comments` | Internal phase names |
| Boundary | `exactly one PR`, `after the user asks to commit` | Details that do not affect routing |
| Exclusion | `does not create PRs; use pr-creator` | Silent overlap with a neighbor |

Related PR skills demonstrate why verbs and objects must partition the
same domain:

| Skill | Territory established by its description |
| ----- | ---------------------------------------- |
| [`review-pull-request`](../../skills/review-pull-request/SKILL.md) | Review or audit one PR; prepare review findings or approved comments |
| [`pr-creator`](../../skills/pr-creator/SKILL.md) | Create, open, draft, or submit a PR/MR from the current branch |
| [`responding-to-pr-review-comments`](../../skills/responding-to-pr-review-comments/SKILL.md) | Assess existing review comments, draft replies, and optionally post approved thread replies |

The shared words `PR`, `review`, and `comments` are insufficient by
themselves. The action-object pair distinguishes reviewing proposed
changes, creating the review request, and responding to feedback already
left on it.

A trigger test table for `review-pull-request` should resemble:

| User phrasing | Expected route | Why |
| ------------- | -------------- | --- |
| "Review PR #1020 for correctness" | `review-pull-request` | Review + PR |
| "Audit this pull request for security issues" | `review-pull-request` | Audit + pull request |
| "Draft request-changes feedback for this PR" | `review-pull-request` | Review-feedback preparation |
| "Open a draft PR from my current branch" | `pr-creator` | Creation, not review |
| "Reply to the reviewer's inline comments" | `responding-to-pr-review-comments` | Existing-comment response |
| "Commit the checkout files" | `committing-scoped-changes` | Commit action; no PR-review intent |

## Rationale

Skill descriptions operate before progressive disclosure. A precise
body, perfect state machine, and correct examples have no effect if the
description fails to load the skill. False negatives hide capability;
false positives load irrelevant instructions and can route a mutating
request into the wrong workflow.

Action-object phrasing gives the classifier a strong semantic center.
Explicit user vocabulary increases recall. Exclusions reduce collisions
where neighboring skills share nouns. Paired positive and negative tests
make the intended boundary inspectable and, when exercised through the
runtime, empirically falsifiable.

## Concrete examples

Good: [`review-pull-request`](../../skills/review-pull-request/SKILL.md)
is the strongest repository model for action-object scope, realistic
trigger vocabulary, and a one-PR boundary. This routing-focused form
also makes its neighboring exclusions explicit.

```yaml
description: "Reviews exactly one pull request. Use when the user asks
  to review a PR, audit a pull request, prepare GitHub review comments,
  draft request-changes feedback, or write a PR review file. Does not
  create or open PRs (use pr-creator) and does not respond to existing
  review comments (use responding-to-pr-review-comments)."
```

Bad: generic domain language has no action boundary, trigger vocabulary,
or exclusions, so it collides with creation and response workflows.

```yaml
description: "Helps users with pull requests, reviews, and GitHub
  comments using a thorough multi-step workflow."
```

## References

- [`frontmatter-contract`](./frontmatter-contract.md)
- [`empirical-validation`](./empirical-validation.md)
- [`review-pull-request/SKILL.md`](../../skills/review-pull-request/SKILL.md)
- [`council-of-advisors/SKILL.md`](../../skills/council-of-advisors/SKILL.md)
- [`committing-scoped-changes/SKILL.md`](../../skills/committing-scoped-changes/SKILL.md)
- [`pr-creator/SKILL.md`](../../skills/pr-creator/SKILL.md)
- [`responding-to-pr-review-comments/SKILL.md`](../../skills/responding-to-pr-review-comments/SKILL.md)
