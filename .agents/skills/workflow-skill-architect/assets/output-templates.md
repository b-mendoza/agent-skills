# Output Templates

Load this asset when assembling files, collection manifests, resume packets, zero-output reports, or final deliveries. Path: `assets/output-templates.md` (templates live under `assets/`, not `references/`).

## Skill Template

```markdown
---
name: "skill-name"
description: "Third-person trigger description."
---

# Skill Title

Purpose paragraph and operating posture.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |

## Workflow Overview

| Phase | Mode | Result |
| ----- | ---- | ------ |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |

## How This Skill Works

Core behavior, trust boundaries, and mutation boundaries.

## Execution

1. Step-by-step routing instructions.

## Output Contract

Returned shape and statuses.

## Example

One short dispatch round trip.
```

## Subagent Template

```markdown
---
name: "subagent-name"
description: "Third-person role and dispatch trigger."
---

# Subagent Title

Mental model and bounded job.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |

## Instructions

1. Ordered work steps.

## Output Format

Structured status and fields.

## Scope

Allow-list of work the subagent may do.

## Escalation

| Status | Use When |
| ------ | -------- |
```

## Reference Template

```markdown
# Reference Title

Load this reference when <specific phase or decision>.

## Section

Focused reusable guidance, template, checklist, or examples.
```

## Slash Command Template

```markdown
---
name: "command-name"
description: "Imperative command description and trigger."
---

# Command Name

Run this command when the user explicitly asks to <action>.

## Inputs

- `INPUT_NAME`: required or optional; example.

## Procedure

1. Validate inputs.
2. Run the bounded action.
3. Return the defined output.

## Output

Copy-ready response or artifact path.
```

## Script Template

```text
scripts/script-name.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail

# Parse arguments, validate paths, perform deterministic work, print results.
```

Script documentation template:

```markdown
## Script: `scripts/script-name.sh`

- Purpose:
- Inputs:
- Outputs:
- Failure modes:
- Consumer invocation:
```

## Per-Item Response

```text
ARCHITECTURE: PASS | NEEDS_INPUT | BLOCKED | ERROR

## Staged Files
| Path | Purpose | Summary |
| ---- | ------- | ------- |

## Contract Summary
- Inputs:
- Outputs:
- Statuses:
- Mutation boundary:
```

## Collection Manifest

```yaml
version: 1
items:
  - id: item-001
    artifact_type: subagent
    status: staged
    paths:
      - staging/package/subagents/example.md
    registry_rows:
      - subagent: example
        path: ./subagents/example.md
        purpose: Example bounded work
    contract_summary:
      inputs: []
      outputs: []
      statuses: []
    validation_note: "Paths are package-relative."
    handoff_summary: "Five lines maximum."
repair_cycle: 0
assumptions: []
```

## Resume Packet

```yaml
version: 1
run_state:
  classification: create
  mode: generation
  target_runtime: portable Agent Skills
  output_scope: entire skill
work_item_queue: []
collection_manifest_path_or_summary: "paths and summaries only"
completed_statuses: []
repair_cycle: 0
pending_questions:
  - id: q1
    question: "Which runtime requires exact syntax?"
resume_from: "queue-loop"
```

## Zero-Output Report

```text
state: ready
result: no-artifacts-required

## Classification
- Classification:
- Mode:
- Target runtime:

## Scope Derivation
- Requested scope:
- Derived scope:
- Assumption:

## Why No Artifacts Are Needed
- Reason:

## Suggested Next Action
- Next action:
```

## Final Delivery

````text
state: ready | blocked | error

## Analysis
- Purpose:
- Classification:
- Output scope:
- Artifact choices:
- Progressive disclosure plan:

## Files
| Path | Purpose |
| ---- | ------- |

```markdown
<complete file content emitted once at final delivery>
```

## Integration Notes
- How files fit together:
- References loaded just in time:
- Dispatch method:
- External URLs fetched:
- Assumptions:

## Findings Resolution
| Finding | File | Resolution | Notes |
| ------- | ---- | ---------- | ----- |

## Validation
- Final review verdict:
- Repair cycles used:
- Remaining risks:
````
