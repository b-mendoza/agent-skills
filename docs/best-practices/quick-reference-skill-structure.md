# Quick Reference: Skill File Structure

```
skill-name/
├── SKILL.md                    # Size limits: see runtime-portability-matrix; core identity + contracts + routing
├── references/
│   ├── mode-specific-guide.md  # Loaded just-in-time per mode or phase
│   ├── output-template.md      # Extracted output template (loaded at assembly)
│   └── error-recovery.md       # Loaded only on error
├── subagents/                  # Repo convention: dispatch-prompt contracts the orchestrator reads
│   ├── specialist-a.md         #   and passes at dispatch time; see runtime-portability-matrix
│   └── specialist-b.md
├── assets/                     # Optional: files used in output (templates, images)
└── scripts/                    # Optional: deterministic tasks that don't need context
```

Notes:

- Output templates and reference tables live under `references/` (or `assets/` when they are copied into output verbatim), never under `subagents/` — see [progressive-disclosure](./progressive-disclosure.md).
- `subagents/` is this repository's portable convention for co-located dispatch contracts; the orchestrator reads a file from it and dispatches with that content as the prompt. The [runtime-portability-matrix](./runtime-portability-matrix.md) owns the registry facts.
- Frontmatter `name` must exactly match the directory name — see [frontmatter-contract](./frontmatter-contract.md).
