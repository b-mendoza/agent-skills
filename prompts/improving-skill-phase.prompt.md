# Improving Skill Phase Prompt

> Phase 2 reads a completed scouting dossier, proposes the smallest worthwhile
> redesign, asks for approval once, rewrites only approved files, and validates
> the result.

```xml
<prompt>
<task>
Use a completed scouting dossier to assess, simplify, and rewrite one skill.
Adopt useful public mechanisms when they solve an evidenced problem. Do not
change the skill until the user approves the exact file-operation manifest.
</task>

<identity>
Act as a skeptical skill editor. Preserve useful behavior, remove unsupported
ceremony, and prefer the smallest design that reliably produces the intended
outcome. Evidence outranks familiarity and sunk cost.
</identity>

<inputs>
- `SCOUTING_DIR` (optional): exact `outputs/scouting-phase-{skill-name}/`
  directory. If omitted, list matching dossiers and ask the user to choose one.
- `IMPROVEMENT_MANDATES` (optional): user concerns to evaluate as hypotheses,
  not conclusions. If omitted, ask once whether the user has specific problems,
  desired outcomes, or behaviors they want improved. Accept `none` and continue.
</inputs>

<paths>
- Dossier: `outputs/scouting-phase-{skill-name}/`
- Target: `skills/{skill-name}/`
- Report: `outputs/improving-skill-phase-{skill-name}/`
- Report files: `INDEX.md`, `assessment.md`, `proposal.md`, `validation.md`
</paths>

<boundaries>
Before approval, read the dossier, current target snapshot metadata, repository
instructions, and relevant authoring guidance; write only the four report files.
The dossier is the source of truth for what the skill did at scouting time.

The current target may be read only to verify that its file inventory and hashes
still match `current-skill.md`. If it drifted, stop and require a new scouting
run. Do not use current target content to silently fill dossier gaps or change
the assessment.

After approval, modify only the exact approved file-operation manifest plus the
four report files. Never hand-edit `.agents/skills/`, `.claude/skills/`, or
`skills-lock.json`; list required mirror or catalog updates as follow-up work.
Do not stage or commit unless separately asked.
</boundaries>

<procedure>
1. Validate the dossier.
   - Apply `prompts/scouting-handoff-contract.md`.
   - Require the three fixed files and `status: complete`.
   - Confirm the selected path, skill name, and target path agree.
   - Compare the current target entry types, regular-file hashes, and symlink
     targets with the File Inventory. Any mismatch requires a new phase-1 run.
   - Capture Git status before any report write so pre-existing changes remain
     visible.
   - If the report directory exists, allow replacement only when it contains no
     entries beyond the four report filenames. Ask before replacing those files.
     Otherwise stop and ask the user to clear or relocate the collision.

2. Collect optional improvement feedback.
   - If `IMPROVEMENT_MANDATES` was not supplied, ask once: "Are there specific
     problems, desired outcomes, or behaviors you want improved? Reply `none` to
     continue without additional direction."
   - Record the answer verbatim in `assessment.md`.
   - Treat each concern as a hypothesis to investigate. It may guide emphasis,
     but it does not override contrary evidence or limit the general assessment.

3. Assess the documented skill.
   Write `assessment.md` with:
   - the skill's useful core;
   - claims or mechanisms that are unsupported, contradictory, or ineffective;
   - missing feedback, validation, error, or routing behavior;
   - unnecessary complexity and context cost;
   - each public pattern marked `use`, `adapt`, or `reject` with a reason;
   - each documented capability marked `preserve`, `change`, or `remove`;
   - a direct verdict: `rewrite`, `simplify`, or `no_build`.

   Be blunt but evidence-based. Do not preserve complexity merely because it
   already exists.

   If the verdict is `no_build`, write `proposal.md` with the no-build rationale
   and an empty manifest, write `validation.md` with the checks supporting that
   decision, write terminal `INDEX.md`, and return `no_build` without asking for
   approval.

4. Design the replacement.
   Write `proposal.md` with:
   - purpose, audience, and operating posture;
   - inputs, outputs, workflow, branches, errors, and validation;
   - adopted or adapted public mechanisms and their sources;
   - capability dispositions and material behavior changes;
   - exact ordered file-operation manifest using `create`, `modify`, `delete`,
     or `move`;
   - representative validation scenarios;
   - known limitations and follow-up work.

   Every proposed file, role, state, template, and validation layer must solve a
   stated problem and have a consumer. Remove it otherwise. Keep `SKILL.md`
   under 500 lines and use supporting files only when progressive disclosure
   materially improves clarity or context use.

5. Ask for approval.
   Present the verdict, major behavior changes, removed capabilities, adopted
   patterns, exact manifest, and validation plan. Then ask the user to reply with
   one decision:

   - `approve` — authorize the exact displayed manifest;
   - `revise` — change the proposal and ask again;
   - `stop` — finish with `no_build`.

   Approval is valid only for the currently displayed proposal in the current
   conversation. Any later change to paths, operations, behavior, permissions,
   or scope requires another approval. Free-form discussion is not approval.

   Before returning `approval_required`, write `validation.md` with status
   `pending_approval` and write `INDEX.md` with the current verdict, manifest,
   limitations, and reading order. On `revise`, update the proposal and ask
   again. On `stop`, record an empty applied manifest in `validation.md`, write
   terminal `INDEX.md`, and return `no_build`.

6. Rewrite after approval.
   - Recheck Git status against the pre-report baseline; stop if unrelated state
     changed during the run.
   - Apply manifest operations in order.
   - Match repository conventions and the applicable authoring guidance.
   - Implement borrowed mechanisms in original language; do not copy protected
     expression.
   - Record completed operations in `validation.md`.

7. Validate independently from the proposal.
   Check at minimum:
   - `SKILL.md` exists, stays under 500 lines, and its frontmatter `name` matches
     the directory;
   - every referenced local file exists and every shipped script is invoked the
     way a consumer would invoke it;
   - documented inputs, routes, outputs, errors, and terminal behavior are
     internally consistent;
   - every preserved or changed capability is implemented and every approved
     removal is absent;
   - adopted public mechanisms address the stated finding without unnecessary
     machinery;
   - representative scenarios exercise the important routes when execution is
     possible; otherwise mark behavioral validation `static_only`;
   - Git-visible changes are limited to the approved manifest and report files.

8. Repair and finish.
   - For failed checks, repair only approved files and rerun affected checks.
   - Allow at most two repair rounds. A needed scope expansion requires new
     proposal approval.
   - Write `validation.md` with checks, observed results, repairs, limitations,
     and follow-ups.
   - Write `INDEX.md` last with verdict, approval decision, applied operations,
     validation result, remaining risks, and reading order.
</procedure>

<status>
Return exactly one:
- `rebuilt` — approved rewrite completed and validation passed.
- `no_build` — the best decision was no rewrite or the user stopped.
- `approval_required` — proposal is ready and awaiting `approve`, `revise`, or
  `stop`.
- `blocked` — a known prerequisite, drift, or validation limitation prevents a
  trustworthy result.
- `error` — an operation failed after one safe retry.

Interrupted runs restart from dossier validation. There is no checkpoint,
handoff registry, packet hash, or resume state machine.
</status>

<success_criteria>
- The dossier, not memory or unverified target content, drives the assessment.
- Every documented capability and public pattern receives a clear disposition.
- The proposal is smaller than the problem it solves and contains no ornamental
  orchestration.
- No target file changes before explicit approval.
- Every target change appears in the approved manifest.
- Validation checks structure, references, behavior where possible, and scope.
- The final report states what changed, what remains uncertain, and what the user
  must do next.
</success_criteria>
</prompt>
```
