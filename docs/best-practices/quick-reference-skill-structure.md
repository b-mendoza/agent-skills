# Quick Reference: Skill File Structure

```
skill-name/
├── SKILL.md                    # Under 500 lines; core identity + contracts + routing
├── subagents/
│   ├── specialist-a.md         # Full subagent definition with scope + escalation
│   ├── specialist-b.md
│   └── specialist-b-template.md  # Extracted output template (loaded on demand)
├── references/
│   ├── mode-specific-guide.md  # Loaded just-in-time per mode or phase
│   └── error-recovery.md       # Loaded only on error
└── scripts/                    # Optional: deterministic tasks that don't need context
```
