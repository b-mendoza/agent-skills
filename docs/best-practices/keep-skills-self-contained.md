# keep-skills-self-contained

> Current-state authoring reference; update when these package conventions change.

Tier: mandatory local packaging; recommended external-source handling.

Use when adding any package dependency, reference, or invocation.

## Local package

Every file in a skill, including maintenance notes and historical records, stays within its package: no references to this repository's outside files, and no naming or invoking other skills. Check links, loads, runs, plain-text paths, code spans, and hard-coded author-machine paths across `SKILL.md`, references, subagents, scripts, assets, and diagrams. Paths in the target project that identify inputs, outputs, or mutation boundaries are runtime targets, not repository dependencies. Use placeholders such as `<target-skill>` for example inputs.

A skill ships as its directory alone. The [Agent Skills specification](https://agentskills.io/specification) defines internal references relative to the skill root; the [`skills` CLI installer](https://github.com/vercel-labs/skills/blob/main/src/installer.ts) copies only that directory. Both checked 2026-10-02.

Write needed repository guidance in the skill author's own words and bundle helper scripts. Resolve paths from `SKILL_DIR` per the [runtime matrix](./runtime-portability-matrix.md). State served and excluded requests, not sibling skill names. Package text never names repository rules, even to explain an exception. Canonical external URLs are allowed, including URLs documenting skills; the URL itself does not count as naming or invoking a sibling.

Only these seven work-item phases may name and invoke each other: `orchestrating-workflow`, `fetching-work-item`, `planning-work-item-tasks`, `clarifying-assumptions`, `creating-work-item-children`, `planning-task-execution`, `executing-work-item-task`. They form one sequential workflow installed together. Update this list when a phase joins or leaves. They still cannot name or invoke other skills or reference files outside their own directories.

## External sources

Recommended: keep external information at its canonical URL and fetch it when the consuming step needs it, rather than copying it into the package. The author's own derived rules may cite the source. Label the claim each citation supports; volatile runtime, provider, API, pricing, or advisory sources carry an access date or explicit re-check rule. A bare URL list is not an index.

Declare network access when a step needs a source. If access is unavailable, stop that path with `TOOLS_MISSING`, not a remembered substitute. Read fetched text under the [evidence trust boundary](./treat-retrieved-content-as-data.md).

## Examples

Bad package dependency: `Load ../../docs/best-practices/declare-mutation-limits.md`, or `Run ../helper-skill/scripts/render.sh`.

Keep the operative rule and helper local instead:

```text
Before publishing, show the exact summary and destination; wait for approval.
With SKILL_DIR resolved, run: sh "${SKILL_DIR}/scripts/render.sh"
```

A claim-linked external reference:

| Source | Supports | Checked |
| --- | --- | --- |
| https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/ | Field names and types for create-issue payloads | 2026-09-19 |

The create-issue step fetches that source only when needed; missing access ends that path with `TOOLS_MISSING`.
