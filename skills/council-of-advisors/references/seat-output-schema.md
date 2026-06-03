# Seat Output Schema

Read this file when authoring a new seat or when validating a seat's
return packet. The schema is the contract between every seat and the
orchestrator (and, at synthesis time, between the analysis seats and the
chair seat).

## Analysis seat packet

Every analysis seat (adversary, optimistic, originality, second-order,
paradox-of-skill, focus, power-questions) returns the following YAML:

```yaml
seat: <name>                       # required, matches subagent name
mandate: <one sentence>            # required, the seat's mandate restated
verdict: go | hold | rework | abandon   # required
reasoning_chain:                   # required, non-empty list
  - premise: <what the seat is treating as true>
    source: <where the premise comes from — user packet, file read, web fetch, named prior knowledge>
  - inference: <what the premise implies>
  - assumption: <what would need to be true for the inference to hold>
key_risks_or_upside:               # required, non-empty list
  - <named risk or upside>
what_would_change_my_mind:         # required, non-empty list — an unfalsifiable opinion is not a reasoning chain
  - <a specific, observable change>
confidence: low | medium | high    # required
mental_model_in_use: <named model> # required — see ./mental-models.md
```

Empty or missing `what_would_change_my_mind` is an automatic seat-packet
failure. The orchestrator redispatches with a missing-field reason.

A `reasoning_chain` entry must be a labeled object (`premise`,
`inference`, or `assumption`). A flat list of strings is rejected.

## Reversibility seat packet

The reversibility seat runs before the analysis seats and returns:

```yaml
seat: reversibility-seat
decision_type: type_1 | type_2     # required
reversal_cost_estimate:            # required, all six dimensions
  money: low | medium | high | extreme
  time: low | medium | high | extreme
  reputation: low | medium | high | extreme
  relationships: low | medium | high | extreme
  optionality: low | medium | high | extreme
  identity: low | medium | high | extreme
rationale: <prose explaining the classification>   # required
confidence: low | medium | high    # required
depth_setting: standard | deep     # required — type_1 → deep, type_2 → standard
```

## Originality seat packet (extends analysis seat packet)

The originality seat returns the analysis seat packet plus three
originality-specific fields, used by the Phase 4 gate:

```yaml
seat: originality-seat
# ...all analysis-seat fields above...
prior_art_exists: true | false      # required
prior_art_examples:                 # required when prior_art_exists is true
  - name: <named incumbent or adjacent solution>
    relation: <how it relates to the user's idea>
differentiation_named: true | false # required
differentiation:                    # required when differentiation_named is true
  - axis: <e.g., better, cheaper, faster, narrower, broader, more accessible, more trusted>
    claim: <what the user's solution does differently on this axis>
    evidence_that_would_validate: <list>
```

## Chair seat packet

The chair seat runs after the analysis seats (and the originality branch
output, if any) and returns:

```yaml
seat: chair-seat
agreements_across_council:         # required, may be empty list
  - <statement>
disagreements_within_council:      # required, may be empty list
  - point: <statement>
    kind: factual | interpretive | values_based | confidence_based
    seats_involved: <list>
recommendation: go | hold | rework | abandon | do_not_commit_yet   # required
confidence: low | medium | high    # required
reasoning_chain:                   # required, non-empty list
  - <step>
minority_report: <verbatim strongest dissent, or "none — confidence is high">
required_kill_criterion: <what would make you stop, stated up-front>
power_questions_to_answer_before_proceeding:
  - <question lifted or refined from the power-questions seat packet>
```

## Originality branch output (optional)

Produced only when the originality gate branches. The orchestrator
appends it to the chair's input payload.

```yaml
branch: differentiate | pivot | abandon
rationale: <why this branch>
candidates:                        # required for differentiate and pivot
  - name: <candidate>
    evidence_that_would_validate: <list>
```

## Validation order

The orchestrator validates each packet against the schema above before
dispatching the next phase. A packet that fails the schema does not
participate in synthesis until a redispatch repairs it.
