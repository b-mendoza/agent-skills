# Command Guard

Apply this algorithm to every candidate command, regardless of origin.

## Algorithm

1. Reject unless the candidate is a single command.
2. Reject if it contains any of `;`, `&&`, `||`, `|`, `$(`, backtick, `>`, `<`, or newline.
3. Reject environment-variable prefixes such as `FOO=bar cmd` and shell wrappers such as `bash -c`, `sh -c`, or `env`.
4. The leading token, or leading pair for two-token runners, must exactly equal one allowlisted entry.
5. Arguments after an allowlisted head are permitted only when they do not introduce rejected characters.
6. Guard-failing candidates require the user to retype the exact command verbatim in this run; record the quoted confirmation.

## Allowlist

`pytest`, `python -m pytest`, `go test`, `npm test`, `yarn test`, `pnpm test`, `npx vitest`, `npx jest`, `cargo test`, `mvn test`, `./gradlew test`, `rspec`, `mix test`.

## Non-Test Commands

Never run deploy, destructive, package-publish, network-write, or non-test commands. Refactorer-suggested, repo-derived, and user-supplied commands are all checked.

## Script-Runner Disclosure

When the command delegates to repo-defined scripts (`npm test`, `yarn test`, `pnpm test`, `mvn test`, `./gradlew test`), resolve and quote the underlying script source, such as `package.json` `scripts.test`. The validator report and final handoff include this standing residual risk: running tests through repo scripts executes repository-defined code.
