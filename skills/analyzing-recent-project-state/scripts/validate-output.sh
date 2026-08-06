#!/bin/sh
# Deterministic output validator for analyzing-recent-project-state.
#
# This file is the normative shape definition for every machine-parsed payload
# in the skill. Producers run it on their own output before returning; the
# orchestrator runs it at the payload gates; the eval suite reuses it, so
# test-time and runtime can never drift apart.
#
# Usage: sh validate-output.sh <evidence|draft|verdict|envelope>  < payload
# Exit 0 when the payload conforms; exit 1 with one "line N: ..." finding per
# defect on stdout. Requires only POSIX sh and awk.

mode="$1"

case "$mode" in
  evidence|draft|verdict|envelope) ;;
  *)
    echo "usage: validate-output.sh <evidence|draft|verdict|envelope>" >&2
    exit 2
    ;;
esac

exec awk -v mode="$mode" '
function fail(lineNumber, message) {
  printf "%s: line %d: %s\n", mode, lineNumber, message
  failed = 1
}
function nonEmptyAfter(text, prefix) {
  rest = substr(text, length(prefix) + 1)
  gsub(/[[:space:]]/, "", rest)
  return rest != ""
}
{ lines[NR] = $0 }
END {
  total = NR

  # Strip leading/trailing blank lines into [first, last].
  first = 1; last = total
  while (first <= last && lines[first] ~ /^[[:space:]]*$/) first++
  while (last >= first && lines[last] ~ /^[[:space:]]*$/) last--
  if (last < first) { fail(1, "payload is empty"); exit 1 }

  if (mode == "envelope") {
    count = 0
    for (i = first; i <= last; i++) {
      if (lines[i] ~ /^[[:space:]]*$/) { fail(i, "blank line inside the envelope"); continue }
      count++
      content[count] = lines[i]; contentLine[count] = i
    }
    if (count != 3) fail(last, "expected exactly 3 envelope lines, found " count)
    if (content[1] !~ /^RECENT_STATE: (NOT_GIT|PATH_ERROR|NEEDS_CONTEXT|ERROR)$/)
      fail(contentLine[1], "line 1 must be RECENT_STATE: <NOT_GIT|PATH_ERROR|NEEDS_CONTEXT|ERROR>")
    if (content[2] !~ /^Reason: / || !nonEmptyAfter(content[2], "Reason: "))
      fail(contentLine[2], "line 2 must be Reason: with non-empty content")
    if (content[3] !~ /^Next step: / || !nonEmptyAfter(content[3], "Next step: "))
      fail(contentLine[3], "line 3 must be Next step: with non-empty content")
    exit failed
  }

  if (mode == "evidence") {
    if (lines[first] !~ /^GIT_EVIDENCE: (PASS|NOT_GIT|PATH_ERROR|ERROR)$/) {
      fail(first, "line 1 must be GIT_EVIDENCE: <PASS|NOT_GIT|PATH_ERROR|ERROR>")
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
    if (lines[first] !~ /^SNAPSHOT_WRITE: (PASS|NEEDS_CONTEXT|ERROR)$/) {
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
      else if (index(lines[i], "Fix dispositions:") == 1) { dispositionsLine = i }
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
    if (status == "PASS" && dispositionsLine && index(lines[dispositionsLine], "not addressed") > 0)
      fail(dispositionsLine, "PASS requires every prior fix addressed")
    exit failed
  }
}
' -
