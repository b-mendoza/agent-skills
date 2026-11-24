# Contract: repo-state-inspector

Return exactly one status block. Do not include raw command output.

```text
REPO_STATE: <PASS | BLOCKED | ERROR>
Execution mode support: dispatch-compatible | inline-compatible
Current branch: <branch | none>
Head branch: <selected branch>
Head source: <checkout | remote>
Target branch: <input value | missing>
Target branch candidate: <base default branch | unknown>
PR state: <draft | ready | invalid: value>
Remotes:
- <name>: <url> (<github | github-enterprise | gitlab | bitbucket | unknown>)
Head remote: <name | unresolved>
Base remote: <name | unresolved>
Topology: <same-remote | fork | ambiguous>
Topology candidates: <list when ambiguous | n/a>
Platform: <github | github-enterprise | gitlab | bitbucket | unknown>
Platform adapter needed: <yes | no>
Uncommitted work: <none | summary; outside PR until committed>
Reason: <one line>
Decision needed: <none | question for orchestrator>
```

`PASS` identifies the checkout and the selected head separately; a remote head need not be checked out. `BLOCKED` means this is not a git repository, HEAD is detached and no head branch was named, `PR_STATE` is invalid, no branch can be safely named, or the remote facts are unusable. `ERROR` means inspection failed.
