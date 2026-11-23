# Agent Guide — agent-skills

`agent-skills` is a skill library for coding agents: each skill is a self-contained directory with a `SKILL.md`, optional `subagents/` and `references/` directories, and supporting scripts. The repo is the artifact — most edits here are skill or subagent authoring tasks.

**Dual-runtime constraint (applies to every skill file):** skills must work on both OpenCode and Claude Code. Follow the [runtime portability matrix](./docs/best-practices/runtime-portability-matrix.md) for frontmatter, markdown, tool, permission, and subagent choices.

## Documentation model

This repo keeps two tiers of agent documentation. Maintain the split when you add or edit docs:

- **Long-lived guidance** — `AGENTS.md` files and `docs/agent/` directories. Principles and guidelines with general examples only; no source-code paths or code snippets, so they stay true as the code changes. Scoped `AGENTS.md` maps are the one exception: they name the exact commands for their tree and are updated when those commands change.
- **Short-lived references** — Markdown files under a `docs/` directory (root or sub-project), outside `docs/agent/`; related references may be grouped in a subdirectory. Current-state descriptions: architecture, file structure and conventions, command references. Each carries a banner saying it must be updated when the code changes.

Guidance earns its place through observed failures: add a rule when a mistake happens, and remove rules that no longer affect behavior. These files load into every agent's context, so every line must pay rent. State what to do rather than enumerating what to avoid; keep a standalone prohibition only when it marks a specific failure that keeps happening.

Cross-cutting guidance lives once, in this file and its linked guides. Each sub-project's `AGENTS.md` (today: [`evals/AGENTS.md`](./evals/AGENTS.md)) is the nearest guide for its tree: it owns the exact commands for that tree and may override anything here.

## Working with the user

The user's instructions are a baseline to build on, not a spec to execute verbatim. When a premise looks wrong, a simpler approach exists, or the problem statement itself is off, say so plainly and propose the better version — the user wants a partner to learn from, not a yes-man, and pushback backed by reasoning is explicitly welcome. Challenge because you have a concrete objection, not to perform independence: when an instruction survives your scrutiny, follow it.

## Always

- Before editing a tree that has its own `AGENTS.md` (today: `evals/`), read that guide first. When authoring or editing a skill, subagent, or reference file, use the [best-practice index](./docs/best-practices/README.md) to find the rule for the decision in front of you.
- After a substantive change, run the checks the nearest guide names: the [manual verification checklist](./docs/agent/skill-verification.md) after skill or subagent edits (this repo has no CI), and inside `evals/` the lint check after a change plus the test suite before committing ([`evals/AGENTS.md`](./evals/AGENTS.md) names the exact commands). Passing checks are a floor, not proof — when unsure whether a change is correct, escalate rather than declare success.
- Where a tree has a linter (`evals/`), its configuration is the enforced source of truth for style. Prefer fixing a finding over suppressing it; suppress inline only when the rule is genuinely wrong for the case, and say why.
- Editing is not permission to publish. Do not commit, push, open a pull request, or create an issue unless explicitly asked; when committing, stage only the paths the task touched.

## Subagents

- Delegate broad searches, multi-file audits, self-contained investigations, parallel subtasks, and tasks that require delegation. Keep intermediate file dumps out of the main thread and conclusions in it. Give each agent a bounded goal, definition of done, scope, and result format. Ask before dispatch when unsure.

## Model topology

The orchestrator selects a model and an effort level for each child task. Match the model to the task difficulty. When the difficulty is not clear, start with `gpt-6.2-astra`.

|                   | `claude-haiku-5-5`                                       | `gpt-6.2-astra`                                                      | `claude-opus-5-5`                                                                                            | `claude-fable-5-2`                                                                                                              |
| ----------------- | -------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Use for**       | High-volume work with results that are easy to check     | Everyday work                                                        | Higher-difficulty work                                                                                       | Very complex work                                                                                                               |
| **Typical tasks** | File searches, log reads, summaries, and data extraction | Well-scoped bug fixes, features built to a spec, and routine reviews | Hard debugging, features across many files, performance work, and refactors or migrations that follow a plan | Architecture plans, refactor and migration plans, design reviews, deep research, and tasks that `claude-opus-5-5` did not solve |
| **Move up when**  | The task needs a code edit or a judgment call            | `high` effort does not solve the task                                | A `claude-fable-5-2` condition is true                                                                       | No model is higher. Report the block to the user.                                                                               |

When the harness does not offer `claude-haiku-5-5`, use `gpt-6.2-astra` at `low` effort.

### Dispatch

- Run each model in the table in the Claude Code harness. Use the native `Agent` tool for these models, not `delegate_task`.
- For `claude-haiku-5-5`, `claude-opus-5-5`, and `claude-fable-5-2`, set the `model` parameter to `haiku`, `opus`, or `fable`.
- For `gpt-6.2-astra`, do not set the `model` parameter. The `CLAUDE_CODE_SUBAGENT_MODEL` environment variable makes `gpt-6.2-astra` the default subagent model. The `model` parameter does not accept this model.
- For `gpt-6.2-astra`, use a `subagent_type` whose definition sets no `model`, such as `general-purpose`. A `model` in the agent definition replaces the default. Do not use `fork`, because a fork always runs on the model of the orchestrator's thread.
- Use the Codex and Grok harnesses only for web reads and adjudication.

### Effort

- Set the effort level on each child task to fit the task. Use the `effort` parameter of the `Agent` tool. Do not rely on an inherited or default level.
- Use only `low`, `medium`, and `high`. Never use a higher level.
- Use `low` for mechanical work that has one correct result, such as a search, a read, or a rename.
- Use `medium` for work that needs judgment. Start here when you are not sure.
- Use `high` for work that needs long reasoning, many tool calls, or many self-checks.

### Escalation

When a model does not solve a task, do these steps in order.

1. Give the model a way to verify its work, such as a test, a build, or a script.
2. Raise the effort level one step. Stop at `high`.
3. Move to the next model in the table. Start that model at `medium`.

### `claude-fable-5-2` conditions

For code work, use `claude-fable-5-2` only when one of these conditions is true.

- **Design decision:** The brief must ask the model to make or review a design decision, and no spec, plan, or convention makes that decision. A design decision selects an architecture, a service or module boundary, a data model, or a migration strategy.
- **Failed check:** `claude-opus-5-5` fails the same verification check two times, and the last attempt used `high` effort.

The size of a task is not a condition. Send a large task that has a settled design to `claude-opus-5-5`.

For a design decision, do these steps in order.

1. Ask `claude-fable-5-2` for a written plan. State the scope in the brief, and ask for the simplest design that satisfies the requirements.
2. Delegate the implementation of the plan to `claude-opus-5-5` or `gpt-6.2-astra`.

### Web reads

- After the first blocked fetch, delegate the read. Do not try other URLs, user agents, or scrapers to get past the block. Require quotes to come from retrieved content.
- For a blocked web page, use `gpt-6.2-astra` in the Codex harness. For X posts, use `grok-4.6` in the Grok harness, not `grok-4.7`.

### Adjudication

- An adjudication is a verdict on a judgment dispute between the orchestrator and a subagent.
- In the Codex harness, use `gpt-6.2-astra` for an adjudication.
- In the Grok harness, use `grok-4.7-build-fast` for an adjudication.

### T3 Code

- Use `delegate_task` only for web reads and adjudication. The provider is `codex` for the Codex harness and `grok` for the Grok harness.
- Use `orchestrator_capabilities` to make sure that the provider offers the model.
- Set the effort level in `target.options`. The option is `reasoningEffort`.

## Open when relevant

Long-lived guides:

- [Skill verification checklist](docs/agent/skill-verification.md) — manual checks after skill or subagent edits; this repo has no CI.
- [Naming conventions](docs/agent/naming-conventions.md) — how to name variables, arguments, and functions, with good/bad examples.
- [Code design](docs/agent/code-design.md) — contracts at the boundaries, failing loudly, and comments.
- [Testing principles](docs/agent/testing.md) — what and how to test.
- [Workflow and task scoping](docs/agent/workflow.md) — simplicity, scope discipline, issues, and decomposition.
- [Verifying your work](docs/agent/verification.md) — what "done" requires beyond green tests.
- [Working inside evals/](evals/AGENTS.md) — nearest guide; owns evals commands, conventions, and guardrails.

Current-state references (short-lived; verify against the code):

- [Repository architecture](docs/architecture.md) — layout of the repository and links to each tree's references.
- [Best-practice library](docs/best-practices/README.md) — index of self-contained rules for skills and subagents, each with ❌/✅ examples; current runtime facts live in [runtime-portability-matrix](docs/best-practices/runtime-portability-matrix.md), dated — verify against the runtime docs.
