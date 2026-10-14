# Review file template

Load only for comment-drafter MATERIALIZE. Render the verified package, never reconstruct publication content from this file. Preserve exact summary and bodies, including trailing newlines and embedded suggestions; use a surrounding fence longer than any fence in the enclosed text when quoting them.
There is one structural `Posting status:` field outside quoted bodies/fences. Its values are `DRAFT | CANCELLED | POSTED | FAILED | PARTIAL | UNCERTAIN`. UPDATE_STATUS changes only that value; initial materialization uses DRAFT.
Use this layout for both findings and no findings. Repeat the finding block in package order, or replace it with `No findings`. Keep every later section on either path. Omit drafting instructions and placeholders from the rendered output.

`````markdown
# PR <number> review

PR: <pr_url>
Reviewed base SHA: <base_sha>
Reviewed head SHA: <head_sha>
Package revision: <revision>

## Findings

### <id>. [<severity>] <title>

- Confidence: <confidence>
- Location: <location>
- Evidence: <evidence, bound to the reviewed revisions>
- Failure scenario: <failure_scenario>
- Impact: <impact>
- Minimal fix: <minimal_fix>
- Sources: <sources, or none>
- Classification: <NEW | FOLLOW_UP | UNCLASSIFIED>
- Anchor: <path, line, side, paired start_line/start_side if present, or none>
- Thread: <comment_id, root_id, OPEN | RESOLVED | UNKNOWN, or none>

Exact comment body, including any verified suggestion:
<quote the exact body without rewording or duplicating its suggestion>

## Review decision

<decision: APPROVE | REQUEST_CHANGES | COMMENT>
Review event planned: <create_review>

## Exact review summary

<quote the required exact summary, including for no findings or replies only>

## Dispositions

<each dropped record's id, CONFIRM | ADJUST | DROP, and reason; or none>

## Residual risks and limitations

History: <history.state; history.limitation when incomplete>
<each residual_risks description with blocks_approval and blocks_posting>
<include the package's coverage, testing and source limitations; or none recorded>

## Verification notes

Verified package revision: <revision, matching the verified package>
Sources and checks: <source_checks, including unavailable checks>

Posting status: DRAFT
`````

A no-findings review still includes decision, exact summary, revisions, risks, source checks and status. Incomplete history or material unresolved evidence cannot become an unqualified APPROVE.
Reread the rendered file and compare every required value with the verified package, not just the headings. Preserve separate comment/root IDs and UNKNOWN resolution. Status-only edits must leave all other bytes unchanged; a later failed package revision leaves the previous verified output intact.
