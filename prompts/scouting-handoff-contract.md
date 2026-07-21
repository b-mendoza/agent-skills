# Scouting Handoff Contract (v3)

> Single normative definition of the phase boundary between
> `prompts/scouting-phase.prompt.md` (producer) and
> `prompts/improving-skill-phase.prompt.md` (consumer). This file defines the
> version literals `scouting-phase-v3`, `scouting-dossier-v3`, and
> `scouting-schema-v3`. Both prompts cite this file instead of restating the
> boundary; where prompt prose and this file disagree about a boundary rule,
> this file wins. Any change to this file requires bumping all three version
> literals here and in both prompts, because the producer records this file's
> SHA-256 in the handoff and the consumer verifies it byte-for-byte.

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

## 2. Safe name grammar (shared)

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
| `producer_contract` | str | literal `scouting-phase-v3` |
| `dossier_version` | str | literal `scouting-dossier-v3` |
| `schema_version` | str | literal `scouting-schema-v3` |
| `handoff_contract_sha256` | sha256 | SHA-256 of this file's exact bytes, recorded at baseline and immutable for the run |
| `run_id` | str | safe segment (§2) |
| `skill_name` | str | safe name (§2) |
| `target_path` | str | exact literal `skills/{skill_name}`; repository-relative, no `./`, no trailing slash |
| `scouting_dir` | str | exact literal `outputs/scouting-phase-{skill_name}`; same path rules |
| `repository_revision` | str | 40-char lowercase hex commit id of `HEAD` at baseline |
| `target_subtree_clean_at_closeout` | bool, nullable until closeout | true exactly when no row of the closeout filtered status snapshot names a path under `target_path` |
| `started_at` | str | ISO 8601 UTC timestamp `YYYY-MM-DDThh:mm:ssZ` |
| `completed_at` | str, nullable until terminal | same format |
| `baseline_algorithm` | str | literal `git-status-v3` |
| `baseline_snapshot` | map | either `{inline: str}` (the verbatim filtered snapshot) or `{sha256: sha256, line_count: int >= 0}` |
| `dirty_path_digests` | map | one entry per path named in the baseline filtered snapshot, holding its typed digest (§7.4); `{}` when the snapshot is empty |
| `target_manifest_digest` | sha256, nullable until closeout | digest of the complete target subtree per §7.5, computed at closeout |
| `dispatch_mode` | str | enum `inline \| delegated \| mixed` |
| `validation_mode` | str | enum `self_check \| independent` |
| `last_completed_phase` | int | 0–6 |
| `last_completed_gate` | str, nullable | enum §6.1 |
| `terminal_status` | str, nullable while nonterminal | enum `complete \| blocked \| error` |
| `blocker_code` | str, nullable | non-null exactly when `terminal_status` is `blocked`; null otherwise |
| `research_budget` | map | exactly the keys `follow_up_queries` (0–20), `screened_candidates` (1–200), `deep_inspections` (1–50), `pattern_cards` (1–100), `literature_items` (0–20); each int in its range |
| `research_result` | str, nullable until phase 4 | enum §6.5; non-null when `terminal_status` is `complete`; pairing per §6.10 |
| `research_stop` | str, nullable until phase 4 | enum §6.6; non-null when `terminal_status` is `complete`; pairing per §6.10 |
| `artifact_registry` | list[map] | exactly 9 entries per §5, in canonical order |
| `coverage_counts` | map | per §8 |
| `pattern_ids` | list[str] | zero-padded `PAT-*`, unique, ascending; `[]` when none |
| `pattern_count` | int | equals `len(pattern_ids)` |
| `limitation_ids` | list[str] | `LIM-*`, unique, ascending; `[]` when none |
| `limitation_count` | int | equals `len(limitation_ids)` |
| `finding_ids` | list[str] | `FND-*`, unique, ascending; `[]` when none |
| `finding_count` | int | equals `len(finding_ids)` |
| `capability_ids` | list[str] | `CAP-*`, unique, ascending; `[]` when none |
| `capability_count` | int | equals `len(capability_ids)` |
| `id_family_counts` | map | keys exactly `FILE`, `REF`, `EVD`, `QRY`, `SRC`; each int >= 0 (counts only; full lists live in their owning artifacts) |
| `governing_source_paths` | list[str] | repository-relative paths of every repository-instruction file the dossier cites for conformance (the external specification URL is excluded); `[]` when none |
| `gate_verdicts` | map | keys exactly the seven gates of §6.1; each `pass \| fail \| unknown` |
| `limitation_rows` | list[map] | one complete record per `LIM-*` id, fields per §9.2 |
| `mutation_proof` | map | keys exactly `head_unchanged`, `target_hashes_unchanged`, `snapshot_equivalent`, `dirty_digests_unchanged`, `output_root_clean`; each bool, nullable until closeout; all must be `true` when `terminal_status` is `complete` |
| `write_ledger` | list[map] | one entry per artifact ever written: `{file: str, last_write_phase: int}` |
| `dossier_schema_anchor` | str | anchor reference per §10, literal `coverage-map.md#scouting-schema-v3` |
| `reading_order` | list[str] | a permutation of the nine canonical filenames |

## 5. `artifact_registry` entry schema

Each of the nine entries is a mapping with exactly these keys:

- `file`: one of the nine canonical filenames.
- `sha256`: lowercase hex hash — ordinary SHA-256 of the file bytes for the
  eight non-index artifacts; for `INDEX.md`, the sentinel hash of §7.2, or
  the literal string `PENDING` before the terminal write.
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
with `research_stop` ≠ `BLOCKED`. The consumer rejects any other combination.

## 7. Algorithms

### 7.1 Repository baseline (`git-status-v3`)
Record `HEAD` from `git rev-parse HEAD`. Capture
`git status --porcelain=v2 --untracked-files=all` verbatim, excluding only
lines whose path is one of the nine dossier paths. Store the snapshot inline,
or its SHA-256 plus line count when long. Additionally record
`dirty_path_digests`: for every path named in the filtered snapshot, its
typed digest per §7.4. At closeout, `snapshot_equivalent` compares the
filtered snapshots and `dirty_digests_unchanged` recomputes and compares the
digests — this makes the proof content-sensitive for pre-existing dirty
paths, which bare porcelain rows are not.

### 7.2 `index_payload_sha256` sentinel
In the raw UTF-8 bytes of the terminal `INDEX.md`, replace exactly the one
occurrence of its own hash value with the literal
`__INDEX_PAYLOAD_SHA256__`, with no newline or Unicode normalization, then
SHA-256 those bytes. Computed exactly once, at the terminal write; the field
holds the literal `PENDING` at every non-terminal checkpoint.

### 7.3 Dossier fingerprint (`dossier-fingerprint-v1`)
In the canonical artifact order of §1, hash each file's actual bytes with
SHA-256 (for `INDEX.md`, the actual bytes as written — not the sentinel
form). Serialize one ASCII row per file: filename, one TAB, lowercase hex
hash, one LF. SHA-256 the exact concatenated row stream. Registry order and
`reading_order` are irrelevant to this computation.

### 7.4 Typed path digest

A typed digest is the string `{tag}:{value}` where `{tag}` and `{value}` are
determined by no-follow inspection of the path plus the gitlink rule below:
`file:{sha256 of the file's bytes}`; `symlink:{sha256 of the link-target's
raw bytes, exactly as returned by readlink, no encoding assumption}` (the
link is never followed); `gitlink:{value}` per the next paragraph; `dir:`
with empty value (a plain directory — contents are not descended into);
`missing:` with empty value (no filesystem object); `other:` with empty
value (socket, fifo, device, or any other type). Every value is ASCII
(lowercase hex or a fixed literal), so a typed digest never contains TAB,
LF, or non-ASCII bytes. Two typed digests are equal only when tag and value
are both equal, so a path changing type is always a mismatch.

Gitlink rule: a directory entry is classified `gitlink` — taking precedence
over `dir` — when the containing repository's Git metadata records mode
`160000` at that path (index or `HEAD` tree), or the directory itself
contains a `.git` entry. The value is the nested worktree's checked-out
commit id obtained from Git metadata only (`git -C {path} rev-parse HEAD`);
when that is unobtainable (e.g. an uninitialized submodule), fall back to
the mode-160000 object id recorded in the containing repository's index or
`HEAD` tree; when neither resolves, the literal `unresolved`. Strict string
equality still applies, so `unresolved` never silently matches a commit. A
gitlink is a traversal boundary: no walk descends into it, and its contents
are represented solely by this digest.

### 7.5 Target manifest digest

`target_manifest_digest` summarizes the complete target subtree, including
Git-ignored entries. Walk `target_path` exactly as the producer's target
manifest does — no symlink following, every entry of every type, sorted by
relative path — and compute each entry's typed digest (§7.4). Serialize one
ASCII row per entry: relative path, one TAB, typed digest, one LF; SHA-256
the exact row stream. An empty or absent target yields the digest of the
empty stream. The producer records this at closeout from the same walk that
produced the target manifest; the consumer recomputes it over an occupied
target during preflight to prove the working tree is byte-identical to what
was scouted.

## 8. `coverage_counts` schema

A mapping with exactly these keys, all int >= 0:

- `facet_rows_total`: number of rows in the coverage-map facet matrix.
- `facet_rows_evidenced`, `facet_rows_absent`, `facet_rows_unknown`,
  `facet_rows_not_applicable`: rows per coverage status; the four must sum to
  `facet_rows_total`.
- `entries_total`: number of `FILE-*` ids (one per walked target entry of
  any type — regular file, directory, symlink, or other).
- `regular_files_total`: `FILE-*` rows whose type is regular file. Read
  statuses apply only to these rows.
- `files_read_complete`, `files_metadata_only`: regular-file rows per read
  status; `regular_files_total - files_read_complete - files_metadata_only`
  must be 0 for a `complete` dossier (an `unreadable` row forbids
  `complete`).
- `references_total`: number of `REF-*` ids.
- `evidence_total`: number of `EVD-*` ids.

Counts count registry rows (unique immutable ids), never prose mentions.

## 9. Record field schemas

### 9.1 Evidence record (`EVD-*`)
`id`; one evidence label (§6.3); concise claim; subject ids or controlled
subject `TARGET`; source path or canonical URL; locator; target file SHA-256
or external revision; the smallest sufficient excerpt, a scoped
negative-observation record, or non-text metadata; interpretation when
needed; supporting evidence ids; linked limitation id when applicable.

### 9.2 Limitation record (`LIM-*`)
`id`; `code` (§6.8); a one-sentence statement of what is uncertain or
unavailable; the affected claim, facet, artifact, or research step; the
checks actually attempted and why they failed or stopped; an origin class
(§6.7); linked `EVD-*` or `FND-*` ids when they exist (`[]` otherwise). The
`limitation_rows` handoff field carries every field of this record.

### 9.3 Capability record (`CAP-*`)
`id`; a one-sentence statement of a positive, currently working, documented
behavior or contract of the target (something the package evidently does,
promises, or guards — not a defect and not a wish); the facet slug it
belongs to; supporting `EVD-*` ids (at least one); linked `FND-*` ids when a
finding qualifies it; and a `criticality` field `core | supporting`
(`core` = the skill's stated purpose fails without it). Capabilities are
current-state observations, never recommendations.

### 9.4 Source record (`SRC-*`)
`source_kind`; host; owner/project; exact path; canonical upstream URL;
immutable commit permalink when obtainable; revision; path-change date when
obtainable; access date; inspection state; screening status (§6.2) and
reason; duplicate relation; license evidence state; evidence locators;
supported mechanisms. Metadata fields use the states of §6.9.

### 9.5 Pattern card (`PAT-*`)
Mechanism name; eligible skill-definition source ids; evidence ids; observed
behavior at mechanism grain (preconditions, steps, outputs); apparent
purpose labeled as inference; target comparison loci (each a triple: target
anchor, concrete difference, open question for phase 2); material
differences; operating assumptions; portability, license, compatibility,
complexity, and risk considerations; the question phase 2 must answer.

### 9.6 Query record (`QRY-*`)
Family; supporting target evidence ids; exact query; host; interface; date;
result count or `COUNT_UNAVAILABLE`; inspected depth; outcome;
retry/fallback; new source or pattern ids.

### 9.7 Finding record (`FND-*`)
`id`; a one-sentence claim stating the unexpected fact, contradiction,
conformance mismatch, failure mode, or unresolved question; supporting
`EVD-*` ids (at least one, except that an unresolved-question finding may
instead link the `LIM-*` that explains why evidence is missing); a
confidence value `high | medium | low`; the effect on understanding (one
sentence: what a consumer would misread without this finding); and linked
`LIM-*` ids when they exist (`[]` otherwise). Findings never contain
proposed fixes, severity rankings, or remediation language.

### 9.8 Coverage row (facet matrix)
One row per (facet, subject): facet slug (§6.4); subject id or the
controlled subject `TARGET`; coverage status (§6.2); artifact anchor (§10)
locating where the facet is mapped; supporting `EVD-*` ids (`[]` only for
`NOT_APPLICABLE`); linked `FND-*` ids (`[]` when none); linked `LIM-*` id
(required for `UNKNOWN`, null otherwise); and a short explanation. Every
facet slug appears in at least one row.

### 9.9 Registry ownership
Each id family has exactly one owning artifact whose rows are the canonical
registry: `FILE-*` → `structure.md`; `REF-*` → `dependencies.md`; `EVD-*` →
`coverage-map.md`; `QRY-*`, `SRC-*`, `PAT-*` → `external-research.md`;
`FND-*` → `findings.md`; `CAP-*` → `behavior.md`; `LIM-*` →
`coverage-map.md` (with every row mirrored in the handoff
`limitation_rows`). Reconciliation is family-specific: for the listed
families (`pattern_ids`, `limitation_ids`, `finding_ids`, `capability_ids`)
the handoff id list must equal the owning registry's id set exactly — a
handoff id with no registry row, or a registry row missing from the list,
fails validation. For the count-only families, each `id_family_counts`
value (`FILE`, `REF`, `EVD`, `QRY`, `SRC`) must equal its owning registry's
row count, and the `FILE`, `REF`, and `EVD` values must additionally equal
`coverage_counts.entries_total`, `coverage_counts.references_total`, and
`coverage_counts.evidence_total` respectively. `QRY` and `SRC` have no
`coverage_counts` mirror.

## 10. Anchor grammar

An anchor reference is `{filename}#{anchor-id}` where `{filename}` is one of
the nine canonical filenames and `{anchor-id}` matches
`^[a-z0-9][a-z0-9-]*$`. An anchor is realized in the artifact as an explicit
`<a id="{anchor-id}"></a>` line immediately above the section heading it
names, and each `anchor-id` is unique within its file. The schema anchor is
the literal `coverage-map.md#scouting-schema-v3`.

## 11. Zero states

No required key or section is ever omitted for emptiness.

- In the handoff YAML: an empty list is `[]`, an empty count is `0`, and a
  not-yet-determined value is `null` only where §4 marks the key nullable.
- In a markdown artifact: a required section with no rows contains exactly
  one paragraph beginning with the literal `ZERO-STATE:` followed by the
  population that is empty and the evidence or negative-observation basis
  (with `EVD-*` id when one exists).

## 12. Required artifact content

Each artifact must contain at least the following, as titled sections or
labeled registries (zero states per §11 where a population is empty):

- `INDEX.md` — the handoff block (§§3–4); the sentinel algorithm statement;
  the artifact registry (§5).
- `structure.md` — the `FILE-*` manifest: one row per walked entry with
  relative path, type (`file|dir|symlink|other`), byte size and SHA-256 for
  regular files, text/non-text classification basis, line count and read
  status (§6.2) for text files, symlink target when applicable; plus
  separately labeled conformance observations.
- `execution-flow.md` — the target's phases/steps/states, branches and
  gates, loops/retries/feedback, dispatch and concurrency, statuses and stop
  conditions, escalation, critical outputs and handoffs, and contradictory
  or unreachable routes, each mapped with evidence ids.
- `behavior.md` — inputs/preconditions/modes; outputs and mutations;
  permissions/tools/external effects; context loading and delegation;
  validation; artifact lifecycle; error/empty/ambiguity/autonomy handling;
  static-runtime unknowns; and the canonical `CAP-*` registry (§9.3).
- `purpose.md` — stated purpose, audience, premise, value claims, identity,
  mental model, priorities, posture, trade-offs, voice, boundaries,
  non-goals; inferred rationale labeled `STATIC_INFERENCE`.
- `dependencies.md` — the canonical `REF-*` registry: one row per detected
  reference with source locator, reference kind, resolved target or
  `indeterminate`, and status (§6.2); plus unreferenced-file observations.
- `external-research.md` — effective budget; the `QRY-*` log (§9.6); the
  `SRC-*` registry (§9.4); eligibility decisions; research limitations; stop
  reason; and the `PAT-*` cards (§9.5).
- `findings.md` — the canonical `FND-*` registry (§9.7).
- `coverage-map.md` — the `dossier-schema` provenance stamp (§13); the facet
  matrix (§9.8); the `EVD-*` registry (§9.1); the `LIM-*` registry (§9.2);
  the per-source excerpt/reconstructability ledger; and cross-artifact
  integrity checks.

## 13. Consumer validation rule

The consumer (phase 2) validates the dossier against this file, not against
a transcription: it computes SHA-256 of the local
`prompts/scouting-handoff-contract.md` and requires equality with the
handoff's `handoff_contract_sha256` (mismatch is the blocker
`handoff_contract_mismatch` — the boundary definition changed between
phases and the dossier must be regenerated or the consumer downgraded);
verifies the version literals; then checks the handoff block, artifact set
and order, registry, hashes, enums, counts, record completeness, anchors,
and zero states directly against §§1–12. The `dossier-schema` section of
`coverage-map.md` records the three version literals and
`handoff_contract_sha256`; it is a provenance stamp, not an independent
schema, and cannot relax anything defined here.
