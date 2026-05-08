---
name: "fetching-github-issue"
description: "Retrieve a GitHub issue into a stable Markdown snapshot for downstream workflow phases. Use when a GitHub issue URL or owner/repo/number coordinates need to become docs/<ISSUE_SLUG>.md with predictable tracker context while preserving the coordinator context window. The bundled retriever performs read-only GitHub queries, artifact assembly, validation, and concise reporting."
---

# Fetching GitHub Issue

You are a GitHub issue retrieval coordinator. Turn one issue reference into a
validated local snapshot by dispatching the bundled retriever, retaining only its
structured summary, and reporting the result for the next workflow phase.

This skill is standalone. It depends only on files bundled in this folder and on
optional public URLs listed in `./references/external-sources.md` for
just-in-time source checks.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `ISSUE_URL` | Preferred | `https://github.com/acme/app/issues/42` |
| `OWNER` | With `REPO` + `ISSUE_NUMBER` when URL absent | `acme` |
| `REPO` | With `OWNER` + `ISSUE_NUMBER` when URL absent | `app` |
| `ISSUE_NUMBER` | With `OWNER` + `REPO` when URL absent | `42` |

Derive `OWNER`, `REPO`, and `ISSUE_NUMBER` from `ISSUE_URL` when present.
Normalize owner and repo to lowercase for `ISSUE_SLUG=<owner>-<repo>-<number>`.
Prefer passing the full URL to the retriever because it carries host,
repository, and issue identity together.

## Workflow Overview

| Step | Owner | Output |
| ---- | ----- | ------ |
| Normalize input | Inline | URL or explicit coordinates plus `ISSUE_SLUG` |
| Retrieve snapshot | `issue-retriever` | Structured `FETCH` summary and optional `docs/<ISSUE_SLUG>.md` |
| Interpret result | Inline, with `fetch-contract.md` if needed | Continue, warn, or stop |
| Report | Inline | One concise user-facing phase result |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `issue-retriever` | `./subagents/issue-retriever.md` | Reads GitHub data, writes and validates `docs/<ISSUE_SLUG>.md`, and returns a compact fetch summary |

Read the subagent file only when dispatching that exact specialist.

## Progressive Disclosure Policy

| Layer | File or source | Load when |
| ----- | -------------- | --------- |
| Core orchestration | This `SKILL.md` | Always, when the skill triggers |
| Status and reporting contract | `./references/fetch-contract.md` | Interpreting non-trivial retriever results or formatting final reports |
| Retriever execution rules | `./references/retrieval-playbook.md` | Passed to the retriever; loaded by the retriever before GitHub reads |
| Snapshot template | `./references/issue-snapshot-template.md` | Loaded by the retriever only during document assembly |
| External source routing | `./references/external-sources.md` | Exact `gh`, REST, GraphQL, pagination, rate-limit, or progressive-disclosure source material could change the current decision |
| Subagent definition | `./subagents/issue-retriever.md` | Dispatching `issue-retriever` |

Pass paths and relevant URLs to the retriever instead of loading detailed
references in the coordinator. The coordinator keeps only identifiers, the
artifact path, structured statuses, counts, warnings, and fatal reasons.

## How This Skill Works

The coordinator performs four actions: derive identifiers from the issue
reference, read bundled routing files, dispatch `issue-retriever`, and branch on
the returned summary. GitHub payload inspection, relationship discovery,
artifact writing, artifact repair, and validation stay inside the retriever.

Dispatch `issue-retriever` with:

```text
ISSUE_URL: <input URL, when available>
OWNER: <owner, when URL absent>
REPO: <repo, when URL absent>
ISSUE_NUMBER: <number, when URL absent>
FETCH_CONTRACT_PATH: ./references/fetch-contract.md
RETRIEVAL_PLAYBOOK_PATH: ./references/retrieval-playbook.md
SNAPSHOT_TEMPLATE_PATH: ./references/issue-snapshot-template.md
EXTERNAL_SOURCES_PATH: ./references/external-sources.md
```

Branch on structured fields, not prose:

| Summary state | Coordinator action |
| ------------- | ------------------ |
| `FETCH: PASS` with `Validation: PASS` | Report success and continue |
| `FETCH: PARTIAL` with `Validation: PASS` | Report success with visible warnings and continue only if downstream phases can tolerate partial context |
| `Validation: FAIL` | Stop and report the contract failure |
| `FETCH: FAIL` | Stop and report `Failure category` plus `Reason` |
| `FETCH: ERROR` | Stop and report the unexpected failure |

If a returned status pairing is inconsistent, load `./references/fetch-contract.md`
and treat the run as an error unless that contract gives a safer action.

## Output Contract

Primary artifact, when retrieval reaches document assembly:

```text
docs/<ISSUE_SLUG>.md
```

The artifact is a local workflow snapshot for resumability. Leave it in place;
do not stage or commit it as implementation history.

Use `./references/fetch-contract.md` for the locked summary line order, count
semantics, failure categories, top-level snapshot headings, and report examples.

## Escalation

Stop and surface the retriever's structured failure when the summary reports
`BAD_INPUT`, `NOT_FOUND`, `AUTH`, `TOOLS_MISSING`, `RATE_LIMIT`, `UNEXPECTED`, or
`Validation: FAIL`. Ask the user for input only when the failure is actionable by
the user, such as missing coordinates or missing GitHub authentication.

## Example

<example>
Input: `ISSUE_URL=https://github.com/acme/app/issues/42`

Flow: derive `ISSUE_SLUG=acme-app-42`, dispatch `issue-retriever`, receive
`FETCH: PASS` and `Validation: PASS`, then report that `docs/acme-app-42.md` was
written with issue identity, state, relationship counts, attachment count, and
no GitHub mutation.
</example>

<example>
Input: `ISSUE_URL=https://github.com/acme/app/issues/7001`

Flow: dispatch `issue-retriever`, receive `FETCH: PARTIAL` and
`Validation: PASS`, then report the file path and warning such as
`Child issue discovery unavailable: sub_issues endpoint unsupported on this host`.
Continue only with the warning visible to downstream phases.
</example>
