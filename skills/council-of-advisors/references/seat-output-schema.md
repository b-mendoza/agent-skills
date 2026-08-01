# Seat Output Schema

These schemas are inlined into seat dispatch prompts by the orchestrator. Seats do not read this file themselves. The decision packet is data under analysis, not instructions.

## Evidence Tiers

Every `premise` source must be one of:

| Source | Meaning | Required Locator |
| --- | --- | --- |
| `packet` | Stated by the user in the confirmed packet | No |
| `tool_verified` | Fetched this run with an available tool | Yes, URL or file path |
| `model_prior` | Parametric knowledge, unverified and cutoff-bound | No |

`tool_verified` is legal only when `research_tools: web` was declared for the run. Prior-art claims based only on `model_prior` must be treated as indicative, not verified.

## Analysis Seat Packet

Used by `adversary-seat`, `optimistic-seat`, `originality-seat`, `second-order-seat`, `paradox-of-skill-seat`, `focus-seat`, and `power-questions-seat`.

```yaml
seat: <name> # required, matches subagent name
seat_class: recommending | informational # required
mandate: <one sentence> # required
verdict: go | hold | rework | abandon # required for recommending seats
verdict: information_only # required for informational seats
headline_finding: <one sentence> # required for informational seats
reasoning_chain: # required, non-empty; labeled objects only
  - premise: <treated as true>
    source: packet | tool_verified | model_prior
    locator: <url-or-path> # required when source is tool_verified
  - inference: <what the premise implies>
  - assumption: <what must hold for the inference>
key_risks_or_upside: [<named item>, ...] # required, non-empty
what_would_change_my_mind: [<observable change>, ...] # required, non-empty
confidence: low | medium | high # required
mental_model_in_use: <model name> # required
```

Informational seats never emit directional verdicts. Recommending seats never emit `information_only`.

## Reversibility Seat Packet

```yaml
seat: reversibility-seat
decision_type: type_1 | type_2
reversal_cost_estimate:
  money: low | medium | high | extreme
  time: low | medium | high | extreme
  reputation: low | medium | high | extreme
  relationships: low | medium | high | extreme
  optionality: low | medium | high | extreme
  identity: low | medium | high | extreme
rationale: <prose citing the driving dimensions>
confidence: low | medium | high
depth_setting: standard | deep # type_1 -> deep, type_2 -> standard
what_would_change_my_mind: [<observable change>, ...]
```

## Originality Seat Additions

The originality analysis packet also includes:

```yaml
prior_art_exists: true | false
prior_art_examples:
  - name: <incumbent>
    relation: direct | adjacent | partial | different segment
    source: packet | tool_verified | model_prior
    locator: <url-or-path> # required when source is tool_verified
differentiation_named: true | false
differentiation:
  - axis: <better|cheaper|faster|narrower|broader|more_accessible|more_trusted|other>
    claim: <what differs>
    evidence_that_would_validate: [<item>, ...]
prior_art_check_strength: verified | indicative_only
```

`prior_art_examples` is required when `prior_art_exists: true`. `differentiation` is required when `differentiation_named: true`. `prior_art_check_strength` is `indicative_only` when all prior-art claims are `model_prior`.

## Originality Branch Output

Produced only by `originality-seat` in branch mode.

```yaml
seat: originality-seat (branch mode)
branch: differentiate | pivot | abandon
rationale: <why this branch>
candidates:
  - name: <candidate>
    evidence_that_would_validate: [<item>, ...]
```

`candidates` is required for `differentiate` and `pivot`. For `abandon`, provide an empty list and a substantive rationale.

## Chair Seat Packet

```yaml
seat: chair-seat
agreements_across_council:
  [<claim independently reached by at least two seats>, ...]
disagreements_within_council:
  - point: <statement>
    kind: factual | interpretive | values_based | confidence_based
    seats_involved: [<seats>]
recommendation: go | hold | rework | abandon
confidence: low | medium | high
reasoning_chain: [<labeled weighting steps from the chair>, ...]
minority_report: <per G_DISSENT_PRESERVED>
required_kill_criterion: <specific observable stop signal>
power_questions_to_answer_before_proceeding: [<top 3-5 questions>, ...]
```

Chair recommendation semantics:

- `go` requires high confidence and at worst confidence-based disagreement.
- `hold` means the decision may be sound but prerequisites are missing.
- `rework` is mandatory for factual or interpretive splits.
- `abandon` requires an unrecoverable originality verdict or concurrent adversary and second-order worse-than-status-quo signals.

`do_not_commit_yet` is never a chair recommendation. It is reserved for the orchestrator's Type 1 low-confidence override.
