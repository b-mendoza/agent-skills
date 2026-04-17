---
name: "pr-creator"
description: 'Create review-ready pull requests from the current branch by validating repo state, comparing against a user-specified base branch, drafting a title and body from the real branch diff, suggesting reviewers and labels, previewing the result, and creating the PR only after explicit confirmation. Use when the user asks to create or open a PR, draft pull request, merge request, code review request, or says their work is ready for review.'
---

# PR Creator

<task>
Create a review-ready pull request from the current branch.
</task>

<scope>
Invoked when the user asks to create or open a PR, draft pull request, merge request, code review request, or says their work is ready for review.
</scope>

<how_this_skill_works>
  You are the orchestrator of a user-in-the-loop PR creation workflow. Your role is:

  - **Observe**: read repo, branch, and platform state via direct `git` and platform CLI calls; read CODEOWNERS and the existing label list.
  - **Decide**: pick the conventional commit type, scope, reviewer set, and label set from real evidence — diff content, file ownership, and the actual repo label list.
  - **Confirm**: present a complete preview to the user and accept the most recent approved version exactly as approved.
  - **Submit**: invoke the platform's PR-create command after explicit approval, then verify and return the URL.

  Inline by design: every observation feeds the user-confirmation loop one step later, so each result is consumed immediately rather than carried as ballast. The one carve-out is the full `git diff` payload (Phase 3), which is loaded only after the size gate passes — see Phase 3 for the ordering.
</how_this_skill_works>

<philosophy>
  <core_principle>
    Keep the user in the loop at every decision point — gather missing inputs, validate branch state, draft from the actual compare diff, preview, apply user edits, and submit only after explicit confirmation.
  </core_principle>
  <what_it_means>
    This skill does exactly five things: (1) inspect repository, hosting platform, and branch state; (2) validate that the chosen base and head branches can produce a meaningful PR; (3) draft title and description from the real compare diff; (4) suggest reviewers and labels from repo metadata; (5) create the PR only after the user approves the preview.
  </what_it_means>
</philosophy>

<platform_adaptation scope="cross-cutting">
  The GitHub-only command blocks in Phases 2, 6, 8, and 9 assume a GitHub remote (GitHub Enterprise hosts follow the GitHub branch). When `remote.origin.url` points to a non-GitHub host, read `./references/platform-adaptation.md` once at the end of Phase 1 and follow the matching platform branches for preflight/auth, labels, create, and verify. Do NOT load this reference for GitHub or GHE remotes. Do NOT skip it for non-GitHub remotes.
</platform_adaptation>

<failure_handling scope="all-phases">
  When the workflow cannot continue, halt and report the issue in exactly this format:

  ```text
  PR_CREATE: <CATEGORY>
  Reason: <one line>
  Next step: <one clear action>
  ```

  `<CATEGORY>` is a closed enum:

  - `AUTH` — the platform CLI is missing, unauthenticated, or lacks permission
  - `BASE_BRANCH_MISSING` — the requested target branch does not exist remotely
  - `HEAD_BRANCH_UNPUSHED` — the source branch must be pushed before PR creation
  - `EMPTY_DIFF` — the source branch has nothing to compare against the target
  - `CREATE_ERROR` — the platform create command failed after confirmation

  Every phase-level `<hard_rule>` that stops the workflow MUST emit this exact envelope with one of these five categories. Do not invent new categories. Do not emit free-form failure prose.
</failure_handling>

<context>
  <inputs>
    | Input             | Required | Example                                     |
    | ----------------- | -------- | ------------------------------------------- |
    | `TARGET_BRANCH`   | No       | `main`                                      |
    | `PR_STATE`        | No       | `draft`                                     |
    | `REVIEWERS`       | No       | `alice,bob`                                 |
    | `TITLE_OVERRIDE`  | No       | `docs(skills): refine pr-creator workflow`  |
    | `BODY_OVERRIDE`   | No       | `## Summary ...`                            |
    | `LABELS_OVERRIDE` | No       | `documentation,enhancement`                 |

    Ask for any missing inputs during the workflow. `PR_STATE` defaults to `draft`; accept only `{draft, ready}`.
  </inputs>

  <branch_terminology>
    The original prose uses **current branch**, **head branch**, and **source branch** as synonyms for the branch the PR is being opened from. Preserve whichever term the surrounding command or field expects (`<current_branch>` in shell, `Source:` in the preview, `--head` on the CLI) instead of normalizing to a single term.
  </branch_terminology>

  <output_contract>
    For GitHub remotes, finish with all of:

    - A created PR URL (captured and returned).
    - Final values for base branch, head branch, title, description, reviewers, labels, and PR state.
    - A preview shown to the user and explicitly approved before `gh pr create`.

    For non-GitHub remotes: detect the platform from `remote.origin.url`, read `./references/platform-adaptation.md`, and follow the matching create and verify flows before submitting anything.

    Every field in the final reply must be populated; empty fields print `none`.
  </output_contract>
</context>

## Pipeline Overview

| Phase | Purpose                                                     | Gate to next phase                                                        |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1     | Identify repo, platform, head branch, inputs                | Platform detected; `TARGET_BRANCH` and `PR_STATE` known                   |
| 2     | Preflight: auth, push state, base resolve                   | Auth passes; head on remote with no commits ahead; target branch resolves |
| 3     | Survey diff, size-gate, then load full diff                 | Diff range non-empty; large-PR confirmation explicit if applicable        |
| 4     | Draft conventional-commit title                             | Title produced (or `TITLE_OVERRIDE` applied exactly)                      |
| 5     | Draft description grounded in diff                          | Description produced (or `BODY_OVERRIDE` applied exactly)                 |
| 6     | Suggest reviewers (CODEOWNERS) and labels (`gh label list`) | At least one reviewer attached                                            |
| 7     | Show preview and iterate until convergence                  | User explicitly approves the most recent preview                          |
| 8     | Create PR via platform CLI                                  | Create command returns success                                            |
| 9     | Verify created PR and return URL                            | URL captured; base/head match the approved preview                        |

<phases>
  <phase id="1" name="identify-repo-and-head">
    <steps>
      <step id="1.1" name="inspect-repo">
        Run, verbatim:

        ```bash
        git config --get remote.origin.url
        git rev-parse --abbrev-ref HEAD
        git status --short --branch
        ```
      </step>
      <step id="1.2" name="detect-platform-and-surface-state">
        Detect the hosting platform from `remote.origin.url`. GitHub Enterprise hosts follow the GitHub branch. If the working tree has uncommitted changes, tell the user those changes are not part of the PR until committed.
      </step>
      <step id="1.3" name="gather-missing-inputs">
        Ask for `TARGET_BRANCH` if it was not already supplied. Do NOT silently default the target branch. If `PR_STATE` is supplied, confirm it is `draft` or `ready`; otherwise default to `draft`.
      </step>
      <step id="1.4" name="load-platform-adaptation-if-needed">
        If the remote is not GitHub, read `./references/platform-adaptation.md` and follow the matching platform branch for the GitHub-only command blocks in Phases 2, 6, 8, and 9.
      </step>
    </steps>
    <o>Known platform, head branch, target branch, and `PR_STATE`; user has been told about any uncommitted work.</o>
  </phase>

  <phase id="2" name="preflight-validation">
    <steps>
      <step id="2.1" name="github-preflight-commands">
        For GitHub remotes, run verbatim:

        ```bash
        git fetch origin --prune
        gh auth status
        git ls-remote --heads origin <current_branch>
        git rev-parse --verify origin/<target_branch>
        git rev-list --left-right --count origin/<current_branch>...<current_branch>
        ```
      </step>
      <step id="2.2" name="push-gate">
        If the head branch is not on the remote, or local commits are ahead of `origin/<current_branch>`, tell the user a push is required before the PR can be created and before the compare diff is trustworthy. Ask for confirmation, then run:

        ```bash
        git push -u origin <current_branch>
        ```

        REMINDER: Do NOT run `git push` without explicit confirmation. A declined push must halt with `HEAD_BRANCH_UNPUSHED`, not a retry.
      </step>
      <step id="2.3" name="non-github-preflight">
        For non-GitHub remotes, follow the matching preflight and auth flow in `./references/platform-adaptation.md` before moving to the diff step.
      </step>
    </steps>
    <hard_rule>If `gh auth status` fails, stop with the `AUTH` envelope (see `<failure_handling>`).</hard_rule>
    <hard_rule>If the user declines the required push, stop with the `HEAD_BRANCH_UNPUSHED` envelope.</hard_rule>
    <hard_rule>If the target branch does not exist on the remote, stop with the `BASE_BRANCH_MISSING` envelope and ask the user for a valid base branch.</hard_rule>
    <gate>Do not enter Phase 3 until auth passes, the head branch is on the remote with no commits ahead, and the target branch resolves.</gate>
  </phase>

  <phase id="3" name="analyze-full-diff">
    <steps>
      <step id="3.1" name="survey-range">
        Survey the range cheaply first — these commands return summaries, not raw patch content:

        ```bash
        git log --oneline origin/<target_branch>..origin/<current_branch>
        git diff --shortstat origin/<target_branch>...origin/<current_branch>
        git diff --stat origin/<target_branch>...origin/<current_branch>
        git diff --name-only origin/<target_branch>...origin/<current_branch>
        ```

        Use the `--shortstat` line (insertions + deletions) and the file list to evaluate the size gate in step 3.2.
      </step>
      <step id="3.2" name="size-gate">
        If `--shortstat` reports roughly more than 1000 changed lines, or the file list spans clearly unrelated areas, ask the user whether to proceed or split the work into smaller PRs. Continue only after explicit confirmation that a large PR should proceed. A declined large-PR proposal ends the workflow (the create path is not retried).
      </step>
      <step id="3.3" name="load-full-diff">
        Once the size gate passes (either under-threshold or explicitly confirmed), load the full patch:

        ```bash
        git diff origin/<target_branch>...origin/<current_branch>
        ```

        Use this to ground the title and description in actual changed lines, not just the file list.
      </step>
    </steps>
    <hard_rule>If there are no commits or no diff, stop with the `EMPTY_DIFF` envelope.</hard_rule>
    <gate>Enter Phase 4 only after the diff range is non-empty, the size gate has passed, and step 3.3 has loaded the full diff.</gate>
  </phase>

  <phase id="4" name="draft-title">
    <steps>
      <step id="4.1" name="pick-type">
        Pick the most accurate conventional commit type from the branch diff:

        - `feat` for new functionality
        - `fix` for bug fixes
        - `chore` for maintenance or housekeeping
        - `docs` for documentation-only changes
        - `style` for formatting-only changes
        - `refactor` for structural improvements without behavior change
        - `test` for test-only changes
        - `perf` for performance improvements
        - `ci` for CI/CD changes
        - `build` for build tooling or dependency system changes

        If the diff straddles two types, present both options and wait for the user to choose; do NOT silently pick.
      </step>
      <step id="4.2" name="compose-title">
        Add an optional scope only when one module, domain, or subsystem clearly dominates the diff. Format as `type(scope): description` or `type: description`. Keep the description concise and lowercase. Wrap code identifiers, file names, and technical keywords in backticks. No trailing period.

        Examples:

        - `feat(pricing): include volume discounts in quote calculation`
        - `fix(auth): handle missing refresh token in sessionStore`
        - `docs(skills): tighten pr-creator validation flow`
        - `refactor(api): extract review metadata mapping`
      </step>
      <step id="4.3" name="apply-title-override">
        If `TITLE_OVERRIDE` is supplied, use it exactly. Do NOT merge it with auto-generated content.
      </step>
    </steps>
  </phase>

  <phase id="5" name="draft-description">
    <steps>
      <step id="5.1" name="apply-body-template">
        Unless `BODY_OVERRIDE` is supplied, use this structure:

        ```markdown
        ## Summary

        A 2-3 sentence overview of what changed and why it matters.

        ## Key Changes

        - Specific change 1 with relevant detail
        - Specific change 2 with relevant detail
        - Add more bullets only when they carry distinct value

        ## Impact

        - Who or what is affected
        - Migration, rollout, or deployment considerations
        - Testing notes, if the diff shows them
        ```
      </step>
      <step id="5.2" name="ground-in-diff">
        Write from the actual diff, not from assumptions, commit messages, branch names, ticket IDs, or prior chat. Be specific about file paths, behaviors, and user-visible outcomes. Mention tests only when they were added, changed, or are relevant to risk.
      </step>
      <step id="5.3" name="apply-body-override">
        If `BODY_OVERRIDE` is supplied, use it exactly. Do NOT merge it with auto-generated content.
      </step>
    </steps>
  </phase>

  <phase id="6" name="suggest-reviewers-and-labels">
    <steps>
      <step id="6.1" name="reviewers">
        Check `.github/CODEOWNERS`, then `CODEOWNERS`, if either file exists. Match changed files against the most relevant owners. Present the suggested reviewers to the user and let them edit the list. If no CODEOWNERS file exists, ask the user for at least one reviewer.
      </step>
      <step id="6.2" name="labels-github">
        For GitHub remotes, list labels that actually exist:

        ```bash
        gh label list --limit 100
        ```

        Suggest only labels that exist in that output. Use the PR type and diff content to guide suggestions. Skip labels silently if none fit. Do NOT invent labels.
      </step>
      <step id="6.3" name="apply-labels-override">
        If `LABELS_OVERRIDE` is supplied, use it instead of auto-suggestions. All overridden labels must still exist per `gh label list`.
      </step>
      <step id="6.4" name="labels-non-github">
        For non-GitHub remotes, follow the platform-specific label guidance in `./references/platform-adaptation.md` instead of calling `gh`.
      </step>
    </steps>
    <hard_rule>Require at least one reviewer before PR creation.</hard_rule>
  </phase>

  <phase id="7" name="preview-and-revise">
    <steps>
      <step id="7.1" name="show-preview">
        Show the complete preview before creating anything:

        ```text
        PR Preview
        ----------
        Title:      <generated title>
        Target:     <target_branch>
        Source:     <current_branch>
        Reviewers:  <reviewer list>
        Labels:     <label list or "none">
        Status:     <draft or ready>

        Description:
        <generated description>
        ```

        Empty fields MUST print `none`.
      </step>
      <step id="7.2" name="validation-loop">
        Ask the user to confirm or request edits. Apply requested title, body, reviewer, label, or status changes, then show the updated preview again.
      </step>
      <step id="7.3" name="three-cycle-escape">
        If three preview cycles still do not converge, ask the user for explicit final values instead of continuing to redraft. Do NOT produce a fourth speculative redraft.
      </step>
    </steps>
    <gate>Do not enter Phase 8 until the user has explicitly approved the most recent preview. Preview approval is required even when `TITLE_OVERRIDE`, `BODY_OVERRIDE`, or `LABELS_OVERRIDE` were supplied.</gate>
  </phase>

  <phase id="8" name="create-pr">
    <steps>
      <step id="8.1" name="github-create">
        After explicit confirmation, create the PR with the CLI that matches the detected hosting platform. Prefer a heredoc or body file for long descriptions.

        GitHub draft PR:

        ```bash
        gh pr create \
          --base "<target_branch>" \
          --head "<current_branch>" \
          --title "<title>" \
          --body "<description>" \
          --draft \
          --reviewer "<reviewer1>,<reviewer2>"
        ```

        GitHub ready PR:

        ```bash
        gh pr create \
          --base "<target_branch>" \
          --head "<current_branch>" \
          --title "<title>" \
          --body "<description>" \
          --reviewer "<reviewer1>,<reviewer2>"
        ```

        For GitHub, add labels only when they exist and the user approved them. Use `-l` or `--label` in the form supported by the installed `gh` version.

        REMINDER: Do NOT invoke `gh pr create` before the user explicitly approves the latest preview. Any field changed after approval invalidates approval — re-enter Phase 7.
      </step>
      <step id="8.2" name="non-github-create">
        For non-GitHub remotes, follow the matching create flow in `./references/platform-adaptation.md`.
      </step>
    </steps>
    <hard_rule>The `gh pr create` invocation must match `PR_STATE` (`--draft` for `draft`, omitted for `ready`).</hard_rule>
  </phase>

  <phase id="9" name="verify">
    <steps>
      <step id="9.1" name="capture-url-and-verify">
        Capture and return the PR URL. Confirm the created PR uses the intended base and head branches.
      </step>
      <step id="9.2" name="non-github-verify">
        For non-GitHub remotes, use the platform-specific verification flow from `./references/platform-adaptation.md` instead of GitHub-only checks.
      </step>
    </steps>
    <hard_rule>If creation fails, stop with the `CREATE_ERROR` envelope and explain the next action clearly.</hard_rule>
  </phase>
</phases>

<invariants>
  Behaviors that hold across all phases:

  - **Inputs**: ask the user for any missing input rather than proceeding with a silent default. `PR_STATE` defaults to `draft`; accepted values are `{draft, ready}`.
  - **Sources of truth**: ground the title and description in the compare diff (`origin/<target_branch>...origin/<current_branch>`) and the actual changed files. CODEOWNERS supplies reviewer suggestions; `gh label list --limit 100` supplies the GitHub label vocabulary.
  - **Overrides**: when `TITLE_OVERRIDE`, `BODY_OVERRIDE`, or `LABELS_OVERRIDE` is supplied, use it as the entire field. Overridden labels must still exist in `gh label list`.
  - **Confirmation gates**: `git push`, the large-PR proceed decision, and `gh pr create` each require an explicit user "yes" at their respective gate. Any preview field changed after approval triggers a re-entry into Phase 7.
  - **Reviewers**: at least one reviewer is attached at preview time and at create time. Reviewers come from CODEOWNERS or from the user.
  - **Failure output**: every workflow stop uses the `PR_CREATE: <CATEGORY>` envelope with a category from `{AUTH, BASE_BRANCH_MISSING, HEAD_BRANCH_UNPUSHED, EMPTY_DIFF, CREATE_ERROR}`.
  - **Preview completeness**: the preview and the final reply populate every field; empty fields print `none`. The PR URL appears in the final reply.
  - **Platform adaptation**: read `./references/platform-adaptation.md` only for non-GitHub remotes (GHE follows the GitHub branch).
  - **Ambiguity**: when two valid interpretations exist (two commit types fit; CODEOWNERS maps multiple teams; multiple plausible target branches; unclear reviewer format), present the options and wait for a user choice.
</invariants>

<new_finding_rule>
  If a mid-run mutation invalidates earlier state — a push changes the diff signal, `.github/CODEOWNERS` only partly covers the changed files, labels mutate between list and create, or the user commits more work after Phase 1 — re-enter the earliest affected phase, tell the user why, and require a fresh explicit confirmation before advancing. Do not resume from cached state.
</new_finding_rule>

<example>
  Input:
  - Current branch: `docs/pr-creator-skill`
  - Target branch: `main`
  - PR state: `draft`

  Flow:
  1. Inspect the remote URL, current branch, and working tree state.
  2. Fetch remote refs and confirm `gh auth status` passes.
  3. Compare `origin/main...origin/docs/pr-creator-skill`.
  4. Draft:
     - Title: `docs(skills): strengthen the pr-creator workflow`
     - Reviewers: `@docs-team`
     - Labels: `documentation`
  5. Show preview and let the user edit it.
  6. After confirmation, run the platform-appropriate create command.

  Output:
  - PR URL returned to the user
  - Final preview values recorded in the reply
</example>

<reference_material>
  - `./references/platform-adaptation.md` — load only when the remote is not GitHub.
</reference_material>
