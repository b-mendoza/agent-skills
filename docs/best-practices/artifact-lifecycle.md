# artifact-lifecycle

## Tier

`mandatory`. Every file-producing workflow must classify artifacts by runtime role, prove that run-local state is ignored and owned by the current run, and keep version-control authority separate from lifecycle classification.

## When it applies

Whenever a skill writes files: dispatch payloads, resume state, plans, reports, source code, tests, configs, documentation, snapshots, or generated output.

## The practice

Classify an artifact by the role it serves in this run, not by its file name or format. A plan, report, or YAML file can belong to different classes depending on who consumes it and why it persists.

| Class | Role | Persistence | Version-control status |
| --- | --- | --- | --- |
| A2 | Run-local dispatch payload: instructions, report handoff, retry payload | Keep only through its dispatch lifecycle | Outside version control |
| A1 | Internal resume/progress state needed beyond the current runtime session | Keep only while the stated persistence need exists | Outside version control |
| B | Durable user/project deliverable: source, tests, config, documentation, requested plan or report | Keep according to the user/project contract | Eligible for version control |
| P | Prohibited sensitive material: credentials, tokens, secret-bearing raw logs, unnecessary personal data | Do not write or persist | Never eligible |

**Classification is not authority.** Class B means only that the artifact is eligible for version control. Keeping, staging, committing, and pushing are separate decisions, each requiring the applicable user and repository authority. Lifecycle classification never grants commit or push authority and never instructs a workflow to perform either action.

**Make A1 conditional.** Modern runtimes often provide native session resumability. Add skill-authored A1 state only when the skill states a persistence need that native retention does not satisfy, such as cross-runtime handoff, resumption beyond runtime retention, or production of a durable deliverable whose work must survive independently. Without that need, keep state in the runtime rather than creating another file.

**Use run-scoped ownership.** Put A1 and A2 files under a path owned by one workflow run, normally:

```text
.handoffs/<skill>/<run-id>/
```

Derive `run-id` once and record the exact files the run creates. Before writing A1 or A2 in a Git repository, verify the chosen path is ignored:

```sh
git check-ignore --quiet -- ".handoffs/<skill>/<run-id>/<file>"
```

Exit zero passes. A nonzero result means the path is not proven ignored: move it to an already ignored workflow location or reclassify it as a Class B deliverable. Do not rely on an intended ignore rule that was not observed.

**Clean up only owned A2 files.** The detailed dispatch mechanics live in [handoff file dispatch](./handoff-file-dispatch.md). At minimum:

1. Confirm the dispatch or workflow is in a terminal state (`success`, `abandoned`, terminal `blocked`, or terminal `error`), not waiting for resumption.
2. Delete only paths recorded as created by this run. Never recursively clean a shared skill directory.
3. A run may list sibling run-directory names to detect stale work, but it never reads or deletes foreign run contents.
4. Retain A2 for debugging only through an explicit opt-in that names the retained files and cleanup condition.

`skills/improving-skill-definition/SKILL.md` is the in-repo pattern: it derives `HANDOFF_DIR`, lists stale runs without inspecting or deleting them, and applies outcome-dependent cleanup to its own run.

**Apply a checkable persistence filter.** Before writing or retaining A1 or A2, verify all of the following:

- The file contains only minimal structured state needed for routing or resumption.
- It contains no credentials, tokens, raw logs, full diffs, unnecessary personal data, or copied user/web/ticket/API payloads. Store a source path, digest, identifier, redacted fact, or concise summary instead.
- Debug retention was explicitly opted into for this run; otherwise the normal cleanup rule still applies.
- Class P content is excluded rather than merely labeled sensitive.

## Rationale

Role-based classification avoids a common category error: the same "plan" can be internal resume state in one workflow and the requested project deliverable in another. The consumer and persistence purpose, not the noun, determine its lifecycle.

Run-scoped ownership closes a concurrency failure. A shared `.handoffs/<skill>/` cleanup can delete another active session's payloads or interpret a stale report as current. A unique run directory plus an owned-file record makes deletion attributable and keeps foreign runs opaque.

The ignore check closes the gap between policy and repository state. A path described as "workflow-only" is still commit-visible unless the repository actually ignores it. The authority rule closes a separate gap: a durable deliverable may be commit-worthy, but that fact does not authorize changing version-control state.

## Concrete examples

Good: the workflow classifies by role, proves its run-local paths are ignored, and distinguishes an internal plan from a deliverable plan.

```text
.handoffs/ticket-planner/run-20260722T153000Z/
├── resume-plan.yaml                 (A1; internal cross-runtime resume state)
├── task-planner-instructions.yaml   (A2; this run's dispatch payload)
└── task-planner-report.yaml         (A2; this run's routeable report)

docs/PROJ-123-tasks.md               (B; requested durable plan; eligible only)
```

On a terminal result, the run deletes only the two A2 paths it recorded. It preserves `resume-plan.yaml` only if the stated resumption need still exists. It neither inspects nor deletes another `.handoffs/ticket-planner/<run-id>/` directory. No lifecycle rule stages, commits, or pushes `docs/PROJ-123-tasks.md`.

Bad: classification by noun and shared cleanup.

```text
docs/PROJ-123-tasks.md                (called "temporary" because it is a plan,
                                       despite being the requested output)
.handoffs/ticket-planner/report.yaml  (shared across all runs)
```

The workflow runs `rm -rf .handoffs/ticket-planner/`, deleting an active parallel run, then treats the deliverable plan as forbidden internal state. It also assumes "deliverable" means "commit now." All three conclusions violate the lifecycle contract.

**Pass/fail authoring checklist**

- [ ] Every written artifact is classified by role as A2, A1, B, or P.
- [ ] Every A1 file names a persistence need beyond native session state.
- [ ] Every A1/A2 path has a passing observable ignore check.
- [ ] Cleanup is terminal-state-gated and limited to this run's recorded files.
- [ ] Persisted state passes the content filter; debug retention is opt-in.
- [ ] Class B says "eligible" and grants no keep/stage/commit/push authority.

## References

- OWASP Top 10 for LLM Applications, accessed 2026-05-27: <https://owasp.org/www-project-top-10-for-large-language-model-applications/>. Supports treating sensitive information disclosure and prompt injection as risks in agent workflows.
- NIST AI Risk Management Framework, accessed 2026-05-27: <https://www.nist.gov/itl/ai-risk-management-framework>. Supports risk-based governance and lifecycle management for AI systems.
