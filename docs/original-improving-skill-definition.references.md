# External References For `improving-skill-definition`

Access date: 2026-06-12.

These resources are relevant because the target skill audits and improves Agent Skills packages, coordinates subagents, uses progressive disclosure and handoff files, validates package structure, and limits related-skill discovery to GitHub/GitLab evidence. External resources are evidence and comparison material only; the target skill's bundled files remain the source of truth for its actual behavior.

## Skill Format And Runtime Ecosystem

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [Agent Skills specification](https://agentskills.io/specification) | The public Agent Skills format reference. It defines the minimum `SKILL.md` directory structure, frontmatter fields, optional `scripts/`, `references/`, and `assets/`, progressive disclosure, file references, and validation. | The target skill audits frontmatter names, package layout, referenced paths, file size, progressive disclosure, and skill-vs-prompt sufficiency. This spec is the closest external baseline for what a valid skill package is. |
| [Agent Skills overview](https://agentskills.io/home) | Overview of Agent Skills as a lightweight open format for specialized knowledge and workflows, with progressive loading from metadata to `SKILL.md` to resources. | The target skill's package-hygiene and prompt-sufficiency audits evaluate whether a workflow earns skill packaging and whether referenced files are loaded only when useful. |
| [GitHub Copilot: Adding agent skills](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills) | GitHub documentation for creating and installing agent skill folders with `SKILL.md` plus optional Markdown resources and scripts. | The repository targets portable Agent Skills across runtimes. GitHub's docs show another mainstream client using the same folder-based skill concept and locations such as `.github/skills`, `.claude/skills`, and `.agents/skills`. |
| [GitLab Duo Agent Skills](https://docs.gitlab.com/user/duo_agent_platform/customize/agent_skills/) | GitLab documentation for project-level and user-level Agent Skills and how GitLab Duo loads matching skills. | The target skill's `related-skills-discoverer` is explicitly limited to GitHub/GitLab examples, and `TARGET_RUNTIME` defaults to portable Agent Skills. This is a relevant runtime/client implementation to compare against. |
| [GitLab.org / ai / skills](https://gitlab.com/gitlab-org/ai/skills) | GitLab-hosted repository of AI skill definitions for GitLab projects. | This is directly in the target skill's allowed related-discovery scope and can supply real GitLab examples for audit comparison without widening beyond GitHub/GitLab. |

## Validation And Quality Gates

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [Validate Skill GitHub Action](https://github.com/marketplace/actions/validate-skill) | A third-party GitHub Action that validates `SKILL.md` against the Agent Skills specification, including required fields, frontmatter structure, body-size warnings, directory enforcement, and optional reference checking. | The target skill's `package-hygiene-auditor` and `skill-package-validator` do similar package-health checks: frontmatter-name matching, reference existence, file caps, and validation before declaring success. It is a comparable external validation tool, not a replacement for the target's stricter local gates. |
| [Anthropic `skill-creator` skill](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) | A public skill-authoring workflow with bundled subagents and references; its documented loop includes drafting or editing a skill, testing it with a skill-aware agent, evaluating outputs, and iterating. | The target skill improves existing skill packages after adversarial audits. This external skill is relevant as a comparable skill-creation and evaluation workflow, especially because it uses specialized subagent/reference files and an iterative improvement loop. |

## Subagent Orchestration

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [Codex subagents](https://developers.openai.com/codex/subagents) | OpenAI documentation describing subagent workflows, specialized agents, parallel work, result collection, and explicit user-triggered spawning. | The target skill dispatches six audit slices as an independent group when runtime support exists and keeps the orchestrator focused on synthesis. Codex's subagent model is directly comparable to that orchestration pattern. |
| [Claude Code custom subagents](https://code.claude.com/docs/en/sub-agents) | Claude Code documentation for custom subagents, tool restrictions, model selection, MCP scoping, permission modes, and preloaded skills. | The target skill audits and validates subagent boundaries, permissions, mutation authority, and whether subagents are justified. Claude Code's subagent controls are relevant runtime comparison points for capability and permission boundaries. |
| [OpenCode agents](https://opencode.ai/docs/agents/) | OpenCode documentation for primary agents and subagents, including read-only exploration agents, full-access general agents, permissions, and markdown-based custom agents. | This repository names OpenCode as a canonical runtime target. The target skill's subagent architecture and mutation-boundary checks map naturally to OpenCode's distinction between primary agents, subagents, and permissions. |

## Context Management And Progressive Disclosure

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Engineering guidance on compaction, structured note-taking, and subagent architectures for managing long-running agent context. | The target skill uses handoff files, compact retained summaries, baseline snapshots, and subagent report synthesis to keep context manageable while preserving traceability. This article explains the broader context-engineering pattern behind those choices. |
| [BMad Builder: Progressive Disclosure in Skills](https://bmad-builder-docs.bmad-method.org/explanation/progressive-disclosure/) | Documentation describing frontmatter/body separation, on-demand resources, dynamic routing, and step files as progressive disclosure layers in skill design. | The target skill's package-hygiene audit checks whether content is split into references and subagents appropriately, whether `SKILL.md` stays compact, and whether machinery is earned. This resource is relevant background for that progressive-disclosure review. |

## Mermaid And Workflow Diagrams

| Resource | What it is | Why it is relevant |
| --- | --- | --- |
| [Mermaid flowchart syntax](https://mermaid.js.org/syntax/flowchart.html) | Official Mermaid flowchart documentation. | The target skill treats `flow-diagram.md` as source of truth and routes semantic diagram changes through `generate-flow-diagram`. Official Mermaid syntax is relevant when validating diagram candidates or repairing syntax failures. |

## Scope Notes

- The target skill's own `references/external-sources.md` lists runtime sources for Claude Code, OpenCode, progressive disclosure, Anthropic context engineering, and GitHub/GitLab related-skill examples. Those are reflected above where externally verified.
- Blogs, package registries, Reddit posts, and vendor pages outside the target's allowed related-discovery scope were not used as related-skill examples. Some are useful background in other contexts, but the target skill's discovery subagent is GitHub/GitLab-only unless the user expands scope.
- No external resource in this file changes the target skill's actual execution contract. The source files under `skills/improving-skill-definition/` govern behavior.
