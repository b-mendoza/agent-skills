---
name: "reviewing-software-engineer-cvs"
description: "Review and tailor a CV or resume for a software engineer role against a job posting. Use when the user provides or references a CV/resume and job description, asks how to make an applicant stand out, improve hiring-manager appeal, align skills and experience to a role, rewrite CV bullets, or check whether recommendations are realistic and interview-defensible."
---

# Reviewing Software Engineer CVs

Reviewing Software Engineer CVs is a judgment-heavy skill for matching a
software engineer CV to a specific role. It optimizes for credible relevance:
the applicant should look like a strong fit without inventing experience,
inflating seniority, or adding technologies they cannot defend in an interview.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `JOB_POSTING` | Yes | URL, pasted text, screenshot, PDF, or document |
| `CV` | Yes | Resume/CV text, screenshot, PDF, DOCX, or document |
| `APPLICANT_CONTEXT` | No | Real projects, preferred stack, target seniority, constraints, or interview-defensible details |
| `OUTPUT_MODE` | No | `review`, `rewrite`, `checklist`, or `questions-only` |

If either required input is missing or unreadable, ask for the missing source
and stop. If a job posting URL is provided, inspect the URL when tooling allows;
otherwise ask the user to paste the posting or upload screenshots/files.

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Full review workflow, output sections, evidence labels, and anti-fabrication rules | `./references/cv-review-contract.md` |

Load the reference before performing a CV review. Keep the always-loaded skill
body as routing and execution guidance; the detailed review contract lives in
the reference.

## Workflow

1. Gather the job posting and CV from the user-provided text, files,
   screenshots, or URL.
2. Load `./references/cv-review-contract.md`.
3. Analyze the job posting for role level, required skills, preferred skills,
   responsibilities, repeated keywords, and likely hiring-manager priorities.
4. Analyze the CV for explicit evidence, partial matches, weak matches, unclear
   claims, and missing signals.
5. Recommend realistic updates that improve fit while preserving honesty and
   interview defensibility.
6. Provide concrete rewrites for the highest-impact sections or bullets.
7. Flag risky or unsupported claims and offer safer alternatives.

## How This Skill Works

Use the reference prompt as the review contract. The skill does three things:

- **Ground** recommendations in the job posting and CV evidence.
- **Prioritize** the updates that most improve perceived fit for the target
  software engineering role.
- **Protect integrity** by labeling assumptions, asking applicant questions,
  and avoiding unsupported claims.

Prefer specific, evidence-backed rewrites over broad advice. A strong output
helps the applicant understand exactly what to change, why it matters for this
role, and what details they need to confirm before submitting.

## Execution

1. Start with an input check. Confirm the job posting and CV are readable.
2. If the user asks for a full review, follow the complete output structure in
   `./references/cv-review-contract.md`.
3. If the user asks for a narrower output, still apply the same evidence labels
   and anti-fabrication rules, then return only the requested sections.
4. For every rewrite, label it as `Supported`, `Likely but unconfirmed`, or
   `Unsupported until verified`.
5. When the CV suggests possible experience but lacks enough evidence, ask
   targeted questions instead of inventing a stronger claim.
6. End with a concise submission checklist unless the user asked for
   `questions-only`.

## Example

User: "Here is a backend engineer job posting and my CV. What should I change
to look like the best fit?"

Round trip:

1. Load the CV review contract.
2. Extract the role target profile from the job posting.
3. Build a CV-to-job match matrix.
4. Prioritize the highest-impact CV updates.
5. Rewrite the strongest supported bullets.
6. Ask targeted questions for stronger but currently unverified claims.
7. Flag any wording that could overstate the applicant's real experience.

## Scope

This skill may recommend edits, rewrites, ordering changes, skills grouping,
and applicant questions. It must not fabricate employment history,
credentials, metrics, responsibilities, technologies, or domain expertise.

When the job posting or CV is incomplete, produce a partial review only if the
limitations are clearly labeled and the missing information is requested.
