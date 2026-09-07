# helper-script-contracts

## Tier

`recommended`. A miss is a portability or reviewability smell, not a safety failure, because [human-in-the-loop-checkpoints](./human-in-the-loop-checkpoints.md) still gates the outward action.

## When it applies

Any file under a skill's `scripts/` directory that is not the runtime output validator owned by [script-enforced-output-contracts](./script-enforced-output-contracts.md). Collectors, posters, checkers, and cleaners are in scope.

## The practice

Helper scripts under `scripts/` declare their shell, usage, exit codes, and side effects, and ship one runnable check.

Rules:

1. **Declare the interpreter.** POSIX `sh` by default. Use `#!/usr/bin/env bash` only with a one-line reason at the top of the script.
2. **Print a usage line.** Name every argument and environment variable. Print it on `-h` and on bad arguments.
3. **Document exit codes.** `0` is success. Use distinct non-zero codes for usage error, missing capability, and remote failure. Match the escalation category the orchestrator routes on.
4. **Name side effects in `SKILL.md` where the script is invoked.** Network calls, writes, and posts must be named so [human-in-the-loop-checkpoints](./human-in-the-loop-checkpoints.md) can gate them.
5. **Ship one runnable check per script.** A smoke invocation with a fixed input, or a `--dry-run` path, that the verification checklist runs.

## Rationale

A helper that only appears as a command in `SKILL.md` is not reviewable. Reviewers cannot tell which shell it needs, which arguments it takes, or which non-zero exit means ask the user versus retry. POSIX `sh` is the portable default. Unexplained bash is a silent portability gap.

Distinct exit codes make routing mechanical. One `exit 1` for usage, missing `gh`, and a failed POST collapses those cases. The orchestrator cannot pick the right escalation category.

Side effects named only inside the script hide the approval surface. Naming them at the call site in `SKILL.md` lets the checkpoint fire before the script runs. A runnable check proves the script still starts. Without it, a helper can rot until a live run.

## Concrete examples

Good: a POSIX `sh` header with usage and documented exit codes.

```sh
#!/bin/sh
# scripts/post-comment.sh
# POSIX sh: no bashisms; both runtimes invoke this with `sh`.
# usage: OWNER=org REPO=name COMMENT_FILE=path sh post-comment.sh
#        sh post-comment.sh -h
# env: OWNER, REPO, COMMENT_FILE required
# exits: 0 success; 2 usage error; 3 TOOLS_MISSING; 4 remote failure
```

Bad: bash with no usage, `exit 1` everywhere, and an undocumented `gh` call.

```bash
#!/usr/bin/env bash
gh api "repos/$1/$2/issues/$3/comments" -f body="$(cat "$4")" || exit 1
```

## References

- [script-enforced-output-contracts](./script-enforced-output-contracts.md)
- [escalation-categories](./escalation-categories.md)
- [human-in-the-loop-checkpoints](./human-in-the-loop-checkpoints.md)
- [empirical-validation](./empirical-validation.md)
