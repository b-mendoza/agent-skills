# Evidence Policy

> Read this file only inside `recency-guard` subagents when scoring source
> quality or confidence. Use the bundled rules first; fetch linked websites only
> for ambiguous or high-stakes judgments.

This file is the standalone authority for source tiers, confidence labels, and
just-in-time external references. The links provide deeper static background;
they do not replace current evidence for the claim being checked.

## Just-In-Time Reference Map

| Need | Fetch Only If Needed | URL |
| ---- | -------------------- | --- |
| Progressive disclosure model | You need background on revealing only necessary detail | https://www.nngroup.com/articles/progressive-disclosure/ |
| Lateral reading and source investigation | A source's credibility, origin, or coverage context is unclear | https://hapgood.us/2019/06/19/sift-the-four-moves/ |
| Currency, relevance, authority, accuracy, purpose | A source evaluation needs a fuller checklist | https://library.csuchico.edu/sites/default/files/craap-test.pdf |
| Common reasoning fallacies | A claim may rely on a recognizable argumentative fallacy | https://owl.purdue.edu/owl/general_writing/academic_writing/logic_in_argumentative_writing/fallacies.html |
| Correlation versus causation | A claim implies cause from association or observational evidence | https://www.scribbr.com/methodology/correlation-vs-causation/ |

If a link is unavailable, continue with the bundled rules and report uncertainty
only when it materially affects the user's answer.

## Source Quality Hierarchy

| Tier | Source Type | Examples |
| ---- | ----------- | -------- |
| 1 | Official canonical sources | Documentation, API references, specifications, standards, pricing pages, policy pages |
| 2 | Independently audited or peer-reviewed sources | Academic papers, government data, audited reports |
| 3 | Authoritative first-party updates | Changelogs, release notes, company announcements, engineering blogs |
| 4 | Reputable secondary analysis | Major journalism, analyst reports, established trade publications |
| 5 | Practitioner and community content | Conference talks, respected blogs, Stack Overflow, forum answers |
| 6 | Unvetted or low-accountability content | Social posts, anonymous blogs, scraped pages, AI-generated pages |

When a source is both official and current, classify it by role: canonical docs,
API references, specs, pricing, and policy pages are Tier 1; announcements,
release notes, changelogs, and engineering blog posts are Tier 3.

## Confidence Labels

Use topic-appropriate freshness windows. Around 30 days is a good default for
fast-moving product, version, pricing, and policy questions; slower standards,
research, and historical claims can justify older evidence.

| Score | Use When |
| ----- | -------- |
| `High` | A Tier 1-3 source directly supports the claim, is fresh enough for the topic, and no better source contradicts it |
| `Med` | A credible source supports the claim, but the evidence is older, indirect, scoped, or needs light date/context wording |
| `Low` | The claim is contradicted, weakly sourced, not independently verified, or framed more strongly than the evidence allows |

## Mode-Specific Application

For `recency-checker`, confidence answers: "Is this claim current enough to keep
as written?" Freshness, directness, and source authority carry the most weight.

For `claim-verifier`, confidence answers: "Is this claim supported strongly
enough for the user's likely decision?" Counterexamples, scope limits, causal
claims, and overstatement carry the most weight.

## Minimum Evidence Rules

- Prefer Tier 1-3 evidence for product, service, library, standard, legal,
  medical, pricing, availability, and policy claims.
- Use Tier 4-5 evidence for context or practitioner trade-offs when better
  sources are unavailable, and label confidence accordingly.
- Treat Tier 6 evidence as a lead for further search, not as support for a final
  claim.
- For broad recommendations, look for at least one credible counterexample or
  exception before assigning `High` confidence.
- For quantitative benchmarks, preserve source scope, workload, date, and sponsor
  context in the suggested wording when those details affect interpretation.
