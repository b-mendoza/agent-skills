# Execution Pipeline Harmonization Spec - Issue/Ticket Fetching

> Canonical reference for the final harmonized baseline between `skills/fetching-github-issue` and `skills/fetching-jira-ticket`.
>
> This document is audit and change-control guidance only. The skills, retrievers, and bundled templates remain self-contained and must not depend on this file at runtime.

---

## Scope

- Record the shared contract definitions, shared execution flow, dispatch boundaries, intentional platform divergences, and change-control decisions established in this harmonization pass.
- Cover these runtime artifacts:
  - `skills/fetching-github-issue/SKILL.md`
  - `skills/fetching-github-issue/subagents/issue-retriever.md`
  - `skills/fetching-github-issue/subagents/issue-retriever-template.md`
  - `skills/fetching-jira-ticket/SKILL.md`
  - `skills/fetching-jira-ticket/subagents/ticket-retriever.md`
  - `skills/fetching-jira-ticket/subagents/ticket-retriever-template.md`
- Preserve the rule that runtime truth stays in the skill-local files above. This spec documents the harmonized state; it does not replace skill-local contracts.

---

## Skills Covered

| Platform | Coordinator skill | Retriever | Template | Primary artifact |
| -------- | ----------------- | --------- | -------- | ---------------- |
| GitHub | `skills/fetching-github-issue/SKILL.md` | `issue-retriever` | `issue-retriever-template.md` | `docs/<ISSUE_SLUG>.md` |
| Jira | `skills/fetching-jira-ticket/SKILL.md` | `ticket-retriever` | `ticket-retriever-template.md` | `docs/<TICKET_KEY>.md` |

---

## Final Harmonized Baseline

| Area | Authoritative baseline |
| ---- | ---------------------- |
| Structural alignment | The two skills were already structurally close and contractually sound before this pass. |
| Dispatch boundary | No broken coordinator/subagent boundary was found. |
| Output contract | No broken `FETCH` / `Validation` / failure-category contract was found. |
| Main transport divergence | GitHub intentionally hard-requires `gh` / `gh api`; Jira intentionally uses tool discovery and schema-driven selection. |
| Input asymmetry | GitHub accepts `ISSUE_URL` or `OWNER` / `REPO` / `ISSUE_NUMBER`; Jira accepts `JIRA_URL` only. This asymmetry is intentional and preserved. |
| Documentation drift | Low-severity drift existed in the second coordinator example in `skills/fetching-github-issue/SKILL.md`. Only one approved example fix was applied in Phase 2. |

---

## Shared Execution Pipeline

1. The coordinator receives a parent issue or ticket reference in one of the accepted platform-specific input shapes: URL-style input for both skills, or explicit `OWNER` / `REPO` / `ISSUE_NUMBER` coordinates for GitHub, and derives only the identifiers needed to dispatch the retriever.
2. The coordinator reads the bundled retriever definition only when it is about to dispatch it.
3. The coordinator dispatches exactly one retrieval specialist for the run.
4. The retriever validates input and establishes the stable local identifier used for the artifact path.
5. The retriever verifies read-path readiness before the first parent read.
6. The retriever fetches the parent item, parent comments, and parent-level metadata needed for the snapshot.
7. The retriever discovers and hydrates related items, making every gap explicit through warnings, unknown markers, or `Not retrieved` placeholders rather than silent omission.
8. The retriever loads the bundled template only at document assembly, writes the snapshot artifact under `docs/`, and leaves it in place as a resumability artifact.
9. The retriever re-reads the written artifact and runs a targeted validate -> repair -> re-check loop with a maximum of 3 passes.
10. The retriever returns only the structured summary.
11. The coordinator branches only on structured result fields and relays file path, identity, counts, warnings, and failure details without inspecting raw tracker payloads or rewriting the artifact.

---

## Subagent Dispatch Conventions and Orchestrator Boundaries

- The coordinator's direct responsibilities are limited to reading its bundled skill/subagent files, deriving identifiers from the input contract, dispatching the retriever, and relaying the retriever's structured summary.
- The coordinator does not inspect raw GitHub or Jira payloads, does not rewrite the generated artifact, and does not infer state from free-form prose when machine-readable fields are present.
- The retriever owns tool or transport readiness checks, auth checks, parent and related-item retrieval, pagination, document assembly, validation, targeted repair, and cleanup decisions.
- The bundled template is read only at assembly time. It is the literal runtime output contract for the corresponding retriever.
- Raw API payloads, exploratory output, and full artifact contents are intentionally kept out of the caller's retained context. Only structured summaries are handed back across the boundary.
- This spec file must not be introduced as a runtime read step for either fetching skill. Keeping the skills self-contained is part of the harmonized contract.

---

## Shared Contracts and Semantics

### Shared artifact contract

| Rule | Harmonized baseline |
| ---- | ------------------- |
| Artifact location | The primary snapshot is written under `docs/` using the platform-specific identifier. |
| Template authority | The bundled template file inside each skill is the runtime output contract. No external spec file is required at runtime. |
| Required top-level headings | Every top-level heading from the bundled template must appear in the artifact. |
| Nested headings | Repeated nested headings appear only when an item exists or when a `Not retrieved` placeholder is required. |
| Verified empty state | `_None_` means the retriever positively verified that the section or scalar is empty. |
| Unknown state | `_Unknown. ..._` markers mean the parent item was retrieved, but discovery or capability was insufficient to verify whether a section was empty. |
| Partial related-item hydration | If a related item is known but not fully retrievable, the artifact must contain both a warning and a placeholder entry. |
| Preservation | The artifact is a resumability document. It is written, validated, and preserved in place, but not staged or committed as implementation history. |

### Locked shared section order

The paired skills share this locked core order:

1. `## Metadata`
2. `## Description`
3. `## Acceptance Criteria`
4. `## Comments`
5. `## Retrieval Warnings`
6. Platform slot: `## Child Issues` on GitHub or `## Subtasks` on Jira
7. `## Linked Issues`

Platform-extension sections may follow after that locked shared core.

### Structured result contract

| Field | Canonical meaning |
| ----- | ----------------- |
| `FETCH: PASS` | Retrieval succeeded, the artifact was written, and validation passed without requiring a partial state. |
| `FETCH: PARTIAL` | The artifact was written and validated, but some comments or related items were not fully retrievable, or discovery for a related section could not be fully verified after the parent item was retrieved. |
| `FETCH: FAIL` | A deterministic failure prevented successful retrieval, such as bad input, not found, auth failure, missing required tools, or exhausted rate-limit retries. |
| `FETCH: ERROR` | An unexpected tool, environment, or post-write validation-loop failure occurred. |
| `Validation: PASS` | The written artifact satisfies the bundled template contract. |
| `Validation: FAIL` | The artifact was written but still violates the template contract after the repair loop. In this pair, that is paired with `FETCH: ERROR` and `Failure category: UNEXPECTED`. |
| `Validation: NOT_RUN` | Retrieval failed before validation could run. |
| `Failure category` | The shared category set is `NONE`, `BAD_INPUT`, `NOT_FOUND`, `AUTH`, `TOOLS_MISSING`, `RATE_LIMIT`, and `UNEXPECTED`. |

### Count semantics

| Count form | Canonical meaning |
| ---------- | ----------------- |
| `0/0` | The retriever positively verified that no items exist in that section. |
| `<retrieved>/<known_total>` | The total number of related identities is known, but some items were not fully hydrated. This is the canonical paired coordinator `SKILL.md` `FETCH: PARTIAL` example model for this harmonized pair. |
| `<retrieved>/UNKNOWN` | The parent item was retrieved, but discovery for that section could not be verified. This remains a valid runtime partial state, including in retriever examples, but it is not the canonical paired coordinator `SKILL.md` example model for this pass. |
| `N/A` | The parent item was not retrieved, so downstream retrieval for that section never ran. |
| `Attachments: <N>` | The number of rendered entries under `## Attachments`. Use `Attachments: N/A` when the parent item was not retrieved. |

- `Comments` counts refer to parent comments only.
- Related-item counts refer to identities discovered from the parent item or from reads keyed off that parent item.
- Partial comment retrieval requires both a warning and the terminal partial marker inside the affected `## Comments` or `#### Comments` section.
- Any inconsistent status pairing, such as `FETCH: PASS` with `Validation: NOT_RUN`, is treated by the coordinator as an error condition and must not be normalized away.

### Repair-loop expectations

- The retriever writes the artifact first, then re-reads it and validates it against the bundled template.
- Repairs are targeted to the missing or mismatched portions only.
- The maximum repair budget is 3 passes.
- If the artifact still fails validation after the repair loop, the final result is `FETCH: ERROR`, `Validation: FAIL`, and `Failure category: UNEXPECTED`.

---

## Intentional Platform Divergences

| Area | GitHub baseline to preserve | Jira baseline to preserve |
| ---- | --------------------------- | ------------------------- |
| Transport | Hard requirement on `gh` and `gh api`, plus explicit `gh` usability and auth checks | Runtime discovery of Jira-capable read tools, with schema inspection before use and deterministic tool selection |
| Accepted inputs | `ISSUE_URL` preferred; fallback `OWNER` / `REPO` / `ISSUE_NUMBER` accepted | `JIRA_URL` only |
| Artifact identifier | `ISSUE_SLUG` | `TICKET_KEY` |
| Locked platform slot | `## Child Issues` | `## Subtasks` |
| Parent summary fields | `Issue: <owner>/<repo>#<N>: ...` and `State: ...` | `Ticket: <TICKET_KEY>: ...` and `Status: ... | Type: ...` |
| Acceptance-criteria source | Issue body sections only | Dedicated Jira field first, then description-body sections |
| Platform extensions | `## Labels`, `## Assignees`, `## Milestone`, `## Projects`, `## Attachments` | `## Attachments`, `## Custom Fields`, plus richer Jira metadata rows |
| Extra partial case | `## Projects` may force `FETCH: PARTIAL` when membership cannot be determined because the required GitHub capability is unavailable | `## Attachments` and `## Custom Fields` come from the parent ticket payload and do not create a separate unknown-discovery state |

These differences are native to the platforms and were explicitly preserved in this harmonization pass.

---

## Decisions From This Harmonization Pass

### Phase 0 findings

- The two skills were already structurally close and contractually sound.
- No broken dispatch boundary or output contract was found.
- The main observed divergence was transport strategy: GitHub hard-requires `gh` / `gh api`, while Jira uses tool discovery.
- A low-severity input asymmetry existed: GitHub accepted `ISSUE_URL` or `OWNER` / `REPO` / `ISSUE_NUMBER`, while Jira accepted `JIRA_URL` only.
- Low-severity documentation drift existed in the second coordinator example in `skills/fetching-github-issue/SKILL.md`.

### Phase 1 authoritative decisions

- GitHub's `gh` / `gh api` requirement is an intentional hard requirement and is not to be harmonized away.
- Platform-native differences are intentional and preserved, including:
  - GitHub inputs: `ISSUE_URL` or `OWNER` / `REPO` / `ISSUE_NUMBER`
  - Jira input: `JIRA_URL`
  - GitHub `## Child Issues` vs Jira `## Subtasks`
- Editorial and symmetry-only fixes may be applied autonomously.
- Any change to accepted inputs, output headings or schema, failure semantics, or tool requirements requires explicit user confirmation first.
- Documentation-only parity additions beyond explicitly approved changes were not authorized.
- The canonical paired coordinator `SKILL.md` `FETCH: PARTIAL` example model for this pair is the Jira-style known-item retrieval gap or partial-hydration case using `<retrieved>/<known_total>`, not the discovery-gap `0/UNKNOWN` case.
- Retriever examples were intentionally left free to show other valid partial states, including `0/UNKNOWN`, when those examples match runtime semantics.

---

## Approved Change Applied in Phase 2

- One and only one coordinator-example change was applied during Phase 2.
- `skills/fetching-github-issue/SKILL.md` had its second coordinator example rewritten from a discovery-gap `FETCH: PARTIAL` case (`0/UNKNOWN`) to a GitHub-native known-child retrieval gap case (`1/2`).
- The purpose of that change was to align the coordinator-level canonical `FETCH: PARTIAL` example with the approved paired model while preserving GitHub-native terminology and output shape.
- Retriever examples were intentionally left unchanged.
- No changes were made to accepted inputs, headings or schema, failure semantics, tool requirements, or the intentional platform divergences recorded above.

---

## Non-goals / Change-Control Boundaries

- Do not make either fetching skill, retriever, or template depend on this spec file at runtime.
- Do not replace the bundled skill-local templates with a shared external template unless separately approved.
- Do not harmonize away GitHub's `gh` / `gh api` requirement.
- Do not broaden, narrow, or otherwise change accepted inputs without explicit approval.
- Do not rename or collapse the platform-slot headings `## Child Issues` and `## Subtasks`.
- Do not change `FETCH`, `Validation`, failure-category meanings, count semantics, placeholder rules, unknown-marker rules, or repair-loop semantics without explicit approval.
- Do not treat symmetry as a reason to remove platform-native metadata, sections, or retrieval behaviors that are intentionally different.
- Do not apply documentation-only parity additions beyond the explicitly approved scope of the harmonization pass.
- Do not treat the discovery-gap `0/UNKNOWN` state as invalid. It remains a valid runtime partial state; it is simply not the canonical paired coordinator `SKILL.md` example model for this pass.

---

## Future Harmonization Checklist

- Is the proposed change purely editorial or symmetry-only? If not, stop and get explicit user approval.
- Does the change alter accepted inputs, output headings or schema, failure semantics, tool requirements, or an intentional platform divergence? If yes, stop and get explicit user approval.
- Does each skill remain self-contained, with its bundled retriever and bundled template still authoritative at runtime?
- If coordinator `SKILL.md` examples are being edited, does the paired canonical `FETCH: PARTIAL` example remain the known-item retrieval gap model using `<retrieved>/<known_total>`?
- If partial semantics are touched, do warnings, unknown markers, placeholder entries, and count lines still agree with one another?
- Can the coordinator still branch only on structured result fields without inspecting raw payloads, full artifact bodies, or this spec file?
- Is the proposed diff limited to the minimum approved surface area?
