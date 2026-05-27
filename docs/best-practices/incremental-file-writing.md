# Incremental File Writing

## What it is

When a skill, orchestrator, or subagent materializes a multi-section markdown
file via tool calls, do not emit the entire file body in a single `Write`
call. Initialize the file with one small `Write` containing only the header
skeleton (a status line plus empty top-level `##` headings), then append each
logical section with a separate `StrReplace` or `Edit` call. Every tool-call
string argument stays well below the runtime's JSON serializer failure
threshold.

This is the same payload-size rule that
[`./handoff-file-dispatch.md`](./handoff-file-dispatch.md) applies to
orchestrator-to-subagent dispatch arguments, generalized to every tool-call
boundary where a large string travels through a JSON serializer — including
the subagent-to-`Write`-tool boundary, the orchestrator-writing-handoff-files
boundary, and any other agent emitting a multi-section artifact to disk.

## Why it matters

**Tool-call arguments are JSON, and JSON is a streaming-serialization
hazard.** When a tool call carries a multi-KB markdown string as one of its
argument values, the runtime serializes the entire string into a single JSON
field. Three properties of markdown make that serialization fail
disproportionately often:

1. **Bulk size.** Once a single tool-call argument grows past roughly 10 KB,
   the failure rate climbs sharply. In this repo: editor reports (~5 KB)
   have never failed; auditor (~31 KB) and validator (~20 KB) reports both
   produced
   `Expected ',' or '}' after property value in JSON at position 115`
   when emitted as one call.
2. **Special-character density.** Backticks, double-quotes, pipe-table
   delimiters, embedded code fences, and `\` escapes each give the streaming
   serializer another chance to emit a malformed token. Markdown reports
   are especially dense in these characters.
3. **No graceful recovery.** When the call fails partway through writing,
   the parent that dispatched it receives a JSON parse error instead of a
   recoverable status. The file is either missing or truncated, and the
   subagent's work has to be redone from scratch.

Splitting the write across many small calls eliminates all three risks at
once: each call's argument is small, the contained special-character
sequences are simpler, and partial failures only lose one section — which a
follow-up `StrReplace` can re-attempt cleanly without re-running the
generating subagent.

The failure class is the same one
[`./handoff-file-dispatch.md`](./handoff-file-dispatch.md) lines 28–41
documents at the orchestrator-to-subagent dispatch boundary. Moving the
payload to a file (the handoff-file pattern) protected the dispatch
boundary; this practice protects every other tool-call boundary where the
same large-string-through-JSON-serializer hazard appears.

## Rules

1. **Initialize the file with a small `Write`.** The initial `Write` call
   contains only the file header: a status line, frontmatter, or top-level
   `##` heading skeleton enumerating the sections that will follow. Keep the
   string argument well under ~2 KB.

2. **One section per `StrReplace` / `Edit` call.** Each subsequent tool call
   adds exactly one logical section to the file (the body of one
   `## Heading`). Do not batch multiple sections into a single call.

3. **Cap per-call string size around 2 KB.** This is the empirical safety
   margin observed in this repo; below this size the JSON serializer is
   reliable across observed runtimes. If a single section's body would
   exceed the budget, split it further: emit the section's intro prose
   first, then append a long table row-by-row or batch-by-batch via
   additional `StrReplace` calls.

4. **Never emit the full file body in a single tool call.** Even when the
   file is short enough today to fit, the contract should require
   incremental writes so the failure mode never returns as the file grows.

5. **Never re-emit the entire file in one call to "fix" formatting.**
   Correct issues with further targeted `StrReplace` / `Edit` calls. A
   rewrite-on-failure pattern recreates the original hazard.

6. **The compact reply to the dispatcher is unchanged.** The subagent's
   final response to its orchestrator is still the short two-line
   `<STATUS>: ...` + `REPORT_WRITTEN: <path>` reply. The incremental writes
   happen entirely between dispatch and reply; the orchestrator reads the
   completed file directly.

7. **Declare the protocol in the contract.** A subagent's `Output Format`
   section (or an orchestrator's `Subagent Dispatch Protocol` /
   `Handoff Composition` section) must name this practice as the canonical
   write pattern. Do not let any example in the contract show a monolithic
   `Write`, even illustratively — readers copy from examples.

## Applies to both orchestrators and subagents

The rule is symmetric across the dispatch boundary:

- **Subagents** writing their structured report to `REPORT_PATH`
  (audit reports, edit reports, validation findings, plan documents, etc.).
- **Orchestrators** writing per-subagent handoff instruction files at
  `HANDOFF_DIR/<subagent-name>-instructions.md`, when those handoff files
  themselves grow past the safety threshold.
- **Any agent** that materializes a multi-section markdown artifact to disk
  via tool calls — examples include declared-deviation logs, final-report
  templates rendered with run-specific data, and structured plans returned
  to the user.

The header-then-append pattern is identical in each case.

## When the pattern is overkill

Use a single `Write` only when ALL of the following are true:

- The total file body is under ~5 KB.
- The file contains no embedded code fences, pipe tables, or other
  high-special-character-density content.
- The file is a one-off artifact, not a contract output that will grow over
  time as the skill matures.

For everything else — subagent reports, multi-section handoff files,
declared-deviation logs, audit summaries, validator findings, plan
documents — apply the incremental protocol from the first version of the
contract.

## Example: subagent `Output Format` section

A subagent contract that adopts this practice declares the protocol in its
`Output Format` section by reference, not by restatement:

```markdown
## Output Format

Materialize your report at `REPORT_PATH` per the `incremental-file-writing`
practice indexed in
[`../../docs/best-practices/README.md`](../../docs/best-practices/README.md).

Concretely for this subagent:

1. Initialize `REPORT_PATH` with one small `Write` containing only the
   `<STATUS>: ...` status line followed by an empty top-level `##` skeleton
   enumerating this subagent's contracted sections.
2. Append each section in the template below with a separate
   `StrReplace` / `Edit` call by replacing the empty heading line with the
   populated section body.
3. Keep every tool-call string argument well under ~2 KB; split a long
   section across multiple appends if needed.
4. Reply to the orchestrator with the compact two-line response:
   `<STATUS>: ...` plus `REPORT_WRITTEN: <REPORT_PATH>`.

[then the standard section template]
```

The contract names the practice once and inherits all seven rules from this
file. The per-subagent specifics (which status enum, which sections appear
in the template) are the only things that need to live in the contract.

## References

- [`./handoff-file-dispatch.md`](./handoff-file-dispatch.md) — the same
  JSON-serializer failure mode applied to orchestrator-to-subagent dispatch
  arguments; this practice generalizes the rule to every other tool-call
  boundary.
- [`./context-window-protection.md`](./context-window-protection.md) —
  moving payloads off the inline wire also protects against this failure
  class and its context-pollution cousin.
- [`./input-output-contracts.md`](./input-output-contracts.md) — the
  subagent's `Output Format` section is where this protocol is declared
  per-subagent.
- [`./critical-output-quality-gates.md`](./critical-output-quality-gates.md)
  — reports produced under this protocol still need their own named gate;
  the gate does not replace this practice.
