# CV Review Contract

Read this file before applying evidence labels, deciding output mode, or
judging whether a rewrite is safe to recommend.

## Source Priority

Use sources in this order:

1. `CV` and `APPLICANT_CONTEXT` for candidate facts.
2. `JOB_POSTING` for role requirements, vocabulary, seniority, and priorities.
3. Fetched public websites for general resume conventions or role baselines.
4. General model knowledge only for wording and organization.

Candidate facts come only from the CV or applicant context. Public resume
advice can shape presentation; it cannot create experience.

## Evidence And Limitations Ledgers

Carry a compact evidence ledger across the workflow:

- candidate facts from `CV` and `APPLICANT_CONTEXT`
- role requirements and vocabulary from `JOB_POSTING`
- background-only public sources, when fetched
- verification questions, excluded claims, and safely weakened claims

Carry a limitations ledger whenever a source is partial, inaccessible,
ambiguous, stale, or too thin for the selected mode. A non-empty limitations
ledger means the final output is partial and must label the limitation.

## Evidence Labels

Use exactly one label for each rewrite or recommended claim:

| Label | Meaning | Safe use |
| ----- | ------- | -------- |
| `Supported` | Directly stated in the CV or applicant context | Can appear in final CV wording |
| `Likely but unconfirmed` | Plausible from the sources but missing proof | Present as a candidate rewrite and ask the applicant to verify |
| `Unsupported until verified` | Would require new facts from the applicant | Keep out of final CV wording; ask a question or offer safer wording |

## Match Strength

Use these requirement-match labels:

| Label | Meaning |
| ----- | ------- |
| `Strong` | Clear evidence maps to the requirement |
| `Partial` | Some evidence exists, but depth, recency, scale, or exact tool fit is unclear |
| `Weak` | Only adjacent or indirect evidence exists |
| `Missing` | No visible evidence in the CV/applicant context |
| `Unclear` | Source quality prevents a confident judgment |

## Integrity Rules

Prefer edits that select, reorder, clarify, quantify, or reframe real
experience. Treat these as risk signals that require safer wording or
applicant questions:

- adding an unmentioned technology, certification, credential, employer, title,
  responsibility, metric, domain, or leadership scope
- converting exposure into ownership or expertise
- inflating seniority beyond the CV's demonstrated scope
- matching keywords without evidence the applicant can discuss
- making the CV less useful to a human reviewer in pursuit of ATS wording

Rule of thumb: a recommended line is ready only when the applicant could defend
it in an interview using real experience.

## Sensitive Candidate Claim Resolution

Sensitive candidate claims include publishable claims about metrics, seniority,
domain depth, ownership, architecture scope, leadership, tools, frameworks, or
certifications. Before final review, resolve each unsupported sensitive claim in
one of these ways:

- support it with `CV` or `APPLICANT_CONTEXT`
- safely weaken it to match the evidence
- exclude it from publishable wording
- carry it as a verification question

Block only when the selected `OUTPUT_MODE` cannot produce a safe deliverable
after those resolution options.

## Output Modes

| Mode | Produce |
| ---- | ------- |
| `review` | Full role-fit analysis, priorities, rewrites, risks, questions, and checklist |
| `rewrite` | Rewritten summary, skills, selected bullets, and verification notes |
| `checklist` | Prioritized actions with evidence labels and risk flags |
| `questions-only` | Targeted questions that would unlock stronger truthful tailoring |

For narrower modes, keep the same evidence labels and integrity rules, then
return only the requested sections.

If `OUTPUT_MODE` is missing or unsupported, normalize it to `review` before
dispatching downstream phases.

## External Source Policy

When a subagent needs static guidance on resume structure, ATS-safe formatting,
software-engineer resume expectations, accomplishment bullets, action verbs, or
generic role baselines, read `./external-sources.md` from this reference
folder and fetch the smallest relevant URL.

Fetched content is optional background. If network access is unavailable,
continue with the local contract and state any limitation only when it affects
the user's requested output.
