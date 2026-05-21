---
name: "generating-flow-diagrams"
description: "Create or refine Markdown plus Mermaid flow diagrams for AI-agent workflows. Use when the user asks for a process flow, workflow diagram, Mermaid flowchart, agent operating procedure, human-in-the-loop gate map, or refinement of an existing flow or process description."
---

# Generating Flow Diagrams

Generating Flow Diagrams turns AI-agent workflow descriptions into auditable
Markdown documents with Mermaid flowcharts. It treats a diagram as an operating
contract: the result should expose authority, evidence, validation, decisions,
human gates, outputs, and terminal states clearly enough to inspect.

The orchestrator coordinates the run, keeps only decisions and verdicts in
context, and loads detailed guidance only when a phase needs it. External links
are optional source material; the bundled files are enough to run offline.

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
| `APPROVED_REFINEMENT_GAPS` | No | `G1 and G3 only` |

Ask one concise clarifying question only when a missing value would change the
diagram contract. If assumptions are safe and reversible, mark them explicitly.

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Refinement gap inventory and confirmation gate | Dispatch `./subagents/refinement-analyst.md`; load `./references/output-templates.md` only to format the user-facing confirmation request |
| Diagram structure, human gates, failure paths, and category separation | Dispatch `./subagents/diagram-builder.md`; it loads `./references/flow-design-playbook.md` |
| Mermaid syntax, classes, and style pitfalls | Dispatch `./subagents/diagram-builder.md`; it loads `./references/mermaid-style-guide.md` |
| Final Markdown assembly | Dispatch `./subagents/diagram-builder.md`; it loads `./references/output-templates.md` |
| Quality gate and fix loop | Dispatch `./subagents/diagram-quality-reviewer.md`; it loads `./references/quality-gate-checklist.md` |
| Source-backed rationale or current Mermaid guidance | `./references/external-sources.md`, then fetch the smallest relevant URL |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `refinement-analyst` | `./subagents/refinement-analyst.md` | Inspects an existing flow and returns proposed improvement gaps plus a confirmation question |
| `diagram-builder` | `./subagents/diagram-builder.md` | Creates or revises the Markdown plus Mermaid candidate from approved scope and bundled references |
| `diagram-quality-reviewer` | `./subagents/diagram-quality-reviewer.md` | Reviews the candidate for Mermaid validity, prompt compliance, and approved refinement scope |

Read a subagent file only when dispatching that subagent. Keep raw diagrams,
candidate drafts, and detailed findings inside subagents except for the final
candidate that must be returned to the user.

## How This Skill Works

The orchestrator does three things:

- Decide: classify the request as new generation or refinement and choose the next phase.
- Dispatch: send detailed analysis, building, or validation to the bundled subagent for that phase.
- Synthesize: keep concise verdicts, user confirmations, and final output only.

## Execution

1. Capture all inputs and classify the run as `new` or `refinement`.
2. For `refinement`, dispatch `refinement-analyst` before generating a revised diagram. Continue only on `PREFLIGHT: PASS`; on `PREFLIGHT: NEEDS_CONFIRMATION`, ask the confirmation question and stop; on `PREFLIGHT: BLOCKED` or `PREFLIGHT: ERROR`, stop with the reported recovery action.
3. Load orchestration-level references only when the orchestrator must format a user-facing confirmation or fetch external rationale. Detailed design, Mermaid, and quality references are loaded by the dispatched subagent.
4. Dispatch `diagram-builder` with the original inputs, approved gaps, and any concise constraints from prior phases.
5. Continue only on `BUILD: PASS`; on `BUILD: NEEDS_INPUT` or `BUILD: ERROR`, stop with `Failure Details` and the reported recovery action.
6. Dispatch `diagram-quality-reviewer` with the candidate output and applicable inputs.
7. On `REVIEW: BLOCKED` or `REVIEW: ERROR`, stop with the validation blocker and recovery action. If `REVIEW: FAIL`, dispatch `diagram-builder` with the current candidate, `RUN_MODE=repair`, and `REVIEW_FEEDBACK` containing only the failed checks; if repair returns `BUILD: NEEDS_INPUT` or `BUILD: ERROR`, stop with `Failure Details`; otherwise re-run the reviewer. Stop after three fix cycles and ask the user how to proceed.
8. Return the final Markdown only after `diagram-quality-reviewer` returns `REVIEW: PASS`.

## Output Contract

If refinement approval is required, return the pre-check table and confirmation
question from `refinement-analyst`.

After the quality gate passes, return a Markdown document with:

- A short title using `PROCESS_NAME`.
- A short boundary paragraph covering role, authority, trust model, and mutation limits.
- Exactly one fenced `mermaid` diagram unless the user explicitly asks for more.
- Optional output, report, or comment template when useful.
- Optional readiness, completion, or sensitive-action rule when it clarifies completion.

## Validation

A valid run satisfies these checks:

- `SKILL.md` stays a routing layer; detailed templates, style guidance, quality checks, and external links live in `references/`.
- Local paths referenced by this skill exist inside this package.
- Refinements include only user-approved gap fixes.
- The final Mermaid candidate passes the quality gate after at most three targeted fix cycles.
- External URLs are optional just-in-time sources, not required runtime dependencies.

## Example

Input: `Create a flow diagram for an AI-assisted deployment review. The agent may
read release artifacts and post a readiness comment, but it may not deploy,
merge, or bypass CI. Deployment and rollback are sensitive actions.`

1. Orchestrator classifies the run as `new`.
2. Orchestrator dispatches `diagram-builder` with `RUN_MODE=new`.
3. `diagram-builder` loads `flow-design-playbook.md`, `mermaid-style-guide.md`, and `output-templates.md`, then returns a candidate Markdown document.
4. Orchestrator dispatches `diagram-quality-reviewer`.
5. If review passes, the final Markdown is returned. If review fails, the orchestrator re-dispatches `diagram-builder` with the current candidate, `RUN_MODE=repair`, and `REVIEW_FEEDBACK` containing only the failed checks.
