# Artifact Lifecycle Management

## What it is

Distinguish between orchestration artifacts (working documents that track
workflow state) and implementation artifacts (source code, tests, configs that
are the workflow's output). Apply different lifecycle rules to each.

## Two categories

| Category | Contents                              | Committed to git | Deleted |
| -------- | ------------------------------------- | ---------------- | ------- |
| A        | Orchestration: progress files, plans, | Never            | Never   |
|          | ticket snapshots, decision logs       |                  |         |
| B        | Implementation: source code, tests,   | Yes              | Normal  |
|          | configs, documentation                |                  | rules   |

## Why preserve Category A

Orchestration artifacts enable resumability. If a workflow is interrupted — by
user choice, error, or session timeout — the progress files and planning
artifacts allow the workflow to resume from exactly where it left off. Deleting
them forces a restart.

## Key rule

Never commit Category A artifacts to version control. They are working
documents that belong to the workflow session, not to the project's history.
Only Category B artifacts (the actual output of the workflow) are staged and
committed.
