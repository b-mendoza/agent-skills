# Clarifying Assumptions Specification

> **This document is the canonical reference for the `clarifying-assumptions`
> skill — the shared conversational clarification layer used by both the Jira
> and GitHub workflow orchestrators.**
>
> When you change the skill's contracts, escalation policy, mode workflows,
> or behavioral guardrails, change **this document first**, then propagate the
> change to the skill files. See the _Change protocol_ section at the bottom.

## 1. Purpose and scope

This spec defines the **harness-agnostic, platform-agnostic clarification
skill** that both workflow orchestrators invoke:

- `skills/orchestrating-jira-workflow/` — invokes at Phase 3 and Phase 6
- `skills/orchestrating-github-workflow/` — invokes at Phase 3 and Phase 6

The skill runs **two modes per invocation**: upfront (Phase 3, whole-plan
critique before execution) and critique (Phase 6, single-task critique just
before execution). It keeps the mentoring dialogue inline while delegating
artifact reading, critique generation, manifest assembly, and file updates to
subagents.

### What this spec covers

- Platform-agnosticism contract (the `TICKET_KEY` bridge)
- Required input shape and upstream artifacts by mode
- Output contract
- Subagent registry and dispatch contracts
- Mode-specific workflow summaries (upfront and critique)
- Escalation routing policy
- Behavioral guardrails
- Artifact lifecycle
- What the skill **may** customize vs what it **must not**

### What this spec does not cover

- The individual prose of each reference file or subagent definition. The
  skill may word instructions differently as long as the behavior, contracts,
  and outputs match this spec.
- The parent orchestrator's logic. This spec covers only the shared
  clarification skill.
- Platform mutation details (Jira transitions, GitHub label changes). Those
  belong inside the platform-specific orchestrator or execution skills, not
  in this skill.

## 2. Harness-agnosticism requirements

The skill must run on **OpenCode, Cursor, and Claude Code** without
modification. The same rules from the execution-pipeline spec apply:

1. **Do not name runtime-specific tools.** Say "dispatch to a subagent", not
   "use the Task tool" or "use the Agent tool".
2. **Do not assume harness-specific frontmatter.** Fields like
   `allowed-tools`, `model`, or `tools` are optional and must not be treated
   as contract.
3. **Do not encode harness-specific scaffolding.** No `TODO(human)`, no
   "learning mode" placeholders, no CLI-specific banner formats.
4. **Prefer relative file paths** over anything that resolves differently
   across harnesses.

## 3. Platform-agnosticism requirements

This skill serves both Jira and GitHub workflows through a single codebase.
Platform-agnosticism is enforced by these rules:

1. **The `TICKET_KEY` bridge.** The skill accepts a single `TICKET_KEY` input
   that can be a Jira ticket key (e.g., `JNS-6065`) or a GitHub issue slug
   (e.g., `acme-app-42`). The calling orchestrator is responsible for mapping
   its native identifier to `TICKET_KEY`. The GitHub orchestrator sets
   `TICKET_KEY = ISSUE_SLUG`.

2. **No platform names in behavioral prose.** Reference files, subagent
   instructions, rubrics, and templates must not say "Jira", "GitHub", `gh`,
   or name any platform-specific integration. The one exception is the
   SKILL.md description paragraph, which names both platforms to explain the
   `TICKET_KEY` bridge.

3. **Examples must represent both platforms.** Where the skill has multiple
   examples, at least one must use a Jira-flavored key and at least one must
   use a GitHub-flavored slug. The convention is: upfront-mode examples use
   Jira keys; critique-mode examples use GitHub slugs.

4. **Artifact paths are platform-neutral.** All artifact paths use
   `docs/<TICKET_KEY>-...` which resolves to the correct platform identifier
   regardless of origin.

5. **Subagent frontmatter descriptions must not name a platform.** A user
   browsing subagent descriptions should not see "Jira" or "GitHub" — the
   subagents serve both workflows identically.

## 4. Vocabulary

| Placeholder | Meaning | Jira value | GitHub value |
| --- | --- | --- | --- |
| `TICKET_KEY` | The universal task identifier | `JNS-6065` | `acme-app-42` |
| `<KEY>` | Shorthand for `TICKET_KEY` in path patterns | Same | Same |
| `<N>` | Task number | `3` | `3` |

The skill does not use `ISSUE_SLUG`, `JIRA_URL`, or `ISSUE_URL` directly.
Those are orchestrator-level inputs that get mapped to `TICKET_KEY` before
this skill is invoked.

## 5. Required input shape

| Input | Required | Notes |
| --- | --- | --- |
| `TICKET_KEY` | Yes | Jira key or GitHub issue slug. |
| `MODE` | Yes | `upfront` or `critique`. |
| `TASK_NUMBER` | Required for `MODE=critique` | Exactly one task per critique invocation. |
| `ITERATION` | No | Defaults to `1`. Incremented on re-runs. |

## 6. Upstream artifacts

### Upfront mode (Phase 3)

| Path pattern | Required | Purpose |
| --- | --- | --- |
| `docs/<KEY>-tasks.md` | Yes | Main task plan with required plan sections. |
| `docs/<KEY>-stage-1-detailed.md` | Yes | Stage 1 planning intermediate. |
| `docs/<KEY>-stage-2-prioritized.md` | Yes | Stage 2 planning intermediate. |

### Critique mode (Phase 6)

| Path pattern | Required | Purpose |
| --- | --- | --- |
| `docs/<KEY>-tasks.md` | Yes | Main task plan. |
| `docs/<KEY>-task-<N>-brief.md` | Yes | Task scope, context, Definition of Done. |
| `docs/<KEY>-task-<N>-execution-plan.md` | Yes | Approved implementation approach. |
| `docs/<KEY>-task-<N>-test-spec.md` | Yes | Required behavior coverage. |
| `docs/<KEY>-task-<N>-refactoring-plan.md` | Yes | Approved structural prep and cleanup. |

### Required plan sections

The main plan file at `docs/<KEY>-tasks.md` must contain:

| Section | Used for |
| --- | --- |
| `## Problem Framing` | Tier 3 hard-gate questions and user-impact context |
| `## Assumptions and Constraints` | Assumptions to confirm, revise, or defer |
| `## Cross-Cutting Open Questions` | Plan-wide blocking questions |
| `## Tasks` | Task-specific questions and assumptions |
| `## Validation Report` | Validation `FAIL` and `WARN` items |
| `## Dependency Graph` | Impact mapping and downstream task references |

## 7. Output contract

This skill updates orchestration artifacts only. It does not produce
implementation code.

| Artifact | Mode | Required result |
| --- | --- | --- |
| `docs/<KEY>-upfront-critique.md` | upfront | Full critique report written before manifest assembly |
| `docs/<KEY>-task-<N>-critique.md` | critique | Full task-level critique report |
| `docs/<KEY>-tasks.md` updates | both | Main plan updated with decision markers, deferred tags, and resolved items |
| `## Decisions Log` rows | both | Durable audit trail in the main plan |
| Deferred question tags | upfront | Phase 6 can identify which questions to revisit |
| `docs/<KEY>-task-<N>-decisions.md` | critique | Per-task decisions record for re-planning and execution |
| `RE_PLAN_NEEDED` flag | both | Signals whether planning should be re-run before execution |
| `BLOCKERS_PRESENT` flag | both | Signals that clarification ended with unresolved items |

All outputs are orchestration artifacts. They stay out of version control.

## 8. Subagent registry and dispatch contracts

### Registry

| Subagent | Path | Purpose |
| --- | --- | --- |
| `critique-analyzer` | `./subagents/critique-analyzer.md` | Reads planning artifacts, verifies the codebase, searches the web, writes structured critique |
| `question-manifest-builder` | `./subagents/question-manifest-builder.md` | Reads plan + critique report, returns ordered manifest of what to ask now/defer/discard |
| `decision-recorder` | `./subagents/decision-recorder.md` | Writes decisions to workflow artifacts, validates the result |

### Supporting files (loaded by critique-analyzer on demand)

| File | Path | When loaded |
| --- | --- | --- |
| Rubric | `./subagents/critique-analyzer-rubric.md` | Before deciding what to critique (step 2) |
| Template | `./subagents/critique-analyzer-template.md` | At artifact write time (step 5) |

### Dispatch contracts

**`critique-analyzer`**

| Input | Required | Upfront | Critique |
| --- | --- | --- | --- |
| `MODE` | Yes | `upfront` | `critique` |
| `TICKET_KEY` | Yes | Yes | Yes |
| `MAIN_PLAN_FILE` | Yes | `docs/<KEY>-tasks.md` | `docs/<KEY>-tasks.md` |
| `ARTIFACTS` | Yes | stage-1, stage-2 | brief, execution-plan, test-spec, refactoring-plan |
| `CRITIQUE_REPORT_FILE` | Yes | `docs/<KEY>-upfront-critique.md` | `docs/<KEY>-task-<N>-critique.md` |
| `TASK_NUMBER` | Critique only | — | `<N>` |
| `PRIOR_DECISIONS_FILE` | When `ITERATION > 1` | `docs/<KEY>-tasks.md` | `docs/<KEY>-task-<N>-decisions.md` |
| `PRIOR_DECISIONS_KIND` | When prior decisions provided | `main-log` | `per-task` |

**`question-manifest-builder`**

| Input | Required | Upfront | Critique |
| --- | --- | --- | --- |
| `MODE` | Yes | `upfront` | `critique` |
| `TICKET_KEY` | Yes | Yes | Yes |
| `PLAN_FILE` | Yes | `docs/<KEY>-tasks.md` | `docs/<KEY>-tasks.md` |
| `CRITIQUE_REPORT_FILE` | Yes | `docs/<KEY>-upfront-critique.md` | `docs/<KEY>-task-<N>-critique.md` |
| `TASK_NUMBER` | Critique only | — | `<N>` |
| `CURRENT_TASK_ARTIFACTS` | Critique only | — | brief, execution-plan, test-spec, refactoring-plan |

**`decision-recorder`**

| Input | Required | Upfront | Critique |
| --- | --- | --- | --- |
| `TICKET_KEY` | Yes | Yes | Yes |
| `MODE` | Yes | `upfront` | `critique` |
| `ITERATION` | No (default `1`) | Yes | Yes |
| `DECISIONS` | Yes | Resolved decisions | Resolved decisions |
| `TASK_NUMBER` | Critique only | — | `<N>` |
| `TASK_TITLE` | Critique only | — | From manifest |
| `DEFERRED_QUESTIONS` | Optional | Deferred to later tasks | — |
| `RESOLVED_IRRELEVANT` | Optional | — | Items no longer applicable |
| `IMPLEMENTATION_UPDATES` | Optional | Implementation-note edits | Implementation-note edits |

## 9. Mode workflows

### Upfront mode (Phase 3)

1. Load `design-thinking-mindset.md` then `upfront-mode.md`.
2. Dispatch `critique-analyzer` with upfront inputs. Handle verdicts per the
   escalation table.
3. Dispatch `question-manifest-builder` with the critique artifact path.
   Handle verdicts.
4. Present the manifest summary to the developer, then walk items one at a
   time.
5. Dispatch `decision-recorder` with all resolved decisions and deferred
   questions.
6. Present the final summary with `RE_PLAN_NEEDED` and `BLOCKERS_PRESENT`
   flags.

### Critique mode (Phase 6)

1. Load `design-thinking-mindset.md` then `critique-mode.md`.
2. Dispatch `critique-analyzer` with critique inputs. Handle verdicts.
3. Dispatch `question-manifest-builder` with the critique artifact path and
   current task artifacts. Handle verdicts.
4. Present the task manifest summary, then walk items one at a time.
5. Dispatch `decision-recorder` with resolved decisions, irrelevant items,
   and implementation updates.
6. Present the final summary with `RE_PLAN_NEEDED` and `BLOCKERS_PRESENT`
   flags.

### Questioning models

| Model | Used for | Flow |
| --- | --- | --- |
| **A — Socratic** | Tier 3 problem-framing hard gates only | Developer answers first, then sees the critique |
| **B — Evaluate reasoning** | All other items | Present original decision + critique, ask if reasoning holds |

## 10. Escalation routing

The orchestrator uses this table to route subagent verdicts:

| Source | Verdict | Action |
| --- | --- | --- |
| `critique-analyzer` | `CRITIQUE: FAIL` | Stop and surface the reason |
| `critique-analyzer` | `CRITIQUE: WARN` | Continue only if the warning does not invalidate the critique |
| `question-manifest-builder` | `MANIFEST: BLOCKED` or `MANIFEST: FAIL` | Stop and surface the manifest issue |
| `question-manifest-builder` | `MANIFEST: WARN` | Continue, but mention what was omitted or guessed |
| `decision-recorder` | `RECORDING: BLOCKED` or `RECORDING: ERROR` | Stop and ask the user how to proceed |
| `decision-recorder` | `RECORDING: WARN` | Present the warnings in the final summary and continue |

### Subagent-level escalation

Each subagent defines its own failure categories and verdict formats:

**`critique-analyzer`** — judgment-heavy escalation. Web search unavailability
is `FAIL`, not graceful degradation, because the subagent exists to correct
training-data bias.

| Failure | Verdict |
| --- | --- |
| Web search unavailable | `FAIL` |
| Codebase cannot be verified | `FAIL` |
| `MAIN_PLAN_FILE` missing | `FAIL` |
| All mode-specific artifacts missing | `FAIL` |
| `CRITIQUE_REPORT_FILE` write fails | `FAIL` |
| Some artifacts missing | `WARN` |
| Prior decisions file missing | `WARN` |

**`question-manifest-builder`** — utility escalation.

| Failure | Verdict |
| --- | --- |
| `PLAN_FILE` missing | `BLOCKED` |
| `TASK_NUMBER` section missing (critique) | `BLOCKED` |
| `CURRENT_TASK_ARTIFACTS` missing (critique) | `BLOCKED` |
| `CRITIQUE_REPORT_FILE` missing | `BLOCKED` |
| `CRITIQUE_REPORT_FILE` malformed | `FAIL` |
| Required plan section missing | `WARN` |
| No items remain after filtering | `PASS` (zero-item manifest) |

**`decision-recorder`** — utility escalation.

| Failure | Verdict |
| --- | --- |
| Main plan missing | `BLOCKED` |
| Per-task metadata missing (critique) | `BLOCKED` |
| Question/assumption text not found | `WARN` |
| Filesystem write error | `ERROR` |

## 11. Behavioral guardrails

1. Ask one question per message.
2. Ask only from the manifest; if a new item emerges, add it before asking.
3. Defer future-task questions instead of speculating.
4. Be direct about shallow thinking on Tier 3 items, but keep a mentor tone.
5. Present every critique item; do not silently accept a subagent
   recommendation.
6. Respect skip only for Tier 2 items. Tier 3 hard gates cannot be skipped.
7. Use selection widgets for discrete choices when available; otherwise use
   numbered options.
8. Keep question blocks scannable. Use tables or diagrams only when they
   clarify a real trade-off.

### Recording rules

| Developer response | Canonical outcome | `RE_PLAN_NEEDED` | `BLOCKERS_PRESENT` | Behavior |
| --- | --- | --- | --- | --- |
| `Keep current approach` / `Confirm` | `confirmed` | — | — | Record and continue |
| `Switch to <alternative>` / `Revise` | `revised` | `true` | — | Record and continue |
| `I need more information` / `Action needed` | `blocked` | `true` | `true` | Record and stop |
| `Acknowledge but proceed` | `override` | — | — | Record as override, no re-plan |
| `Skip` (Tier 2 only) | `skipped` | — | — | Record fallback and warning |
| `Resolved` | `resolved` | — | — | Record and continue |

## 12. Artifact lifecycle

All artifacts produced by this skill are **Category A** (orchestration
artifacts):

- `docs/<KEY>-upfront-critique.md`
- `docs/<KEY>-task-<N>-critique.md`
- `docs/<KEY>-task-<N>-decisions.md`
- Updates to `docs/<KEY>-tasks.md` (decision markers, deferred tags)

These are never committed to version control, never deleted, and are
preserved across sessions for resumability.

## 13. Divergence register

### Locked to this spec

The following aspects are locked. The skill files may word them differently
but the behavior must match:

- Required input shape (section 5)
- Upstream artifact requirements by mode (section 6)
- Required plan sections (section 6)
- Output contract (section 7)
- Subagent dispatch contracts (section 8)
- Mode workflow sequences (section 9)
- Questioning models A and B (section 9)
- Escalation routing table (section 10)
- Subagent escalation categories and verdicts (section 10)
- Behavioral guardrails (section 11)
- Recording rules and canonical outcome mapping (section 11)
- Artifact lifecycle (section 12)

### Platform-neutral by design

The following must remain platform-neutral (no Jira, GitHub, `gh`, or
platform-specific integration references):

- All reference files (`design-thinking-mindset.md`, `upfront-mode.md`,
  `critique-mode.md`)
- All subagent definitions (`critique-analyzer.md`,
  `question-manifest-builder.md`, `decision-recorder.md`)
- All subagent supporting files (`critique-analyzer-rubric.md`,
  `critique-analyzer-template.md`)
- All subagent frontmatter descriptions

The rubric and template are abstract by nature (severity levels, output
structure, placeholders). They define critique dimensions and report
formatting, not platform interactions.

### Allowed to name platforms

Only these locations may reference Jira, GitHub, or platform-specific
terminology:

- **SKILL.md description paragraph** — to explain the `TICKET_KEY` bridge
  and name both platforms the skill serves
- **SKILL.md input table** — to show example values for both platforms

### Conventions (encouraged)

These are representation guidelines, not behavioral contracts. They improve
consistency but are not grounds for blocking a change.

**Example distribution:** Where the skill or a subagent has multiple example
blocks, at least one should use a Jira-flavored key and at least one should
use a GitHub-flavored slug. The current convention is:

- Upfront-mode examples → Jira key (e.g., `JNS-6065`)
- Critique-mode examples → GitHub slug (e.g., `acme-app-42`)

This convention extends to subagent output examples. A subagent that only
has one example (e.g., upfront-mode only) is not required to add a second
example for platform representation — the SKILL.md-level examples already
cover both platforms.

## 14. Change protocol

When the clarification skill needs to change, follow this order:

1. **Update this spec first.** Edit the relevant section(s) and the
   divergence register if the change affects what may differ.
2. **Update the skill files** to match. Touch `SKILL.md`, the reference
   files, and any affected subagents.
3. **Verify alignment.** Re-read the skill's `SKILL.md`, both mode
   playbooks, and all three subagent definitions. Confirm they express the
   same contract in the same order. Check the divergence register to ensure
   no platform-specific language leaked into locked-neutral files.
4. **Do not split this skill into platform-specific variants.** The
   `TICKET_KEY` bridge exists so both orchestrators share a single
   clarification codebase. If a behavior truly differs by platform, it
   belongs in the calling orchestrator, not in this skill.

This spec is intentionally denser than the skill files. It exists to be read
by the human author (or a future agent) at change time, not every invocation.
The skill does not load this file during normal operation.
