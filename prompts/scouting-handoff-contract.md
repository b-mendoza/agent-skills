# Scouting Handoff Contract (v4)

> Single normative definition of the phase boundary between
> `prompts/scouting-phase.prompt.md` (producer) and
> `prompts/improving-skill-phase.prompt.md` (consumer). This file defines the
> version literals `scouting-phase-v4`, `scouting-dossier-v4`, and
> `scouting-schema-v4`. Both prompts cite this file instead of restating the
> boundary; where prompt prose and this file disagree about a boundary rule,
> this file wins. Any change to this file requires bumping all three version
> literals here and in both prompts, because the producer records this file's
> SHA-256 in the handoff and the consumer verifies it byte-for-byte. A v3
> dossier or checkpoint is not resumable or consumable under v4 and must be
> regenerated.

## 1. Canonical artifact set and order

The dossier contains exactly nine regular files, in this canonical order:

1. `INDEX.md`
2. `structure.md`
3. `execution-flow.md`
4. `behavior.md`
5. `purpose.md`
6. `dependencies.md`
7. `external-research.md`
8. `findings.md`
9. `coverage-map.md`

This order is authoritative for the dossier fingerprint (§7.3) and the default
reading order. The `artifact_registry` list (§5) must use this order.

## 2. Shared grammars

### 2.1 Safe names and path segments

One grammar governs the skill name in both phases. A **safe name** matches
`^[a-z0-9][a-z0-9._-]{0,63}$` and additionally is not `.` or `..`, does not
end with `.`, and contains no `/`, `\`, NUL, or non-ASCII byte. Because the
grammar admits only ASCII, no Unicode-normalization ambiguity is possible.

- The producer must reject a `SKILL_NAME` (even one naming a real directory)
  that is not a safe name, reporting `not_started` with the reason before any
  dossier write.
- The consumer applies the identical predicate to the dossier-directory
  suffix and `skill_name`; because both phases share the grammar, a name the
  producer accepted can never fail the consumer's name check.

The same grammar (a **safe segment**) applies to any run identifier a phase
interpolates into a filesystem path.

### 2.2 Registry identifiers

Every scouting registry id matches:

```text
^(FILE|REF|EVD|QRY|SRC|PAT|FND|CAP|LIM)-[0-9]{4}$
```

The numeric portion is `0001` through `9999`; `0000` is invalid. Allocate ids
in the deterministic family order declared by the producer and never renumber
them. A family that would exceed `9999` is blocked with
`registry_capacity_exceeded`; widening the grammar requires a contract-version
bump. Lists of ids are unique and sorted by ascending numeric value, which is
also lexical order under this fixed width. Phase-2 ids inherit their own
contract; A2 round and attempt numbers remain separate two-digit fields.

## 3. Handoff YAML acceptance grammar

The **first substantive block** of `INDEX.md` is the first fenced code block
in the file, which must appear before any other fenced block and carry the
info string `yaml`. It must satisfy all of:

- Exactly one YAML document, UTF-8, no byte-order mark.
- The top level is a mapping with exactly one key: `scouting_handoff`.
- Mapping keys are unique at every nesting level.
- No anchors, aliases, merge keys, custom tags, or directives.
- Scalars are limited to plain or quoted strings, base-10 integers, `true`,
  `false`, and `null`. No floats, timestamps, sexagesimals, or other
  implicit-typing forms; values that look like them must be quoted strings.

The consumer rejects any violation as a malformed handoff. The producer's
final validation applies this same grammar to its own terminal `INDEX.md`.

## 4. `scouting_handoff` field schema

Every key below is required. "nullable" marks keys whose value is `null`
until the noted point; keys are never omitted. Types: `str`, `int`, `bool`,
`list[...]`, `map`. `sha256` means a 64-char lowercase hex string.

| Key | Type | Constraint |
| --- | --- | --- |
| `producer_contract` | str | literal `scouting-phase-v4` |
| `dossier_version` | str | literal `scouting-dossier-v4` |
| `schema_version` | str | literal `scouting-schema-v4` |
| `handoff_contract_sha256` | sha256 | SHA-256 of this file's exact bytes, recorded at baseline and immutable for the run |
| `run_id` | str | safe segment (§2.1) |
| `skill_name` | str | safe name (§2.1) |
| `target_path` | str | exact literal `skills/{skill_name}`; repository-relative, no `./`, no trailing slash |
| `scouting_dir` | str | exact literal `outputs/scouting-phase-{skill_name}`; same path rules |
| `repository_revision` | str | 40-char lowercase hex commit id of `HEAD` at baseline |
| `target_subtree_clean_at_closeout` | bool, nullable until closeout | true exactly when no record of the closeout filtered status snapshot names a path under `target_path`; non-null on `complete` |
| `target_manifest_digest` | sha256, nullable until closeout | filesystem digest per §7.5; non-null on `complete` |
| `repository_target_tree_digest` | sha256, nullable until closeout | digest of `repository_revision`'s target tree per §7.6; non-null on `complete` |
| `git_recoverable_at_closeout` | bool, nullable until closeout | true exactly under §7.6; non-null on `complete`; required true to use `git_recoverable` |
| `started_at` | str | ISO 8601 UTC timestamp `YYYY-MM-DDThh:mm:ssZ` |
| `completed_at` | str, nullable until terminal | same format; non-null at terminal |
| `baseline_algorithm` | str | literal `git-status-v4` |
| `baseline_snapshot` | map | either `{inline: str}` containing the exact filtered snapshot bytes decoded as UTF-8, or `{sha256: sha256, line_count: int >= 0}`; parsing and filtering per §7.1 |
| `dirty_path_digests` | map | one entry per unique path named in the filtered baseline snapshot, holding its typed digest (§7.4); `{}` when empty |
| `governing_source_paths` | list[str] | unique ascending repository-relative paths of every repository-instruction file cited for conformance; `[]` when none |
| `governing_source_digests` | map | keys exactly equal `governing_source_paths`; value is the §7.4 typed digest bound to the cited evidence; `{}` when no governing sources |
| `dispatch_mode` | str | enum `inline \| delegated \| mixed` |
| `validation_mode` | str | enum `self_check \| independent` |
| `last_completed_phase` | int | 0–6 |
| `last_completed_gate` | str, nullable | enum §6.1 |
| `terminal_status` | str, nullable while nonterminal | enum `complete \| blocked \| error` |
| `blocker_code` | str, nullable | non-null exactly when `terminal_status` is `blocked`; null otherwise |
| `resumable` | bool | true only when the checkpoint reconciles and the blocker/error can continue without rebaseline or forbidden repair; false on `complete` and non-repairable failures |
| `resume_prerequisite` | str, nullable | bounded missing condition when resumable; null otherwise |
| `research_budget` | map | exactly the keys `follow_up_queries` (0–20), `screened_candidates` (1–200), `deep_inspections` (1–50), `pattern_cards` (1–100), `literature_items` (0–20); each int in range |
| `research_result` | str, nullable while `last_completed_phase < 4` | once phase 4 completes, non-null and paired per §6.10; `complete` also requires stop not `BLOCKED` |
| `research_stop` | str, nullable while `last_completed_phase < 4` | once phase 4 completes, non-null and paired per §6.10; `complete` forbids `BLOCKED` |
| `artifact_registry` | list[map] | exactly 9 entries per §5, in canonical order |
| `coverage_counts` | map | per §8 |
| `pattern_ids` | list[str] | `PAT-*` ids per §2.2, unique and ascending; `[]` when none |
| `pattern_count` | int | equals `len(pattern_ids)` |
| `limitation_ids` | list[str] | `LIM-*` ids per §2.2, unique and ascending; `[]` when none |
| `limitation_count` | int | equals `len(limitation_ids)` |
| `finding_ids` | list[str] | `FND-*` ids per §2.2, unique and ascending; `[]` when none |
| `finding_count` | int | equals `len(finding_ids)` |
| `capability_ids` | list[str] | `CAP-*` ids per §2.2, unique and ascending; `[]` when none |
| `capability_count` | int | equals `len(capability_ids)` |
| `id_family_counts` | map | keys exactly `FILE`, `REF`, `EVD`, `QRY`, `SRC`; each int 0–9999; full lists live in owning registries |
| `limitation_rows` | list[map] | one complete §9.9 record per `LIM-*`; id set equals `limitation_ids` |
| `finding_rows` | list[map] | one complete §9.8 record per `FND-*`; id set equals `finding_ids` |
| `capability_rows` | list[map] | one complete §9.5 record per `CAP-*`; id set equals `capability_ids` |
| `gate_verdicts` | map | keys exactly the seven gates of §6.1; each `pass \| fail \| unknown` |
| `mutation_proof` | map | keys exactly `head_unchanged`, `target_hashes_unchanged`, `snapshot_equivalent`, `dirty_digests_unchanged`, `output_root_clean`; each bool, nullable until closeout; all true on `complete` |
| `write_ledger` | list[map] | one entry per artifact ever written: `{file: str, last_write_phase: int}` |
| `dossier_schema_anchor` | str | literal `coverage-map.md#scouting-schema-v4` |
| `reading_order` | list[str] | a permutation of the nine canonical filenames |

For `terminal_status: complete`, all nullable closeout fields above are non-null,
all seven `gate_verdicts` are `pass`, `research_stop` is not `BLOCKED`, all five
`mutation_proof` fields are true, `resumable` is false with null prerequisite,
and every list/count/map equality in this section holds. `git_recoverable_at_closeout` may be false on a complete dossier;
it controls preservation eligibility rather than dossier validity.

## 5. `artifact_registry` entry schema

Each of the nine entries is a mapping with exactly these keys:

- `file`: one of the nine canonical filenames.
- `sha256`: type `sha256` for every non-index entry. For the `INDEX.md` entry only, type is `sha256 | literal PENDING`: `PENDING` at non-terminal checkpoints and the §7.2 sentinel hash at terminal.
- `hash_kind`: `sha256` for the eight non-index artifacts;
  `index_payload_sha256` for `INDEX.md`.

## 6. Enums

### 6.1 Producer gates

`G_INPUT`, `G_BASELINE`, `G_INVENTORY`, `G_MAP`, `G_RESEARCH`, `G_DOSSIER`,
`G_MUTATION`.

### 6.2 Row statuses

- File read: `complete | metadata_only | unreadable`
- Reference: `resolved | missing | external_to_target | cross_skill | generated | indeterminate`
- Coverage: `EVIDENCED | ABSENT | UNKNOWN | NOT_APPLICABLE`
- Source screening: `eligible | rejected | duplicate | unavailable`
- Validation: `pass | fail | unknown`

### 6.3 Evidence labels

`TARGET_FACT`, `STATIC_INFERENCE`, `CONFORMANCE_OBSERVATION`,
`EXTERNAL_PATTERN`, `UNKNOWN`.

### 6.4 Facet slugs

`identity-purpose-audience-premise-nongoals`,
`posture-priorities-tradeoffs-voice-boundaries`,
`inputs-preconditions-modes`,
`outputs-handoffs-criticality-lifecycle`,
`phases-steps-states-transitions`,
`branches-gates-loops-retries-feedback`,
`statuses-errors-empty-terminal-states`,
`validation-observability-empirical-checks`,
`delegation-context-concurrency-merge`,
`ambiguity-autonomy-escalation`,
`tools-permissions-mutations-external-effects`,
`dependencies-references-load-conditions-runtime-assumptions`,
`structure-progressive-disclosure-portability-conformance`,
`failure-modes-contradictions-unknowns-limitations`.

### 6.5 `research_result`

`NO_RESULTS`, `RESULTS_NONE_ELIGIBLE`, `NO_ELIGIBLE_AMONG_READABLE_SOURCES`,
`NO_ELIGIBLE_WITHIN_BUDGET`, `PATTERNS_FOUND`, `UNDETERMINED_DUE_TO_OUTAGE`.

### 6.6 `research_stop`

`SATURATED_WITHIN_BUDGET`, `CAP_REACHED_BEFORE_SATURATION`, `PARTIAL_OUTAGE`,
`BLOCKED`.

### 6.7 Limitation origin classes

`static_boundary`, `incomplete_inspection`, `external_unavailable`,
`tooling_gap`.

### 6.8 Limitation codes

`code` is a machine-routable literal. Reserved values:
`HOST_UNAVAILABLE`, `COUNT_UNAVAILABLE`, `CAP_REACHED_BEFORE_SATURATION`,
`PARTIAL_OUTAGE`, `METADATA_NOT_EXPOSED`, `TINY_FILE_EXCEPTION`,
`METADATA_ONLY_FILE`, `INDETERMINATE_REFERENCE`, `GENERAL`. A limitation not
matching a reserved value uses `GENERAL`; new codes require a version bump.

### 6.9 External-source metadata states

`KNOWN`, `NOT_EXPOSED`, `NOT_FOUND`, `AMBIGUOUS`.

### 6.10 Result/stop compatibility matrix

Exactly these `(research_result, research_stop)` pairs are legal:

| `research_stop` | legal `research_result` values |
| --- | --- |
| `SATURATED_WITHIN_BUDGET` | `NO_RESULTS`, `RESULTS_NONE_ELIGIBLE`, `PATTERNS_FOUND` |
| `CAP_REACHED_BEFORE_SATURATION` | `NO_RESULTS`, `RESULTS_NONE_ELIGIBLE`, `NO_ELIGIBLE_WITHIN_BUDGET`, `PATTERNS_FOUND` |
| `PARTIAL_OUTAGE` | `NO_ELIGIBLE_AMONG_READABLE_SOURCES`, `PATTERNS_FOUND` |
| `BLOCKED` | `UNDETERMINED_DUE_TO_OUTAGE` |

Stop precedence when conditions overlap: `BLOCKED` > `PARTIAL_OUTAGE` >
`CAP_REACHED_BEFORE_SATURATION` > `SATURATED_WITHIN_BUDGET`. A dossier with
`terminal_status: complete` must carry non-null values forming a legal pair
with `research_stop` != `BLOCKED`.

## 7. Algorithms

### 7.1 Repository baseline (`git-status-v4`)

Record `HEAD` from `git rev-parse HEAD`. Capture
`git status --porcelain=v2 --untracked-files=all` as raw UTF-8 lines in Git's
emitted order. A path that decodes to invalid UTF-8 is a baseline blocker
because handoff map keys are Unicode strings. Parse record paths as follows:

- `1` ordinary and `u` unmerged records name the final path field.
- `2` rename/copy records name both the current path and the original path;
  the two path fields are separated by the record's TAB delimiter.
- `?` untracked and `!` ignored records name the path after the two-character
  record prefix. `!` is accepted by the parser even though the required command
  does not request ignored records.
- Decode a double-quoted path using Git's C-style quote rules; an unquoted path
  is its literal UTF-8 bytes. Reject malformed quoting, absolute paths, `./`,
  NUL, or a repository-escaping `..` component.

For scouting, the nine dossier paths are the exact repository-relative strings
`{scouting_dir}/{filename}` for the nine §1 filenames; exclude a record only
when every named path is one of those strings. For phase 2 pre-approval
baselines, exclude only exact registered run-root paths. After Category B
approval, additionally exclude only exact paths represented by the approved
object manifest, including approved SCOPE_LIMITS expansions. Never exclude an
entire target or expansion directory merely by prefix unless every descendant
object is represented in that manifest. A cross-boundary rename is retained. Preserve every
retained record's original bytes and order. `baseline_snapshot.inline` is the
exact retained line stream; the hashed form hashes those same bytes and records
the retained line count.

`dirty_path_digests` contains one key for every unique named path in retained
records, including both sides of rename/copy records, with its §7.4 typed
digest. At closeout, `snapshot_equivalent` is exact byte equality of the
retained line streams, and `dirty_digests_unchanged` is exact key-set and typed-
digest equality. This proof is content-sensitive for pre-existing dirty paths.

### 7.2 `index_payload_sha256` sentinel

The sole storage location is the `artifact_registry` entry whose `file` is
`INDEX.md` and `hash_kind` is `index_payload_sha256`; no top-level or extra
handoff field exists. At a non-terminal checkpoint that entry's `sha256` is
literal `PENDING`. For terminal bytes, replace exactly that entry's own 64-hex
`sha256` value with literal `__INDEX_PAYLOAD_SHA256__`, with no newline or
Unicode normalization, then SHA-256 the result and store it back in that entry.
No other occurrence of the same 64-hex value is allowed.

### 7.3 Dossier fingerprint (`dossier-fingerprint-v1`)

In the canonical artifact order of §1, hash each file's actual bytes with
SHA-256 (for `INDEX.md`, the actual bytes as written, not sentinel form).
Serialize one ASCII row per file: filename, one TAB, lowercase hex hash, one LF.
SHA-256 the exact concatenated row stream. Registry order and `reading_order`
are irrelevant.

### 7.4 Typed path digest

A typed digest is `{tag}:{value}`, determined by no-follow inspection:

- `file:{mode}:{sha256 of file bytes}`, where mode is `x` when any executable bit is set and `n` otherwise
- `symlink:{sha256 of readlink target raw bytes}`; never follow the link
- `gitlink:{value}` per the rule below
- `dir:` for a plain directory; contents are not represented by this one digest
- `missing:` when no object exists
- `other:{kind}` where kind is `socket|fifo|block|char|unknown` from no-follow metadata

Every value is ASCII. Equality requires equal tag and value, so a type change is
always a mismatch.

A directory entry is `gitlink` (taking precedence over `dir`) when the
containing repository records mode `160000` at that path or the directory
contains a `.git` entry. Its value is the nested worktree's checked-out commit
id from Git metadata; when unavailable, use the mode-160000 object id from the
containing index or `HEAD`; when neither resolves, use `unresolved`. A gitlink
is a traversal boundary.

### 7.5 Filesystem target manifest digest

`target_manifest_digest` summarizes the complete target subtree, including
hidden, untracked, and Git-ignored entries, with gitlinks as boundaries. Walk
`target_path` without following symlinks, include every entry of every type,
and sort by ascending raw-byte relative path. For each entry compute §7.4 typed
digest. Each row is: ASCII decimal byte length of raw relative path, `:`, raw
relative path bytes exactly as returned by the filesystem, `:`, typed digest,
LF. SHA-256 the exact row stream. An absent or empty target yields SHA-256 of
the empty stream. The producer records this at closeout from the same walk that
owns the `FILE-*` registry; the consumer may recompute it over an occupied
target only through the mechanical-hashing exception.

### 7.6 Repository target tree digest and Git recoverability

`repository_target_tree_digest` applies the §7.5 row serialization to the tree
at `{repository_revision}:{target_path}` without checking it out. Include every
descendant tree entry and plain directory row. Map Git modes as follows:

- mode `100644` blob -> `file:n:{sha256 of blob bytes}`
- mode `100755` blob -> `file:x:{sha256 of blob bytes}`
- symlink blob -> `symlink:{sha256 of blob bytes}` (Git stores link-target bytes)
- tree -> `dir:`
- mode `160000` -> `gitlink:{object id}` and do not descend

Git trees cannot contain `other` objects or ignored/untracked entries. An absent
or empty target tree yields SHA-256 of the empty stream.

`git_recoverable_at_closeout` is true exactly when all of these hold:

1. `target_subtree_clean_at_closeout` is true.
2. `target_manifest_digest == repository_target_tree_digest`.
3. `{repository_revision}:{target_path}` resolves to a tree.

The equality proves that every scouted filesystem entry is represented by the
recorded revision, including the absence of ignored, untracked, or non-tree
extras. A clean Git status alone never establishes Git recoverability.

### 7.7 Governing-source digest binding

For each path in `governing_source_paths`, bind the conformance evidence to the
§7.4 typed digest observed on its complete read. Recompute at closeout. On one
mismatch, invalidate claims derived from that source and re-read once; a second
mismatch blocks with `governing_source_changed_during_read`.
`governing_source_digests` stores the final bound values. The consumer compares
current §7.4 digests directly with this map; it never substitutes Git object ids
or a projection of `dirty_path_digests`.

### 7.8 Mutation-proof predicates

The five §4 fields have these exact predicates at closeout:

- `head_unchanged`: current `git rev-parse HEAD` equals `repository_revision`.
- `target_hashes_unchanged`: the closeout §7.5 digest equals the baseline-bound
  target digest derived from the same canonical `FILE-*` walk, and every regular
  file's SHA-256/executable bit equals its canonical file record.
- `snapshot_equivalent`: exact filtered-snapshot byte equality under §7.1.
- `dirty_digests_unchanged`: exact retained-path key-set and typed-digest
  equality under §7.1.
- `output_root_clean`: `scouting_dir` is a real contained directory containing
  exactly the nine §1 regular non-symlink artifacts and no other entry; every
  artifact path is untracked and unstaged.

Each field records the predicate result directly. A `complete` dossier requires
all five true; no producer-local reinterpretation is allowed.

## 8. `coverage_counts` schema

A mapping with exactly these keys, all int 0–9999:

- `facet_rows_total` and per-status counts
  `facet_rows_evidenced`, `facet_rows_absent`, `facet_rows_unknown`,
  `facet_rows_not_applicable`; the four sum to total.
- `entries_total`: `FILE-*` rows for all walked entries, including hidden,
  ignored, untracked, directory, symlink, gitlink, and `other` entries.
- `regular_files_total`.
- `files_read_complete`, `files_metadata_only`; for `complete`, their sum equals
  `regular_files_total` and no `unreadable` row exists.
- `references_total`: `REF-*` rows.
- `evidence_total`: `EVD-*` rows.

Counts count canonical registry rows, never prose mentions.

## 9. Canonical registry serialization and field schemas

### 9.1 Serialization rule

Each canonical registry is exactly one fenced `yaml` block immediately below
its fixed anchor and heading. The block contains one mapping with exactly the
root key shown below; its value is a list of exact-key mappings. Explanatory
Markdown may appear outside the block but is not canonical data.

| Family | Artifact | Anchor | YAML root |
| --- | --- | --- | --- |
| `FILE-*` | `structure.md` | `file-registry-v4` | `file_registry` |
| `REF-*` | `dependencies.md` | `reference-registry-v4` | `reference_registry` |
| `EVD-*` | `coverage-map.md` | `evidence-registry-v4` | `evidence_registry` |
| `QRY-*` | `external-research.md` | `query-registry-v4` | `query_registry` |
| `SRC-*` | `external-research.md` | `source-registry-v4` | `source_registry` |
| `PAT-*` | `external-research.md` | `pattern-registry-v4` | `pattern_registry` |
| `FND-*` | `findings.md` | `finding-registry-v4` | `finding_registry` |
| `CAP-*` | `behavior.md` | `capability-registry-v4` | `capability_registry` |
| `LIM-*` | `coverage-map.md` | `limitation-registry-v4` | `limitation_registry` |
| facet rows | `coverage-map.md` | `facet-coverage-v4` | `facet_coverage` |
| excerpt ledger | `coverage-map.md` | `excerpt-ledger-v4` | `excerpt_ledger` |

Registry blocks use the acceptance restrictions of §3 for their YAML values.
An empty registry uses the empty list under its root and the surrounding section
also carries the §11 `ZERO-STATE:` paragraph.

### 9.2 File record (`FILE-*`)

| Key | Type | Constraint |
| --- | --- | --- |
| `id` | str | `FILE-*` per §2.2 |
| `path` | str | target-relative display path; repository-safe UTF-8 representation |
| `type` | str | `file|dir|symlink|gitlink|other` |
| `size_bytes` | int or null | non-negative for file; null otherwise |
| `sha256` | sha256 or null | regular file only |
| `executable` | bool or null | regular file only; true when any executable bit is set |
| `classification` | str or null | `text|non_text`; regular file only |
| `classification_basis` | str or null | textual role or successful text read; regular file only |
| `line_count` | int or null | text file only |
| `read_status` | str or null | file-read enum §6.2; regular file only |
| `symlink_target` | str or null | symlink only; display form, link not followed |
| `gitlink_value` | str or null | gitlink only, per §7.4 |
| `other_kind` | str or null | `socket|fifo|block|char|unknown` for `other`; null otherwise |

### 9.3 Reference record (`REF-*`)

| Key | Type | Constraint |
| --- | --- | --- |
| `id` | str | `REF-*` per §2.2 |
| `source_file_id` | str | existing `FILE-*` |
| `locator` | str | stable locator in source file |
| `reference_kind` | str | detector category used |
| `raw_reference` | str | bounded observed reference text |
| `resolved_target` | str or null | target path/URL when determinable |
| `status` | str | reference enum §6.2 |
| `limitation_id` | str or null | required for `indeterminate` |

### 9.4 Evidence record (`EVD-*`)

| Key | Type | Constraint |
| --- | --- | --- |
| `id` | str | `EVD-*` per §2.2 |
| `label` | str | evidence label §6.3 |
| `claim` | str | concise material claim |
| `subject_ids` | list[str] | registry ids or singleton `TARGET` |
| `source` | str or null | target path or canonical URL; null only for inaccessible `UNKNOWN` |
| `locator` | str or null | stable source locator when source exists |
| `source_revision` | str or null | target SHA-256 or external revision |
| `evidence_kind` | str | `excerpt|negative_observation|non_text_metadata|unavailable` |
| `evidence_role` | str | `primary|corroboration`; corroboration cannot establish source/pattern eligibility |
| `observation_method` | map or null | required exactly for `negative_observation`; exact keys `scope_ids`, `detectors`, `result`, `checkpoint` |
| `evidence` | str or map or null | smallest sufficient excerpt or structured observation/metadata |
| `interpretation` | str or null | explicit inference when needed |
| `supporting_evidence_ids` | list[str] | existing `EVD-*`; `[]` when none |
| `limitation_id` | str or null | existing `LIM-*` when applicable |

### 9.5 Capability record (`CAP-*`)

| Key | Type | Constraint |
| --- | --- | --- |
| `id` | str | `CAP-*` per §2.2 |
| `statement` | str | one sentence; positive current documented behavior/contract |
| `facet` | str | §6.4 slug |
| `evidence_ids` | list[str] | one or more existing `EVD-*` |
| `finding_ids` | list[str] | qualifying `FND-*`; `[]` when none |
| `criticality` | str | `core|supporting` |

Capabilities are observations, not recommendations. The handoff
`capability_rows` contains these exact records.

### 9.6 Query record (`QRY-*`)

| Key | Type | Constraint |
| --- | --- | --- |
| `id` | str | `QRY-*` per §2.2 |
| `family` | str | declared query family |
| `target_evidence_ids` | list[str] | supporting `EVD-*` |
| `query` | str | exact query |
| `host` | str | queried host |
| `interface` | str | exact interface/tool |
| `date` | str | `YYYY-MM-DD` |
| `result_count` | int or str | non-negative int or literal `COUNT_UNAVAILABLE` |
| `inspected_depth` | int | non-negative |
| `outcome` | str | concise result |
| `retry_or_fallback` | str or null | route used when applicable |
| `source_ids` | list[str] | newly found `SRC-*` |
| `pattern_ids` | list[str] | newly found `PAT-*` |

### 9.7 Source record (`SRC-*`)

| Key | Type | Constraint |
| --- | --- | --- |
| `id` | str | `SRC-*` per §2.2 |
| `source_kind` | str | `skill_definition|literature` |
| `host` | str | source host |
| `owner_project` | str | canonical owner/project |
| `exact_path` | str | exact definition/supporting path |
| `canonical_url` | str | canonical upstream URL |
| `immutable_url` | str or null | commit permalink when obtainable |
| `revision` | str or null | immutable revision when obtainable |
| `path_change_date` | str | date or metadata state §6.9 |
| `access_date` | str | `YYYY-MM-DD` |
| `inspection_state` | str | concise state |
| `screening_status` | str | source-screening enum §6.2 |
| `screening_reason` | str | evidence-backed reason |
| `duplicate_of` | str or null | existing `SRC-*` |
| `license_state` | str | metadata state §6.9 |
| `evidence_locators` | list[str] | direct locators |
| `pattern_ids` | list[str] | supported `PAT-*` |

### 9.8 Finding record (`FND-*`)

| Key | Type | Constraint |
| --- | --- | --- |
| `id` | str | `FND-*` per §2.2 |
| `claim` | str | one sentence stating fact, contradiction, mismatch, failure mode, or unresolved question |
| `evidence_ids` | list[str] | one or more `EVD-*`, except unresolved questions may use `[]` with limitation |
| `limitation_ids` | list[str] | linked `LIM-*`; required when evidence list is empty |
| `confidence` | str | `high|medium|low` |
| `effect` | str | one sentence stating what a consumer would misread without the finding |

Findings contain no fixes, severity rankings, or remediation language. The
handoff `finding_rows` contains these exact records.

### 9.9 Limitation record (`LIM-*`)

| Key | Type | Constraint |
| --- | --- | --- |
| `id` | str | `LIM-*` per §2.2 |
| `code` | str | §6.8 |
| `statement` | str | one sentence stating what is uncertain/unavailable |
| `affected_scope` | str | claim, facet, artifact, or research step |
| `attempted_checks` | list[str] | checks actually attempted; non-empty |
| `stop_reason` | str | why checks failed or stopped |
| `origin` | str | §6.7 |
| `evidence_ids` | list[str] | linked `EVD-*`; `[]` when none |
| `finding_ids` | list[str] | linked `FND-*`; `[]` when none |

The handoff `limitation_rows` contains these exact records.

### 9.10 Pattern record (`PAT-*`)

| Key | Type | Constraint |
| --- | --- | --- |
| `id` | str | `PAT-*` per §2.2 |
| `mechanism` | str | mechanism-grain name |
| `source_ids` | list[str] | one or more eligible skill-definition `SRC-*` |
| `evidence_ids` | list[str] | direct external `EVD-*` |
| `preconditions` | list[str] | observed preconditions |
| `steps` | list[str] | observed steps |
| `outputs` | list[str] | observed outputs |
| `apparent_purpose` | str | explicitly inference |
| `comparison_loci` | list[map] | each exact keys `target_anchor`, `difference`, `phase2_question` |
| `material_differences` | list[str] | target/source differences |
| `operating_assumptions` | list[str] | assumptions |
| `portability` | str | consideration, not verdict |
| `license` | str | descriptive evidence state |
| `compatibility` | str | consideration |
| `complexity` | str | consideration |
| `risks` | list[str] | transfer risks |
| `phase2_question` | str | decision question |

### 9.11 Facet coverage row

| Key | Type | Constraint |
| --- | --- | --- |
| `facet` | str | §6.4 slug |
| `subject_id` | str | registry id or `TARGET` |
| `status` | str | coverage enum §6.2 |
| `artifact_anchor` | str | §10 |
| `evidence_ids` | list[str] | `[]` only for `NOT_APPLICABLE` |
| `finding_ids` | list[str] | `[]` when none |
| `limitation_id` | str or null | required for `UNKNOWN`, null otherwise |
| `explanation` | str | concise disposition |

Every facet slug appears in at least one row.

### 9.12 Excerpt/reconstructability record

One row per target or external source from which any excerpt is retained:

| Key | Type | Constraint |
| --- | --- | --- |
| `source` | str | target path or canonical URL |
| `source_revision` | str | target SHA-256 or external revision |
| `source_line_count` | int or null | non-negative when line-addressable |
| `quoted_ranges` | list[str] | canonical non-overlapping line ranges, ascending |
| `quoted_line_count` | int | sum of unique quoted lines |
| `evidence_ids` | list[str] | all `EVD-*` using those excerpts |
| `tiny_file_exception` | bool | true only when complete source is at most 12 lines and partial quotation would mislead |
| `exception_justification` | str or null | required exactly when exception true |
| `reconstructability_verdict` | str | `pass|fail` |

Without a tiny-file exception, no one contiguous quoted span exceeds 12 lines
and aggregate quoted lines do not exceed the smaller of 40 lines or 25 percent
of a line-addressable source (rounding up to one line). Non-line-addressable
sources use bounded semantic units and record `source_line_count: null`; their
verdict remains an explicit gate judgment. A `fail` row forbids `complete`.

### 9.13 Registry ownership and reconciliation

Each family has exactly one owning artifact per §9.1. Handoff lists and rows
must equal owning registry sets exactly. `limitation_rows`, `finding_rows`, and
`capability_rows` must byte-semantically equal the corresponding canonical
record mappings after YAML parse. For count-only families, `id_family_counts`
must equal registry row counts; `FILE`, `REF`, and `EVD` also equal
`coverage_counts.entries_total`, `references_total`, and `evidence_total`.

## 10. Anchor grammar

An anchor reference is `{filename}#{anchor-id}` where filename is canonical and
anchor id matches `^[a-z0-9][a-z0-9-]*$`. An anchor is an explicit
`<a id="{anchor-id}"></a>` line immediately above its heading and is unique in
its file. Registry anchors are fixed by §9.1. The schema anchor is literal
`coverage-map.md#scouting-schema-v4`.

## 11. Zero states

No required key, registry, or section is omitted for emptiness.

- Handoff YAML uses `[]`, `0`, `{}`, and `null` only where §4 permits null.
- A canonical registry block uses its required root with `[]`.
- A required Markdown section with no rows contains exactly one paragraph
  beginning `ZERO-STATE:` followed by the empty population and evidence or
  negative-observation basis, with `EVD-*` when one exists.

## 12. Required artifact content

Each artifact contains the following, with canonical registries and anchors per
§9 and zero states per §11:

- `INDEX.md` — handoff block (§§3–4), sentinel statement, artifact registry.
- `structure.md` — complete `FILE-*` manifest for every target entry, including
  hidden, ignored, untracked, symlink, gitlink boundary, and `other`; separately
  labeled conformance observations.
- `execution-flow.md` — phases/steps/states, branches/gates, loops/retries,
  feedback, dispatch/concurrency, statuses/stops, escalation, critical outputs,
  handoffs, contradictions and unreachable routes, with evidence ids.
- `behavior.md` — inputs/preconditions/modes; outputs/mutations; permissions,
  tools and external effects; context/delegation; validation; lifecycle;
  error/empty/ambiguity/autonomy handling; runtime unknowns; `CAP-*` registry.
- `purpose.md` — stated purpose, audience, premise, value claims, identity,
  mental model, priorities, posture, trade-offs, voice, boundaries and
  non-goals; inferred rationale labeled `STATIC_INFERENCE`.
- `dependencies.md` — `REF-*` registry plus unreferenced-file observations.
- `external-research.md` — effective budget, `QRY-*`, `SRC-*`, and `PAT-*`
  registries, eligibility decisions, research limitations and stop reason.
- `findings.md` — canonical `FND-*` registry.
- `coverage-map.md` — schema provenance stamp (§13), facet coverage, `EVD-*` and
  `LIM-*` registries, excerpt/reconstructability ledger, integrity checks.

## 13. Consumer validation rule

The consumer validates the dossier against this file, not a transcription. It:

1. Hashes local `prompts/scouting-handoff-contract.md` and requires equality
   with `handoff_contract_sha256`.
2. Requires the v4 literals, `git-status-v4`, and v4 schema anchor.
3. Checks §§1–12 directly: handoff grammar/fields, artifact order, registry
   serialization, record schemas, hashes, algorithms, enums, counts, anchors,
   zero states, complete-state rules, and required content.
4. Requires exact reconciliation of all id sets and handoff row projections.
5. Rejects v3 dossiers/checkpoints; they must be regenerated under v4.

The `dossier-schema` section at `coverage-map.md#scouting-schema-v4` records the
three version literals and `handoff_contract_sha256`; it is a provenance stamp,
not an independent schema and cannot relax this contract.
