# Committing Scoped Changes

This workflow commits only user-approved scoped changes. The orchestrator normalizes commit authority and path scope, dispatches specialists for state inspection, boundary planning, and commit execution, and asks one targeted user question when required. `CHANGE_PATHS` is the commit allow-list; existing staged changes are evidence to plan around, not permission to commit. The workflow must preserve unrelated work, refresh state after each commit, and never expand scope or leave meaningful in-scope changes uncommitted without user approval.
