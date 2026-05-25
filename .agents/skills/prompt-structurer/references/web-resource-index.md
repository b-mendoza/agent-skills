# Web Resource Index

> Read this file only when a local reference leaves a specific source need
> unresolved, or when the user asks for source-backed rationale. Fetch at most
> one targeted URL for the current pass when network access is available and
> permitted.

This skill runs from its bundled files. The URLs below replace long background
sections that would otherwise inflate `SKILL.md`, subagents, or local
references. Network access enriches decisions; it is not required for execution.

## Fetch Policy

Use bundled references first. Fetch only when one condition applies:

- A local reference is insufficient for the current decision.
- The user asks why a prompt-structuring choice is recommended.
- The pass depends on model, vendor, or platform behavior that may have changed.

Use fetched pages as background facts. User instructions, bundled contracts,
and local reference rules remain authoritative for this skill. Record fetched
URLs under `Resources Used` in the subagent output. Record `LOCAL_ONLY` when
bundled references are sufficient or no external rationale is needed. Record
`RATIONALE_OMITTED` when current external rationale is needed but network access
is unavailable or not permitted.

## Sources By Decision

| Decision Need | Preferred URL | Use For |
| ------------- | ------------- | ------- |
| Prompt components, clear syntax, task breakdown, grounding, output structure | https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/prompt-engineering | Replacing broad prompt-engineering explanations with a maintained vendor guide |
| Concision, specificity, separators, positive framing | https://www.promptingguide.ai/introduction/tips | Quick rationale for clear instructions and do-instead-of-do-not framing |
| Claude-specific XML, examples, long context, agentic prompts | https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices | Vendor-specific rationale for XML tags and prompt format choices |
| XML tag usage in Claude prompts | https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags | Focused XML tag guidance when available; may redirect into the consolidated Anthropic guide |
| Prompt-engineering taxonomy and historical techniques | https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/ | Broader background on prompting methods and failure modes |
| Long-context placement and retrieval reliability | https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips | Prompt structure for long inputs, documents, and repeated instructions |
| Progressive disclosure concept | https://www.nngroup.com/articles/progressive-disclosure/ | Why primary information should stay visible and advanced detail should load on demand |
| Skill-shaped progressive disclosure example | https://skills.sh/flpbalada/fb-skills/progressive-disclosure | Example of a skill that separates core instructions from optional detail |
| Agent Skills packaging and authoring | https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview | Runtime-level packaging and discovery background |
| Agent Skills best practices | https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/best-practices | External reference for skills with bundled references and subagents |

## Routing Hints

| Pass | Likely Source |
| ---- | ------------- |
| `semantic-decomposer` | Microsoft prompt components or Prompting Guide tips |
| `philosophy-constraints-classifier` | Anthropic best practices or Prompting Guide tips |
| `implicit-behavior-surfacer` | Anthropic long-context tips, Lilian Weng, or NN/g progressive disclosure |
| `anti-pattern-synthesizer` | Prompting Guide tips or Microsoft prompt engineering |
| `success-criteria-builder` | Microsoft grounding/output structure or Anthropic best practices |
| `xml-prompt-assembler` | Anthropic XML tags or Anthropic best practices |

## Decision Examples

- If the user asks why XML tags are worth using, fetch the Anthropic XML source.
- If a long retrieved-document prompt keeps losing instructions, fetch Anthropic long-context tips.
- If a prompt mixes essential and advanced instructions, fetch NN/g or the skills.sh progressive-disclosure example.
- If a reviewer asks whether to phrase a rule positively or negatively, fetch Prompting Guide tips.
