# Handoff-File Subagent Dispatch

## What it is

When an orchestrator dispatches a subagent, the subagent's instructions live in
a bundled handoff file on disk that the subagent reads as its first action.
The dispatch call itself only points the subagent at the file. After the
subagent completes the work the file describes, the orchestrator deletes the
file.

This is the pattern:

1. Orchestrator writes a markdown file containing the subagent's complete
   payload — instructions, inputs, constraints, references, output contract,
   stop conditions — to a predictable per-skill path.
2. Orchestrator dispatches the subagent with a short prompt that names the
   file path and instructs the subagent to read it first and follow it
   strictly.
3. Subagent reads the file, executes against its contents, and returns the
   contracted output.
4. Orchestrator consumes the output and deletes the handoff file as part of
   the same dispatch step's cleanup.

## Why it matters

Two grounded reasons.

**Runtime reliability.** Large inline dispatch prompts fail at the tool-call
boundary. When an orchestrator builds a subagent prompt by concatenating an
audit report, an approved-gap list, a personality decision, a quality-gate
plan, a flow-diagram candidate, and a mutation-limits block, the resulting
argument can break the dispatch tool's JSON serializer with errors like
`Expected ',' or '}' after property value`. The dispatch never reaches the
subagent. The orchestrator either retries (wasting tokens) or falls back to
inline execution (losing the architectural boundary the subagent was supposed
to enforce). This was first encountered in this repo while improving
`committing-scoped-changes`: three back-to-back editor-subagent dispatches
failed for exactly this reason, and the only safe recovery was to abandon the
subagent and apply edits directly. The handoff-file pattern eliminates the
failure mode because the dispatch argument no longer carries the payload — it
carries a path.

**Authoring capacity.** Inline prompts are implicitly capped by the runtime's
tool-call size limit. That cap silently constrains how many rules,
constraints, references, examples, and stop conditions an orchestrator can
hand to a subagent. Moving the payload to a file removes the cap: the
orchestrator can prescribe a long, precise, example-rich contract without
worrying about argument size. The dispatch call itself stays compact and
predictable.

A third, smaller benefit: the handoff file is auditable. After the run, the
orchestrator can — for as long as the file exists — show the user the exact
payload that was passed to the subagent, which is useful when debugging
unexpected subagent behavior.

## Rules

1. **Path is predictable, per-skill, per-subagent.** Resolve a workspace or
   repository root once, set `HANDOFF_DIR` to
   `.handoffs/<skill-name>/` under that root, and write each file to
   `HANDOFF_DIR/<subagent-name>-instructions.md`. The `<skill-name>` is the
   orchestrator skill's frontmatter `name`. The `<subagent-name>` is the
   dispatched subagent's frontmatter `name`. This prevents collisions when
   two skills run concurrently, keeps handoffs out of committed documentation
   directories, and makes the file self-identifying.

2. **Create the handoff directory if missing.** If
   `.handoffs/<skill-name>/` does not exist when the orchestrator goes to
   write, create it. Treat the directory the same way as the file: scoped to
   one orchestrator skill, per-run. Repositories that adopt this pattern should
   ignore `.handoffs/` in version control.

3. **One file per dispatch.** Do not reuse a single handoff file across
   multiple subagents. Each dispatched subagent gets its own
   `<subagent-name>-instructions.md`. If the same subagent is dispatched more
   than once in a workflow (for example, a repair cycle after a validator
   `FAIL`), overwrite the previous file for that subagent — do not append.

4. **Dispatch prompt is short and points at the file.** The inline dispatch
   prompt should do four things only: name the subagent's role, name the
   absolute or workspace-relative path to the handoff file, instruct the
   subagent to read it first as its first action, and require it to follow
   the file strictly. Do not duplicate the payload inline.

5. **Subagent reads the file first, before any work.** The subagent's
   contract (its `SKILL.md`-side definition or its inline behavior section)
   must require it to load the handoff file as its first action and treat the
   file's contents as the source of truth for inputs, instructions, and
   constraints. If the file is missing or unreadable, the subagent returns a
   blocked status with the missing path named explicitly.

6. **Orchestrator deletes the file on successful completion.** When the
   subagent returns a terminal success status that the orchestrator routes
   forward (for example, `EDIT: PASS`, `VALIDATION: PASS`, `BUILD: PASS`),
   the orchestrator deletes the handoff file in the same step that records
   the subagent's verdict. Do not defer deletion to the end of the workflow;
   delete it as the dispatch step closes so the directory does not accumulate
   stale instructions across phases.

7. **Failures leave the file in place until the next cycle.** When a
   dispatched subagent returns a non-terminal failure that the orchestrator
   intends to retry (for example, `EDIT: BLOCKED` that will be re-dispatched
   after the user answers one targeted question, or a repair cycle after a
   `VALIDATION: FAIL`), leave the file on disk. The retry overwrites it with
   the next payload. Only delete when the orchestrator either succeeds, hits
   a terminal blocked/error status, or abandons the subagent entirely.

8. **Empty the handoff directory at workflow end.** When the orchestrator reaches a
   terminal user-facing handoff (success, blocked, error, no-change), it
   removes any remaining `<subagent-name>-instructions.md` files inside its
   `HANDOFF_DIR` as part of the final-cleanup phase. The directory itself may
   be left in place or removed when empty; do not remove sibling files the
   orchestrator did not create.

9. **The handoff file is a Category A2 orchestration artifact.** It is an
   ephemeral dispatch payload scoped to one workflow session. Never stage it.
   Never commit it. Delete it according to the dispatch cleanup rules above
   unless the user asks to preserve it for debugging. See
   `./artifact-lifecycle.md` for the full Category A1/A2/B lifecycle rules.

10. **The dispatch prompt still names the contract.** Even though the payload
    moves to the file, the dispatch prompt should still name the contract
    boundary in one sentence (for example, "Output must conform to
    `<subagent-name>`'s `Output Format` section"). This protects the run
    against the rare case where the subagent's contract file is missing or
    stale — the orchestrator's expectation is recoverable from the dispatch
    log alone.

## File-layout convention

```text
<repo-root>/
├── .handoffs/
│   └── <skill-name>/
│       ├── <subagent-a>-instructions.md
│       ├── <subagent-b>-instructions.md
│       └── <subagent-c>-instructions.md
└── (workflow-owned outputs elsewhere)
```

`<skill-name>` is the orchestrator skill's frontmatter `name`. `<subagent-*>`
files share `HANDOFF_DIR` because they all belong to the same orchestrator's
current run.

## Handoff-file contents

Use the structure below. It mirrors the inputs section of a typical subagent
contract; the payload is just moved to a file:

```markdown
# Handoff: <subagent-name>

## Role
<one-sentence subagent role from its contract>

## Inputs
| Input | Value |
| ----- | ----- |
| `INPUT_1` | <value or path> |
| `INPUT_2` | <value or path> |

## Instructions
<the same prose the orchestrator would have inlined>

## Constraints
<scope, mutation limits, retry caps, anything the subagent must not violate>

## References
- <bundled path>: <when to load it>
- <external URL>: <only if current platform syntax matters>

## Output Contract
<reference to the subagent's `Output Format` section, plus any
run-specific additions like which status to use on `BLOCKED`>

## Stop Conditions
<exact statuses or conditions that should end the run early>
```

## Example: dispatch with vs without a handoff file

```markdown
# Bad — inline payload risks tool-call serialization failure

Dispatch <subagent>:
  prompt: """<5-page audit report>
                <approved gap list>
                <personality decision>
                <mutation limits>
                <flow-diagram candidate>
                <checklist references>
                Follow the contract at ./subagents/<subagent>.md ..."""
# Tool call fails with a JSON parsing error; subagent never runs.

# Good — handoff file, compact dispatch

Orchestrator writes .handoffs/<skill-name>/<subagent>-instructions.md with the
full payload, then dispatches:
  prompt: """You are dispatched as <subagent>. Read
                ./subagents/<subagent>.md for your contract, then read
                .handoffs/<skill-name>/<subagent>-instructions.md as your
                handoff payload. Follow it strictly. Return the
                contracted Output Format."""
# Subagent reads the contract, then the handoff file, then executes.
# On `<STATUS>: PASS`, orchestrator deletes the handoff file.
```

## When the pattern is overkill

Not every dispatch needs a handoff file. Use inline payloads when:

- The payload is a handful of short fields (a path, a key, a flag) and a
  one-sentence instruction.
- The subagent's contract already enumerates every input it needs, and the
  dispatch is just naming values for those inputs.
- The skill is single-runtime and the runtime's dispatch tool is known to
  accept arbitrarily large arguments without serialization risk.

Use the handoff-file pattern when:

- The dispatch payload includes multi-paragraph rationale, gap inventories,
  audit reports, prior-pass findings, large reference excerpts, or any
  candidate artifact (Mermaid blocks, full file contents, structured plans).
- The skill targets multiple runtimes and you cannot rely on a specific
  tool-call argument size limit.
- The subagent will be re-dispatched in a repair cycle and the second
  payload will be derived from the first plus validator findings — the
  handoff file is cheaper to update than to rebuild inline.

## References

- `./subagent-default-execution.md` — when to dispatch vs. inline at all.
- `./input-output-contracts.md` — what the handoff file's `Inputs` and
  `Output Contract` sections must specify.
- `./artifact-lifecycle.md` — handoff files are Category A2 artifacts; never
  committed and normally deleted after terminal dispatch cleanup.
- `./context-window-protection.md` — moving payloads to disk also keeps them
  off the orchestrator's tool-call wire, not just out of the subagent's
  inline context.
