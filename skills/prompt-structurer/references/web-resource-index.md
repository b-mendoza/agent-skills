# Web Resource Index

> Read this file only when a subagent needs external background. Fetch one targeted URL, not the whole list.

The skill is executable from its local files. These links replace long static background explanations and provide just-in-time reading when the agent needs deeper rationale, examples, or current guidance.

## Fetch Policy

- Fetch external resources only when they change a decision, explain a user-facing rationale, or answer a prompt-engineering question not covered locally.
- Prefer official vendor documentation for model-specific prompt behavior.
- Use articles and blogs for broader concepts, examples, and research context.
- If web access is unavailable, continue with the local `SKILL.md`, subagents, and references.
- Record fetched URLs under `Resources Used` in the subagent output.

## Resources

| Need | Resource | URL |
| --- | --- | --- |
| Prompt-engineering workflow and evaluation setup | Anthropic prompt engineering overview | https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview |
| XML tags, examples, clarity, long context, and agentic prompting for Claude | Anthropic prompting best practices | https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices |
| XML tag rationale and prompt structure for Claude-style prompts | Anthropic XML tags guide | https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags |
| Prompt components, clear syntax, task breakdown, output structure, grounding, and space efficiency | Microsoft prompt engineering techniques | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/prompt-engineering |
| Specificity, concise prompts, separators, and positive instruction framing | Prompt Engineering Guide general tips | https://www.promptingguide.ai/introduction/tips |
| Research-oriented overview of few-shot prompting, chain-of-thought, retrieval, tool use, and prompt optimization | Lilian Weng, Prompt Engineering | https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/ |
| Progressive disclosure concept, benefits, and split between primary and secondary information | Nielsen Norman Group, Progressive Disclosure | https://www.nngroup.com/articles/progressive-disclosure/ |
| Skill-shaped example of progressive disclosure in an agent skill | skills.sh progressive-disclosure skill | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure |
| Claude skill packaging and progressive disclosure for skills | Claude Agent Skills overview | https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview |
| Claude skill authoring patterns and best practices | Claude Agent Skills best practices | https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/best-practices |

## Routing Hints

| Subagent | Most Likely Useful Resources |
| --- | --- |
| `semantic-decomposer` | Microsoft prompt components, Prompt Engineering Guide tips |
| `philosophy-constraints-classifier` | Anthropic prompting best practices, Prompt Engineering Guide tips |
| `implicit-behavior-surfacer` | Anthropic long-context and agentic guidance, Nielsen Norman progressive disclosure |
| `anti-pattern-synthesizer` | Prompt Engineering Guide positive framing, Microsoft clear syntax and output structure |
| `success-criteria-builder` | Microsoft output structure and grounding, Anthropic self-check guidance |
| `xml-prompt-assembler` | Anthropic XML tags guide, Microsoft clear syntax, local template skeleton |
