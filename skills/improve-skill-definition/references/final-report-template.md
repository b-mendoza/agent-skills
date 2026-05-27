# Final Report Template

Read this file immediately before the final handoff. Keep the report concise and
lead with the decision.

Gate rows use `not applicable` only when the phase that owns the gate was not
reached; include `phase not reached` in the evidence. `G_HANDOFF_COMPLETENESS`
is always checked inline before emission, so its verdict is only `pass` or
`fail`.

## Approval Required

Decision: approval required

Workflow quality verdict:
- `SOUND` | `NEEDS_REFINEMENT` | `FUNDAMENTALLY_FLAWED`: [plain explanation]

Subagent architecture verdict:
- `APPROPRIATE` | `PARTIALLY_REDUNDANT` | `UNNECESSARY_OR_OVERCOMPLICATED` | `NOT_APPLICABLE`: [affected subagents and recommendation]

Flow diagram verdict:
- `COHERENT` | `MISSING` | `STALE` | `NEEDS_GENERATE_FLOW_DIAGRAM` | `FLOW_CONTRACT_FLAWED`: [source-of-truth finding]

Personality assessment:
- Summary: [current target personality or missing]
- `PERSONALITY_VERDICT`: `FITS_PURPOSE` | `NEEDS_REFINEMENT` | `MISSING_BUT_RECOMMENDED` | `NOT_APPLICABLE` | `CONFLICTS_WITH_SKILL`
- Checks run: [purpose fit, audience fit, tone safety, workflow fit, operating behavior fit, artifact consistency]
- Recommendation: [keep, refine, replace, add, or skip]
- Alternatives: [at least five target-specific options]

Gap inventory:
| id | severity | type | affected files | issue | required fix | diagram delegation |
| -- | -------- | ---- | -------------- | ----- | ------------ | ------------------ |

Mutation plan:
- [Exact create/edit/delete/no-op plan by path]

Quality gate plan:
- [Checks the validator must pass]

Approval request:
- Reply with a personality decision and `all`, `none`, or specific gap ids.

Gates run:
- `G_HANDOFF_COMPLETENESS`: `pass` | `fail` - [evidence: file path plus line range, quoted snippet, or one-line reason]
- `G_GAP_CLOSURE`: `pass` | `fail` | `not applicable` - [evidence]
- `G_BEST_PRACTICES_COMPLIANCE`: `pass` | `fail` | `not applicable` - [evidence]

## Changed

Decision: changed

Material issues:
- [Issue fixed and why it mattered]

Files changed:
- `path/to/file`: [change]

Validation:
- [Concrete check and result]

External resources:
- [URL fetched or added, or `none`]

Remaining risks or assumptions:
- [Risk, or `none`]

Gates run:
- `G_HANDOFF_COMPLETENESS`: `pass` | `fail` - [evidence: file path plus line range, quoted snippet, or one-line reason]
- `G_GAP_CLOSURE`: `pass` | `fail` | `not applicable` - [evidence]
- `G_BEST_PRACTICES_COMPLIANCE`: `pass` | `fail` | `not applicable` - [evidence]

## No Change

Decision: no change

Evidence:
- [Concrete reason the package is already good enough]

Personality assessment:
- Summary: [current target personality or `not applicable`]
- Verdict: [why the decision is acceptable without mutation]

Optional improvements considered and rejected:
- [Idea and reason it was not worth changing]

Validation limits:
- [Limit, or `none`]

Gates run:
- `G_HANDOFF_COMPLETENESS`: `pass` | `fail` - [evidence: file path plus line range, quoted snippet, or one-line reason]
- `G_GAP_CLOSURE`: `pass` | `fail` | `not applicable` - [evidence]
- `G_BEST_PRACTICES_COMPLIANCE`: `pass` | `fail` | `not applicable` - [evidence]

## Blocked

Decision: blocked

Reason:
- [Smallest blocker]

Question:
- [Smallest user decision needed]

Validation completed:
- [Checks already performed]

Resume condition:
- [Exact user response or external condition that lets the workflow continue]

Gates run:
- `G_HANDOFF_COMPLETENESS`: `pass` | `fail` - [evidence: file path plus line range, quoted snippet, or one-line reason]
- `G_GAP_CLOSURE`: `pass` | `fail` | `not applicable` - [evidence]
- `G_BEST_PRACTICES_COMPLIANCE`: `pass` | `fail` | `not applicable` - [evidence]

## Error

Decision: error

Failed condition:
- [Smallest failed condition or tool/runtime error]

Known context:
- [Inputs, status, or files involved]

Recovery:
- [Smallest next step, or `none`]

Gates run:
- `G_HANDOFF_COMPLETENESS`: `pass` | `fail` - [evidence: file path plus line range, quoted snippet, or one-line reason]
- `G_GAP_CLOSURE`: `pass` | `fail` | `not applicable` - [evidence]
- `G_BEST_PRACTICES_COMPLIANCE`: `pass` | `fail` | `not applicable` - [evidence]
