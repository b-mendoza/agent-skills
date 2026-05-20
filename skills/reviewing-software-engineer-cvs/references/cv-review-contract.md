# CV Review And Job Tailoring Contract

Use this contract to review a software engineer CV against a specific job
posting or job description, then recommend realistic updates that make the
applicant appear like a stronger, more relevant fit for the role.

## Inputs

| Input | Required | Handling |
| ----- | -------- | -------- |
| `job_posting` | yes | Use any provided job posting text, attached files, screenshots, or URL. If a URL is inaccessible, ask the user to paste the job posting text or upload screenshots/files. |
| `cv` | yes | Use the provided CV, resume, attached file, screenshot, or pasted text. |
| `applicant_context` | no | Optional context may include real projects, preferred technologies, seniority level, target location, visa/work authorization constraints, or examples of work the applicant can honestly discuss in an interview. |

## Goal

Help the applicant tailor the CV so it is clearly aligned with the role,
compelling to the hiring manager, and still honest, interview-defensible, and
consistent with the applicant's actual experience.

## Philosophy

Optimize for credible relevance, not inflated keyword density.

Prefer specific, evidence-backed updates that connect the applicant's real
skills, experience, projects, and impact to the job's most important
requirements.

Do not make the applicant look senior in areas where the CV only supports
beginner exposure. Do not invent technologies, responsibilities, achievements,
certifications, degrees, leadership scope, metrics, or domain experience.

Rule of thumb: a recommended CV update is acceptable only if the applicant
could plausibly explain it in an interview using real experience.

## Scope

In scope:

- Analyze the job posting, CV, skills, experience bullets, project
  descriptions, summary/profile section, role titles, achievement framing,
  ATS-relevant wording, and hiring-manager appeal for a software engineer role.
- Recommend edits, rewrites, ordering changes, skill grouping, and clarifying
  questions.

Out of scope:

- Writing a fictional CV.
- Fabricating credentials, employment history, metrics, responsibilities,
  technologies, or domain experience.
- Guaranteeing hiring outcomes.
- Recommending claims unsupported by the CV or applicant context.

## Workflow

1. Input check:
   - Confirm that both the job posting/description and the CV are available and
     readable.
   - If either source is missing, unreadable, or inaccessible, ask for the
     missing source and stop.
   - If the CV is present but lacks enough detail to support tailoring,
     continue with clearly labeled assumptions and list the missing information
     that would improve the recommendations.
2. Job posting analysis:
   - Identify the role title, seniority level, company context if available,
     main responsibilities, required skills, preferred skills, domain
     knowledge, soft skills, and likely hiring-manager priorities.
   - Separate must-have requirements from nice-to-have signals.
   - Identify repeated or emphasized keywords, technologies, methodologies, and
     outcomes.
3. CV evidence analysis:
   - Map the CV's current skills, roles, projects, achievements, technologies,
     and domain experience to the job requirements.
   - Classify each match as strong, partial, weak, missing, or unclear.
   - Distinguish explicit CV evidence from reasonable inferences.
   - Do not treat an inference as a fact. Label it as an assumption or a
     question for the applicant.
4. Tailoring recommendations:
   - Prioritize updates that would most improve perceived fit for the specific
     role.
   - Recommend changes to the summary/profile, skills section, work experience
     bullets, project descriptions, and information ordering when relevant.
   - For each recommendation, explain why it matters for this job and what
     evidence supports it.
   - When rewriting bullets, make them concrete, outcome-oriented, and
     technically specific without overstating the applicant's role.
   - Suggest questions where a stronger bullet may be possible but the current
     CV lacks enough evidence.
5. Realism and integrity check:
   - Flag any update that would be risky, exaggerated, unsupported, or
     difficult to defend in an interview.
   - Offer a safer alternative for each risky update.
   - Keep recommendations aligned with the applicant's apparent seniority and
     demonstrated experience.

## Anti-Patterns

Do NOT:

- Recommend adding technologies, tools, frameworks, certifications, degrees,
  job titles, metrics, or responsibilities unless they are supported by the CV
  or applicant-provided context.
- Turn beginner-level exposure into expert-level positioning.
- Stuff the CV with a broad list of keywords that the applicant cannot
  credibly discuss.
- Rewrite every bullet generically; prioritize the changes most relevant to
  this job.
- Optimize only for ATS scanning while making the CV less useful or less
  believable to a human hiring manager.
- Present assumptions as facts.

## Evidence Labels

If the CV suggests possible relevant experience but does not provide enough
evidence, use one of these labels:

- `Supported`: directly stated in the CV or applicant context.
- `Likely but unconfirmed`: plausible from the CV, but should be verified
  before adding.
- `Unsupported until verified`: should not be added unless the applicant
  confirms real experience.

## Output Format

Produce the review in the following sections unless the user requests a
narrower output.

1. Executive Summary:
   Summarize the applicant's current fit for the role in 3-5 bullets, including
   the strongest fit signals and biggest gaps.
2. Role Target Profile:
   Summarize what the job posting appears to value most, separating must-have
   requirements from nice-to-have signals.
3. CV To Job Match Matrix:
   Provide a table with columns: Job Requirement, Evidence In Current CV, Match
   Strength, Recommended Action, Integrity Risk.
4. Highest-Impact CV Updates:
   List the top recommended updates in priority order. For each update include
   CV area, current issue, recommended change, reason it helps, and evidence
   level.
5. Suggested Rewrites:
   Provide rewritten versions of the most important CV sections or bullets. For
   each rewrite, include original text if available, improved text, why this
   version is stronger for the job, and whether the rewrite is `Supported`,
   `Likely but unconfirmed`, or `Unsupported until verified`.
6. Skills Section Guidance:
   Recommend which skills to keep, elevate, group, de-emphasize, remove, or
   verify. Do not add unsupported skills.
7. Applicant Questions:
   Ask targeted questions that would allow stronger, truthful CV improvements,
   especially around impact metrics, project scope, technical depth, team size,
   production usage, architecture decisions, performance improvements, testing,
   cloud/devops exposure, and business outcomes.
8. Realism And Interview Defensibility Check:
   List any recommendations that could overstate the applicant's experience,
   explain the risk, and provide safer wording.
9. Final Tailoring Checklist:
   Provide a short checklist the applicant can use before submitting the CV.

## Success Criteria

- The analysis clearly ties CV recommendations to the specific job posting.
- Every recommended update is labeled by evidence level or clearly framed as a
  question for the applicant.
- The strongest recommendations improve hiring-manager appeal without
  inventing experience.
- The output includes concrete rewritten text, not only general advice.
- The final CV direction remains realistic for the applicant's apparent
  seniority and background.
