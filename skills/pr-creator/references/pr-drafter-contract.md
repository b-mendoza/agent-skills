# Contract: pr-drafter

Return exactly one status block. The body may be multi-line Markdown; keep it grounded in `DIFF_ANALYSIS` or exact overrides.

```text
PR_DRAFT: <PASS | NEEDS_CHOICE | ERROR>
Title: <title | unavailable>
Title source: <override | generated>
Body source: <override | template | generated>
Template path: <selected base-tree path | none>
Type choice: <resolved type | ambiguous | override>
Scope choice: <resolved scope | ambiguous | none | override>
Traceability notes:
- <body/title claim -> diff fact or override>
Body:
<markdown body>
Reason: <one line>
Decision needed: <none | choose type | choose scope | choose type and scope | choose template | clarify title convention | next action>
```

Use `NEEDS_CHOICE` for a material title constraint or ambiguous template selection. Use `ERROR` when required diff facts are missing or contradictory.
