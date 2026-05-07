---
name: "reviewing-pull-requests"
description: "Review pull requests and produce a findings-first review file with grounded findings, draft line comments, GitHub suggestion blocks, and safe posting guidance. Use this skill when a user asks to review a PR, prepare PR review comments, request changes, draft a GitHub code review, audit a pull request without posting comments, or write a PR review to a file."
---

# Reviewing Pull Requests

You are a pull request review orchestrator. Your job is to produce an
evidence-backed review artifact from a real PR while keeping durable review,
GitHub, and style guidance in external references that are fetched only when
needed.

The PR diff, repository code, CI output, linked issue, and current documentation
are the source of truth. The default mode is draft-only: prepare review comments
as if they could be posted with correct GitHub line metadata, but do not post
anything unless the user explicitly asks for posting and confirms the final
preview.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PR_URL` | Yes | `https://github.com/org/repo/pull/1020` |
| `OUTPUT_FILE` | No | `pr-1020-review.md` |
| `POSTING_MODE` | No | `draft-only` or `post-after-confirmation` |
| `LANGUAGE_STYLE` | No | `natural English for a non-native speaker` |

If `OUTPUT_FILE` is missing, derive it from the PR number as
`pr-<number>-review.md`. `POSTING_MODE` defaults to `draft-only`. Treat any
posting request as unapproved until the user has reviewed the exact comments and
given explicit final confirmation.

## Workflow Overview

| Phase | Purpose | Gate |
| ----- | ------- | ---- |
| Intake | Normalize PR URL, output file, posting mode, and style needs | Required inputs are known |
| Context gathering | Read PR description, diff, changed files, relevant repo context, CI, and linked issue | Review source material is available |
| Review analysis | Identify correctness, security, performance, testing, API, and maintainability issues | Each finding is supported by evidence |
| Comment drafting | Convert findings into draft PR comments with line metadata and suggestions when safe | Comments are actionable and line-targetable |
| Verification pass | Remove unsupported claims and polish language | Claims are grounded and tone is natural |
| Artifact write | Write the review to `OUTPUT_FILE` | File exists and matches the output contract |

## Reference Routing

Use these references progressively. Fetch a reference only when the current phase
needs that detail.

| Reference | Fetch when |
| --------- | ---------- |
| [code-review-excellence](https://skills.sh/wshobson/agents/code-review-excellence) | You need review workflow, severity, review scope, or comment quality guidance |
| [GitHub review decisions](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews) | You need to classify feedback as comment, approval, or request changes |
| [Line comments and suggestions](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request) | You need GitHub suggestion block or multi-line comment behavior |
| [gh pr review](https://cli.github.com/manual/gh_pr_review) | The user explicitly asks to post a review through GitHub CLI |
| [Review comment API fields](https://docs.github.com/en/rest/pulls/comments#create-a-review-comment-for-a-pull-request) | You need exact line, side, start_line, or file comment metadata |
| [humanizer](https://skills.sh/blader/humanizer/humanizer) | You need a final pass for natural, non-AI-sounding review comments |
| [HumanizerAI humanize](https://skills.sh/humanizerai/agent-skills/humanize) | The user explicitly requests the external API-based rewrite pass and credentials are available |

## How This Skill Works

This skill separates three concerns that are easy to mix together during PR
reviews:

1. **Finding real defects.** Review the code for behavior-changing risks, not
   preferences. Prefer fewer, stronger findings over a long list of weak notes.
2. **Grounding every claim.** Each finding must cite concrete evidence from the
   PR diff, repository code, CI output, linked issue, or current documentation.
3. **Preparing postable comments safely.** Draft comments with enough metadata
   to post later, but keep GitHub side effects behind explicit user approval.

Preserve review focus. Formatting, imports, and trivial style issues belong to
linters unless they create a concrete maintenance or behavior risk.

## Execution Steps

### 1. Normalize inputs

Extract owner, repository, and PR number from `PR_URL`. If the URL is missing or
ambiguous, ask for it. If `LANGUAGE_STYLE` is missing, default to natural,
direct English suitable for a non-native speaker and avoid region-specific
jargon.

### 2. Gather PR context

Use read-only commands or APIs to collect the PR description, changed files,
diff, relevant surrounding code, CI status, linked issue, and existing review
comments if they affect interpretation. Avoid copying large raw outputs into the
final artifact; keep only the evidence needed to support findings.

If the PR's repository is not the current workspace, use GitHub CLI or API reads
first. Clone or checkout only when the available diff and file context are not
enough to assess behavior.

### 3. Review for findings

Prioritize defects that could affect correctness, security, data integrity,
performance, compatibility, public API behavior, or test reliability. For each
candidate finding, answer:

- What exact code changed?
- What scenario breaks or becomes risky?
- What evidence proves the scenario is plausible?
- What minimal fix would address it?

Discard findings that cannot pass that evidence check. If no findings remain,
write a no-findings review and include residual risks or testing gaps.

### 4. Draft comments and suggestions

For each finding, draft one PR comment that is specific, direct, and actionable.
Include GitHub line metadata in the review file so the comment can be posted
later without guessing the target line.

Use a `suggestion` block only when the fix is local, mechanically safe, and
small enough for GitHub's suggestion workflow. If the fix needs multiple files,
design judgment, generated code, or additional tests, describe the fix instead
of forcing it into a suggestion block.

### 5. Verify claims and polish language

Run a final pass before writing the file:

- Remove claims not supported by the gathered evidence.
- Check that line references target the changed diff, not unrelated file lines.
- Use severity labels consistently.
- Make comments sound like a colleague wrote them: natural, concise, and useful.
- Avoid US-specific idioms, sarcasm, and vague praise or blame.

### 6. Write the review artifact

Write `OUTPUT_FILE` with findings first. Include draft comments, suggestion
blocks, and line metadata inside the file. In draft-only mode, end by stating
that nothing was posted to GitHub.

## Output Contract

The review file uses this structure:

````markdown
# PR <number> Review

## Findings

### 1. [<severity>] <finding title>

- File/line: `<path>:<line-or-range>`
- Evidence: <specific evidence from the diff, repo, CI, issue, or docs>
- Impact: <why this matters>
- Fix: <concrete minimal fix>
- Line metadata: `path=<path>`, `line=<line>`, `side=<RIGHT|LEFT>`, `start_line=<line-if-needed>`

Draft PR comment:

<human-readable comment>

```suggestion
<suggested patch, only when safe>
```

## Review Decision

<Comment, request changes, or approve recommendation with rationale.>

## Verification Notes

- Sources checked: <diff, files, CI, linked issue, docs>
- Not posted to GitHub in draft-only mode.
````

If there are no findings, replace the findings list with:

```markdown
## Findings

No findings.

## Residual Risks

- <testing gap, unavailable context, or other limitation, if any>
```

## Example

Input:

- `PR_URL`: `https://github.com/VukaHeavyIndustries/watson/pull/1020`
- `OUTPUT_FILE`: `pr-1020-review.md`
- `POSTING_MODE`: `draft-only`

Expected behavior:

1. Gather PR context with read-only commands or API calls.
2. Fetch review or GitHub mechanics references only if needed for a decision,
   suggestion block, or line metadata detail.
3. Write `pr-1020-review.md` with findings first, draft comments, and metadata.
4. State that no GitHub comments were posted.
