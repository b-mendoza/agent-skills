#!/bin/sh
# Deterministic output validator for analyzing-recent-project-state.
#
# This file is the normative shape definition for every machine-parsed payload
# in the skill. Producers run it on their own output before returning; the
# orchestrator runs it at the payload gates; the eval suite reuses it, so
# test-time and runtime can never drift apart.
#
# Usage: sh validate-output.sh <evidence|draft|report|verdict|envelope>  < payload
# Exit 0 when the payload conforms; exit 1 with one "line N: ..." finding per
# defect on stdout. Requires only POSIX sh and awk.

LC_ALL=C
export LC_ALL

mode="$1"

case "$mode" in
  evidence|draft|report|verdict|envelope) ;;
  *)
    echo "usage: validate-output.sh <evidence|draft|report|verdict|envelope>" >&2
    exit 2
    ;;
esac

exec awk -v mode="$mode" '
function fail(lineNumber, message) {
  printf "%s: line %d: %s\n", mode, lineNumber, message
  failed = 1
}

function wellFormedLabel(token,    loc) {
  if (token == "[possible]" || token == "[unverified]") return 1
  if (token ~ /^\[(confirmed|likely): .+\]$/) {
    loc = substr(token, index(token, ": ") + 2)
    loc = substr(loc, 1, length(loc) - 1)
    return loc != ""
  }
  return 0
}
function eachLabel(lineNumber, text,    rest, frag, token) {
  rest = text
  while (match(rest, /\[(confirmed|likely|possible|unverified)/)) {
    frag = substr(rest, RSTART)
    if (!match(frag, /^\[[^]]*\]/)) { fail(lineNumber, "unclosed claim label"); return }
    token = substr(frag, 1, RLENGTH)
    if (!wellFormedLabel(token)) fail(lineNumber, "malformed claim label: " token)
    rest = substr(frag, RLENGTH + 1)
  }
}
function canonicalHeading(text,    n) {
  for (n = 1; n <= nFull; n++) {
    if (text ~ ("^(######|#####|####|###|##|#)[[:space:]]*([0-9]+\\.[[:space:]]*)?" fullNames[n] "[[:space:]]*$"))
      return fullNames[n]
  }
  return ""
}
function checkReport(bodyFirst, bodyLast,    i, firstNonBlank, name, seen, uniqueCount, fullCount, fullMissing, isFull, isShort, assumptionsCount, executionModeCount, inspectLeak) {
  inspectLeak = "Inspec" "ted:"
  firstNonBlank = 0
  for (i = bodyFirst; i <= bodyLast; i++) {
    if (lines[i] !~ /^[[:space:]]*$/) { firstNonBlank = i; break }
  }
  if (firstNonBlank == 0) { fail(bodyFirst, "report body is empty"); return }
  if (lines[firstNonBlank] != "# Project State Snapshot")
    fail(firstNonBlank, "first line must be exactly # Project State Snapshot")
  uniqueCount = 0
  for (i = bodyFirst; i <= bodyLast; i++) {
    name = canonicalHeading(lines[i])
    if (name != "") {
      seen[name]++
      if (seen[name] == 1) uniqueCount++
      else if (seen[name] == 2) fail(i, "duplicate section: " name)
    }
  }
  fullCount = 0; fullMissing = ""
  for (i = 1; i <= nFull; i++) {
    if (seen[fullNames[i]]) fullCount++
    else fullMissing = fullMissing (fullMissing == "" ? "" : ", ") fullNames[i]
  }
  isFull = (fullCount == nFull)
  isShort = (uniqueCount == nShort && seen[shortNames[1]] && seen[shortNames[2]] && seen[shortNames[3]] && seen[shortNames[4]])
  if (!isFull && !isShort)
    fail(firstNonBlank, "section set is neither the full form nor the quiet-state short form; missing: " fullMissing)
  assumptionsCount = 0; executionModeCount = 0
  for (i = bodyFirst; i <= bodyLast; i++) {
    if (index(lines[i], "GIT_EVIDENCE:") == 1 || index(lines[i], "SNAPSHOT_WRITE:") == 1 || index(lines[i], "SNAPSHOT_VERIFY:") == 1 || lines[i] == inspectLeak)
      fail(i, "leaked internal artifact")
    if (index(lines[i], "Assumptions:") == 1) {
      assumptionsCount++
      if (!nonEmptyAfter(lines[i], "Assumptions:")) fail(i, "Assumptions: must carry non-empty content")
    }
    if (index(lines[i], "Execution mode:") == 1) {
      executionModeCount++
      if (lines[i] != "Execution mode: isolated" && lines[i] != "Execution mode: inline; subagent context isolation degraded")
        fail(i, "Execution mode: value must be the isolated or inline enum literal, verbatim")
    }
    eachLabel(i, lines[i])
  }
  if (assumptionsCount != 1) fail(bodyLast, "expected exactly one Assumptions: line in the body, found " assumptionsCount)
  if (executionModeCount != 1) fail(bodyLast, "expected exactly one Execution mode: line in the body, found " executionModeCount)
}

function nonEmptyAfter(text, prefix) {
  rest = substr(text, length(prefix) + 1)
  gsub(/[[:space:]]/, "", rest)
  return rest != ""
}
BEGIN {
  nFull = split("Executive Summary|Git State|Change Themes|Behavioral Impact|Risks|Test And Validation Review|Dependency, Config, Tooling, And Security Notes|Questions Before Merging|Ranked Next Actions|Final Developer Briefing", fullNames, "|")
  nShort = split("Executive Summary|Git State|Ranked Next Actions|Final Developer Briefing", shortNames, "|")
}
{ lines[NR] = $0 }
END {
  total = NR

  # Strip leading/trailing blank lines into [first, last].
  first = 1; last = total
  while (first <= last && lines[first] ~ /^[[:space:]]*$/) first++
  while (last >= first && lines[last] ~ /^[[:space:]]*$/) last--
  if (last < first) { fail(1, "payload is empty"); exit 1 }

  if (mode == "report") {
    checkReport(first, last)
    exit failed
  }

  if (mode == "envelope") {
    count = 0
    for (i = first; i <= last; i++) {
      if (lines[i] ~ /^[[:space:]]*$/) { fail(i, "blank line inside the envelope"); continue }
      count++
      content[count] = lines[i]; contentLine[count] = i
    }
    if (count != 3) fail(last, "expected exactly 3 envelope lines, found " count)
    if (content[1] !~ /^RECENT_STATE: (NOT_GIT|PATH_ERROR|NEEDS_CONTEXT|TOOLS_MISSING|ERROR)$/)
      fail(contentLine[1], "line 1 must be RECENT_STATE: <NOT_GIT|PATH_ERROR|NEEDS_CONTEXT|ERROR>")
    if (content[2] !~ /^Reason: / || !nonEmptyAfter(content[2], "Reason: "))
      fail(contentLine[2], "line 2 must be Reason: with non-empty content")
    if (content[3] !~ /^Next step: / || !nonEmptyAfter(content[3], "Next step: "))
      fail(contentLine[3], "line 3 must be Next step: with non-empty content")
    exit failed
  }

  if (mode == "evidence") {
    if (lines[first] !~ /^GIT_EVIDENCE: (PASS|ERROR)$/) {
      fail(first, "line 1 must be GIT_EVIDENCE: <PASS|ERROR>")
      exit 1
    }
    if (lines[first] != "GIT_EVIDENCE: PASS") {
      if (last - first + 1 != 2) fail(last, "non-PASS payload must be exactly 2 lines: status and Reason:")
      if (lines[first + 1] !~ /^Reason: / || !nonEmptyAfter(lines[first + 1], "Reason: "))
        fail(first + 1, "line 2 must be Reason: with non-empty content")
      exit failed
    }
    fieldCount = split("Project path|Branch/upstream|Repo state|Evidence window|Working tree|Base branch|Base comparison|Recent commits reviewed|Changed-file groups|Diff stats|Preliminary themes|Risk signals|Test signals|Dependency/config/tooling signals|Context limitations|Commands run|Reason", fields, "|")
    previousLine = first
    for (f = 1; f <= fieldCount; f++) {
      found = 0
      for (i = first + 1; i <= last; i++) {
        if (index(lines[i], fields[f] ": ") == 1 || lines[i] == fields[f] ":") { found = i; break }
      }
      if (found == 0) { fail(last, "missing field: " fields[f] ":"); continue }
      if (found < previousLine) fail(found, "field out of order: " fields[f] ":")
      previousLine = found
    }
    for (i = first + 1; i <= last; i++) {
      if (index(lines[i], "Repo state:") == 1 && lines[i] !~ /^Repo state: (normal|unborn-branch|detached-HEAD|operation-in-progress\(.+\)|shallow|conflicted)$/)
        fail(i, "Repo state: value must be one of the declared repo states")
    }
    exit failed
  }

  if (mode == "draft") {
    if (lines[first] !~ /^SNAPSHOT_WRITE: (PASS|NEEDS_CONTEXT|TOOLS_MISSING|ERROR)$/) {
      fail(first, "line 1 must be SNAPSHOT_WRITE: <PASS|NEEDS_CONTEXT|ERROR>")
      exit 1
    }
    if (lines[first] == "SNAPSHOT_WRITE: ERROR") {
      if (last - first + 1 != 2) fail(last, "ERROR payload must be exactly 2 lines: status and Reason:")
      if (lines[first + 1] !~ /^Reason: / || !nonEmptyAfter(lines[first + 1], "Reason: "))
        fail(first + 1, "line 2 must be Reason: with non-empty content")
      exit failed
    }
    if (lines[first] == "SNAPSHOT_WRITE: NEEDS_CONTEXT") {
      if (last - first + 1 != 3) fail(last, "NEEDS_CONTEXT payload must be exactly 3 lines: status, Reason:, Decision needed:")
      if (lines[first + 1] !~ /^Reason: / || !nonEmptyAfter(lines[first + 1], "Reason: "))
        fail(first + 1, "line 2 must be Reason: with non-empty content")
      if (lines[first + 2] !~ /^Decision needed: / || !nonEmptyAfter(lines[first + 2], "Decision needed: "))
        fail(first + 2, "line 3 must be Decision needed: naming exactly one decision")
      exit failed
    }

    # PASS: status, Inspected: block, then the report body.
    if (lines[first + 1] != "Inspected:") fail(first + 1, "line 2 must be exactly Inspected:")
    headingLine = 0
    for (i = first + 2; i <= last; i++) {
      if (lines[i] == "# Project State Snapshot") { headingLine = i; break }
    }
    if (headingLine == 0) { fail(last, "missing # Project State Snapshot heading after the Inspected: block"); exit 1 }

    entryCount = 0; noneCount = 0; capCount = 0; previousPath = ""
    for (i = first + 2; i < headingLine; i++) {
      if (lines[i] ~ /^[[:space:]]*$/) continue
      if (index(lines[i], "- ") != 1) { fail(i, "Inspected: entries must start with \"- \""); continue }
      if (lines[i] == "- none") { noneCount++; continue }
      if (lines[i] ~ /^- inspection cap reached; [0-9]+ files not inspected$/) {
        capCount++
        capLine = i
        continue
      }
      entryCount++
      entryPath = substr(lines[i], 3)
      separatorAt = index(entryPath, " - ")
      if (separatorAt == 0) { fail(i, "path entry must be \"- <path>:<optional range> - <purpose>\""); continue }
      entryPath = substr(entryPath, 1, separatorAt - 1)
      if (previousPath != "" && entryPath < previousPath)
        fail(i, "path entries must be in ascending byte-wise order")
      previousPath = entryPath
      lastPathLine = i
    }
    if (noneCount > 1) fail(headingLine - 1, "at most one - none line")
    if (capCount > 1) fail(headingLine - 1, "at most one inspection-cap line")
    if (noneCount == 1 && capCount > 0) fail(capLine, "- none never carries a cap note")
    if (noneCount == 1 && entryCount > 0) fail(headingLine - 1, "- none and path entries are mutually exclusive")
    if (noneCount == 0 && entryCount == 0) fail(headingLine - 1, "Inspected: block must carry path entries or exactly - none")
    if (capCount == 1 && entryCount > 0 && capLine < lastPathLine)
      fail(capLine, "the inspection-cap line must close the block")

    bodyContent = 0; assumptionsCount = 0; executionModeCount = 0
    for (i = headingLine + 1; i <= last; i++) {
      if (lines[i] !~ /^[[:space:]]*$/) bodyContent++
      if (index(lines[i], "Assumptions:") == 1) {
        assumptionsCount++
        if (!nonEmptyAfter(lines[i], "Assumptions:")) fail(i, "Assumptions: must carry entries or the literal none")
      }
      if (index(lines[i], "Execution mode:") == 1) {
        executionModeCount++
        if (lines[i] != "Execution mode: isolated" && lines[i] != "Execution mode: inline; subagent context isolation degraded")
          fail(i, "Execution mode: value must be the isolated or inline enum literal, verbatim")
      }
    }
    if (bodyContent == 0) fail(last, "report body is empty")
    if (assumptionsCount != 1) fail(last, "expected exactly one Assumptions: line in the body, found " assumptionsCount)
    if (executionModeCount != 1) fail(last, "expected exactly one Execution mode: line in the body, found " executionModeCount)
    exit failed
  }

  if (mode == "verdict") {
    if (lines[first] !~ /^SNAPSHOT_VERIFY: (PASS|FAIL|NEEDS_CONTEXT|ERROR)$/) {
      fail(first, "line 1 must be SNAPSHOT_VERIFY: <PASS|FAIL|NEEDS_CONTEXT|ERROR>")
      exit 1
    }
    status = substr(lines[first], length("SNAPSHOT_VERIFY: ") + 1)
    fixesLine = 0; reasonLine = 0; decisionLine = 0; bulletCount = 0; dispositionsLine = 0
    for (i = first + 1; i <= last; i++) {
      if (index(lines[i], "Required fixes:") == 1) { if (fixesLine) fail(i, "duplicate Required fixes: line"); else fixesLine = i }
      else if (index(lines[i], "Reason:") == 1) { if (reasonLine) fail(i, "duplicate Reason: line"); else reasonLine = i }
      else if (index(lines[i], "Decision needed:") == 1) { if (decisionLine) fail(i, "duplicate Decision needed: line"); else decisionLine = i }
      else if (index(lines[i], "- ") == 1) bulletCount++
    }
    if (fixesLine == 0) fail(last, "missing Required fixes: line")
    if (reasonLine == 0) fail(last, "missing Reason: line")
    if (decisionLine == 0) fail(last, "missing Decision needed: line")
    if (reasonLine && !nonEmptyAfter(lines[reasonLine], "Reason:")) fail(reasonLine, "Reason: must be non-empty")
    if (fixesLine == 0 || reasonLine == 0 || decisionLine == 0) exit 1

    fixesNone = (lines[fixesLine] == "Required fixes: none")
    decisionNone = (lines[decisionLine] == "Decision needed: none")
    if (status == "PASS" || status == "ERROR") {
      if (!fixesNone) fail(fixesLine, status " requires Required fixes: none")
      if (!decisionNone) fail(decisionLine, status " requires Decision needed: none")
    }
    if (status == "FAIL") {
      if (fixesNone || (bulletCount == 0 && !nonEmptyAfter(lines[fixesLine], "Required fixes:")))
        fail(fixesLine, "FAIL requires at least one section-targeted required fix")
      if (!decisionNone) fail(decisionLine, "FAIL requires Decision needed: none")
    }
    if (status == "NEEDS_CONTEXT") {
      if (!fixesNone) fail(fixesLine, "NEEDS_CONTEXT requires Required fixes: none")
      if (decisionNone || !nonEmptyAfter(lines[decisionLine], "Decision needed:"))
        fail(decisionLine, "NEEDS_CONTEXT requires exactly one named decision")
    }
    exit failed
  }
}
' -
