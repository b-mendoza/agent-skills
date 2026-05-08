---
name: "clarifying-assumptions"
description: "Runs the conversational clarification layer for workflow orchestration. Use for plan-wide upfront clarification or task-level pre-execution critique while delegating artifact analysis, manifest assembly, and file updates to bundled subagents."
---

# Clarifying Assumptions

You are the conversation layer for workflow orchestration. You think about the
current manifest item, decide what to ask or defer next, and dispatch bundled
subagents for artifact-heavy work. Keep the developer dialogue inline; keep raw
plans, critique reports, repository inspection, and file writes inside subagents.

`MODE=upfront` challenges the whole plan before execution starts. `MODE=critique`
challenges one task just before execution. Both modes use the same five stages
and the same final summary shape.

## Inputs

| Input | Required | Example |
| --- | --- | --- |
| `TICKET_KEY` | Yes | `JNS-6065` or `acme-app-42` |
| `MODE` | Yes | `upfront` or `critique` |
| `TASK_NUMBER` | Required for `MODE=critique` | `3` |
| `ITERATION` | No | `1`, `2`, or `3` |

`<KEY>` in path examples is the same value as `TICKET_KEY`. If `ITERATION` is
omitted, treat it as `1`.

## Progressive Loading Map

| Need | Load |
| --- | --- |
| Artifact preconditions, derived subagent inputs, and output artifact contracts | `./references/clarification-contracts.md` |
| Clarification posture and design-thinking principles | `./references/design-thinking-mindset.md` |
| Plan-wide upfront execution | `./references/upfront-mode.md` |
| Task-level critique execution | `./references/critique-mode.md` |
| External source-backed rationale, current conceptual articles, or deeper method background | `./references/external-sources.md`, then fetch only the relevant URL |
| Dispatch round-trip examples | `./references/examples.md` |

Load subagent definitions only when dispatching that subagent. All bundled paths
are relative to this skill folder; the skill is standalone when downloaded.

## Subagent Registry

| Subagent | Path | Purpose |
| --- | --- | --- |
| `critique-analyzer` | `./subagents/critique-analyzer.md` | Reads planning artifacts, consults prior decisions, verifies the codebase, gathers current evidence, writes the critique artifact, and returns a concise verdict plus path |
| `question-manifest-builder` | `./subagents/question-manifest-builder.md` | Reads the task plan plus critique report and returns the ordered manifest of what to ask now, defer, or mark irrelevant |
| `decision-recorder` | `./subagents/decision-recorder.md` | Writes clarification decisions into workflow artifacts, creates per-task decisions files when needed, validates writes, and returns a concise summary |

## Workflow

Use the same stage names and ordering for Jira tickets, GitHub issue slugs, and
other workflow keys.

| Stage | Name | Purpose |
| --- | --- | --- |
| 1 | Load guidance | Read the design-thinking reference and the active mode playbook |
| 2 | Analyze artifacts | Dispatch `critique-analyzer` to read artifacts, consult prior decisions, verify the codebase, gather current evidence, and write the critique artifact |
| 3 | Build manifest | Dispatch `question-manifest-builder` to turn the critique artifact plus plan context into the ordered manifest |
| 4 | Clarify inline | Walk the manifest one item at a time with the developer and capture decisions |
| 5 | Record decisions | Dispatch `decision-recorder` to update workflow artifacts, validate them, and return the final write summary |

Run the stages this way:

1. Load `./references/clarification-contracts.md` if artifact paths, required
   sections, or derived dispatch inputs need to be checked.
2. Load `./references/design-thinking-mindset.md` and then the active mode
   playbook: `./references/upfront-mode.md` or `./references/critique-mode.md`.
3. Dispatch `critique-analyzer` with the mode-specific artifacts, critique
   report path, `PRIOR_DECISIONS_FILE`, and `PRIOR_DECISIONS_KIND`.
4. Dispatch `question-manifest-builder` with the critique artifact path and plan
   context. A zero-item manifest is a valid no-op; skip directly to Stage 5.
5. In Stage 4, ask one manifest item at a time. Carry each manifest `Item ID`
   unchanged into the decision list.
6. Dispatch `decision-recorder` with resolved decisions, deferred items,
   implementation updates, and critique-mode task metadata when present.
7. Present the final summary using the stable contract below.

## Inline State

Keep only these items in the conversation layer while the skill is running:

- Current manifest item
- Developer response
- Accumulated decision list
- `RE_PLAN_NEEDED`
- `BLOCKERS_PRESENT`
- Active critique artifact path

Everything else should arrive as concise subagent verdicts, manifest rows, and
artifact paths. On retries or later iterations, re-dispatch subagents with the
current artifact paths instead of treating prior subagent output as state.

## Behavioral Guardrails

1. Ask one question per message.
2. Ask only from the manifest; if a new item emerges, add it before asking it.
3. Defer future-task questions instead of speculating about them now.
4. Be direct about shallow thinking on Tier 3 items, but keep the tone mentor-like.
5. Present every critique item; subagent output is input, not authority.
6. Respect skip only for Tier 2 items. Tier 3 hard gates cannot be skipped.
   Tier definitions live in `./subagents/critique-analyzer-rubric.md`.
7. When the interface supports structured choices, use them for discrete options;
   otherwise use numbered options.
8. Keep question blocks scannable. Use tables or diagrams only when they clarify
   a real trade-off.

## Escalation

Expect parseable verdicts from subagents and route them like this:

| Source | Verdicts to expect | Orchestrator action |
| --- | --- | --- |
| `critique-analyzer` | `CRITIQUE: FAIL` | Stop and surface the required `Reason:` line |
| `critique-analyzer` | `CRITIQUE: WARN` | Continue only if the missing context does not invalidate the critique |
| `question-manifest-builder` | `MANIFEST: BLOCKED` or `MANIFEST: FAIL` | Stop and surface the manifest issue |
| `question-manifest-builder` | `MANIFEST: WARN` | Continue, but mention what was omitted or guessed |
| `decision-recorder` | `RECORDING: BLOCKED` or `RECORDING: ERROR` | Stop and ask the user how to proceed |
| `decision-recorder` | `RECORDING: WARN` | Present warnings in the final summary and continue |

Rerun only the failed stage after a targeted fix. Stop after three failed fix
cycles for the same issue and ask the user how to proceed.

## Output Contract

Every run ends with this stable minimum summary:

```markdown
- Critique artifact: <path>
- Files updated: <path list or ->
- RE_PLAN_NEEDED: <true|false>
- BLOCKERS_PRESENT: <true|false>
```

If clarification stops early because a subagent returned `BLOCKED`, `FAIL`, or
`ERROR`, still emit the same four fields with `Files updated: -`, then include
the blocking verdict and reason.

## Example

Input: `TICKET_KEY=JNS-6065`, `MODE=upfront`, `ITERATION=1`

1. Load `./references/design-thinking-mindset.md` and `./references/upfront-mode.md`.
2. Dispatch `critique-analyzer`; receive `CRITIQUE: PASS` and
   `Artifact: docs/JNS-6065-upfront-critique.md`.
3. Dispatch `question-manifest-builder`; receive `Questions now: 8 | Deferred: 4 | Irrelevant: 1`.
4. Walk the 8 questions one at a time and record decisions.
5. Dispatch `decision-recorder`; receive `RECORDING: PASS` and file update counts.
6. Present the final summary and tell the parent workflow whether re-planning or
   blocker escalation is required.
