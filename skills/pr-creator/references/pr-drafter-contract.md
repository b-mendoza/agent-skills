# Contract: pr-drafter

Read-only source discovery/drafting returns one JSON object. The full drafted
body is one JSON string, with newlines/quotes escaped by JSON serialization,
never a second routing block. Shared types: [execution-contracts.md](./execution-contracts.md).
Consumer gate: `python3 -I "${SKILL_DIR}/scripts/validate-output.py" pr-drafter`
on stdin.

In addition to checked `PLATFORM`, canonical `BASE_REPOSITORY`, validated
`DIFF_ANALYSIS`, exact `TITLE_OVERRIDE`/`BODY_OVERRIDE`, and any
`TYPE_CHOICE`/`SCOPE_CHOICE`, consume these source-selection inputs:

| Input               | Required | Meaning                                                                           |
| ------------------- | -------- | --------------------------------------------------------------------------------- |
| `TITLE_RULES`       | No       | One plain-language user rule, including explicit ticket/casing/scope constraints. |
| `TITLE_RULE_SOURCE` | No       | Selected repository source object below, or explicit `fallback`.                  |
| `TEMPLATE_SOURCE`   | No       | Selected source object below, or explicit `fallback`.                             |

Absent source-selection inputs mean discover/read in this specialist under the
[platform rules](./platform-adaptation.md), not orchestrator-resolved contents.
Repository-file discovery uses the base default branch at a recorded full SHA;
a GitLab settings default uses the canonical base project and setting identity,
not a fabricated revision. Local templates require explicit user selection.
Re-read selected identities on redispatch and verify repository/path/revision
or project/setting. A stale/missing selection needs a new choice. Local/settings
sources have no immutable revision; read their current values. Required missing
discovery/read capabilities return `TOOLS_MISSING`. Failed discovery is not
absence. Do not mine recent titles or extract tickets automatically.

Status enum: `PASS | NEEDS_CHOICE | ERROR | TOOLS_MISSING`. Always required:
`status`, `reason`, `decision_needed`.

| Key                           | Type / values                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `title`, `body`               | Exact nonempty drafted strings or `null` when unresolved                             |
| `title_source`                | `override`, `title-rules`, `repository-rule`, `fallback`                             |
| `title_rule`                  | Concise selected constraint summary, not retrieved rule text; `null` for override    |
| `title_rule_source`           | Nonempty source identity/revision or `null`; nonnull for repository rule             |
| `body_source`                 | `override`, `repository-template`, `local-template`, `settings-template`, `fallback` |
| `template_source`             | Source object below or `null`                                                        |
| `type_choice`, `scope_choice` | Nonempty chosen value/`ambiguous`/`none`/`override`, or `null`                       |
| `traceability_notes`          | Array of concise nonempty author-only claim/evidence or override notes               |
| `choices`                     | Array drawn from `type`, `scope`, `title-rule`, `template`                           |
| `source_candidates`           | Array of at most 10 `{choice, source}` objects below                                 |
| `missing_tools`               | Nonempty capability array; required for `TOOLS_MISSING`                              |

Source objects have exactly the keys for their kind:

| Kind         | Keys and values                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `repository` | `kind`, `repository` canonical identity, `revision` full SHA, `path` nonempty repository-file path                |
| `local`      | `kind`, `repository=null`, `revision=null`, `path` nonempty explicitly selected local template path               |
| `settings`   | `kind`, `project` canonical base-project identity, `setting` nonempty API field such as `merge_requests_template` |

Settings sources contain no Git revision or file path. Do not add a source-value
digest; preview approval freezes/digest-binds the exact drafted body.

`PASS` requires every fact key except `missing_tools`; `title`/`body` are
nonnull, `choices=[]`, `source_candidates=[]`, and `decision_needed=null`.
Title priority: exact override, user `TITLE_RULES`, explicit repository rule,
Conventional-Commit fallback. Non-override titles require `title_rule`;
repository rules also require `title_rule_source`. Override has null rule/source.
Body priority: exact override, one selected template, built-in fallback.
Template body sources require the matching nonnull source kind;
override/fallback has `template_source=null`.

`NEEDS_CHOICE` requires nonempty `choices` and `decision_needed`, plus
`source_candidates`. Each candidate has exactly `choice` (`title-rule` or
`template`, present in `choices`) and `source` (identity object above).
Title-rule candidates use repository sources. Return source identities only;
keep raw source contents out of candidates, questions, reasons, summaries, and notes.
If more than ten exist, disclose that the list is partial and ask for a listed
identity or explicit fallback; never infer precedence from truncation.
Use `source_candidates=[]` for type/scope-only choices or no readable candidates;
disclose unreadable/unknown defaults and offer explicit fallback. Include other
facts only when established. The orchestrator shows the checked identities and
question, then redispatches with the selected identity/fallback or type/scope.
This uses the existing `type_scope_cycles` ledger, not a discovery retry loop.
`ERROR` covers evidence that cannot be resolved as a choice.

Keep overrides byte-exact, preserve selected template structure, and check the
title against the selected rule. Unknown tests stay unknown/unrun; never invent
checked boxes. Publishable body excludes traceability/source/author notes.
The checker validates shapes and bounds, not provenance truth, prose compliance,
or factual grounding.
