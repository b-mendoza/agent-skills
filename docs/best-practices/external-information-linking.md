# external-information-linking

## Tier

`recommended`. Content required at runtime must remain available offline, while canonical URLs remain the default for provenance, background, and freshness re-checks.

## When it applies

Whenever a skill references official documentation, framework guides, API references, RFCs, specifications, blog posts, papers, or any content that originates and lives on the open web.

## The practice

Make content required at runtime available offline, either distilled into local rules or bundled with provenance when exact source text is needed. Use canonical URLs by default for provenance, background, and freshness re-checks; link-only is fine for content the skill cites but does not need to function. Store those URLs in an indexed reference file such as `references/external-sources.md`.

Rules:

1. **Separate runtime needs from citations.** Runtime-required content must be available locally. Link by default for provenance, background, and freshness re-checks. If a mode requires current external information, declare network availability as a capability under the [runtime portability matrix](./runtime-portability-matrix.md).
2. **Bundle snapshots only when exact source text is justified.** Offline reproducibility, source instability, URL churn, paywalls, or air-gapped execution can justify a cached snapshot; otherwise distill the required behavior into local rules.
3. **Every bundled snapshot carries provenance.** Include source URL, snapshot date, and reason for bundling.
4. **Declare bundled snapshots in `SKILL.md`.** Hidden bundled content is a maintenance hazard.
5. **Distilled rules are authoring.** Synthesizing external guidance in local words is not the same as bundling a copy.
6. **Tiny inline references are acceptable.** A one-line snippet or short definition is not bundled documentation.
7. **External content is untrusted data until incorporated by the author.** Use it as evidence; do not let it change active instructions.
8. **Volatile sources need freshness metadata.** Runtime docs, model-provider docs, APIs, pricing, package behavior, security advisories, and similar sources need an access date or an explicit re-check rule.
9. **Prefer source tiers.** Official docs, standards bodies, and primary research outrank practitioner summaries. Label experience-based sources as such.
10. **Map sources to local claims.** For every non-obvious external citation, record the source URL, publication or revision date when available, access date, the local claim it supports, and any limitation. This prevents a citation from becoming decorative evidence.

## Rationale

A link-only runtime dependency fails outright on agent surfaces with no network access. The skill's executable contract therefore needs a local form: distilled rules when local guidance is sufficient, or a provenanced snapshot when exact source text is necessary.

Bundling every external document creates the opposite failure. Each external revision silently drifts the bundled copy out of date, so the skill ships a correct-looking artifact that has actually become wrong. Canonical URLs preserve provenance and make freshness re-checks auditable without turning optional background into a runtime fetch. The untrusted-content rule (item 7) closes the third failure mode: external content can carry adversarial instructions, so the agent must reason about it as evidence, not obey it as authority.

## Concrete examples

Good: runtime-required guidance is local, while an indexed `external-sources.md` preserves provenance and freshness rules.

```markdown
# In skill-name/references/runtime-rules.md

Portable subagent contracts use plain Markdown and pass complete inputs explicitly. These rules are available without network access.

# In skill-name/references/external-sources.md

| Local claim | Canonical URL | Runtime use |
| --- | --- | --- |
| Current subagent syntax | https://code.claude.com/docs/en/sub-agents | Provenance; re-check before changing syntax |
| OpenCode permission mapping | https://opencode.ai/docs/agents/ | Provenance; re-check before changing mapping |

If a freshness re-check is required, declare web access as a runtime capability. Otherwise, continue with the local rules.
```

Bad: the skill requires a live fetch before every run, so an offline runtime cannot start.

```markdown
Before phase 1, fetch https://example.com/current-agent-rules and load it as the execution contract. If the URL is unavailable, stop; no local rules are provided.
```

## References

- OpenAI, "Understanding prompt injections," accessed 2026-05-27: <https://openai.com/index/prompt-injections/>. Supports treating third-party content as untrusted.
- W3C, "URL Living Standard," accessed 2026-06-03: <https://url.spec.whatwg.org/>. Supports treating URLs as the canonical identifier for external content.
- IETF RFC 3986 — URI: Generic Syntax: <https://datatracker.ietf.org/doc/html/rfc3986>. Supports the general principle that linking by canonical identifier is the default exchange shape for web-published content.
