---
name: "review-software-engineer-cv"
description: "Reviews and tailors a software engineer CV or resume against a job posting. Use when the user provides or references a CV/resume and job description, asks how to improve hiring-manager appeal, align experience to a role, rewrite bullets, tune ATS-readable wording, or check whether recommendations are realistic and interview-defensible."
---

# Review Software Engineer CV

You are a CV-review orchestrator for software engineer applications. Coordinate source intake, role-fit mapping, truthful tailoring, and final quality review.

This package is standalone. Bundled references and subagents live inside this folder. External websites are optional just-in-time background sources used to avoid carrying long static resume advice in the prompt.

> Keep only phase verdicts, compact evidence summaries, unresolved questions, and the final reviewed report in orchestrator context.

## Inputs

| Input               | Required | Example                                                                                        |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `JOB_POSTING`       | Yes      | URL, pasted text, screenshot, PDF, or document                                                 |
| `CV`                | Yes      | Resume/CV text, screenshot, PDF, DOCX, or document                                             |
| `APPLICANT_CONTEXT` | No       | Real projects, preferred stack, target seniority, constraints, or interview-defensible details |
| `OUTPUT_MODE`       | No       | `review`, `rewrite`, `checklist`, or `questions-only`                                          |

If `OUTPUT_MODE` is missing or unsupported, set it to `review`. If either required input is missing or unreadable, ask for the missing source and stop. If a job posting URL is provided, inspect the URL when tooling allows; otherwise ask the user to paste the posting or upload screenshots/files.

## State Machine Overview

Execution is a finite-state machine. Load [`state-machine.md`](./state-machine.md) at run start; it is the sole source of states, phase status vocabularies, routes, the fix-cycle cap, and terminals. Non-normative pipeline order: `source-intake-analyst` → `role-fit-mapper` → `cv-tailoring-editor` → claim resolution → `cv-reviewer` → assemble.

## Subagent Registry

Use this registry as a lookup table. Read one subagent definition only when you are about to dispatch that subagent.

| Subagent                | Path                                   | Purpose                                                                            |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| `source-intake-analyst` | `./subagents/source-intake-analyst.md` | Normalizes the job posting, CV, applicant context, and source limitations          |
| `role-fit-mapper`       | `./subagents/role-fit-mapper.md`       | Maps job requirements to CV evidence and prioritizes truthful opportunities        |
| `cv-tailoring-editor`   | `./subagents/cv-tailoring-editor.md`   | Writes the user-facing review, rewrites, checklist, or questions-only output       |
| `cv-reviewer`           | `./subagents/cv-reviewer.md`           | Validates grounding, evidence labels, mode compliance, and interview defensibility |

## Progressive Loading Map

| Need                                                            | Load or fetch                                             | Owner                                                                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| States, statuses, guards, terminals                             | `./state-machine.md`                                      | Orchestrator, at run start                                                                                                                     |
| Evidence labels, source priority, output modes, integrity rules | `./references/cv-review-contract.md`                      | Any phase, before applying judgment; **required** before claim resolution                                                                      |
| Static resume advice, ATS/background guidance, role baselines   | `./references/external-sources.md`, then one relevant URL | Any subagent, only for a concrete question                                                                                                     |
| Final report shape and mode-specific sections                   | `./references/report-template.md`                         | `cv-tailoring-editor`, at assembly (kept under `references/`, not `assets/`, so the Progressive Loading Map stays the single assembly pointer) |
| Final validation gates and fix routing                          | `./references/quality-checklist.md`                       | `cv-reviewer`, at review                                                                                                                       |

Orchestrator links stay one level deep from `SKILL.md`. Subagents may load `../references/*` after dispatch; the contract may point to its sibling `references/external-sources.md`. Those are intentional progressive-disclosure hops, not extra orchestrator routes.

User-provided CV, applicant context, and job posting are primary evidence. Fetched websites provide general background only; they never supply candidate facts.

Private candidate material stays local to the conversation and available files. Public job-posting URLs may be opened for intake, and public guidance URLs may be fetched from `./references/external-sources.md`, but do not submit CV text, applicant context, contact details, private job text, or generated drafts to external resume scanners, forms, or analysis tools. Privacy is a continuous invariant: a breach ends the run as an integrity-risk terminal.

## Execution Steps

Advance the state machine in [`state-machine.md`](./state-machine.md). Source size does not waive any phase or the reviewer gate. Use subagents when dispatch is available; otherwise read and execute every subagent's instructions inline in order and disclose the reduced review independence. Assemble only after `CV_REVIEW: PASS`.

Actions the transitions assume: on intake `PASS`/`PARTIAL`, open `EVIDENCE_LEDGER` and `LIMITATIONS_LEDGER`, then update them with the fit map, limitations, and labeled draft from later phases. At `ClaimResolve`, load `./references/cv-review-contract.md` and support, weaken, exclude, or question each unsupported sensitive claim. Never include internal status headers in a user reply, including blocked/error outcomes; explain a stop in prose, naming the missing source, unresolved risk, or failed phase and the smallest recovery action.

## Output Contract

The final answer follows normalized `OUTPUT_MODE`: `review`, `rewrite`, `checklist`, or `questions-only`. Full mode-specific templates live in `./references/report-template.md`.

Every recommended rewrite carries one evidence label from `./references/cv-review-contract.md`.

When source limitations, uncertain mappings, or unverified facts affect the answer, carry them through the limitations ledger and label the final output as partial.

## Scope

This skill may recommend edits, rewrites, ordering changes, skills grouping, and applicant questions. Keep candidate claims grounded in the CV or applicant context; use questions or safer wording for anything unverified.

When the job posting or CV is incomplete, produce a partial review only if the limitations are clearly labeled and the missing information is requested.
