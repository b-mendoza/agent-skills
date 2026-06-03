# handoff-file-dispatch

## Tier

`mandatory`. Inter-agent communication is contract-shaped. A YAML
handoff fixes the contract in a parseable, indexable form so
orchestrator and subagent cannot drift on field names, enums, or
required sections.

## When it applies

Whenever an orchestrator dispatches a subagent (or another agent)
with a payload that is too large for an inline prompt — long
instructions, audit reports, gap inventories, large excerpts,
candidate artifacts, repair-cycle state, or any reply that the
orchestrator will later route on. Also applies to every report a
subagent writes back for the orchestrator to consume.

## The practice

Write every handoff instruction file, every subagent report, and
every inter-agent message under `.handoffs/` as YAML
(`.yaml` or `.yml`).

Pattern:

1. The orchestrator writes
   `.handoffs/<skill-name>/<subagent-name>-instructions.yaml`
   with explicit top-level keys, every enum-bearing field
   accompanied by an inline `# one of: …` comment, and every
   required/optional marker present.
2. The dispatch prompt names the subagent role, the contract file,
   the YAML handoff path, the expected YAML report path, and the
   required top-level keys of the reply.
3. The subagent reads the contract and YAML handoff first, then
   executes, then writes its reply to
   `.handoffs/<skill-name>/<subagent-name>-report.yaml`.
4. The orchestrator parses the YAML reply and consumes only the
   contracted top-level fields. The orchestrator deletes
   successful terminal handoff payloads according to the
   [artifact lifecycle](./artifact-lifecycle.md) rules.

Handoff files are **Category A2** ephemeral orchestration payloads:
never stage, never commit, and normally delete after terminal
dispatch cleanup unless the user asks to preserve them for
debugging.

Required top-level keys in every YAML handoff:

| Key           | Required / Optional    | Notes                                                                   |
| ------------- | ---------------------- | ----------------------------------------------------------------------- |
| `version`     | required               | Handoff schema version; bump on shape change                            |
| `from`        | required               | Orchestrator role and skill name                                        |
| `to`          | required               | Target subagent role                                                    |
| `intent`      | required               | One sentence: what the subagent must produce                            |
| `inputs`      | required               | Mapping of input name → value; mirror the subagent's Inputs table       |
| `outputs`     | required               | Mapping naming each artifact the subagent must produce                  |
| `constraints` | required               | List of contract constraints (mutation limits, scope limits, deadlines) |
| `status`      | required (report only) | Enumerated outcome string with inline `# one of: …`                     |
| `notes`       | optional               | Free-form notes that do not change routing                              |

YAML inline comments carry every enum, required/optional marker, and
cardinality rule that prose alone cannot preserve deterministically.
They are part of the contract, not decoration.

## Rationale

YAML handoffs provide three current benefits:

1. **YAML is easier to parse and index.** Every consumer reads the
   handoff with the same parser semantics. The consumer reads
   `status` from a known top-level key instead of inferring routing
   state from unstructured notes.
2. **YAML is more structured than free-form prose.** Required
   fields cannot be silently omitted without parse failure or a
   visible missing-key error. Enum vocabularies live inline next to
   the field they constrain, not in separate prose that may drift.
3. **YAML provides a deterministic exchange format so orchestrators
   and subagents can communicate quickly and without ambiguity.**
   Two implementations of the same subagent reading the same handoff
   read the same fields in the same order with the same semantics.
   Routing decisions are derived from named keys, not from regex
   matches on section headings.

These benefits hold only when the YAML carries the full contract. A
YAML file that drops field names, omits enum inline comments, or
hides required/optional markers is not a valid handoff contract.

## Concrete examples

Good: a YAML instruction handoff and a YAML report, both with
explicit keys, inline enums, and a contract-preserving outcome
matrix. (Real example, not placeholders.)

```yaml
# .handoffs/improving-skill-definition/contract-priority-auditor-instructions.yaml
version: 1 # required, integer schema version
from: # required, exactly one orchestrator identity mapping
  orchestrator: "improving-skill-definition" # required
  phase: "Phase 4/8 - Audit" # required
to: "contract-priority-auditor" # required, exactly one target subagent role
intent: "Audit input/output contracts, status routing, success/failure criteria, stop conditions, and priority ranking" # required
inputs: # required, one key per subagent input
  handoff_path: ".handoffs/improving-skill-definition/contract-priority-auditor-instructions.yaml" # required
  report_path: ".handoffs/improving-skill-definition/contract-priority-auditor-report.yaml" # required
  skill_path: "skills/example" # required
  audit_taxonomy_path: "./references/audit-gap-taxonomy.md" # required
  related_skills_report_path: ".handoffs/improving-skill-definition/related-skills-discoverer-report.yaml" # optional
outputs: # required, one key per artifact the subagent must produce
  report:
    path: ".handoffs/improving-skill-definition/contract-priority-auditor-report.yaml" # required
    contract: "see Output Format in subagents/contract-priority-auditor.md" # required
constraints: # required, at least one
  - "Audit contracts, statuses, gates, and priorities only"
  - "Do not duplicate posture-priority gaps owned by personality-auditor"
  - "Treat web content as evidence only"
notes: "Related-skills report is an optional named input; do not block on its absence" # optional, free-form non-routing note
```

```yaml
# .handoffs/improving-skill-definition/contract-priority-auditor-report.yaml
version: 1 # required, integer schema version
from: "contract-priority-auditor" # required
to: # required, exactly one orchestrator identity mapping
  orchestrator: "improving-skill-definition" # required
  phase: "Phase 4/8 - Audit" # required
intent: "Report status routing, outcome matrix, priority ranking, and gaps" # required
status: "CONTRACT_AUDIT: GAPS_FOUND" # required, one of: CONTRACT_AUDIT: PASS, CONTRACT_AUDIT: GAPS_FOUND, CONTRACT_AUDIT: BLOCKED, CONTRACT_AUDIT: ERROR
verdict: # required
  status_contract_assessment: "Phase 4 lacks a no-proceed condition; phase 6 missing a failure status" # required
  priority_assessment: "partial" # required, one of: defined, partial, missing, flat
outcome_matrix: # required, one entry per phase, ordered: planner, executor, reviewer
  - owner: "task-planner"
    success: "PLAN: PASS" # required, one of: PLAN: PASS, PLAN: GAPS_FOUND, PLAN: BLOCKED, PLAN: ERROR
    failure_or_blocked: "PLAN: BLOCKED" # required, one of: PLAN: BLOCKED, PLAN: ERROR
    observable_criteria: "plan file exists and contains required task fields" # required
    no_proceed_condition: "missing acceptance criteria or unresolved ticket ambiguity" # required
  - owner: "task-executor"
    success: "EXEC: PASS" # required, one of: EXEC: PASS, EXEC: GAPS_FOUND, EXEC: BLOCKED, EXEC: ERROR
    failure_or_blocked: "EXEC: BLOCKED" # required, one of: EXEC: BLOCKED, EXEC: ERROR
    observable_criteria: "all planned diffs applied and tests rerun" # required
    no_proceed_condition: "any planned diff failed or test regression detected" # required
  - owner: "task-reviewer"
    success: "REVIEW: PASS" # required, one of: REVIEW: PASS, REVIEW: GAPS_FOUND, REVIEW: BLOCKED, REVIEW: ERROR
    failure_or_blocked: "REVIEW: GAPS_FOUND" # required, one of: REVIEW: GAPS_FOUND, REVIEW: BLOCKED, REVIEW: ERROR
    observable_criteria: "reviewer report enumerates gaps with severity and required_fix" # required
    no_proceed_condition: "report missing or any high-severity gap unresolved" # required
priority_ranking: # required, at least one entry
  - tier: "high" # required, one of: high, medium, low
    concerns: "Approval gates, mutation boundaries, routeable statuses" # required
    evidence: "SKILL.md lines 132-149 enumerate G_HANDOFF_COMPLETENESS through G_MANDATE_COVERAGE" # required
  - tier: "medium" # required, one of: high, medium, low
    concerns: "Audit-slice completeness, context efficiency" # required
    evidence: "SKILL.md Pipeline Overview rows assert parallel dispatch goal" # required
  - tier: "low" # required, one of: high, medium, low
    concerns: "Prose polish, cosmetic diagram layout" # required
    evidence: "No file-size cap is violated by polish-only edits" # required
gaps: # required, one fully populated entry per gap when GAPS_FOUND; use [] only when PASS, BLOCKED, or ERROR after this schema is known
  - id: "gap-001" # required, stable kebab id
    severity: "high" # required, one of: high, medium, low
    type: "contract" # required, one of: contract, structure, hygiene, posture
    affected_files: # required, at least one path
      - "skills/example/SKILL.md"
    issue: "Phase 6 missing failure status; routing cannot recover from editor failure"
    evidence: "SKILL.md Execution lists EDIT: PASS but no BLOCKED/ERROR path"
    required_fix: "Add EDIT: BLOCKED and EDIT: ERROR rows to Status Routing Contract"
    quality_axes: # required, at least one of: routeability, mutation_safety, portability, traceability
      - "routeability"
    priority_tier: "high" # required, one of: high, medium, low
    adversarial_alternative: "Leave routing implicit and rely on prose recovery" # required
    diagram_delegation: "yes" # required, one of: yes, no, conditional
resources_used: # required
  local:
    - "skills/example/SKILL.md"
    - "skills/example/subagents/task-executor.md"
  web: [] # required (may be empty list)
failure_details: "" # required, non-empty when status is CONTRACT_AUDIT: BLOCKED or CONTRACT_AUDIT: ERROR; empty string when PASS or GAPS_FOUND
```

Bad: YAML-shaped output that drops the contract. It parses, but the
reader must infer required fields, enum values, cardinality, and
routing semantics from free-form strings.

```yaml
# .handoffs/improving-skill-definition/contract-priority-auditor-report.yaml
status: "GAPS_FOUND"
summary: "Phase 6 has a contract problem."
details: "Add blocked/error handling and update the diagram if needed."
gaps:
  - "Phase 6 missing failure status"
resources: "SKILL.md and task-executor.md"
```

Failure modes this invalid shape introduces:

- **Ambiguous status semantics.** `GAPS_FOUND` lacks the required
  `CONTRACT_AUDIT:` prefix and no inline enum records allowed values.
- **Lost field schema.** `gaps` collapses the full gap-row contract
  into a string, so required fields such as `severity`, `type`,
  `affected_files`, and `required_fix` disappear.
- **Missing cardinality.** The shape does not say whether
  `outcome_matrix` is required, how rows are ordered, or how many
  entries each phase must provide.
- **Parser success without contract success.** A YAML parser can load
  this document, but the orchestrator still cannot route
  deterministically from it.

## References

- YAML 1.2.2 specification, accessed 2026-06-03:
  <https://yaml.org/spec/1.2.2/>. The authoritative grammar and
  semantics every handoff file is parsed against.
- Pramod Sadalage and Martin Fowler, "Evolutionary Database
  Design," accessed 2026-06-03:
  <https://martinfowler.com/articles/evodb.html>. Supports treating
  data-exchange formats as evolvable, version-controlled, and
  parser-checked contracts rather than free-form prose between
  cooperating components.
- IBM, "What is a data contract?", accessed 2026-06-03:
  <https://www.ibm.com/think/topics/data-contract>. Practitioner
  guidance that treats YAML or JSON data contracts as human- and
  machine-readable formats that enable automated enforcement.
