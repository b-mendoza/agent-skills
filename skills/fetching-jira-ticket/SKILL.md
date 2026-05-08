---
name: "fetching-jira-ticket"
description: "Retrieve a Jira ticket into a stable Markdown snapshot for downstream workflow phases. Use when a Jira URL needs to become docs/<TICKET_KEY>.md with predictable tracker context while preserving the coordinator context window. The bundled retriever performs Jira reads, artifact assembly, validation, and concise reporting; this skill coordinates retrieval only and does not mutate Jira."
---

# Fetching Jira Ticket

You are a Jira retrieval coordinator. Turn one Jira URL into a validated local
snapshot by dispatching the bundled retriever, retaining only its structured
summary, and reporting the result for the next workflow phase.

The coordinator does three things: derive identifiers from the input URL,
dispatch `ticket-retriever`, and branch on the returned summary. Jira payload
inspection, artifact writing, repair, and validation stay inside the
retriever.

This skill is standalone. It depends only on files bundled in this folder and
on optional public URLs listed in `./references/external-sources.md` for
just-in-time syntax checks.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `JIRA_URL` | Yes | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

Derive workspace from the Atlassian subdomain, `TICKET_KEY` from the final
path segment, and project from the key prefix. Pass the full `JIRA_URL` to
the retriever because it carries workspace and ticket identity together.

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `ticket-retriever` | `./subagents/ticket-retriever.md` | Reads Jira data, writes and validates `docs/<TICKET_KEY>.md`, returns a compact fetch summary |

Read the subagent file only when dispatching it.

## Progressive Disclosure Map

| Layer | File or source | Load when |
| ----- | -------------- | --------- |
| Always | This `SKILL.md` | The skill triggers |
| Status semantics | `./references/fetch-contract.md` | Interpreting non-trivial retriever results or formatting the final report |
| Retriever rules | `./references/retrieval-playbook.md` | Inside the retriever, before Jira reads |
| Snapshot shape | `./references/ticket-snapshot-template.md` | Inside the retriever, only at document assembly |
| External sources | `./references/external-sources.md` | Exact Jira API syntax, auth, pagination, or rate-limit behavior could change the current decision |
| Subagent definition | `./subagents/ticket-retriever.md` | Dispatching `ticket-retriever` |

The coordinator passes paths and relevant URLs to the retriever instead of
loading detailed references itself. It keeps only identifiers, the artifact
path, structured statuses, counts, warnings, and fatal reasons.

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

Primary artifact when retrieval reaches assembly:

```text
docs/<TICKET_KEY>.md
```

The artifact is a local workflow snapshot for resumability. Leave it in place;
do not stage or commit it as implementation history. Use
`./references/fetch-contract.md` for the locked summary line order, count
semantics, failure categories, top-level snapshot headings, and report
phrasing.

## Escalation

Stop and surface the retriever's structured failure when the summary reports
`BAD_INPUT`, `NOT_FOUND`, `AUTH`, `TOOLS_MISSING`, `RATE_LIMIT`, `UNEXPECTED`,
or `Validation: FAIL`. Ask the user for input only when the failure is
actionable by the user, such as a malformed URL or missing authentication.

## Examples

<example>
Input: `JIRA_URL=https://vukaheavyindustries.atlassian.net/browse/JNS-6065`

Flow: derive `JNS-6065`, dispatch `ticket-retriever`, receive `FETCH: PASS`
and `Validation: PASS`, then report that `docs/JNS-6065.md` was written with
the ticket identity, status/type, relationship counts, attachment count, and
no Jira mutation.
</example>

<example>
Input: `JIRA_URL=https://vukaheavyindustries.atlassian.net/browse/JNS-7001`

Flow: dispatch `ticket-retriever`, receive `FETCH: PARTIAL` and
`Validation: PASS`, then report the file path with the warning
`Could not retrieve JNS-7002 (404 Not Found)`. Continue only with the warning
visible to downstream phases.
</example>
