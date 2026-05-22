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
| Progressive disclosure background | `https://skills.sh/flpbalada/fb-skills/progressive-disclosure` | Explaining why detailed static material should be loaded just in time |
| Claude Code subagents | `https://docs.anthropic.com/en/docs/claude-code/sub-agents` | Verifying current Claude Code subagent concepts or syntax |
| Claude prompting XML guidance | `https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags` | Verifying current XML prompt-tag guidance |
| Claude prompting best practices | `https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview` | Checking current prompt-structure recommendations |
| OpenCode documentation | `https://opencode.ai/docs/` | Verifying current OpenCode runtime behavior or configuration expectations |

## Fetch Rules

- Fetch only one targeted URL at a time.
- Prefer official runtime documentation for syntax and current behavior.
- Prefer local bundled criteria for normal audit and validation.
- If a source cannot be fetched, make the local-package decision when safe and
  record the unavailable source as a remaining risk.
- Do not block on an external source unless runtime freshness is essential to the
  requested change.
