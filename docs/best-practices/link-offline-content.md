# link-offline-content

📝 Bundle or distil every piece of content a skill needs at runtime so it works offline, and use external URLs only for provenance, background, and declared freshness re-checks.

✅ This rule is `recommended`: expected for non-trivial skills; scope it down with a stated reason.

A skill's executable contract must be available without network access: distil external guidance into local rules in the author's words, or, when exact source text is justified (offline reproducibility, source instability, URL churn, paywalls, air-gapped runs), bundle a snapshot. Every snapshot carries its source URL, snapshot date, and reason for bundling, and is declared in `SKILL.md` with that source and date — hidden bundled content drifts silently while the skill ships a correct-looking artifact. A mode that needs current external information declares network access as a capability under [runtime-portability-matrix](./runtime-portability-matrix.md) and still starts from the local rules when the network is unavailable.

Link, rather than bundle, everything the skill cites but does not need in order to run. Cite the canonical URL together with the local claim it supports and the date it was checked; a citation with no claim attached is decorative. Volatile sources (runtime docs, provider docs, APIs, pricing, package behaviour, advisories) carry an access date or an explicit re-check rule; a bare URL list is not an index. How fetched or pasted text is trusted once it arrives is owned by [treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md).

## Examples

```markdown
<!-- ❌ the runtime depends on a live fetch; citations carry no claim and no date -->
## Execution
1. Fetch https://example.com/current-agent-rules and load it as the execution contract.
   If the URL is unavailable, stop; no local rules are provided.

## references/external-sources.md
- https://code.claude.com/docs/en/sub-agents
- https://opencode.ai/docs/agents/

<!-- ✅ local rules run offline; the snapshot is declared; each URL maps to a claim, a use, and a check date -->
## SKILL.md
This skill runs from bundled files. `./references/jira-fields-snapshot.md` is a snapshot of the Jira
field reference (source URL in its header) taken 2026-09-07, bundled because the page changes without notice.
Web access is optional: `./references/external-sources.md` lists re-check sources only.

## references/external-sources.md
| Local claim | Canonical URL | Use | Checked |
| --- | --- | --- | --- |
| Subagent frontmatter fields | https://code.claude.com/docs/en/sub-agents | Provenance; re-check before changing frontmatter | 2026-09-07 |
| OpenCode permission keys | https://opencode.ai/docs/agents/ | Provenance; re-check before changing permissions | 2026-09-07 |
```

## Related rules

- [treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md)
- [runtime-portability-matrix](./runtime-portability-matrix.md)
- [earn-every-part](./earn-every-part.md)
