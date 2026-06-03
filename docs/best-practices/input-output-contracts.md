# input-output-contracts

## Tier

`mandatory`. Without explicit input and output contracts, subagents
make implicit assumptions that surface as silent failures multiple
stages downstream.

## When it applies

For every multi-stage workflow, every subagent that takes structured
inputs, and every artifact (file, ticket, message) that downstream
consumers parse.

## The practice

Explicitly define what data a skill or subagent requires as input,
what it produces as output, and in what format. These contracts are
the data boundaries between pipeline stages.

**Input contract format.** Use a table of `Input | Required |
Example`, with derivation rules when an input carries multiple
pieces of information.

```markdown
## Inputs

| Input      | Required | Example                                               |
| ---------- | -------- | ----------------------------------------------------- |
| `JIRA_URL` | Yes      | `https://workspace.atlassian.net/browse/PROJECT-1234` |
| `MODE`     | No       | `upfront` (default) or `critique`                     |
```

Include derivation rules when inputs carry multiple pieces of
information:

```markdown
Extract these values from the URL:

- **Workspace:** subdomain before `.atlassian.net` → `workspace`
- **Ticket key:** full path segment → `PROJECT-1234`
```

**Output contract format.** Specify the file path, required
sections, and structural expectations.

```markdown
## Output Contract

Path: `docs/<TICKET_KEY>-tasks.md`

Must contain:

- `## Ticket Summary` section
- `## Tasks` section with at least 2 task entries
- Each task entry has: Title, Description, Acceptance Criteria
```

**Design principle: prefer canonical source identifiers over lossy
fragments.** When a non-sensitive value carries multiple pieces of
useful context (e.g., a canonical issue URL contains workspace,
project, and key), pass the full value rather than requiring the
caller to pre-extract components. The receiving skill can derive
what it needs. This reduces ambiguity and provides richer context to
downstream operations.

Do not pass full URLs or raw identifiers by default when they
contain secrets, access tokens, private user data, tracking
parameters, or unnecessary context. In those cases, validate and
pass the smallest structured fields needed by the receiver, plus a
redacted source reference when provenance matters.

## Rationale

Without explicit contracts, subagents make assumptions about input
format and downstream consumers make assumptions about output
format. Mismatches cause silent failures that surface steps later,
far from the root cause. A subagent that "took whatever the
orchestrator passed and returned something reasonable" cannot be
re-used, cannot be validated, and cannot be repaired without re-
reading its source.

The canonical-source-over-fragments rule closes a sneakier failure:
when the caller pre-extracts the workspace and the ticket key from a
Jira URL, the receiver has lost the ability to derive any other
useful context from the URL (project metadata, custom subdomains,
verification of the URL shape). Passing the canonical identifier
preserves context for the receiver without forcing the caller to
predict every future use.

## Concrete examples

Good: explicit inputs with required/optional markers, derivation
rules, output contract with file path and required sections.

```markdown
## Inputs

| Input        | Required | Example                                               |
| ------------ | -------- | ----------------------------------------------------- |
| `JIRA_URL`   | Yes      | `https://workspace.atlassian.net/browse/PROJECT-1234` |
| `MODE`       | No       | `upfront` (default) or `critique`                     |
| `SKILL_PATH` | Conditional | `skills/example` (only for `critique` mode)        |

Extract from JIRA_URL:
- Workspace: subdomain before `.atlassian.net` → `workspace`
- Ticket key: trailing path segment → `PROJECT-1234`

## Output Contract

Path: `docs/PROJECT-1234-tasks.md`

Must contain:
- `## Ticket Summary` section
- `## Tasks` section with at least 2 task entries
- Each task: Title, Description, Acceptance Criteria
```

Bad: inputs and outputs left implicit; receiver has to guess.

```markdown
The skill takes a Jira URL or maybe a ticket key, and produces a
task plan in markdown.
```

## References

- JSON Schema specification, accessed 2026-05-27:
  <https://json-schema.org/specification>. Supports explicit
  validation structures for machine-readable contracts.
- OpenAI Structured Outputs documentation, accessed 2026-05-27:
  <https://platform.openai.com/docs/guides/structured-outputs>.
  Supports using schemas when a downstream consumer depends on
  machine-checkable output.
- OpenAI, "Safety in building agents," accessed 2026-05-27:
  <https://platform.openai.com/docs/guides/agent-builder-safety>.
  Supports extracting and validating structured values from
  untrusted content before they drive agent behavior.

## Related practices

- [Handoff file dispatch](./handoff-file-dispatch.md) — YAML
  handoffs encode this contract between agents.
- [Critical output gates](./critical-output-gates.md) — gates
  measure outputs against the contract shape.
- [Orchestrator as routing UI](./orchestrator-as-routing-ui.md) —
  the orchestrator routes on the contracted output fields.
- [Escalation categories](./escalation-categories.md) — contract
  violations produce `FAIL` or `BLOCKED` per the category contract.
