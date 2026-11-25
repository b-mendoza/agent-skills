#!/bin/sh
# Shape validator for committing-scoped-changes envelopes.
#
# Proves: line-1 status enum, exact field set and order per status, non-empty
# values, byte-sorted duplicate-free Paths tokens, 40-hex digests, Expansions
# tokens present in Paths, split-path selections and prior history, disjoint omissions,
# consecutive groups, series check reuse,
# verification scope, and equal Preserved and Tree sides on COMMIT_EXECUTE: PASS.
# Does not prove: message quality, grouping sense, digest correctness, or that
# any commit exists.
#
# Usage: sh validate-output.sh <plan|execute> < payload
# Exit 0  payload conforms
# Exit 1  one "<mode>: line N: <message>" finding per defect on stdout
# Exit 2  bad or missing mode (usage on stderr)
# Dependencies: sh, awk. No git, no network, no temp files.

LC_ALL=C
export LC_ALL

mode=$1
case "$mode" in
  -h|--help) echo "usage: sh validate-output.sh <plan|execute> < payload"; exit 0 ;;
  plan|execute) ;;
  *) echo "usage: sh validate-output.sh <plan|execute> < payload" >&2; exit 2 ;;
esac

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
  k = split(s, t, " ")
  prev = ""
  for (i = 1; i <= k; i++) {
    if (prev != "" && !(prev < ("x" t[i]))) { fail(n, name ": tokens must be strictly ascending byte-wise"); return }
    prev = "x" t[i]
  }
}
function commitLine(n,    v) {
  v = field(n, "Commit")
  if (v == "") return
  if (v !~ /^[0-9a-f]+ [^[:space:]]/) { fail(n, "Commit: must be <sha> <message>"); return }
  if (length(v) - length(substr(v, index(v, " "))) < 7) fail(n, "Commit: sha must be at least 7 hex")
}
function expectCount(want) { if (N != want) fail(N, "expected exactly " want " lines, found " N) }
function isReference(command) { return command ~ /^same as group([[:space:]]|$)/ }
function planVerification(n, g, checks,    command, ref) {
  command = field(n, "Verification")
  if (isReference(command)) {
    ref = substr(command, length("same as group ") + 1)
    if (checks != "worktree" || command !~ /^same as group [1-9][0-9]*$/ || !(ref in literal))
      fail(n, "reuse requires worktree and an earlier group with a literal command")
  } else if (command != "none" && command != "") {
    if (checks == "worktree" && (command in seen)) fail(n, "use same as group " seen[command])
    seen[command] = g
    literal[g] = command
  }
}
# Compare canonical decimals as strings; awk numbers can lose precision.
function ascending(a, b) {
  return length(a) < length(b) || (length(a) == length(b) && ("x" a) < ("x" b))
}
function selection(n, path, text,    k, sets, old, fresh, i, count, added) {
  if (text !~ /^[1-9][0-9]*(,[1-9][0-9]*)*([+][1-9][0-9]*(,[1-9][0-9]*)*)?$/) {
    fail(n, "invalid hunk numbers: " path); return
  }
  k = split(text, sets, /[+]/)
  count = k == 2 ? split(sets[2], old, ",") : 0
  if (count != priorCount[path]+0) fail(n, "wrong PRIOR count: " path)
  for (i = 1; i <= count; i++)
    if (!((path, old[i]) in history) || (i > 1 && !ascending(old[i-1], old[i])))
      fail(n, "invalid PRIOR: " path)
  added = split(sets[1], fresh, ",")
  for (i = 1; i <= added; i++) {
    if ((path, fresh[i]) in history || (i > 1 && !ascending(fresh[i-1], fresh[i])))
      fail(n, "repeated or unordered NEW: " path)
    history[path, fresh[i]] = 1
  }
  priorCount[path] += added
}
function groupPaths(n, paths, hunks,    t, count, i, path, previous, files, members, tokens) {
  count = split(paths, files, " ")
  for (i = 1; i <= count; i++) members[files[i]] = 1
  if (hunks != "none") {
    count = split(hunks, t, " ")
    if (count < 2 || !hex40(t[1])) fail(n, "Hunks: expected a full base and tokens")
    if (base != "" && ("x" base) != ("x" t[1])) fail(n, "Hunks: inconsistent base")
    base = t[1]
    for (i = 2; i <= count; i++) {
      path = t[i]; sub(/#[^#]*$/, "", path)
      if (!index(t[i], "#") || !(path in members)) fail(n, "hunk path not in Paths: " t[i])
      if (("x" path) <= previous) fail(n, "hunk paths must be unique and byte-sorted: " path)
      previous = "x" path
      tokens[path] = 1
      selection(n, path, substr(t[i], length(path)+2))
    }
  }
  for (path in members) {
    if (path in grouped && (!grouped[path] || !(path in tokens))) fail(n, "repeated whole path: " path)
    grouped[path] = (path in tokens)
  }
}
function checkPlan(    st, i, g, v, paths, ex, k, t, j, checks) {
  if (L[1] !~ /^COMMIT_PLAN: (PASS|NEEDS_DECISION|NO_CHANGES|ERROR)$/) { fail(1, "line 1 must be COMMIT_PLAN: <PASS|NEEDS_DECISION|NO_CHANGES|ERROR>"); return }
  st = substr(L[1], 14)
  if (st == "NEEDS_DECISION") { expectCount(3); if (N >= 2) field(2, "Reason"); if (N >= 3) field(3, "Decision needed"); return }
  if (st != "PASS") { expectCount(2); if (N >= 2) field(2, "Reason"); return }
  if (N < 11 || (N - 4) % 7 != 0) { fail(N, "PASS needs one or more 7-line groups plus Checks:, Omissions: and Warnings:; found " N " lines"); return }
  checks = field(N - 2, "Checks")
  if (checks != "worktree" && checks != "candidate") fail(N - 2, "Checks: must be worktree or candidate")
  g = 0
  for (i = 2; i + 6 <= N - 3; i += 7) {
    g++
    v = field(i, "Group"); if (v != "" && v != g "") fail(i, "Group: must be " g)
    field(i + 1, "Message")
    paths = field(i + 2, "Paths"); sortedTokens(i + 2, paths, "Paths")
    groupPaths(i + 3, paths, field(i + 3, "Hunks"))
    ex = field(i + 4, "Expansions")
    if (ex != "none") {
      sortedTokens(i + 4, ex, "Expansions")
      k = split(ex, t, " ")
      for (j = 1; j <= k; j++) if (index(" " paths " ", " " t[j] " ") == 0) fail(i + 4, "Expansions: token not in Paths: " t[j])
    }
    planVerification(i + 5, g, checks)
    v = field(i + 6, "Digest"); if (v != "" && !hex40(v)) fail(i + 6, "Digest: must be 40 lowercase hex")
    if (v == "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391") fail(i + 6, "Digest: empty-input hash is not a group digest")
  }
  v = field(N - 1, "Omissions"); if (v != "none") {
    sortedTokens(N - 1, v, "Omissions")
    k = split(v, t, " ")
    for (j = 1; j <= k; j++) if (t[j] in grouped) fail(N - 1, "group path also omitted: " t[j])
  }
  field(N, "Warnings")
}
function equalOids(n, name,    value, eq, a, b) {
  value = field(n, name); eq = index(value, "=")
  a = substr(value, 1, eq - 1); b = substr(value, eq + 1)
  if (!hex40(a) || !hex40(b)) fail(n, name ": must be <40hex>=<40hex>")
  else if (a != b) fail(n, name ": digests must be equal on PASS")
  return a
}
function verification(n, status, tree,    command, code, evidence, scope, shared, oid, ref) {
  command = field(n, "Verification")
  code = field(n + 1, "Verification exit")
  evidence = field(n + 2, "Verification evidence")
  scope = field(n + 3, "Verification scope")
  shared = "shared worktree; not an isolated commit tree"
  if (scope != shared) {
    oid = substr(scope, length("candidate tree ") + 1, 40)
    if (!hex40(oid) || scope != "candidate tree " oid "; ignored files linked from the worktree") fail(n + 3, "invalid Verification scope")
    else if (status == "PASS" && oid != tree) fail(n + 3, "candidate scope must match Tree")
  }
  if (isReference(command)) {
    ref = substr(command, length("same as group ") + 1)
    if (command !~ /^same as group [1-9][0-9]*$/ || scope != shared || code != "reused" || status == "VERIFY_FAILED" || evidence != "not re-run; group " ref " ran it before its commit") fail(n, "invalid reused verification")
  } else if (command == "none") {
    if (status == "VERIFY_FAILED") fail(n, "VERIFY_FAILED requires an attempted verification command")
    else if (code != "not-run" || evidence != "not run") fail(n, "none requires not-run exit and not run evidence")
  } else if (status == "VERIFY_FAILED") {
    if (code !~ /^[1-9][0-9]*$/) fail(n + 1, "failed verification needs nonzero exit")
  } else if (status == "ERROR") {
    if (code !~ /^[0-9]+$/) fail(n + 1, "ERROR verification needs a decimal exit code")
  } else if (code != "0") fail(n + 1, status " verification needs exit 0")
}
function checkExecute(    st, v, tree) {
  if (L[1] !~ /^COMMIT_EXECUTE: (PASS|DIVERGED|VERIFY_FAILED|COMMIT_ERROR|HOOK_MUTATION|ERROR)$/) { fail(1, "line 1 must be COMMIT_EXECUTE: <PASS|DIVERGED|VERIFY_FAILED|COMMIT_ERROR|HOOK_MUTATION|ERROR>"); return }
  st = substr(L[1], 17)
  if (st == "PASS") {
    expectCount(9)
    if (N >= 2) commitLine(2)
    if (N >= 3) { v = field(3, "Paths"); sortedTokens(3, v, "Paths") }
    if (N >= 4) equalOids(4, "Preserved")
    if (N >= 5) tree = equalOids(5, "Tree")
    if (N >= 9) verification(6, st, tree)
    return
  }
  if (st == "HOOK_MUTATION") { expectCount(7); if (N >= 2) field(2, "Reason"); if (N >= 3) commitLine(3); if (N >= 7) verification(4, st); return }
  if (st == "VERIFY_FAILED" || st == "COMMIT_ERROR" || (st == "ERROR" && N == 6)) { expectCount(6); if (N >= 2) field(2, "Reason"); if (N >= 6) verification(3, st); return }
  expectCount(2); if (N >= 2) field(2, "Reason")
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
