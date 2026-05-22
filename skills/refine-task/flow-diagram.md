# refine-task reviewer-only refinement flow

This workflow keeps the coordinator thin and evidence-focused: it normalizes a Jira ticket, Jira epic, GitHub issue, or GitHub parent issue request; dispatches `refinement-reviewer` with compact source pointers; and returns or posts exactly one refinement comment only when posting is explicitly authorized and available. Tracker items are treated as evidence to review, not state to mutate; all edits, lifecycle changes, child creation, link changes, splitting actions, and other mutations are deferred to separate approved workflows.
