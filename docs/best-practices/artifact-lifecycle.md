# Artifact Lifecycle Management

## What it is

Distinguish between orchestration artifacts (working documents that track or
carry workflow state) and implementation artifacts (source code, tests,
configs that are the workflow's output). Apply different lifecycle rules to
each, and separate persistent orchestration records from ephemeral dispatch
payloads.

## Two categories

| Category | Contents | Committed to git | Deleted |
| --- | --- | --- | --- |
| A1 | Persistent orchestration records: progress files, plans, ticket snapshots, decision logs | Never | Preserve until the workflow no longer needs resumability or the user approves cleanup |
| A2 | Ephemeral orchestration payloads: handoff files, temporary dispatch instructions, retry payloads | Never | Delete after terminal dispatch cleanup unless retained for debugging |
| B | Implementation: source code, tests, configs, documentation | Yes | Normal rules |

## Why preserve Category A1

Persistent orchestration records enable resumability. If a workflow is
interrupted by user choice, error, or session timeout, progress files and
planning artifacts allow the workflow to resume from exactly where it left off.
Deleting them forces a restart.

## Why delete Category A2

Ephemeral orchestration payloads are point-in-time instructions for a specific
dispatch. Once the dispatch succeeds, is abandoned, or reaches a terminal
blocked/error state, stale payloads become misleading. Delete them as part of
workflow cleanup unless the user asks to preserve them for debugging.

## Key rule

Never commit Category A artifacts to version control. They are working
documents that belong to the workflow session, not to the project's history.
Preserve Category A1 while it is needed for resumability; clean up Category A2
when its dispatch lifecycle ends. Only Category B artifacts (the actual output
of the workflow) are staged and committed.
