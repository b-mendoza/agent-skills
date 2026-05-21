---
name: "generating-flow-diagrams"
description: "Create or refine Markdown plus Mermaid flow diagrams for AI-agent workflows. Use when the user asks for a process flow, workflow diagram, Mermaid flowchart, agent operating procedure, human-in-the-loop gate map, or refinement of an existing flow or process description."
---

# Generating Flow Diagrams

Generating Flow Diagrams turns AI-agent workflow descriptions into auditable
Markdown documents with Mermaid flowcharts. The skill treats a flow diagram as
an operating contract: it must show authority, evidence, validation, decision
logic, human gates, outputs, and terminal states clearly enough to inspect.

Use this skill for new diagrams and for refinement requests. When refining an
existing flow, preserve user intent by identifying improvement gaps first and
asking for confirmation before filling, fixing, or redefining them.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PROCESS_NAME` | Yes | `AI-assisted production deployment review` |
| `AGENT_ROLE` | Yes | `Deployment reviewer` |
| `PRIMARY_OBJECTIVE` | Yes | `Decide whether a release candidate is safe to deploy` |
| `INPUTS` | Yes | `PR, CI results, changelog, rollback plan` |
| `OUTPUTS` | Yes | `Deployment readiness comment` |
| `ALLOWED_ACTIONS` | Yes | `Read artifacts, summarize risks, post readiness comment` |
| `FORBIDDEN_ACTIONS` | Yes | `Trigger deploy, merge PR, bypass CI` |
| `SENSITIVE_ACTIONS` | Yes | `Deploy, rollback, change feature flags` |
| `HUMAN_CONFIRMATION_REQUIREMENTS` | Yes | `Explicit approval before recommending deploy` |
| `EVIDENCE_SOURCES` | Yes | `CI, incident history, runbooks` |
| `COMPLETION_CRITERIA` | Yes | `Ready, blocked, needs more validation, escalated` |
| `EXISTING_FLOW_OR_DIAGRAM` | No | Existing Mermaid block, file, or process description |
| `REFINEMENT_REQUEST` | No | `Improve the current diagram without changing scope` |
| `APPROVED_REFINEMENT_GAPS` | No | `Add human gate and blocked terminal state only` |

Ask one concise clarifying question only when a missing input would change the
diagram contract. If enough information exists to make assumptions safely, mark
those assumptions instead of presenting them as facts.

## Workflow

| Phase | Action | Output |
| ----- | ------ | ------ |
| 1 | Frame boundary, role, objective, authority, and trust model | Boundary paragraph |
| 2 | Map inputs, outputs, evidence, risks, dependencies, and completion outcomes | Diagram outline |
| 2a | For refinement requests, inspect the existing flow and ask approval for proposed gaps | Gap inventory or approved scope |
| 3 | Build the Mermaid `flowchart TD` unless another Mermaid type is clearly better | Candidate diagram |
| 4 | Add failure paths, human gates, decline paths, and audit or handoff paths | Guardrailed diagram |
| 5 | Apply Mermaid formatting, short labels, line breaks, and classes | Readable Mermaid |
| 6 | Self-review for safety, branch integrity, grounding, and syntax | Revised candidate |
| 7 | Run the quality gate loop until the candidate passes | Final Markdown or blocker |

## How This Skill Works

The skill does three things:

- Design: convert the process into nodes, decisions, checks, gates, outputs, and terminal states.
- Protect: keep sensitive actions behind human gates and preserve confirmed user intent during refinements.
- Validate: reject invalid Mermaid or instruction-noncompliant candidates and iterate until the quality gate passes.

## Execution

1. Capture the required inputs and any existing flow, diagram, file content, or refinement request.
2. If refining an existing flow, run the refinement pre-check before generating a new diagram.
3. Define the operating boundary: agent role, objective, allowed actions, forbidden actions, sensitive actions, trust model, and read-only or mutation limits.
4. Map process material into concrete stages: intake, context collection, classification, validation, evidence synthesis, decisions, failure paths, human gates, output generation, and terminal states.
5. Draft one Mermaid diagram in a fenced `mermaid` block, using `flowchart TD` unless another Mermaid diagram type is clearly better.
6. Add class definitions and class assignments for guardrails, checks, decisions, human gates, outputs, and terminal states.
7. Self-review and fix missing gates, mutation paths without authorization, dead-end branches, unclear decisions, disconnected validation, unsupported facts, and Mermaid syntax issues.
8. Run the quality gate. If any check fails, reject the candidate, revise the relevant phase output, and run the quality gate again.
9. Return the final Markdown only after the quality gate passes. If required information or refinement approval is missing, return the blocker or confirmation request instead.

## Refinement Pre-Check

Run this gate when the user provides an existing Mermaid diagram, flow, process
description, or file to refine.

1. Inspect the existing flow without rewriting it.
2. List concrete gaps that could be improved, such as missing gates, unclear authority, unsupported assumptions, disconnected validation, dead-end branches, malformed Mermaid, missing terminal states, weak evidence handling, or absent failure paths.
3. Classify each gap as `structural`, `safety`, `evidence`, `syntax`, `scope`, `human-confirmation`, `output-shape`, or `completion-criteria`.
4. Ask the user which gaps are approved for the generated flow before filling, fixing, or redefining them.
5. Generate the revised flow only for explicitly approved gaps.

If gaps are found and approval is missing, stop and return only:

```markdown
## Refinement Pre-Check
| Gap | Type | Why It Matters | Proposed Change |
| --- | ---- | -------------- | --------------- |
| ... | ... | ... | ... |

Which gaps should I include or fix in the revised flow?
```

## Diagram Requirements

Include these elements when relevant to the process:

- Start node.
- Boundary and authority node.
- Intake or context snapshot node.
- Access or evidence availability decision.
- Classification node.
- Parallel or grouped validation checks.
- Evidence synthesis node.
- Contradiction or invalid-claim decision.
- Missing-information decision.
- Scope or decomposition decision.
- Risk or dependency decision.
- Human confirmation gates for sensitive actions.
- Output, report, or comment drafting node.
- Final readiness decision.
- Terminal states such as ready, needs refinement, blocked, deferred, not actionable, or escalated.

For each human-in-the-loop gate, include the exact action, target, reason, risk
and reversibility, safer alternative, explicit approve branch, explicit decline
branch, and audit or handoff requirement after approval.

## Mermaid Style

Use short, action-oriented node names such as `COLLECT_CONTEXT`,
`VERIFY_CLAIMS`, `ASK_HUMAN`, and `POST_REPORT`. Use `\n` when a concise label
needs one clarifying detail.

Use class definitions similar to:

```mermaid
classDef guard fill:#fff3cd,stroke:#856404,color:#000;
classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
classDef stop fill:#fdecea,stroke:#b02a37,color:#000;
```

## Anti-Patterns

Do not:

- Generate implementation details, code, tool commands, or production changes instead of a process design.
- Let a sensitive or risky action bypass human confirmation.
- Fill or fix gaps in an existing flow before the user confirms which gaps should be included.
- Return a diagram that failed the quality gate.
- Treat placeholders, assumptions, or missing evidence as confirmed facts.
- Use vague nodes such as `Process item`, `Handle issue`, `Review stuff`, or `Do work`.
- Leave dead-end branches, unlabeled decision outcomes, or validation checks disconnected from readiness.
- Produce Mermaid with undefined nodes, conflicting duplicate node definitions, malformed arrows, or class assignments for classes that are not defined.

## Quality Gate

Treat the generated Mermaid diagram as a candidate until it passes validation. A
candidate fails if Mermaid syntax is invalid, required nodes or paths are
missing, sensitive actions bypass human approval, unconfirmed refinement gaps
were applied, validation checks do not affect readiness, unsupported facts
appear as confirmed, terminal states are missing, or output format does not
match this skill.

Reject failed candidates and iterate until the gate passes. If a valid diagram
cannot be produced because required information or user confirmation is missing,
return the blocker or confirmation request instead of a final diagram.

## Output Contract

Return a Markdown document with this structure after the quality gate passes:

1. A short title using `PROCESS_NAME`.
2. A short paragraph describing the workflow boundary, authority, trust model, and read-only or mutation limits.
3. Exactly one Mermaid diagram in a fenced `mermaid` block unless the user explicitly asks for multiple diagrams.
4. Optional output, report, or comment template in a fenced `text` block when useful.
5. Optional readiness, completion, or sensitive-action rule when it clarifies successful completion.

Separate facts, assumptions, risks, blockers, recommendations, and unresolved
questions in the diagram or supporting text. If the refinement pre-check needs
approval, return the gap inventory and confirmation question instead of this
final output.

## Success Criteria

- The final Markdown contains a title, boundary paragraph, and one valid Mermaid diagram.
- The diagram starts with process intake and ends only at explicit terminal states.
- Context collection, classification, validation checks, evidence synthesis, decision points, failure paths, human gates, output generation, and readiness logic are represented.
- Every sensitive action routes through a human gate with approve and decline branches.
- Read-only or reviewer-only boundaries route mutations to recommendations or separate approved workflows.
- Missing access, missing information, contradictory evidence, invalid claims, oversized scope, dependencies, and escalation have paths when relevant.
- Facts, assumptions, risks, blockers, recommendations, and unresolved questions are separated.
- Mermaid classes are defined and applied consistently.
- No unsupported facts are invented.
- For refinement requests, proposed gaps were identified first and only user-approved gaps were included, filled, fixed, or redefined.
- The quality gate passed after the final iteration.

## Example

Input: `Create a flow diagram for an AI-assisted deployment review. The agent may
read release artifacts and post a readiness comment, but it may not deploy,
merge, or bypass CI. Deployment and rollback are sensitive actions.`

1. Frame the reviewer role, release-readiness objective, and read-only boundary.
2. Add evidence checks for CI, changelog, rollback plan, incidents, and runbooks.
3. Route deploy or rollback recommendations through a human gate.
4. Add blocked, needs validation, ready, and escalated terminal states.
5. Run the quality gate and return the Markdown plus Mermaid only after it passes.
