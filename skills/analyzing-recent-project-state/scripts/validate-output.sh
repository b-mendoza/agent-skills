#!/bin/sh
# Shape validator for analyzing-recent-project-state payloads.
#
# Proves: payload shape, closed status enums, evidence field set and order,
# verdict field order, report section set (full ten or quiet-state four),
# label-token grammar, and (draft mode) that every [confirmed:] / [likely:]
# locator resolves under PROJECT_PATH. Does not prove claim truth, unlabeled
# claims, or prose quality.
#
# Interpreter: POSIX sh. Dependencies: tr, awk; git and test in draft mode only.
# Usage: sh validate-output.sh <evidence|draft|report|verdict> [PROJECT_PATH] < payload
#   draft requires PROJECT_PATH, an existing directory; other modes ignore it.
#   No environment variables are read. -h prints the usage line (exit 2).
# Exit 0  payload conforms
# Exit 1  one "<mode>: line N: <message>" finding per defect on stdout
# Exit 2  bad mode, or draft without a PROJECT_PATH directory (usage on stderr)
# Exit 3  shellQuote refused a value holding a single quote (an internal bug)
# Any other non-zero exit, or one with no findings on stdout, means the validator
#   could not run or aborted: a failed gate, never findings.
# Side effects: none; draft runs test, read-only git cat-file and git log, and reads cited files.
# Check: printf 'GIT_EVIDENCE: ERROR\nReason: x\n' | sh validate-output.sh evidence  # exit 0
#
# tr drops NUL bytes, which hide the rest of a line from macOS awk. A ranged
# locator needs a regular file; a final line without a trailing newline counts.
# Locale is C so comparisons do not depend on the host.

LC_ALL=C
export LC_ALL
unset CDPATH

usage() {
  echo "usage: validate-output.sh <evidence|draft|report|verdict> [PROJECT_PATH] < payload" >&2
  exit 2
}

mode=$1
projectPath=$2

case "$mode" in
  evidence|report|verdict) ;;
  draft)
    [ -n "$projectPath" ] || usage
    cd -- "$projectPath" || usage
    ;;
  *) usage ;;
esac

tr -d '\000' | awk -v mode="$mode" '
function fail(lineNumber, message) {
  printf "%s: line %d: %s\n", mode, lineNumber, message
  failed = 1
}
function fieldHasValue(text, name) {
  return index(text, name ": ") == 1 && substr(text, length(name) + 3) ~ /[^[:space:]]/
}
# Strips "#".."######", an optional "N." and trailing space; returns the
# canonical section name, or "" when the line is not a canonical heading.
function canonicalHeading(text) {
  if (!sub(/^##?#?#?#?#?[[:space:]]*/, "", text)) return ""
  sub(/^[0-9]+\.[[:space:]]*/, "", text)
  sub(/[[:space:]]+$/, "", text)
  return (text in isSection) ? text : ""
}
function isCanonicalFixBullet(text,    colon) {
  colon = index(text, ": ")
  return index(text, "- ") == 1 && (substr(text, 3, colon - 3) in isSection) && length(text) > colon + 1
}
# Splits a locator into parts["kind"], parts["value"] (hex, path, or field
# name) and parts["last"] (last line of a path range, 0 when absent).
# Returns 1 only for the grammar in references/project-state-snapshot-template.md.
function parseLocator(locator, parts,    value, colon, range, bounds) {
  parts["kind"] = substr(locator, 1, index(locator, " ") - 1)
  value = substr(locator, length(parts["kind"]) + 2)
  parts["value"] = value
  parts["last"] = 0
  if (parts["kind"] == "commit")
    return value ~ /^[0-9a-f]+$/ && length(value) >= 7 && length(value) <= 40
  if (parts["kind"] == "field") return value in isField
  if (parts["kind"] != "path") return 0
  colon = index(value, ":")
  if (colon) {
    range = substr(value, colon + 1)
    if (range !~ /^[1-9][0-9]*(-[1-9][0-9]*)?$/) return 0
    if (split(range, bounds, "-") == 1) bounds[2] = bounds[1]
    if (bounds[1] + 0 > bounds[2] + 0) return 0
    parts["last"] = bounds[2] + 0
    value = substr(value, 1, colon - 1)
    parts["value"] = value
  }
  # A quote would end shellQuote; a tab is rejected as it was before.
  if (index(value, sq) || index(value, "\t")) return 0
  return value != "" && value !~ /^\// && index("/" value "/", "/../") == 0
}
# The one place text reaches the shell. Inside POSIX single quotes every
# character except a quote is literal, and parseLocator rejects quotes, so the
# word is exactly value. Never pass a value to system() or a pipe otherwise.
function shellQuote(value) {
  if (index(value, sq)) {
    print "validate-output.sh: refusing to quote " value > "/dev/stderr"
    exit 3
  }
  return sq value sq
}
# "./" keeps a path that starts with "-" from reading as an option.
function locatorResolves(parts,    path, command, hash, count, line) {
  if (parts["kind"] == "field") return 1
  if (parts["kind"] == "commit")
    return system("git cat-file -e " shellQuote(parts["value"] "^{commit}") " 2>/dev/null") == 0
  path = "./" parts["value"]
  if (parts["last"]) {
    # getline from a directory aborts some awks, so require a regular file.
    if (system("test -f " shellQuote(path)) != 0) return 0
    for (count = 0; count < parts["last"] && (getline line < path) > 0; count++) ;
    close(path)
    return count == parts["last"]
  }
  if (system("test -e " shellQuote(path)) == 0) return 1
  command = "git log --max-count=1 --format=%h -- " shellQuote(path) " 2>/dev/null"
  command | getline hash
  close(command)
  return hash != ""
}
function checkLabel(lineNumber, token,    locator, parts) {
  if (token == "[possible]" || token == "[unverified]") return
  locator = token
  if (!sub(/^\[(confirmed|likely): /, "", locator) || !sub(/\]$/, "", locator) || !parseLocator(locator, parts)) {
    fail(lineNumber, "malformed claim label: " token)
    return
  }
  if (mode == "draft" && !locatorResolves(parts))
    fail(lineNumber, "locator does not resolve: " locator)
}
function checkLabels(lineNumber, text) {
  while (match(text, /\[(confirmed|likely|possible|unverified)/)) {
    text = substr(text, RSTART)
    if (!match(text, /^\[[^]]*\]/)) {
      fail(lineNumber, "unclosed claim label")
      return
    }
    checkLabel(lineNumber, substr(text, 1, RLENGTH))
    text = substr(text, RLENGTH + 1)
  }
}
function checkReport(bodyFirst, bodyLast,    i, title, name, seen, present, assumptions, executionModes) {
  for (title = bodyFirst; title < bodyLast && lines[title] ~ /^[[:space:]]*$/; title++) ;
  if (lines[title] != "# Project State Snapshot")
    fail(title, "first line must be exactly # Project State Snapshot")
  for (i = bodyFirst; i <= bodyLast; i++) {
    name = canonicalHeading(lines[i])
    if (name != "" && ++seen[name] == 2) fail(i, "duplicate section: " name)
    if (lines[i] ~ /^(GIT_EVIDENCE|SNAPSHOT_WRITE|SNAPSHOT_VERIFY):/ || lines[i] == inspectLeak)
      fail(i, "leaked internal artifact")
    if (index(lines[i], "Assumptions:") == 1) {
      assumptions++
      if (lines[i] !~ /^Assumptions:.*[^[:space:]]/) fail(i, "Assumptions: must carry non-empty content")
    }
    if (index(lines[i], "Execution mode:") == 1) {
      executionModes++
      if (lines[i] != "Execution mode: isolated" && lines[i] != "Execution mode: inline; subagent context isolation degraded")
        fail(i, "Execution mode: value must be the isolated or inline enum literal, verbatim")
    }
    checkLabels(i, lines[i])
  }
  for (i = 1; i <= nSections; i++)
    if (sectionNames[i] in seen) present = present (present == "" ? "" : "; ") sectionNames[i]
  if (present != FULL_SECTIONS && present != SHORT_SECTIONS)
    fail(title, "section set is neither the full form nor the quiet-state short form; found: " present)
  if (assumptions != 1) fail(bodyLast, "expected exactly one Assumptions: line in the body, found " assumptions + 0)
  if (executionModes != 1) fail(bodyLast, "expected exactly one Execution mode: line in the body, found " executionModes + 0)
}
# A payload that stops early: the status line, then exactly the fields in
# fieldList ("|"-separated), one per line, each with a non-empty value.
function checkStopPayload(kind, fieldList,    names, count, k, listing) {
  count = split(fieldList, names, "|")
  for (k = 1; k <= count; k++) listing = listing (count == 1 ? " and " : ", ") names[k] ":"
  if (last - first != count)
    fail(last, kind " payload must be exactly " (count + 1) " lines: status" listing)
  for (k = 1; k <= count; k++)
    if (!fieldHasValue(lines[first + k], names[k]))
      fail(first + k, "line " (k + 1) " must be " names[k] ": with non-empty content")
}
function checkEvidence(    i, f, fieldLine, previousLine) {
  if (lines[first] !~ /^GIT_EVIDENCE: (PASS|ERROR)$/) {
    fail(first, "line 1 must be GIT_EVIDENCE: <PASS|ERROR>")
    return
  }
  if (lines[first] != "GIT_EVIDENCE: PASS") {
    checkStopPayload("non-PASS", "Reason")
    return
  }
  for (i = first + 1; i <= last; i++) {
    for (f = 1; f <= nFields && index(lines[i], fieldNames[f] ":") != 1; f++) ;
    if (f > nFields) continue
    if (fieldNames[f] == "Repo state" && lines[i] !~ /^Repo state: (normal|unborn-branch|detached-HEAD|operation-in-progress\(.+\)|shallow|conflicted)$/)
      fail(i, "Repo state: value must be one of the declared repo states")
    if (f in fieldLine) {
      fail(i, "duplicate field: " fieldNames[f])
      continue
    }
    fieldLine[f] = i
    if (!fieldHasValue(lines[i], fieldNames[f])) fail(i, "empty value for field: " fieldNames[f])
  }
  previousLine = first
  for (f = 1; f <= nFields; f++) {
    if (!(f in fieldLine)) {
      fail(last, "missing field: " fieldNames[f])
      continue
    }
    if (fieldLine[f] < previousLine) fail(fieldLine[f], "field out of order: " fieldNames[f])
    previousLine = fieldLine[f]
  }
}
function checkDraft() {
  if (lines[first] !~ /^SNAPSHOT_WRITE: (PASS|NEEDS_CONTEXT|ERROR)$/)
    fail(first, "line 1 must be SNAPSHOT_WRITE: <PASS|NEEDS_CONTEXT|ERROR>")
  else if (lines[first] == "SNAPSHOT_WRITE: ERROR") checkStopPayload("ERROR", "Reason")
  else if (lines[first] == "SNAPSHOT_WRITE: NEEDS_CONTEXT") checkStopPayload("NEEDS_CONTEXT", "Reason|Decision needed")
  else checkReport(first + 1, last)
}
# Verdict fields are positional; returns 1 when line i starts with name.
function verdictLine(i, name) {
  if (i > last) fail(last, "missing " name " line")
  else if (index(lines[i], name) != 1) fail(i, "expected " name " line, in the order Required fixes:, Reason:, Decision needed:")
  return i <= last && index(lines[i], name) == 1
}
function checkVerdict(    status, i, fixesLine, bullets, decisionLine, decisionNone) {
  if (lines[first] !~ /^SNAPSHOT_VERIFY: (PASS|FAIL|NEEDS_CONTEXT|ERROR)$/) {
    fail(first, "line 1 must be SNAPSHOT_VERIFY: <PASS|FAIL|NEEDS_CONTEXT|ERROR>")
    return
  }
  status = substr(lines[first], length("SNAPSHOT_VERIFY: ") + 1)
  fixesLine = first + 1
  if (!verdictLine(fixesLine, "Required fixes:")) return
  if (lines[fixesLine] != "Required fixes: none" && lines[fixesLine] != "Required fixes:")
    fail(fixesLine, "Required fixes: must be the literal none, or bare and followed by fix bullets")
  for (i = fixesLine + 1; i <= last && index(lines[i], "- ") == 1; i++) {
    bullets++
    if (!isCanonicalFixBullet(lines[i])) fail(i, "fix bullet must start with a canonical section name and a colon")
  }
  if (!verdictLine(i, "Reason:")) return
  if (lines[i] !~ /^Reason:.*[^[:space:]]/) fail(i, "Reason: must be non-empty")
  decisionLine = i + 1
  if (!verdictLine(decisionLine, "Decision needed:")) return
  if (decisionLine < last) fail(decisionLine + 1, "unexpected line after Decision needed:")
  if (bullets && status != "FAIL") fail(fixesLine, "only FAIL may carry required-fix bullets")
  if (status == "FAIL" && (lines[fixesLine] != "Required fixes:" || !bullets))
    fail(fixesLine, "FAIL requires at least one section-targeted required fix under a bare Required fixes: line")
  if (status != "FAIL" && lines[fixesLine] != "Required fixes: none")
    fail(fixesLine, status " requires Required fixes: none")
  decisionNone = (lines[decisionLine] == "Decision needed: none")
  if (status == "NEEDS_CONTEXT" && (decisionNone || lines[decisionLine] !~ /^Decision needed:.*[^[:space:]]/))
    fail(decisionLine, "NEEDS_CONTEXT requires exactly one named decision")
  if (status != "NEEDS_CONTEXT" && !decisionNone)
    fail(decisionLine, status " requires Decision needed: none")
}
BEGIN {
  sq = "\047"
  # Split so this script does not itself contain the leaked log header.
  inspectLeak = "Inspec" "ted:"
  FULL_SECTIONS = "Executive Summary; Git State; Change Themes; Behavioral Impact; Risks; Test And Validation Review; Dependency, Config, Tooling, And Security Notes; Questions Before Merging; Ranked Next Actions; Final Developer Briefing"
  SHORT_SECTIONS = "Executive Summary; Git State; Ranked Next Actions; Final Developer Briefing"
  nSections = split(FULL_SECTIONS, sectionNames, "; ")
  for (i = 1; i <= nSections; i++) isSection[sectionNames[i]] = 1
  nFields = split("Project path|Branch/upstream|Repo state|Evidence window|Working tree|Base branch|Base comparison|Recent commits reviewed|Changed-file groups|Diff stats|Preliminary themes|Risk signals|Test signals|Dependency/config/tooling signals|Context limitations|Commands run|Reason", fieldNames, "|")
  for (i = 1; i <= nFields; i++) isField[fieldNames[i]] = 1
}
{ lines[NR] = $0 }
END {
  first = 1
  last = NR
  while (first <= last && lines[first] ~ /^[[:space:]]*$/) first++
  while (last >= first && lines[last] ~ /^[[:space:]]*$/) last--
  if (last < first) fail(1, "payload is empty")
  else if (mode == "evidence") checkEvidence()
  else if (mode == "draft") checkDraft()
  else if (mode == "report") checkReport(first, last)
  else checkVerdict()
  exit failed
}
'
