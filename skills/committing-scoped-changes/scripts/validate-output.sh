#!/bin/sh
# Shape validator. Proves enums, fields/order/counts, path token grammar,
# byte order/uniqueness, expansion membership and 40-hex group digests.
# Does not prove repository coverage, claim truth, digests or commit existence.
# Usage: sh validate-output.sh <plan|execute> < payload; -h prints help.
# Exit 0: accepted/help; 1: findings on stdout; 2: usage/capability error.
# Dependencies: POSIX sh, awk. Environment: none required.
# Side effects: none; no Git, network or temporary files.
# Check: printf 'COMMIT_PLAN: ERROR\nReason: example\n' | sh validate-output.sh plan
LC_ALL=C
export LC_ALL
usage() { printf '%s\n' 'usage: sh validate-output.sh <plan|execute> < payload'; }
[ "$#" -eq 1 ] || { usage >&2; exit 2; }
mode=$1
case "$mode" in
  -h|--help) usage; exit 0 ;;
  plan|execute) ;;
  *) usage >&2; exit 2 ;;
esac
command -v awk >/dev/null 2>&1 || { printf '%s\n' 'validator: awk unavailable' >&2; exit 2; }
awk -v mode="$mode" '
function fail(n, msg) { printf "%s: line %d: %s\n", mode, n, msg; failed = 1 }
function field(n, name,    p) {
  p = name ": "
  if (index(L[n], p) != 1) { fail(n, "expected " name ": with content"); return "" }
  if (substr(L[n], length(p) + 1) ~ /^[[:space:]]*$/) { fail(n, name ": must be non-empty"); return "" }
  return substr(L[n], length(p) + 1)
}
function hex40(s) { return (length(s) == 40 && s ~ /^[0-9a-f]+$/) }
function sortedTokens(n, s, name,    k, i, t, prev) {
  if (s == "") return
  if (s ~ /[^ -~]/) fail(n, name ": control/non-ASCII bytes are unsupported")
  if (s ~ /^ | $|  /) fail(n, name ": tokens must be single-space separated")
  k = split(s, t, " "); prev = ""
  for (i = 1; i <= k; i++) {
    if (t[i] == "" || t[i] ~ /[^!-~]/ || t[i] ~ /["\\]/ || t[i] ~ /^\// || t[i] ~ /\/$/ || t[i] ~ /\/\// || t[i] ~ /(^|\/)\.\.?($|\/)/)
      fail(n, name ": unsupported path token")
    if (prev != "" && !("x" prev < "x" t[i])) fail(n, name ": tokens must be strictly ascending byte-wise")
    prev = t[i]
  }
}
function claim(n, s,    k, t, i) {
  k = split(s, t, " ")
  for (i = 1; i <= k; i++) {
    if (t[i] in owned) fail(n, "path appears in multiple groups/omissions: " t[i])
    owned[t[i]] = 1
  }
}
function commitLine(n,    v, sha) {
  v = field(n, "Commit")
  if (v == "") return
  if (v !~ /^[0-9a-f]+ [^[:space:]]/) { fail(n, "Commit: must be <sha> <message>"); return }
  sha = substr(v, 1, index(v, " ") - 1)
  if (length(sha) < 7 || length(sha) > 40) fail(n, "Commit: sha must be 7-40 lowercase hex")
}
function expectCount(want) { if (N != want) fail(N, "expected exactly " want " lines, found " N) }
function checkPlan(    st, i, g, v, paths, ex, k, t, j) {
  if (L[1] !~ /^COMMIT_PLAN: (PASS|NEEDS_DECISION|NO_CHANGES|ERROR)$/) { fail(1, "unknown COMMIT_PLAN status"); return }
  st = substr(L[1], 14)
  if (st == "NEEDS_DECISION") { expectCount(3); field(2, "Reason"); field(3, "Decision needed"); return }
  if (st != "PASS") { expectCount(2); field(2, "Reason"); return }
  if (N < 9 || (N - 3) % 6 != 0) { fail(N, "PASS needs 6-line groups plus Omissions: and Warnings:"); return }
  g = 0
  for (i = 2; i + 5 <= N - 2; i += 6) {
    g++
    v = field(i, "Group"); if (v != "" && v != g "") fail(i, "Group: must be " g)
    field(i + 1, "Message")
    paths = field(i + 2, "Paths"); sortedTokens(i + 2, paths, "Paths"); claim(i + 2, paths)
    ex = field(i + 3, "Expansions")
    if (ex != "none") {
      sortedTokens(i + 3, ex, "Expansions"); k = split(ex, t, " ")
      for (j = 1; j <= k; j++) if (index(" " paths " ", " " t[j] " ") == 0) fail(i + 3, "Expansions: token not in Paths: " t[j])
    }
    field(i + 4, "Verification")
    v = field(i + 5, "Digest"); if (v != "" && !hex40(v)) fail(i + 5, "Digest: must be 40 lowercase hex")
  }
  v = field(N - 1, "Omissions")
  if (v != "none") { sortedTokens(N - 1, v, "Omissions"); claim(N - 1, v) }
  field(N, "Warnings")
}
function checkExecute(    st, v) {
  if (L[1] !~ /^COMMIT_EXECUTE: (PASS|DIVERGED|VERIFY_FAILED|COMMIT_ERROR|HOOK_MUTATION|ERROR)$/) { fail(1, "unknown COMMIT_EXECUTE status"); return }
  st = substr(L[1], 17)
  if (st == "PASS") {
    expectCount(3); commitLine(2)
    v = field(3, "Paths"); sortedTokens(3, v, "Paths"); return
  }
  if (st == "HOOK_MUTATION") { expectCount(3); field(2, "Reason"); commitLine(3); return }
  expectCount(2); field(2, "Reason")
}
{ raw[NR] = $0 }
END {
  first = 1; last = NR
  while (first <= last && raw[first] ~ /^[[:space:]]*$/) first++
  while (last >= first && raw[last] ~ /^[[:space:]]*$/) last--
  if (last < first) { fail(1, "payload is empty"); exit 1 }
  N = 0
  for (i = first; i <= last; i++) { L[++N] = raw[i]; if (raw[i] ~ /^[[:space:]]*$/) fail(N, "blank line inside the envelope") }
  if (mode == "plan") checkPlan(); else checkExecute()
  exit failed
}
'
