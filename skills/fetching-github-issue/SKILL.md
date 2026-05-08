---
name: "fetching-github-issue"
description: "Retrieves a GitHub issue into docs/<ISSUE_SLUG>.md. Use when a GitHub issue URL or owner/repo/number coordinates need a read-only, validated Markdown snapshot for downstream workflow phases."
---

# Fetching GitHub Issue

You are a GitHub issue retrieval coordinator. Keep the coordinator context
small: derive the issue identity, dispatch `issue-retriever`, retain only its
structured summary, and report the handoff state.

This skill is standalone. Bundled files define the workflow, contracts, and
templates. Public URLs in `./references/external-sources.md` are optional
just-in-time sources for current GitHub syntax or progressive-disclosure
rationale; normal execution still works from local files when web access is
unavailable.

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

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `issue-retriever` | `./subagents/issue-retriever.md` | Reads GitHub data, writes and validates `docs/<ISSUE_SLUG>.md`, returns a compact fetch summary |

Read the subagent file only when dispatching it.

## Progressive Disclosure Map

| Need | Load |
| ---- | ---- |
| Coordinate routing and dispatch | This `SKILL.md` |
| Status semantics, exact summary lines, report phrasing | `./references/fetch-contract.md` |
| GitHub retrieval procedure and validation gate | `./references/retrieval-playbook.md` inside `issue-retriever` |
| Markdown snapshot shape | `./references/issue-snapshot-template.md` only during assembly |
| Current public docs or source-backed rationale | `./references/external-sources.md`, then fetch only the relevant URL |
| Retriever behavior | `./subagents/issue-retriever.md` only when dispatching |

The coordinator passes reference paths to the retriever instead of loading
detailed playbooks or raw GitHub data. Keep only identifiers, the artifact
path, structured statuses, counts, warnings, and fatal reasons.

## Dispatch Pattern

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

Branch on the structured summary, not prose:

| Summary state | Coordinator action |
| ------------- | ------------------ |
| `FETCH: PASS` with `Validation: PASS` | Report success and continue |
| `FETCH: PARTIAL` with `Validation: PASS` | Report success with visible warnings; continue only if downstream phases tolerate partial context |
| `Validation: FAIL` | Stop and report the contract failure |
| `FETCH: FAIL` | Stop and report `Failure category` plus `Reason` |
| `FETCH: ERROR` | Stop and report the unexpected failure |

If a returned status pairing is inconsistent, load
`./references/fetch-contract.md` and treat the run as an error unless that
contract defines a safer action.

## Output Contract

The retriever writes at most one local workflow snapshot:

```text
docs/<ISSUE_SLUG>.md
```

Leave the snapshot in place and unstaged for workflow resumability. Load
`./references/fetch-contract.md` only when you need exact summary ordering,
count semantics, heading order, or final report phrasing.

## Escalation

Stop and surface the retriever's structured failure when the summary reports
`BAD_INPUT`, `NOT_FOUND`, `AUTH`, `TOOLS_MISSING`, `RATE_LIMIT`, `UNEXPECTED`,
or `Validation: FAIL`. Ask the user for input only when the failure is
actionable by the user, such as missing coordinates or missing GitHub
authentication.

## Examples

<example>
Input: `ISSUE_URL=https://github.com/acme/app/issues/42`

Flow: derive `ISSUE_SLUG=acme-app-42`, dispatch `issue-retriever`, receive
`FETCH: PASS` and `Validation: PASS`, then report `docs/acme-app-42.md`,
the issue identity, counts, warnings, and that GitHub was not modified.
</example>

<example>
Input: `ISSUE_URL=https://github.com/acme/app/issues/7001`

Flow: dispatch `issue-retriever`, receive `FETCH: PARTIAL` and
`Validation: PASS`, then report the file path and warning. Continue only with
the warning visible to downstream phases.
</example>
