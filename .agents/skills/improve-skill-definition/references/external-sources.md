# External Sources

Read this file only when a concrete decision needs current platform guidance,
source-backed rationale, or optional background that would otherwise bloat the
skill package. Fetch the smallest relevant source and record the URL in the
subagent report.

External sources are optional. A skill package must keep essential execution
rules, inputs, outputs, escalation behavior, and validation criteria in bundled
files.

## Source Index

| Need | URL | Use when |
| ---- | --- | -------- |
| Progressive disclosure background | `https://bmad-builder-docs.bmad-method.org/explanation/progressive-disclosure/` | Explaining just-in-time loading, small orchestrators, and reference extraction |
| Claude Code subagents | `https://docs.anthropic.com/en/docs/claude-code/sub-agents` | Verifying current Claude Code subagent concepts, fields, or file placement |
| Claude prompting XML guidance | `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#structure-prompts-with-xml-tags` | Verifying XML prompt-tag guidance for prompt-oriented skills |
| Claude prompting best practices | `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices` | Checking current prompt-structure recommendations and positive instruction framing |
| Anthropic context engineering | `https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents` | Explaining context-window protection, summarization, and just-in-time retrieval |
| OpenCode documentation | `https://opencode.ai/docs/` | Verifying current OpenCode runtime behavior or configuration expectations |
| OpenCode agents | `https://opencode.ai/docs/agents/` | Checking OpenCode-specific agent or subagent packaging expectations |

## Fetch Rules

- Fetch only one targeted URL at a time.
- Prefer official runtime documentation for syntax and current behavior.
- Prefer local bundled criteria for normal audit and validation.
- Use articles and blog posts for rationale; use official docs for syntax.
- If a source cannot be fetched, make the local-package decision when safe and
  record the unavailable source as a remaining risk.
- Do not block on an external source unless runtime freshness is essential to the
  requested change.
