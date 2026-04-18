# Upfront Mode Playbook

> Read `./design-thinking-mindset.md` first.
>
> Reminder: the conversational layer does not read or edit the plan directly in
> this phase. Subagents read artifacts, assemble the manifest, and write file
> updates.
>
> Use the main `SKILL.md` file's `## Escalation` table as the authoritative verdict
> routing policy. This playbook focuses on the canonical stage flow and inline questioning.

## Stage 2 — Analyze Artifacts

Dispatch `critique-analyzer`.

Read `../subagents/critique-analyzer.md`, then dispatch with:

- `MODE=upfront`
- `TICKET_KEY=<TICKET_KEY>`
- `MAIN_PLAN_FILE=docs/<TICKET_KEY>-tasks.md`
- `ARTIFACTS`
  - `docs/<TICKET_KEY>-stage-1-detailed.md`
  - `docs/<TICKET_KEY>-stage-2-prioritized.md`
- `CRITIQUE_REPORT_FILE=docs/<TICKET_KEY>-upfront-critique.md`
- `PRIOR_DECISIONS_FILE=docs/<TICKET_KEY>-tasks.md`
- `PRIOR_DECISIONS_KIND=main-log`

The analyzer consults the main `## Decisions Log` on every run, including
`ITERATION=1`. It decides by substance whether a candidate concern is already
answered, so changed wording or reassigned item IDs do not justify re-asking it.

Handle the verdicts:

- `CRITIQUE: FAIL` → stop and surface the reason.
- `CRITIQUE: WARN` → continue only if the warning does not invalidate the
  critique.
- `CRITIQUE: PASS` → continue.

## Stage 3 — Build Manifest

Dispatch `question-manifest-builder`.

Read `../subagents/question-manifest-builder.md`, then dispatch with:

- `MODE=upfront`
- `TICKET_KEY=<TICKET_KEY>`
- `PLAN_FILE=docs/<TICKET_KEY>-tasks.md`
- `CRITIQUE_REPORT_FILE=docs/<TICKET_KEY>-upfront-critique.md`

The manifest builder reads the task plan and produces:

- The ordered list of questions to ask now
- The list of questions to defer to later tasks
- Any warnings about malformed or missing sections

Handle the verdicts:

- `MANIFEST: BLOCKED` or `MANIFEST: FAIL` → stop and surface the reason.
- `MANIFEST: WARN` → continue, but mention the warning in the final summary.
- `MANIFEST: PASS` → continue.

### Stage 4 substep — Preview Manifest

Show the manifest summary before asking the first question. Reuse the
`question-manifest-builder` header counts and `## Questions For Now` table
shape instead of inventing a new preview schema.

Do not preview the per-item `Brief` blocks for Model A rows yet. Tier 3
problem-framing items still follow the Model A rule: the developer answers
before seeing the critique.

```markdown
## Question Manifest — <TICKET_KEY>

Questions now: <N> | Deferred: <M> | Irrelevant: <R>

| # | Item ID | Category | Severity | Model | Skippable | Affects |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PF1 | Problem framing | HIGH | A | No | All |
| 2 | TC1 | Critique | MEDIUM | B | Yes | Task 1 |
| 3 | CQ1 | Cross-cutting | MEDIUM | B | Yes | All |
```

After the preview, ask:

> Ready to start? I'll walk through these one at a time.

If `Questions now: 0`, say so clearly, do not emit a placeholder prompt, and
skip directly to Stage 5 with an empty decision list.

## Stage 4 — Clarify Inline

Always show progress:

```text
Question <current>/<total> — [<category>]
```

### Model A — Tier 3 problem framing

Use this flow:

1. Explain what gap is being challenged and why it matters for this ticket.
2. Ask the developer to answer in their own words before revealing the critique.
3. If the answer is shallow, say exactly what is missing.
4. Reveal the critique-analyzer's finding and compare perspectives.
5. Ask for the final decision and rationale.

Tier 3 items cannot be skipped.

### Model B — everything else

Use this flow:

1. Present the original decision or question.
2. Present the critique or clarifying context from the manifest.
3. Ask the developer whether the reasoning holds up, and why.
4. Record the final decision and rationale.

For critique items, present these options when a discrete choice is needed:

1. `Keep current approach`
2. `Switch to <alternative>`
3. `I need more information`
4. `Acknowledge but proceed`

Record `I need more information` and `Action needed` style responses as the
canonical `blocked` outcome for the recorder.

For assumptions and direct questions, use the simplest fitting options:

- assumptions: `Confirm`, `Revise`, `Skip`
- open questions: free-text answer or `Skip`
- validation items: `Resolved`, `Action needed`

### Recording rules

- `Switch to <alternative>` → set `RE_PLAN_NEEDED=true`
- `blocked` → set `RE_PLAN_NEEDED=true`, set `BLOCKERS_PRESENT=true`, and stop after recording the blocker
- `Acknowledge but proceed` → record as an override, no re-plan
- `Skip` on Tier 2 → record the fallback and add a warning
- New question for the current task or cross-cutting scope → append it to the
  live manifest
- New question for a future task → add it to `DEFERRED_QUESTIONS`

## Stage 5 — Record Decisions

Dispatch `decision-recorder`.

Read `../subagents/decision-recorder.md`, then dispatch with:

- `TICKET_KEY=<TICKET_KEY>`
- `MODE=upfront`
- `ITERATION=<ITERATION or 1>`
- `DECISIONS=<resolved decisions from the session>`
- `DEFERRED_QUESTIONS=<all deferred questions from the manifest and discussion>`
- `IMPLEMENTATION_UPDATES=<any implementation-note edits caused by switch decisions>`

`decision-recorder` is responsible for all file writes and validation.

Handle the verdicts:

- `RECORDING: BLOCKED` or `RECORDING: ERROR` → stop and surface the reason.
- `RECORDING: WARN` → continue, but carry the warnings into the final summary.
- `RECORDING: PASS` → continue.

### Stage 5 substep — Present Final Summary

Keep the first four lines in the same order as the main `SKILL.md` final
summary contract, then add any extra counts that help the user understand what
happened in this run.

Use the recorder summary plus session counts to present:

```markdown
## Clarification Complete — <TICKET_KEY>

- Critique artifact: <path>
- Files updated: <path list or ->
- RE_PLAN_NEEDED: <true|false>
- BLOCKERS_PRESENT: <true|false>
- Questions resolved: <N>
- Questions skipped: <N>
- Questions deferred: <N>
- Blocking items: <N>
- Overrides: <N>
- Plan-changing decisions: <N>
```

If `RE_PLAN_NEEDED=true`, tell the orchestrator to re-run planning before
execution starts.

If `BLOCKERS_PRESENT=true`, tell the orchestrator to stop before execution and
escalate the unresolved items.
