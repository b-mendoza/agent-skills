# Contract: pr-drafter

Return exactly one status block. The body may be multi-line Markdown.

```text
PR_DRAFT: <PASS | NEEDS_CHOICE | ERROR>
Title: <title | unavailable>
Title source: <override | generated>
Body source: <override | template | generated>
Template path: <selected base-tree path | none>
Type choice: <resolved type | ambiguous | override>
Scope choice: <resolved scope | ambiguous | none | override>
Traceability notes:
- <body/title claim -> traceability source>
Body:
<markdown body>
Reason: <one line>
Decision needed: <none | choose type | choose scope | choose type and scope | choose template | clarify title convention | provide ticket key | next action>
```

`PASS` grounds every claim in a diff fact with its `Bn` id, an exact override, a user choice, the selected template, or a verification record. `NEEDS_CHOICE` identifies an unresolved type, scope, template, ticket key or convention. `ERROR` means required facts are missing or contradictory. The body is literal multiline Markdown; field-looking lines within it remain body content.
