# Input and Output Contracts

## What it is

Explicitly define what data a skill or subagent requires as input, what it
produces as output, and in what format. These contracts are the data boundaries
between pipeline stages.

## Why it matters

Without explicit contracts, subagents make assumptions about input format and
downstream consumers make assumptions about output format. Mismatches cause
silent failures that surface steps later, far from the root cause.

## Input contract format

```markdown
## Inputs

| Input      | Required | Example                                               |
| ---------- | -------- | ----------------------------------------------------- |
| `JIRA_URL` | Yes      | `https://workspace.atlassian.net/browse/PROJECT-1234` |
| `MODE`     | No       | `upfront` (default) or `critique`                     |
```

Include derivation rules when inputs carry multiple pieces of information:

```markdown
Extract these values from the URL:

- **Workspace:** subdomain before `.atlassian.net` → `workspace`
- **Ticket key:** full path segment → `PROJECT-1234`
```

## Output contract format

Specify the file path, required sections, and structural expectations:

```markdown
## Output Contract

Path: `docs/<TICKET_KEY>-tasks.md`

Must contain:

- `## Ticket Summary` section
- `## Tasks` section with at least 2 task entries
- Each task entry has: Title, Description, Acceptance Criteria
```

## Design principle: Prefer URLs over derived keys as inputs

When a value carries multiple pieces of context (e.g., a URL contains
workspace, project, and key), pass the full value rather than requiring the
caller to pre-extract components. The receiving skill can derive what it needs.
This reduces ambiguity and provides richer context to downstream operations.
