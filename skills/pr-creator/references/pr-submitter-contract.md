# Contract: pr-submitter

Return one JSON object. Actual readback is evidence; approved inputs are not
returned facts. Consume the absolute frozen `preview.json`, literal `body.md`,
current-run `approval_record`, and fixed mutation limits from
[execution-contracts.md](./execution-contracts.md). This includes canonical
assignees, exact checked plan, requested/effective state, and pinned identities.
The consumer always runs:

```sh
python3 -I "${SKILL_DIR}/scripts/validate-output.py" pr-submitter --approved-preview "$RUN_DIR/preview.json" < receipt.json
```

Status enum: `PASS | GAPS_FOUND | HEAD_MOVED | CREATE_UNCERTAIN | BLOCKED |
CREATE_ERROR | AUTH | ERROR | TOOLS_MISSING`. Always required: `status`,
`reason`, `decision_needed`.

| Key                                     | Type / values                                           |
| --------------------------------------- | ------------------------------------------------------- |
| `approval_record`                       | Exact preview approval record or `null`                 |
| `remote_head_sha`                       | Full SHA immediately before create, or `null`           |
| `create_attempted`, `create_retry_used` | Booleans                                                |
| `outcome`                               | `created` or `found`                                    |
| `url`                                   | Platform-returned HTTP(S) URL or `null`                 |
| `returned`                              | Exact readback object below                             |
| `uncertain_check_commands`              | Array of nonempty supported lookup commands             |
| `missing_tools`                         | Nonempty capability array; required for `TOOLS_MISSING` |

Readback object has exactly `title`, `base`, `head_ref`, `head_sha`, `state`,
`reviewers`, `labels`, `assignees`, and `body`, all required. Each may be `null`
when unavailable. Scalars are strings (`head_sha` full SHA); metadata is arrays
of canonical nonempty strings. Title/body may be empty actual strings. `base` is
the returned base branch; `head_ref` is the returned head branch, not a remote
tracking name. Normalize platform state vocabulary through the checked adapter;
retain any other actual nonempty state as a comparison mismatch. Body is the
full exact decoded JSON string, including final newlines. No first-line or
whole-body line-count fields.

| Status                     | Additional required keys / conditions                                                                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PASS`, `GAPS_FOUND`       | `approval_record`, `remote_head_sha`, `create_attempted`, `create_retry_used`, `outcome`, `url`, `returned`; record nonnull and bound to preview; URL may be unavailable, and null returned facts are valid gaps. `created` requires an attempted create. |
| `HEAD_MOVED`               | `approval_record`, `remote_head_sha`, `create_attempted=false`; record valid and remote SHA nonnull and different from preview. Clear stale pins/approval; return through preflight.                                                                      |
| `CREATE_UNCERTAIN`         | `create_attempted=true`, `create_retry_used`, nonempty `uncertain_check_commands`; say a remote object may exist.                                                                                                                                         |
| `CREATE_ERROR`             | `create_attempted=true`, `create_retry_used`; definitive creation failure only.                                                                                                                                                                           |
| `BLOCKED`, `AUTH`, `ERROR` | Common keys only; established partial facts may be included.                                                                                                                                                                                              |
| `TOOLS_MISSING`            | Nonempty `missing_tools`; only before an object is known.                                                                                                                                                                                                 |

An included nonnull approval record must bind `checkpoint=preview`, current
`run_id`, canonical preview digest, and actual user approval reference. The
checker verifies binding, not consent. `create_retry_used=true` requires
`create_attempted=true`. A nonnull `outcome` is allowed only with `PASS` or
`GAPS_FOUND`: once an object is known, later auth/tool/readback failure is a
verification gap, not create failure/uncertainty or permission for another
write.

## Independent comparison (checker stdout)

For a known-object receipt the checker emits exactly `status`, `gaps`,
`approved_body_digest`, `returned_body_digest`, and `platform_additions`.
`status` is independently derived `PASS` or `GAPS_FOUND`, never trusted from the
producer. `gaps` is an array of concrete missing/altered/unavailable field
strings. Digests use the shared SHA-256 rule; returned digest is `null` when
body is unavailable. `platform_additions` has exactly `reviewers`, `labels`,
`assignees` (each sorted returned-minus-approved array, or `null` if
unavailable), and `body_suffix` (exact appended string, or `null` if no approved
prefix/readback). For other conforming statuses the checker emits only `status`
unchanged.

Comparison is exactly:

- Title, base, head ref, head SHA, and state equal preview `title`,
  `base_branch`, `head_branch`, `head_sha`, and `effective_state` respectively.
- Each approved reviewer/label/assignee set is a subset of its returned set.
- `returned_body.encode("utf-8").startswith(approved_body.encode("utf-8"))`. No
  trimming, newline normalization, or whole-body-digest-equality requirement.

Missing/altered approved values or any unavailable readback yield `GAPS_FOUND`.
Differences are domain results: exit 0, not a schema error. Routine bot labels,
CODEOWNERS reviewers under `REVIEWERS=none`, extra assignees, and an exact
appended body suffix pass with visible additions. Always print the full actual
body and `Platform additions after create:` (all additions, or `none`); suffix
line count may replace suffix text. Known-created gaps are headed `PR created;
verification gaps`; race-found objects are explicitly called found.

## Creation boundary

Revalidate artifact/approval, remote head, and duplicate race immediately before
the exact approved action. Found object means verify, never duplicate. Execute
only the approved plan using literal body-file transport. Omit unrequested
reviewer/assignee flags. An ambiguous create requires supported lookup before
any retry. Found means compare; only successful established absence permits at
most one retry. Recheck the remote head before the permitted retry; movement
after an attempted create forbids retry and returns `CREATE_UNCERTAIN` with
`create_attempted=true`, `create_retry_used=false`, nonempty
`uncertain_check_commands`, and "a remote object may exist", while `HEAD_MOVED`
remains exclusive to zero attempts. Inconclusive/failed lookup remains `CREATE_UNCERTAIN`; this is
not a universal eventual-consistency guarantee. Never correct a known object's
body or metadata, assign later, retry on gaps, or retry after missing/malformed
output.
