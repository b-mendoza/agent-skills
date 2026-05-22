# Input Contract

> Load this file only when normalizing `PROCESS_SPEC`, checking whether required
> process details are missing, or drafting a clarification question.

## Required Process Fields

Every `PROCESS_INPUTS` bundle includes these dispatch keys. Values may come from
explicit user wording or from explicit assumptions when the clarification policy
allows them. Ask for clarification when a missing value changes the diagram
contract.

| Field | Purpose | Example |
| ----- | ------- | ------- |
| `PROCESS_NAME` | Names the diagram and workflow boundary | `AI-assisted deployment review` |
| `AGENT_ROLE` | Identifies who performs the workflow | `Deployment reviewer` |
| `PRIMARY_OBJECTIVE` | States the main decision or outcome | `Decide whether a release candidate is safe` |
| `INPUTS` | Lists source artifacts or incoming data | `PR, CI results, changelog, rollback plan` |
| `OUTPUTS` | Names produced artifacts or comments | `Deployment readiness comment` |
| `ALLOWED_ACTIONS` | States actions the agent may perform | `Read artifacts, summarize risks, post comment` |
| `BOUNDARIES_OR_LIMITS` | States where the agent stops or recommends instead of acting | `No deploy, merge, or CI bypass` |
| `SENSITIVE_ACTIONS` | Names actions that require explicit approval | `Deploy, rollback, change feature flags` |
| `HUMAN_CONFIRMATION_REQUIREMENTS` | Defines approval timing and evidence | `Approval before recommending deploy` |
| `EVIDENCE_SOURCES` | Lists trusted sources for claims | `CI, incident history, runbooks` |
| `COMPLETION_CRITERIA` | Defines terminal outcomes | `Ready, blocked, needs validation, escalated` |

## Clarification Policy

Ask one concise question when any missing field would change authority, sensitive
actions, allowed outputs, evidence requirements, human confirmation, or terminal
states. If a missing value only affects wording, continue with an explicit
assumption in `PROCESS_INPUTS`.

## Dispatch Shape

Send subagents a concise `PROCESS_INPUTS` bundle containing:

- Normalized fields from the table above, using explicit assumptions where the
  clarification policy allows them.
- Supplied optional context from the user.
- Explicit assumptions.

Keep refinement controls outside `PROCESS_INPUTS`: send `EXISTING_FLOW_OR_DIAGRAM`
as the baseline for refinement runs, send `REFINEMENT_REQUEST` as refinement
control data, keep `APPROVED_REFINEMENT_GAPS` as a separate dispatch input so
approval scope is visible to the builder and reviewer, and send `RUN_MODE` as its
own dispatch input.
