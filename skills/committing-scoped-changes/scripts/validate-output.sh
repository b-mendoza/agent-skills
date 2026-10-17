#!/bin/sh
# POSIX sh; usage: sh validate-output.sh < payload; -h prints usage.
# Exits: 0 accepted/help; 1 findings on stdout; 2 usage or missing awk.
# Checks plan shape only. Side effects: none. No required environment variables.
# Check: printf 'COMMIT_PLAN: ERROR\nReason: example\n' | sh validate-output.sh
LC_ALL=C
export LC_ALL
usage() { printf '%s\n' 'usage: sh validate-output.sh < payload'; }
if [ "$#" -ne 0 ]; then
  [ "$#" -eq 1 ] && [ "$1" = -h ] && { usage; exit 0; }
  usage >&2; exit 2
fi
command -v awk >/dev/null 2>&1 || { printf '%s\n' 'plan: awk unavailable' >&2; exit 2; }
awk '
function fail(n, msg) { printf "plan: line %d: %s\n", n, msg; failed = 1 }
function field(n, name,    prefix, value) {
  prefix = name ": "
  if (index(L[n], prefix) != 1) { fail(n, "expected " name ": with content"); return "" }
  value = substr(L[n], length(prefix) + 1)
  if (value ~ /^[[:space:]]*$/) fail(n, name ": must be non-empty")
  return value
}
function claim(n, value, omit,    count, tokens, i) {
  if (value == "") return
  if (omit) {
    if (value !~ /^[^[:space:]]+ [^[:space:]].*$/) { fail(n, "Omit: needs one path and a reason"); return }
    value = substr(value, 1, index(value, " ") - 1)
  }
  if (value ~ /(^ | $|  |[\t\r\n\v\f])/) fail(n, "paths must be single-space separated tokens")
  count = split(value, tokens, " ")
  for (i = 1; i <= count; i++) {
    if (tokens[i] in owned) fail(n, "duplicate path: " tokens[i])
    owned[tokens[i]] = 1
  }
}
{ raw[NR] = $0 }
END {
  first = 1; last = NR
  while (first <= last && raw[first] ~ /^[[:space:]]*$/) first++
  while (last >= first && raw[last] ~ /^[[:space:]]*$/) last--
  if (last < first) { fail(1, "payload is empty"); exit 1 }
  for (i = first; i <= last; i++) {
    L[++N] = raw[i]
    if (raw[i] ~ /^[[:space:]]*$/) fail(N, "blank line inside the envelope")
  }
  if (L[1] !~ /^COMMIT_PLAN: (PASS|BLOCKED|ERROR|TOOLS_MISSING)$/) fail(1, "unknown COMMIT_PLAN status")
  else if (L[1] != "COMMIT_PLAN: PASS") {
    if (N != 2) fail(N, "non-PASS needs exactly one Reason line")
    field(2, "Reason")
  } else {
    i = 2
    while (i <= N && L[i] ~ /^Message: /) {
      field(i, "Message"); claim(i + 1, field(i + 1, "Paths"), 0)
      field(i + 2, "Verification"); i += 3
    }
    while (i <= N && L[i] ~ /^Omit: /) { claim(i, field(i, "Omit"), 1); i++ }
    if (i <= N) fail(i, "expected a Message triple or Omit record")
  }
  exit failed
}'
