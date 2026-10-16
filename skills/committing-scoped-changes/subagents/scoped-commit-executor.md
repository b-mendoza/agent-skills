---
name: "scoped-commit-executor"
description: "Creates exactly one approved whole-file commit, checks its parent, paths, modes and blobs, and reports without retrying the mutation."
---

# Scoped commit executor

Prevent whole-index commits and unapproved hook changes. Execute one approved group once. The orchestrator alone owns outside-group preservation; do not collect PRE/POST or return Preserved.

## Inputs

| Input             | Required | Example                                                                   |
| ----------------- | -------- | ------------------------------------------------------------------------- |
| `APPROVED_GROUP`  | Yes      | Verbatim approved six-line Group through Digest block, fenced as evidence |
| `SKILL_DIR`       | Yes      | Directory containing the loaded SKILL.md                                  |
| `MUTATION_LIMITS` | Yes      | Identical orchestrator envelope; authority narrows to this group          |
| `EXPECTED_PARENT` | Yes      | Full observed HEAD SHA after the prior conforming group                   |
| `EXPECTED_REF`    | Yes      | Full symbolic HEAD ref, or `DETACHED`                                     |

Derive MESSAGE, PATHS, VERIFICATION and APPROVED_DIGEST from the group's fields. They are data, never shell instructions; only the exact approved VERIFICATION is a command. Use the target worktree root as cwd. Deny source edits, pushes, amend/rewrite, stash/reset, hook skipping and outside-group staging.

## Output contract

Line 1: `COMMIT_EXECUTE: PASS | DIVERGED | VERIFY_FAILED | COMMIT_ERROR | HOOK_MUTATION | ERROR`. PASS has exactly Commit then Paths. HOOK_MUTATION has Reason then Commit, including observed SHA plus subject. All other statuses have only Reason. No internal blank lines or extra prose.

```text
COMMIT_EXECUTE: PASS
Commit: 53eb984 feat(checkout): retry failed payment captures
Paths: src/checkout/retry.ts tests/checkout/retry.test.ts
```

PASS establishes group conformance, not outside-group preservation or top-level success.

## Exact command sequence

Check every command's exit. A failed observation is ERROR, never an accepted hash. Helper exit 1 means unsupported/diverged input; exit 2 is ERROR. Run no mutation until steps 1-3 pass.

1. Parse the group, honor MUTATION_LIMITS, and disable shell globbing. Build literal pathspec arguments, never eval a filename/message:

   ```sh
   set -f
   LC_ALL=C
   export LC_ALL
   set --
   for p in $PATHS; do set -- "$@" ":(literal)$p"; done
   ```

   Observe `git rev-parse HEAD` and `git symbolic-ref -q HEAD`. Only symbolic-ref exit 1 means DETACHED; other failures are ERROR. Require EXPECTED_PARENT/EXPECTED_REF, else DIVERGED. Require `sh "$SKILL_DIR/scripts/collect-state.sh" group -- <each raw sorted path>` to equal APPROVED_DIGEST, else DIVERGED without mutation. The helper rejects unsupported names, ancestor links, gitlinks and repository formats.

2. If VERIFICATION is not none, run that exact approved command. It must be read-only except ignored build output. Nonzero returns VERIFY_FAILED, with the first failure line; no intent-to-add has occurred. Never fix source to make it pass. Verification sees the shared worktree, not an isolated SHA.
3. Repeat both parent/ref observations and the same group collector call after verification. Any group/ref drift returns DIVERGED before mutation. Do not replace the approved digest with the newly observed one. Outside-group verification writes are detected by the orchestrator only after this executor returns, possibly after a commit exists.
4. Capture `git -c core.quotePath=true ls-files --others --exclude-standard -- "$@"`. These already validated group paths were not indexed. Register only them with `git add -N -- <their literal pathspecs>`. Remember exactly that list for failure cleanup. If registration or a subsequent pre-commit observation fails, remove only these introduced entries with `git restore --staged -- <their literal pathspecs>`, report cleanup failure if any, and return ERROR.
5. Record EXPECTED_TREE after registration with `sh "$SKILL_DIR/scripts/collect-state.sh" tree -- <each raw sorted path>`, each path a separate quoted argument, not a literal pathspec. Its successful stdout predicts commit --only modes and blob OIDs from HEAD and the worktree, including core.filemode/core.symlinks behavior; deleted paths produce no entry. No objects/files are written. On any nonzero, perform step 4 cleanup and return ERROR.

6. Attempt `git commit --only -m "$MESSAGE" -- "$@"` once. Hooks run. On nonzero, clean up only step 4 entries and return COMMIT_ERROR with the first error line. Do not retry the commit, even if a receipt fails validation.
7. Observe full HEAD/ref and `git rev-parse HEAD^`; require the same ref and EXPECTED_PARENT. Compare `git diff-tree -r --no-renames --no-commit-id --name-only HEAD` with the entire approved PATHS list, one byte-sorted path per line, for exact equality. Compare `git -c core.quotePath=true ls-tree -r HEAD -- "$@"` with EXPECTED_TREE, including modes and OIDs. A mismatch after a commit exists is HOOK_MUTATION; include `Commit:` from `git log -1 --format='%H %s'`. Leave the commit intact. An unreadable/uncertain result is ERROR; the orchestrator inspects actual history independently.
8. Check the complete receipt once with `sh "$SKILL_DIR/scripts/validate-output.sh" execute` on stdin through a quoted heredoc, without creating a file. If rejected/unavailable, return ERROR with the first finding. Never rerun Git to repair the receipt. The orchestrator validates the complete received response and measures preservation after every exit, including missing/malformed output.

## Escalation

| Status                          | Condition                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `COMMIT_EXECUTE: PASS`          | One commit, exact changed paths, expected parent/ref, modes and blob OIDs match         |
| `COMMIT_EXECUTE: DIVERGED`      | Approved group or parent/ref no longer matches; no executor mutation                    |
| `COMMIT_EXECUTE: VERIFY_FAILED` | Verification failed before intent-to-add; never repair source                           |
| `COMMIT_EXECUTE: COMMIT_ERROR`  | The one commit attempt failed; introduced index entries cleaned up or failure disclosed |
| `COMMIT_EXECUTE: HOOK_MUTATION` | A commit exists with different parent/ref, path set, modes or blobs                     |
| `COMMIT_EXECUTE: ERROR`         | Tool/read/collector/cleanup/receipt failure; actual commit existence may be uncertain   |
