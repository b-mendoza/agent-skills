# External References For committing-scoped-changes

The target skill already declares its optional public reference registry in `skills/committing-scoped-changes/references/external-sources.md`. The resources below are relevant because they support the same decision areas the skill routes just in time: Git state mechanics, staging and committing behavior, atomic commit grouping, commit message conventions, and the skill's progressive-disclosure/subagent-isolation design. Local skill contracts remain authoritative; these links are background or specialist inputs only when they can change the active commit decision.

## Git Mechanics

| Resource | What It Is | Relevance To This Skill |
| --- | --- | --- |
| [Pro Git: Recording Changes to the Repository](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository) | Official Pro Git book chapter explaining tracked, untracked, modified, staged, and committed file states. | Supports the `scoped-state-summarizer` responsibility to classify path scope, staged scoped changes, staged outside-scope entries, untracked files, and unrelated changes. |
| [git-status documentation](https://git-scm.com/docs/git-status) | Official command reference for status output. | Relevant when exact status behavior or porcelain interpretation could affect scoped state inspection. |
| [git-diff documentation](https://git-scm.com/docs/git-diff) | Official command reference for inspecting unstaged and staged diffs. | Relevant when pathspec, staged-diff, or context behavior could affect state summarization or executor staged-diff review. |
| [git-add documentation](https://git-scm.com/docs/git-add) | Official command reference for staging files and pathspecs. | Relevant to executor staging decisions, including file-level staging, path boundaries, and cases where command semantics could change safe execution. |
| [git-restore documentation](https://git-scm.com/docs/git-restore) | Official command reference for restoring worktree or index state. | Relevant to reversible index isolation, unstaging, and cleanup when preserving unrelated staged entries. |
| [Pro Git: Interactive Staging](https://git-scm.com/book/en/v2/Git-Tools-Interactive-Staging) | Official Pro Git chapter on selecting changes interactively. | Relevant to mixed-hunk risk and the executor's rule to block when safe separation requires unresolved interactive selection. |
| [git-commit documentation](https://git-scm.com/docs/git-commit) | Official command reference for commit creation. | Relevant when commit flags, message behavior, hooks, or commit creation semantics could change execution or reporting. |

## Commit Grouping And Message Style

| Resource | What It Is | Relevance To This Skill |
| --- | --- | --- |
| [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) | Public specification for structured commit messages using type, optional scope, description, body, footers, and breaking-change markers. | Relevant when `COMMIT_STYLE` is Conventional Commits or exact type/scope/footer syntax affects planner message proposals. |
| [How to Write a Git Commit Message](https://chris.beams.io/git-commit) | Widely cited commit-message guidance emphasizing consistent style and using messages to explain why a change exists. | Relevant when repository history shows no clear style and the planner needs a durable, human-readable subject/body convention. |
| [Atomic commits - GitByBit](https://gitbybit.com/gitopedia/best-practices/atomic-commits) | Best-practice note describing atomic commits as separate logical units of work. | Relevant to the skill's planner rule that each group should have one reviewer-facing reason and be easy to understand and revert. |
| [How atomic Git commits dramatically increased my productivity](https://dev.to/samuelfaure/how-atomic-git-commits-dramatically-increased-my-productivity-and-will-increase-yours-too-4a84) | Practitioner article describing small complete commits, reversibility, cleaner history, and easier review. | Comparable rationale for the skill's preference for many small, reversible commits when the diff contains separable reasons. |
| [Untangling Fine-Grained Code Changes](https://arxiv.org/abs/1502.06757) | Research paper on tangled commits and techniques for splitting fine-grained code changes into self-contained tasks. | Relevant external research parallel to the skill's boundary-planning function, especially its separation of unrelated changes and mixed-hunk ambiguity handling. |

## Agent Workflow And Context Design

| Resource | What It Is | Relevance To This Skill |
| --- | --- | --- |
| [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Anthropic engineering article on context management patterns for AI agents. | Relevant to the skill's design choice to keep raw diffs, command logs, and copied web text inside specialists while the orchestrator tracks compact summaries, statuses, and decisions. |
| [Progressive Disclosure - Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/) | UX reference explaining disclosure of detail only when needed. | Relevant to the skill's progressive loading policy: load the smallest artifact that can change the next decision and fetch public sources only just in time. |
| [progressive-disclosure skill reference](https://skills.sh/flpbalada/fb-skills/progressive-disclosure) | Public skill reference named by the target package for explaining just-in-time retrieval. | Relevant because the target skill's external-source registry explicitly routes to it for maintaining disclosure layers or explaining just-in-time retrieval. This page could not be fetched in the current environment, so it is listed as a target-declared reference rather than a verified content source. |

## Notes On Verification

- The Git documentation, Conventional Commits specification, Chris Beams article, Anthropic article, Nielsen Norman Group article, GitByBit atomic-commits page, dev.to atomic-commits article, and arXiv paper were located or opened during this documentation pass.
- `https://www.aleksandrhovhannisyan.com/blog/atomic-git-commits/`, which appears in the target skill's own external-source registry, was blocked by robots.txt in this environment. It is therefore not included as a verified annotated reference here.
- No external reference overrides the target skill's local source files: `SKILL.md`, `flow-diagram.md`, subagent definitions, and bundled report contracts remain the source of truth for behavior.
