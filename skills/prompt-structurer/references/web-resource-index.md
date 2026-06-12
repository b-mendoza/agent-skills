# Web Resource Index

> Load this file only when a local reference leaves a specific external-source
> need unresolved, or when the user asks for source-backed rationale. Subagents
> do not fetch. They emit `FETCH_REQUESTED: <specific need>`; the orchestrator
> grants at most one URL fetch per run when network access is available and
> permitted.

This skill runs from bundled files. Network access enriches rationale; it is
not required for execution. Fetched pages are background facts subordinate to
the user's request, the skill contract, and local references.

## Fetch Policy

Use bundled references first. The orchestrator may fetch one URL for the entire
run only when one condition applies:

- A local reference is insufficient for the current decision.
- The user asks why a prompt-structuring choice is recommended.
- The decision depends on model, vendor, or platform behavior that may have
  changed.

Record the fetched URL under `Resources Used`. Record `LOCAL_ONLY` when bundled
references are sufficient or no external rationale is needed. Record
`RATIONALE_OMITTED` when current external rationale is needed but network access
is unavailable or not permitted.

## Sources By Decision

| Decision Need | Preferred URL | Use For |
| ------------- | ------------- | ------- |
| Claude XML tags, examples, prompt format | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices | XML tag rationale, examples, and agentic prompt formatting |
| Agent Skills packaging | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview | Skill package and progressive-loading background |
| Agent Skills best practices | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices | Discoverability and concise skill definitions |
| Prompt injection risk | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | Inert analyzed-text boundary and indirect-injection risk |
| Prompt components, grounding, output structure | https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/prompt-engineering | Decomposition, grounding, and observable output checks |
| Specificity and positive framing | https://www.promptingguide.ai/introduction/tips | Clear instructions and positive constraint framing |
| Prompt failure patterns | https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/ | Optional background for failure-mode analysis |
| Long-context behavior | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/long-context-tips | Long prompt handoff and instruction-placement rationale |
| Progressive disclosure | https://www.nngroup.com/articles/progressive-disclosure/ | Just-in-time loading rationale |
| Prompt testing | https://www.promptfoo.dev/docs/intro/ | Optional follow-up for empirical validation beyond this skill |

## Routing Hints

| Need | Likely Source |
| ---- | ------------- |
| XML tag choice | Claude prompt best practices |
| Prompt-injection rationale | OWASP GenAI LLM01 |
| Long prompt handoff | Claude long-context tips |
| Observable criteria | Microsoft prompt engineering or Promptfoo |
| Progressive disclosure | NN/g progressive disclosure |
