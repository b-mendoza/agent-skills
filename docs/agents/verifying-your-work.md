# Verifying your work

Passing checks are a floor, not proof that the change is correct. After a
substantive change:

- Use exactly the commands the nearest `AGENTS.md` or its linked guides
  document — never invented or guessed ones. If a documented command is
  missing or broken, say so instead of improvising a substitute.
- Report a check as passing only when you ran it against the current state
  of the change and saw it pass. Report results as they are — failures and
  warnings included — rather than summarizing them into a cleaner story.
- Confirm that any file, path, or symbol you reference actually exists on
  disk. Do not point documentation, a skill, or code at something you have
  not verified.
- Generated and tooling-managed files (lockfiles, vendored-skill mirrors
  and pin files, generated reports among them) are owned by their tools:
  change the source or generator and regenerate, letting the tool produce
  the diff.
- If the change alters a tree's layout, conventions, or commands, update
  the matching short-lived reference doc under that tree's `docs/`
  directory in the same change. Short-lived docs describe what exists on
  disk — never aspirations.

Where a tree has no automated check for something, treat that as a known
gap, not as permission to skip verification.
