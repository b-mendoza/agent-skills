# Local revision evidence

Load only for an explicitly approved, meaning-preserving copy edit. The normal route still requires re-planning. This reference defines evidence, not a second state machine; flag transitions remain in `SKILL.md`.

## Preconditions

The recorder checks that every revised answer is solely an exact prose correction, with no change to scope, behavior, security policy, technology, acceptance criteria, dependencies, task identities, numbering, or executable commands. Uncertainty fails closed to re-planning. The user's explicit old/new wording is required; do not invent a replacement or infer consent from a plan. Blocked decisions always keep re-plan required.

## Artifact inventory

Include the main `docs/<KEY>-tasks.md` and every file for the active mode:

- Upfront: `docs/<KEY>-stage-1-detailed.md`, `docs/<KEY>-stage-2-prioritized.md`.
- Critique: `docs/<KEY>-task-<N>-brief.md`, `docs/<KEY>-task-<N>-execution-plan.md`, `docs/<KEY>-task-<N>-test-spec.md`, `docs/<KEY>-task-<N>-refactoring-plan.md`.

A missing file prevents certification. Read all files, including those with no matching wording. Capture their full text after adding the normal decisions records but before applying the copy edits. Build each `files` value from `Path(path).read_bytes().decode("utf-8")`, then serialize it with `json.dumps`. Strict UTF-8 decoding preserves the original bytes when re-encoded; decoding failure prevents certification. Preserve literal LF, CRLF, any UTF-8 BOM, and final-newline presence in the JSON string. Do not use universal-newline text reads such as `Path.read_text()`, split/join lines, or reconstruct the evidence from tool-rendered text. Keep this evidence in the recorder handoff, not in a new durable workflow file.

## Script input and output

Pass JSON on stdin to `python3 -I <loaded-skill-dir>/scripts/validate-local-revision.py <repo-root> <KEY> <upfront|critique> <N|->`. Build the evidence in memory and pipe it straight to the script in one command, for example `python3 -I -c '<build evidence and print json.dumps(...)>' | python3 -I <script> ...`. Never write the evidence to a file, including temporary files under `/tmp`; the write limits allow only the workflow artifacts.

```json
{
  "files": {
    "docs/<KEY>-tasks.md": "Full before text for this file",
    "docs/<KEY>-stage-1-detailed.md": "Full before text for this file",
    "docs/<KEY>-stage-2-prioritized.md": "Full before text for this file"
  },
  "replacements": [{"old": "recieve the audit download", "new": "receive the audit download"}]
}
```

Apply the exact replacements to every occurrence in the inventory, and no other edits in this step. Encode the before evidence and approved replacements as UTF-8 bytes. The script compares those expected bytes with `read_bytes()` from each file on disk. It rejects an incomplete inventory, an unmatched edit, stale files, extra changes including unapproved newline conversion, multiline or markup replacements, and paths escaping the repository.

Exit 0 emits `LOCAL_REVISION: PASS files=<count>`; exit 1 emits a failure to stderr. Return the full evidence to the coordinator with the existing recording summary so it can rerun the read-only check before using the flag exception. The script proves consistency, not semantic equivalence; the recorder's precondition check is still required. Keep the log conservative through the first successful check. To record `Re-plan: No (validated copy edit)`, change only that log cell, apply the same metadata-only cell change to the saved main-plan before text, and rerun the check. Return this final evidence for the coordinator to verify. A failed second check restores re-plan required. The coordinator does not treat a log entry as proof, and structural decisions in the same run keep the terminal flag true.
