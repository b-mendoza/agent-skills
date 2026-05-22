# Review Pull Request Skill Flow

This workflow reviews exactly one pull request at a time. The orchestrator may normalize inputs, collect PR context through subagents, coordinate review phases, verify findings before they become final, write a local Markdown review artifact, and post to GitHub only after an exact preview and explicit user approval. Raw diffs, logs, API payloads, large source content, and other high-volume evidence stay inside phase subagents.

