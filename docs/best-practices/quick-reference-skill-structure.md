# Quick Reference: Skill File Structure

```
skill-name/
├── SKILL.md                    # Under 500 lines; core identity + contracts + routing
├── references/
│   ├── mode-specific-guide.md  # Loaded just-in-time per mode or phase
│   ├── output-template.md      # Extracted output template (loaded at assembly)
│   └── error-recovery.md       # Loaded only on error
├── subagents/                  # Repo convention: dispatch-prompt contracts the
│   ├── specialist-a.md         #   orchestrator reads and passes at dispatch time.
│   └── specialist-b.md         #   Not a runtime agent registry — runtimes discover
│                               #   native agents elsewhere (e.g. .claude/agents/).
├── assets/                     # Optional: files used in output (templates, images)
└── scripts/                    # Optional: deterministic tasks that don't need context
```

Notes:

- Output templates and reference tables live under `references/` (or `assets/` when they are copied into output verbatim), never under `subagents/` — see [template-extraction](./template-extraction.md).
- `subagents/` is this repository's portable convention for co-located dispatch contracts; the orchestrator reads a file from it and dispatches with that content as the prompt. Do not expect either runtime to auto-register these files as named agents.
- Frontmatter `name` must exactly match the directory name — see [frontmatter-contract](./frontmatter-contract.md).
