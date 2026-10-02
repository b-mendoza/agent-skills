# keep-skills-self-contained

📝 Keep every skill package self-contained: never reference a file in this repository outside the skill's own directory, and never name or invoke another skill; only the seven work-item workflow phases may name and invoke each other.

🔒 This rule is `mandatory` and cannot be waived by a per-skill exception; its only exception is the work-item workflow allowance below.

Every file in the package (`SKILL.md`, references, subagents, scripts, assets, flow diagrams) follows this boundary, including maintenance notes and historical records: no links, paths, loads, or runs into this repository's `docs/`, `evals/`, `prompts/`, `AGENTS.md`, `CLAUDE.md`, root README, or another skill's files, and no other skill named or invoked; example inputs use placeholders such as `<target-skill>`. Plain-text paths, code spans, and hard-coded absolute paths into the author's machine or repository count too. Paths in the target project for inputs, outputs, or mutation boundaries are runtime targets, not references to this repository. A skill ships as its directory alone: the [Agent Skills specification](https://agentskills.io/specification) defines a skill as a directory whose internal file references resolve from the skill root, and the [`skills` CLI installer](https://github.com/vercel-labs/skills/blob/main/src/installer.ts) copies only that directory (both checked 2026-10-02), so a path out of the package or a named sibling may not exist after install.

Put what the skill needs inside it: restate repository guidance as the skill's own rules in the author's words, cite canonical external-source URLs per [link-external-sources](./link-external-sources.md) even when the page documents a skill, and bundle any helper script it runs. Resolve package paths from `SKILL_DIR` per [runtime-portability-matrix](./runtime-portability-matrix.md). In descriptions and body text, exclude the request, not its owner: "Does not open pull requests" ([describe-when-to-use](./describe-when-to-use.md)). A declared exception names the rule, such as `validate-by-observation`, and gives the reason, never a link or path to the rule file or repository directories; the name is a reviewer identifier, not a dependency.

The seven work-item workflow phases run as one sequential workflow and are meant to be installed together: `orchestrating-workflow`, `fetching-work-item`, `planning-work-item-tasks`, `clarifying-assumptions`, `creating-work-item-children`, `planning-task-execution`, `executing-work-item-task`. This current-state list must be updated when a skill joins or leaves the workflow. This rule grants them permission to name and invoke each other without per-skill exception declarations, but only among those seven; they still cannot name or invoke any other skill or reference any repository file outside their own directories.

## Examples

```markdown
<!-- ❌ skills/summarize-diagram/SKILL.md: repository and sibling dependencies -->
description: "Summarizes diagrams. Use when asked to explain a diagram. Does not open pull requests (use pr-creator)."
Load `../../docs/best-practices/checkpoint-irreversible-actions.md` before publishing.
Run `../diagram-tools/scripts/render.sh`.
Maintainer note: coverage lives in `evals/cases/summarize-diagram/`.
Exception: [validate-by-observation](../../docs/best-practices/validate-by-observation.md),
because automated cases are not yet available.
```

```markdown
<!-- ✅ same skill: own rules, bundled helper, request-based exclusion -->
description: "Summarizes diagrams. Use when asked to explain a diagram. Does not open pull requests."
Before publishing, show the exact summary and destination; wait for explicit approval.
With `SKILL_DIR` resolved, run the bundled helper: `sh "${SKILL_DIR}/scripts/render.sh"`.
Exception: `validate-by-observation`, because automated cases are not yet available.
<!-- no repository paths, even in maintainer notes -->
```

## Related rules

- [link-external-sources](./link-external-sources.md)
- [describe-when-to-use](./describe-when-to-use.md)
- [runtime-portability-matrix](./runtime-portability-matrix.md)
- [earn-every-part](./earn-every-part.md)
