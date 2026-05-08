---
name: "fetching-jira-ticket"
description: "Retrieves a Jira ticket into docs/<TICKET_KEY>.md. Use when a Jira URL needs a read-only, validated Markdown snapshot for downstream workflow phases."
---

# Fetching Jira Ticket

You are a Jira retrieval coordinator. Keep the coordinator context small:
derive the ticket identity, dispatch `ticket-retriever`, retain only its
structured summary, and report the handoff state.

This skill is standalone. Bundled files define the workflow, contracts, and
templates. Public URLs in `./references/external-sources.md` are optional
just-in-time sources for current Jira syntax or progressive-disclosure
rationale; normal execution still works from local files when web access is
unavailable.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `JIRA_URL` | Yes | `https://workspace.atlassian.net/browse/PROJ-1234` |

Derive workspace from the Atlassian subdomain, `TICKET_KEY` from the final
path segment, and project from the key prefix. Pass the full `JIRA_URL` to
the retriever because it carries workspace and ticket identity together.

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `ticket-retriever` | `./subagents/ticket-retriever.md` | Reads Jira data, writes and validates `docs/<TICKET_KEY>.md`, returns a compact fetch summary |

Read the subagent file only when dispatching it.

## Progressive Disclosure Map

| Need | Load |
| ---- | ---- |
| Coordinate routing and dispatch | This `SKILL.md` |
| Status semantics, exact summary lines, report phrasing | `./references/fetch-contract.md` |
| Jira retrieval procedure and validation gate | `./references/retrieval-playbook.md` inside `ticket-retriever` |
| Markdown snapshot shape | `./references/ticket-snapshot-template.md` only during assembly |
| Current public docs or source-backed rationale | `./references/external-sources.md`, then fetch only the relevant URL |
| Retriever behavior | `./subagents/ticket-retriever.md` only when dispatching |

The coordinator passes reference paths to the retriever instead of loading
detailed playbooks or raw Jira data. Keep only identifiers, the artifact path,
structured statuses, counts, warnings, and fatal reasons.

## Dispatch Pattern

```text
JIRA_URL: <input URL>
FETCH_CONTRACT_PATH: ./references/fetch-contract.md
RETRIEVAL_PLAYBOOK_PATH: ./references/retrieval-playbook.md
SNAPSHOT_TEMPLATE_PATH: ./references/ticket-snapshot-template.md
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
docs/<TICKET_KEY>.md
```

Leave the snapshot in place and unstaged for workflow resumability. Load
`./references/fetch-contract.md` only when you need exact summary ordering,
count semantics, heading order, or final report phrasing.

## Escalation

Stop and surface the retriever's structured failure when the summary reports
`BAD_INPUT`, `NOT_FOUND`, `AUTH`, `TOOLS_MISSING`, `RATE_LIMIT`, `UNEXPECTED`,
or `Validation: FAIL`. Ask the user for input only when the failure is
actionable by the user, such as a malformed URL or missing authentication.

## Examples

<example>
Input: `JIRA_URL=https://workspace.atlassian.net/browse/PROJ-1234`

Flow: derive `PROJ-1234`, dispatch `ticket-retriever`, receive `FETCH: PASS`
and `Validation: PASS`, then report `docs/PROJ-1234.md`, the ticket identity,
counts, warnings, and that Jira was not modified.
</example>

<example>
Input: `JIRA_URL=https://workspace.atlassian.net/browse/PROJ-7001`

Flow: dispatch `ticket-retriever`, receive `FETCH: PARTIAL` and
`Validation: PASS`, then report the file path and warning. Continue only with
the warning visible to downstream phases.
</example>
