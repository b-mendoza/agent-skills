# Review state machine

Canonical transitions; SKILL.md owns inputs, file contracts and exact preview contents. Apply only this table for routing.

`OUTPUT_REPAIR[dispatch]`, `VERIFY_REPAIR` and `REVISE` start at 0. The first belongs to a logical role/dimension and survives its one correction dispatch; the latter two belong to the whole run and never reset on a revision. No automatic context recovery or approval re-ask. No script failure authorizes replay of file or GitHub mutations.

Apply the first matching row. Independently observed effects and scope/basis guards take precedence over payload repair. At the join, evaluate all available results by these priorities, then declared dimension order, never completion order; wait only for named live workers.

| Order | State/event | Action and next state or terminal |
| --- | --- | --- |
| 1 | Approved posting exits 1, loses its result, times out, or has possible effects with incomplete outcome | Stop GitHub mutations. If `receipts.json` exists, run renderer `--replace <last-output-sha256>` once to record known receipts in the draft, a local write, not a mutation retry. If refused, failed or uncertain, exempt `receipts.json` from cleanup and name its path in Notes. End `POST_ERROR` with known receipts, failed/unattempted actions and explicit uncertainty; never infer no effect from no receipt. |
| 2 | Any scope/trust conflict or out-of-envelope change | `REVIEW_ERROR` before GitHub effects; otherwise `POST_ERROR`, preserving actual effects. |
| 3 | Necessary capability unavailable, unknown `SKILL_DIR`, validator or renderer self-test nonzero, validator exit 2, or `CONTEXT: TOOLS_MISSING`, `CHUNK: TOOLS_MISSING`, `AUTHOR: TOOLS_MISSING`, `VERIFY: TOOLS_MISSING` | `TOOLS_MISSING`; never substitute model validation. After possible posting effects use row 1. |
| 4 | Independently observed head/comparison drift, except poster preflight refusal | Invalidate evidence, verification and approval; `NEEDS_CONTEXT` for a fresh full review. |
| 5 | Validator exit 1; malformed, unknown or dimension-mismatched output; missing, cancelled or lost output from a worker no longer live | If `OUTPUT_REPAIR[dispatch] < 1`, increment and redispatch that same role with diagnostics; otherwise `REVIEW_ERROR`. Never repair by repeating a script mutation. |
| 6 | `CONTEXT: ERROR`, `CHUNK: ERROR`, `AUTHOR: ERROR`, `VERIFY: ERROR` | `REVIEW_ERROR` with the validated cause and next step. |
| 7 | `CONTEXT: NEEDS_CONTEXT`, `CHUNK: NEEDS_CONTEXT`, `AUTHOR: NEEDS_CONTEXT`, `VERIFY: NEEDS_CONTEXT` | `NEEDS_CONTEXT` with the exact missing input/evidence and next step. No collection cascade. |
| 8 | Intake missing/invalid PR, mode, focus or safe unused output; multiple PRs; ambiguous new-review versus author-reply intent; ignore proof fails | Ask for one PR when needed. For mixed intent, ask whether the user wants a new review or replies as the author; do not draft a new review before clarification. Missing/invalid selection, unresolved intent or existing/unsafe output ends `NEEDS_CONTEXT`. Failed ignore proof ends `BLOCKED` with the ignore-file next step. |
| 9 | Intake safe, root/limits/baseline/run directory established | Dispatch collector with inputs, `SKILL_DIR`, identical `MUTATION_LIMITS` and `PAYLOAD_FILE`. |
| 10 | Collector helper exits 0 / 3 / 2 / 4, 1, 64 | Collector records complete / partial history and continues, or emits `CONTEXT: TOOLS_MISSING` / `CONTEXT: ERROR` with cause respectively. Validate its payload before any role-status route. |
| 11 | `CONTEXT: PASS` | Pin base/head, state, history and dimension order; dispatch one chunk per dimension, concurrently when supported, otherwise serially. No size-only refusal. |
| 12 | `ALL_DIMENSIONS_JOIN`, with zero or more accepted results so far | Wait for named live workers. Once every declared dimension has exactly one accepted `CHUNK: PASS` matching its name, aggregate coverage/risks in declared order and dispatch author even with empty findings. Unusable results use row 5. |
| 13 | `AUTHOR: PASS` | Dispatch independent verifier with that exact package, context, joined chunks, pins and language guidance. |
| 14 | `VERIFY: FAIL` | If `VERIFY_REPAIR < 2`, increment and send issues to author, then verify again; otherwise `VERIFY_FAIL`. Missing evidence is row 7, not FAIL. |
| 15 | `VERIFY: PASS` | Run renderer for create, or `--replace <last-output-sha256>` only for this run's verified revision. |
| 16 | Renderer exits 0 / 1, 2 or has uncertain local effect | On 0 observe file/hash and retain its new hash. Draft-only ends `VERIFIED_DRAFT_SAVED`; posting mode runs the [exact preview command](./SKILL.md#execution). Before posting, refusal, mismatch or uncertainty ends `WRITE_ERROR`, keeping observed files. After poster exit 0, retain `VERIFIED_REVIEW_POSTED` and report any failed receipt update; row 1's render always ends `POST_ERROR`. Never blindly replay. |
| 17 | Poster dry-run exits 0 / 1, 2, 3; approved mode exits 2, 3 | Dry-run 0 enters `HUMAN_GATE_FINAL_PREVIEW_APPROVAL`. Other exits end `POST_ERROR`, draft kept; exit 3 has no effects. Approved exit 1 is row 1. |
| 18 | Checkpoint awaiting the next user message | Stay at `HUMAN_GATE_FINAL_PREVIEW_APPROVAL`: this is non-terminal. End the assistant turn with the exact preview and choices; retain all run payloads and other recorded run files. Do not run terminal cleanup. Resume this same run when the user replies. |
| 19 | Checkpoint receives the user's next message: `APPROVED` / `REVISE` / `ABORT` / unrecognized answer | APPROVED runs `--approved <approval-sha256>` once for that exact preview. REVISE invalidates approval; if `REVISE < 2`, increment and send user's text to author, then verify, render `--replace`, preview again; otherwise `BLOCKED`, draft kept. ABORT posts nothing, keeps draft and ends `VERIFIED_DRAFT_SAVED_POSTING_CANCELLED`. An unrecognized reply ends `BLOCKED` without re-ask. No reply yet is row 18, not BLOCKED. |
| 20 | Approved poster exits 0 | Retain receipts and run renderer `--replace <last-output-sha256>` to record them; row 16 ends `VERIFIED_REVIEW_POSTED`. |

