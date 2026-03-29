---
name: "pr-creator"
description: 'Create GitHub pull requests from the current branch with auto-generated titles, descriptions, reviewers, and labels. Use this skill whenever the user wants to create a PR, open a pull request, submit code for review, push changes for merge, or mentions "PR", "pull request", "code review", or "merge request". Also trigger when the user says things like "I''m done with this feature", "ready to submit", "open a draft PR", or "send this for review". Works with GitHub CLI by default, with guidance for GitLab and Bitbucket.'
---

# PR Creator

Create well-structured draft pull requests by analyzing the diff, generating a conventional-commit title and structured description, suggesting reviewers from CODEOWNERS, and executing `gh pr create` — all with a confirmation step before anything is submitted.

## Prerequisites

- Git repository with a remote origin
- GitHub CLI (`gh`) installed and authenticated
- For GitLab: `glab` CLI; for Bitbucket: `bb` CLI (see Platform Adaptation section at the end)

## Workflow

Follow these steps in order. Do not skip the preview step.

### Step 1: Gather context

Run these commands to understand the current state:

```bash
# Confirm repo and ownership
git config --get remote.origin.url

# Detect current branch
git rev-parse --abbrev-ref HEAD
```

Then ask the user: **"What branch should this PR target?"**

Do not assume `dev`, `main`, or any default. Wait for the user's answer before proceeding.

### Step 2: Analyze the diff

First, verify the current branch has been pushed to the remote:

```bash
git ls-remote --heads origin <current_branch>
```

If the branch doesn't exist on the remote, push it first:

```bash
git push -u origin <current_branch>
```

Then run the diff:

```bash
git diff origin/<target_branch>...origin/<current_branch> | cat
```

If the diff exceeds roughly 1000 lines, warn the user:

> "This PR touches over 1000 lines of changes. Large PRs are harder to review effectively. Would you like to proceed anyway, or would you prefer to split this into smaller PRs?"

Wait for confirmation before continuing. If the user wants to split, help them plan the split — but that's outside this skill's scope.

### Step 3: Generate the PR title

Analyze the diff to determine:

1. **Type** — Pick the most appropriate conventional commit type based on what the diff actually does:
   - `feat` — new functionality
   - `fix` — bug fix
   - `chore` — maintenance, dependency updates
   - `docs` — documentation only
   - `style` — formatting, whitespace, no logic change
   - `refactor` — restructuring without behavior change
   - `test` — adding or updating tests
   - `perf` — performance improvement
   - `ci` — CI/CD config changes
   - `build` — build system or external dependency changes

2. **Scope** (optional) — If the changes clearly belong to a single module, component, or domain (e.g., `pricing`, `auth`, `api`), include it in parentheses. If the changes span multiple areas or no clear scope emerges, omit it.

3. **Description** — A concise lowercase summary of what changed. Wrap code identifiers, function names, file names, and technical keywords in backticks.

**Format:** `type(scope): description` or `type: description`

**Examples:**

- `feat(pricing): adjust formula to include volume discounts`
- `fix: resolve null pointer in `getUserProfile` response`
- `chore: upgrade `axios` to v1.7.2`
- `refactor(auth): extract token validation into middleware`

### Step 4: Generate the PR description

Structure the description with these three sections:

```markdown
## Summary

A 2-3 sentence high-level overview of what this PR does and why.

## Key Changes

- Specific change 1 with relevant detail
- Specific change 2 with relevant detail
- (list as many as needed to cover the meaningful changes)

## Impact

- Who or what is affected by these changes
- Any migration steps, breaking changes, or deployment considerations
- Testing notes if relevant
```

Write the description based on what the diff actually shows. Be specific — reference file names, functions, and behaviors rather than being vague.

### Step 5: Suggest reviewers

Check if a CODEOWNERS file exists:

```bash
cat .github/CODEOWNERS 2>/dev/null || cat CODEOWNERS 2>/dev/null || echo "No CODEOWNERS file found"
```

- **If CODEOWNERS exists**: Match changed file paths against CODEOWNERS patterns to identify suggested reviewers. Present them to the user and ask: "Based on CODEOWNERS, I'd suggest these reviewers: `@user1`, `@user2`. Would you like to add or change any?"
- **If no CODEOWNERS**: Ask the user directly: "Please provide at least one reviewer for this PR (GitHub usernames)."

At least one reviewer is required. Do not proceed without one.

### Step 6: Detect labels

Check if the repo uses labels:

```bash
gh label list --limit 50
```

If labels exist, suggest relevant ones based on the PR type and diff content. For example:

- `feat` type → look for `enhancement` or `feature` label
- `fix` type → look for `bug` or `bugfix` label
- Breaking changes in the diff → look for `breaking-change` label

Only suggest labels that actually exist in the repo. If no labels exist or none are relevant, skip this step silently.

### Step 7: Preview and confirm

Present the complete PR to the user for review before executing anything:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PR Preview
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title:       <generated title>
Target:      <target_branch>
Source:      <current_branch>
Reviewers:   <reviewer list>
Labels:      <label list or "none">
Status:      Draft

Description:
<generated description>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask: **"Does this look good? I'll create the draft PR once you confirm. Let me know if you'd like to change anything."**

If the user requests changes, apply them and show the preview again. Do not proceed until the user confirms.

### Step 8: Create the PR

Once confirmed, execute:

```bash
gh pr create \
  --base "<target_branch>" \
  --head "<current_branch>" \
  --title "<title>" \
  --body "<description>" \
  --draft \
  --reviewer "<reviewer1>,<reviewer2>" \
  --label "<label1>,<label2>"
```

Omit `--label` if no labels were selected. Use comma-separated usernames for `--reviewer` (e.g., `--reviewer "alice,bob"`). For team reviewers, use a separate `--reviewer` flag (e.g., `--reviewer myorg/team-name`).

After successful creation, share the PR URL with the user.

If the command fails, show the error and help the user troubleshoot (common issues: `gh` not authenticated, branch not pushed to remote, reviewer username doesn't exist).

---

## Platform Adaptation

This skill defaults to GitHub CLI (`gh`). If the remote URL indicates a different platform, mention the equivalent commands:

**GitLab (`glab`)**:

```bash
glab mr create \
  --target-branch "<target>" \
  --title "<title>" \
  --description "<description>" \
  --draft \
  --reviewer "<reviewers>"
```

**Bitbucket**: The `bb` CLI or Bitbucket API can be used, but workflows vary. Suggest the user consult their team's tooling.

The title format, description structure, and review workflow remain the same regardless of platform.
