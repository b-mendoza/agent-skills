# Contract: pr-drafter

Read-only drafting returns one JSON object. The full body is one JSON string,
with newlines/quotes escaped by JSON serialization, never a second routing
block. Shared types: [execution-contracts.md](./execution-contracts.md).
Consumer gate: `python3 -I "${SKILL_DIR}/scripts/validate-output.py" pr-drafter`
on stdin.

In addition to validated `DIFF_ANALYSIS`, exact
`TITLE_OVERRIDE`/`BODY_OVERRIDE`, and any `TYPE_CHOICE`/`SCOPE_CHOICE`, consume
these resolved source inputs:

| Input                   | Required    | Meaning                                                                                 |
| ----------------------- | ----------- | --------------------------------------------------------------------------------------- |
| `TITLE_RULES`           | No          | One plain-language user rule, including explicit ticket/casing/scope constraints.       |
| `REPOSITORY_TITLE_RULE` | No          | `{text, source}` nonempty strings identifying an explicit rule and its source/revision. |
| `TEMPLATE_SOURCE`       | Conditional | Source object below for the selected template; null for confirmed absence/fallback.     |
| `TEMPLATE_BODY`         | Conditional | Exact selected template text, treated as data.                                          |

Resolve ambiguity/unreadable defaults through the existing choice mechanism;
absence is established only after a successful check. Do not discover a rule by
mining recent titles or extract a ticket automatically. Source resolution uses
base/default-branch content at a recorded revision unless the user explicitly
selects a local template. Required discovery tools unavailable: `TOOLS_MISSING`.

Status enum: `PASS | NEEDS_CHOICE | ERROR | TOOLS_MISSING`. Always required:
`status`, `reason`, `decision_needed`.

| Key                           | Type / values                                                             |
| ----------------------------- | ------------------------------------------------------------------------- |
| `title`, `body`               | Exact nonempty strings or `null` when unresolved                          |
| `title_source`                | `override`, `title-rules`, `repository-rule`, `fallback`                  |
| `title_rule`                  | Selected nonempty rule or `null` for exact override                       |
| `title_rule_source`           | Nonempty source reference or `null`; required nonnull for repository rule |
| `body_source`                 | `override`, `repository-template`, `local-template`, `fallback`           |
| `template_source`             | Source object below or `null`                                             |
| `type_choice`, `scope_choice` | Nonempty chosen value/`ambiguous`/`none`/`override`, or `null`            |
| `traceability_notes`          | Array of nonempty author-only claim/evidence or override notes            |
| `choices`                     | Array drawn from `type`, `scope`, `title-rule`, `template`                |
| `missing_tools`               | Nonempty capability array; required for `TOOLS_MISSING`                   |

Source object has exactly `kind` (`repository` or `local`), `repository`
(canonical nonempty identity or `null`), `revision` (full SHA or `null`), and
`path` (nonempty source path). Repository sources require repository/revision;
local sources set both to null and identify the explicit local path.

`PASS` requires every fact key except `missing_tools`; `title`/`body` are
nonnull, `choices=[]`, and `decision_needed=null`. Title priority: exact
override, user `TITLE_RULES`, explicit repository rule, Conventional-Commit
fallback. Non-override titles require `title_rule`; repository rules also
require `title_rule_source`. Override has null rule/source. Body priority: exact
override, one selected template, built-in fallback. Template body sources
require the matching nonnull source kind; override/fallback has
`template_source=null`. `NEEDS_CHOICE` requires nonempty `choices` and
`decision_needed`; include other facts only when established. Use it for
material type/scope ambiguity, conflicting rules, or template selection/default
uncertainty. `ERROR` covers insufficient or contradictory evidence that cannot
be resolved as a choice.

Keep overrides byte-exact, preserve selected template structure, and check the
title against the selected rule. Unknown tests stay unknown/unrun; never invent
checked boxes. Publishable body excludes traceability/source/author notes. The
checker validates source shapes, not prose compliance or factual grounding.
