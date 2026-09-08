#!/bin/sh
# Shape validator for analyzing-recent-project-state payloads.
#
# Proves: payload shape, closed status enums, evidence field set and order,
# report section set (full ten or quiet-state four), label-token grammar, and
# (draft mode) that every [confirmed:] / [likely:] locator resolves against
# PROJECT_PATH. Does not prove claim truth, unlabeled claims, or prose quality.
#
# Usage: sh validate-output.sh <evidence|draft|report|verdict|envelope> [PROJECT_PATH] < payload
#   draft requires PROJECT_PATH as the second argument.
# Exit 0  payload conforms
# Exit 1  one "<mode>: line N: <message>" finding per defect on stdout
# Exit 2  bad mode, or draft without PROJECT_PATH (usage on stderr)
#
# Dependencies: sh, awk; git (read-only) only for draft locator resolution.
# Path ranges use awk NR at END as the line count, so a final line without a
# trailing newline still counts. Locale is forced to C so string comparisons
# do not depend on the host.

LC_ALL=C
export LC_ALL

mode=$1
projectPath=$2

case "$mode" in
  evidence|report|verdict|envelope) ;;
  draft)
    if [ -z "$projectPath" ]; then
      echo "usage: validate-output.sh <evidence|draft|report|verdict|envelope> [PROJECT_PATH]" >&2
      exit 2
    fi
    ;;
  *)
    echo "usage: validate-output.sh <evidence|draft|report|verdict|envelope> [PROJECT_PATH]" >&2
    exit 2
    ;;
esac

payload=$(cat)

awkProgram='
function fail(lineNumber, message) {
  if (extractLocators) return
  printf "%s: line %d: %s\n", mode, lineNumber, message
  failed = 1
}
function nonEmptyAfter(text, prefix,    rest) {
  rest = substr(text, length(prefix) + 1)
  gsub(/[[:space:]]/, "", rest)
  return rest != ""
}
function isEvidenceField(name,    f) {
  for (f = 1; f <= nFields; f++) if (fieldNames[f] == name) return 1
  return 0
}
function isPositiveInt(s) {
  return (s ~ /^[1-9][0-9]*$/)
}
function pathCharsLegal(path,    n) {
  if (length(path) < 1) return 0
  if (index(path, "]") || index(path, ":") || index(path, "\t")) return 0
  if (substr(path, 1, 1) == "/") return 0
  if (path == "..") return 0
  if (index(path, "../") == 1) return 0
  n = length(path)
  if (n >= 3 && substr(path, n - 2, 3) == "/..") return 0
  if (index(path, "/../") > 0) return 0
  return 1
}
function wellFormedRange(range,    dash, start, end) {
  dash = index(range, "-")
  if (dash == 0) return isPositiveInt(range)
  start = substr(range, 1, dash - 1)
  end = substr(range, dash + 1)
  if (!isPositiveInt(start) || !isPositiveInt(end)) return 0
  return (start + 0) <= (end + 0)
}
function wellFormedLocator(loc,    hex, n, path, range, colon, field) {
  if (loc ~ /^commit /) {
    hex = substr(loc, 8)
    n = length(hex)
    if (n < 7 || n > 40) return 0
    if (hex ~ /[^0-9a-f]/) return 0
    return 1
  }
  if (loc ~ /^path /) {
    path = substr(loc, 6)
    colon = index(path, ":")
    if (colon == 0) return pathCharsLegal(path)
    range = substr(path, colon + 1)
    path = substr(path, 1, colon - 1)
    if (!pathCharsLegal(path)) return 0
    return wellFormedRange(range)
  }
  if (loc ~ /^field /) {
    field = substr(loc, 7)
    return isEvidenceField(field)
  }
  return 0
}
function wellFormedLabel(token,    loc) {
  if (token == "[possible]" || token == "[unverified]") return 1
  if (token ~ /^\[(confirmed|likely): .+\]$/) {
    loc = substr(token, index(token, ": ") + 2)
    loc = substr(loc, 1, length(loc) - 1)
    return wellFormedLocator(loc)
  }
  return 0
}
function emitLocator(lineNumber, token,    loc, kind, val, sp) {
  if (token !~ /^\[(confirmed|likely): /) return
  if (!wellFormedLabel(token)) return
  loc = substr(token, index(token, ": ") + 2)
  loc = substr(loc, 1, length(loc) - 1)
  sp = index(loc, " ")
  if (sp == 0) return
  kind = substr(loc, 1, sp - 1)
  val = substr(loc, sp + 1)
  printf "%s\t%s\t%s\n", lineNumber, kind, val
}
function eachLabel(lineNumber, text,    rest, frag, token) {
  rest = text
  while (match(rest, /\[(confirmed|likely|possible|unverified)/)) {
    frag = substr(rest, RSTART)
    if (!match(frag, /^\[[^]]*\]/)) {
      fail(lineNumber, "unclosed claim label")
      return
    }
    token = substr(frag, 1, RLENGTH)
    if (extractLocators) emitLocator(lineNumber, token)
    else if (!wellFormedLabel(token)) fail(lineNumber, "malformed claim label: " token)
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
function lineIsField(text, name) {
  return (text == name ":" || index(text, name ":") == 1)
}
function fieldHasValue(text, name) {
  return (index(text, name ": ") == 1 && nonEmptyAfter(text, name ": "))
}
function isCanonicalFixBullet(text,    n) {
  for (n = 1; n <= nFull; n++) {
    if (text ~ ("^- " fullNames[n] ": .+$")) return 1
  }
  return 0
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

  fullCount = 0
  fullMissing = ""
  for (i = 1; i <= nFull; i++) {
    if (seen[fullNames[i]]) fullCount++
    else fullMissing = fullMissing (fullMissing == "" ? "" : ", ") fullNames[i]
  }
  isFull = (fullCount == nFull)
  isShort = (uniqueCount == nShort && seen[shortNames[1]] && seen[shortNames[2]] && seen[shortNames[3]] && seen[shortNames[4]])
  if (!isFull && !isShort)
    fail(firstNonBlank, "section set is neither the full form nor the quiet-state short form; missing: " fullMissing)

  assumptionsCount = 0
  executionModeCount = 0
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
function checkEnvelope(    count, i) {
  count = 0
  for (i = first; i <= last; i++) {
    if (lines[i] ~ /^[[:space:]]*$/) { fail(i, "blank line inside the envelope"); continue }
    count++
    content[count] = lines[i]
    contentLine[count] = i
  }
  if (count != 3) fail(last, "expected exactly 3 envelope lines, found " count)
  if (content[1] !~ /^RECENT_STATE: (NOT_GIT|PATH_ERROR|NEEDS_CONTEXT|TOOLS_MISSING|ERROR)$/)
    fail(contentLine[1], "line 1 must be RECENT_STATE: <NOT_GIT|PATH_ERROR|NEEDS_CONTEXT|TOOLS_MISSING|ERROR>")
  if (content[2] !~ /^Reason: / || !nonEmptyAfter(content[2], "Reason: "))
    fail(contentLine[2], "line 2 must be Reason: with non-empty content")
  if (content[3] !~ /^Next step: / || !nonEmptyAfter(content[3], "Next step: "))
    fail(contentLine[3], "line 3 must be Next step: with non-empty content")
}
function checkEvidence(    f, i, found, foundLine, count) {
  if (lines[first] !~ /^GIT_EVIDENCE: (PASS|ERROR)$/) {
    fail(first, "line 1 must be GIT_EVIDENCE: <PASS|ERROR>")
    return
  }
  if (lines[first] != "GIT_EVIDENCE: PASS") {
    if (last - first + 1 != 2) fail(last, "non-PASS payload must be exactly 2 lines: status and Reason:")
    if (lines[first + 1] !~ /^Reason: / || !nonEmptyAfter(lines[first + 1], "Reason: "))
      fail(first + 1, "line 2 must be Reason: with non-empty content")
    return
  }
  previousLine = first
  for (f = 1; f <= nFields; f++) {
    count = 0
    foundLine = 0
    for (i = first + 1; i <= last; i++) {
      if (lineIsField(lines[i], fieldNames[f])) {
        count++
        if (count == 1) foundLine = i
        else fail(i, "duplicate field: " fieldNames[f])
      }
    }
    if (count == 0) { fail(last, "missing field: " fieldNames[f]); continue }
    if (foundLine < previousLine) fail(foundLine, "field out of order: " fieldNames[f])
    previousLine = foundLine
    if (!fieldHasValue(lines[foundLine], fieldNames[f]))
      fail(foundLine, "empty value for field: " fieldNames[f])
  }
  for (i = first + 1; i <= last; i++) {
    if (index(lines[i], "Repo state:") == 1 && lines[i] !~ /^Repo state: (normal|unborn-branch|detached-HEAD|operation-in-progress\(.+\)|shallow|conflicted)$/)
      fail(i, "Repo state: value must be one of the declared repo states")
  }
}
function checkDraft() {
  if (lines[first] !~ /^SNAPSHOT_WRITE: (PASS|NEEDS_CONTEXT|ERROR)$/) {
    fail(first, "line 1 must be SNAPSHOT_WRITE: <PASS|NEEDS_CONTEXT|ERROR>")
    return
  }
  if (lines[first] == "SNAPSHOT_WRITE: ERROR") {
    if (last - first + 1 != 2) fail(last, "ERROR payload must be exactly 2 lines: status and Reason:")
    if (lines[first + 1] !~ /^Reason: / || !nonEmptyAfter(lines[first + 1], "Reason: "))
      fail(first + 1, "line 2 must be Reason: with non-empty content")
    return
  }
  if (lines[first] == "SNAPSHOT_WRITE: NEEDS_CONTEXT") {
    if (last - first + 1 != 3) fail(last, "NEEDS_CONTEXT payload must be exactly 3 lines: status, Reason:, Decision needed:")
    if (lines[first + 1] !~ /^Reason: / || !nonEmptyAfter(lines[first + 1], "Reason: "))
      fail(first + 1, "line 2 must be Reason: with non-empty content")
    if (lines[first + 2] !~ /^Decision needed: / || !nonEmptyAfter(lines[first + 2], "Decision needed: "))
      fail(first + 2, "line 3 must be Decision needed: with non-empty content")
    return
  }
  checkReport(first + 1, last)
}
function checkVerdict(    status, i, fixesLine, reasonLine, decisionLine, bulletCount, fixesNone, decisionNone) {
  if (lines[first] !~ /^SNAPSHOT_VERIFY: (PASS|FAIL|NEEDS_CONTEXT|ERROR)$/) {
    fail(first, "line 1 must be SNAPSHOT_VERIFY: <PASS|FAIL|NEEDS_CONTEXT|ERROR>")
    return
  }
  status = substr(lines[first], length("SNAPSHOT_VERIFY: ") + 1)
  fixesLine = 0; reasonLine = 0; decisionLine = 0; bulletCount = 0
  for (i = first + 1; i <= last; i++) {
    if (index(lines[i], "Required fixes:") == 1) {
      if (fixesLine) fail(i, "duplicate Required fixes: line")
      else fixesLine = i
    } else if (index(lines[i], "Reason:") == 1) {
      if (reasonLine) fail(i, "duplicate Reason: line")
      else reasonLine = i
    } else if (index(lines[i], "Decision needed:") == 1) {
      if (decisionLine) fail(i, "duplicate Decision needed: line")
      else decisionLine = i
    } else if (index(lines[i], "- ") == 1) {
      bulletCount++
      if (!isCanonicalFixBullet(lines[i]))
        fail(i, "fix bullet must start with a canonical section name and a colon")
    }
  }
  if (fixesLine == 0) fail(last, "missing Required fixes: line")
  if (reasonLine == 0) fail(last, "missing Reason: line")
  if (decisionLine == 0) fail(last, "missing Decision needed: line")
  if (reasonLine && !nonEmptyAfter(lines[reasonLine], "Reason:")) fail(reasonLine, "Reason: must be non-empty")
  if (fixesLine == 0 || reasonLine == 0 || decisionLine == 0) return

  fixesNone = (lines[fixesLine] == "Required fixes: none")
  decisionNone = (lines[decisionLine] == "Decision needed: none")
  if (status == "PASS" || status == "ERROR") {
    if (!fixesNone) fail(fixesLine, status " requires Required fixes: none")
    if (!decisionNone) fail(decisionLine, status " requires Decision needed: none")
    if (bulletCount > 0) fail(fixesLine, "only FAIL may carry required-fix bullets")
  }
  if (status == "FAIL") {
    if (lines[fixesLine] != "Required fixes:")
      fail(fixesLine, "FAIL requires Required fixes: with no trailing content, then at least one bullet")
    if (bulletCount == 0)
      fail(fixesLine, "FAIL requires at least one section-targeted required fix")
    if (!decisionNone) fail(decisionLine, "FAIL requires Decision needed: none")
  }
  if (status == "NEEDS_CONTEXT") {
    if (!fixesNone) fail(fixesLine, "NEEDS_CONTEXT requires Required fixes: none")
    if (decisionNone || !nonEmptyAfter(lines[decisionLine], "Decision needed:"))
      fail(decisionLine, "NEEDS_CONTEXT requires exactly one named decision")
    if (bulletCount > 0) fail(fixesLine, "only FAIL may carry required-fix bullets")
  }
}
BEGIN {
  failed = 0
  nFull = split("Executive Summary|Git State|Change Themes|Behavioral Impact|Risks|Test And Validation Review|Dependency, Config, Tooling, And Security Notes|Questions Before Merging|Ranked Next Actions|Final Developer Briefing", fullNames, "|")
  nShort = split("Executive Summary|Git State|Ranked Next Actions|Final Developer Briefing", shortNames, "|")
  nFields = split("Project path|Branch/upstream|Repo state|Evidence window|Working tree|Base branch|Base comparison|Recent commits reviewed|Changed-file groups|Diff stats|Preliminary themes|Risk signals|Test signals|Dependency/config/tooling signals|Context limitations|Commands run|Reason", fieldNames, "|")
}
{ lines[NR] = $0 }
END {
  total = NR
  first = 1; last = total
  while (first <= last && lines[first] ~ /^[[:space:]]*$/) first++
  while (last >= first && lines[last] ~ /^[[:space:]]*$/) last--
  if (last < first) { fail(1, "payload is empty"); exit 1 }

  if (extractLocators) {
    if (lines[first] == "SNAPSHOT_WRITE: PASS") {
      for (i = first + 1; i <= last; i++) eachLabel(i, lines[i])
    }
    exit 0
  }

  if (mode == "envelope") checkEnvelope()
  else if (mode == "evidence") checkEvidence()
  else if (mode == "draft") checkDraft()
  else if (mode == "report") checkReport(first, last)
  else if (mode == "verdict") checkVerdict()
  exit failed
}
'

findings=$(printf '%s\n' "$payload" | awk -v mode="$mode" -v extractLocators=0 "$awkProgram")

if [ "$mode" = "draft" ]; then
  statusLine=$(printf '%s\n' "$payload" | awk '
    { lines[NR] = $0 }
    END {
      first = 1; last = NR
      while (first <= last && lines[first] ~ /^[[:space:]]*$/) first++
      if (first <= last) print lines[first]
    }
  ')
  if [ "$statusLine" = "SNAPSHOT_WRITE: PASS" ]; then
    locators=$(printf '%s\n' "$payload" | awk -v mode="$mode" -v extractLocators=1 "$awkProgram")
    # Heredoc (not a pipeline) so the loop is not a subshell and case-pattern
    # ')' cannot terminate a surrounding command substitution. $locators is
    # expanded once; the resulting text is not re-scanned for $(...).
    tab=$(printf '\t')
    resolution=
    while IFS="$tab" read -r lineNumber kind value
    do
      if [ -z "$kind" ]; then
        continue
      fi
      locatorText="$kind $value"
      resolved=0
      case "$kind" in
        commit)
          if git -C "$projectPath" cat-file -e "${value}^{commit}" >/dev/null 2>&1; then
            resolved=1
          fi
          ;;
        field)
          resolved=1
          ;;
        path)
          pathName=$value
          rangeStart=
          rangeEnd=
          case "$value" in
            *:*)
              pathName=${value%%:*}
              range=${value#*:}
              case "$range" in
                *-*)
                  rangeStart=${range%%-*}
                  rangeEnd=${range#*-}
                  ;;
                *)
                  rangeStart=$range
                  ;;
              esac
              ;;
          esac
          target="$projectPath/$pathName"
          if [ -e "$target" ]; then
            resolved=1
            if [ -n "$rangeStart" ] && [ -f "$target" ]; then
              lineCount=$(awk 'END { print NR+0 }' "$target")
              need=$rangeStart
              if [ -n "$rangeEnd" ]; then
                need=$rangeEnd
              fi
              if [ "$lineCount" -lt "$need" ]; then
                resolved=0
              fi
            fi
          else
            hash=$(git -C "$projectPath" log --max-count=1 --format=%h -- "$pathName" 2>/dev/null) || hash=
            if [ -n "$hash" ]; then
              resolved=1
            fi
          fi
          ;;
      esac
      if [ "$resolved" -eq 0 ]; then
        finding=$(printf 'draft: line %s: locator does not resolve: %s' "$lineNumber" "$locatorText")
        if [ -n "$resolution" ]; then
          resolution="$resolution
$finding"
        else
          resolution=$finding
        fi
      fi
    done <<EOF
$locators
EOF
    if [ -n "$resolution" ]; then
      if [ -n "$findings" ]; then
        findings="$findings
$resolution"
      else
        findings=$resolution
      fi
    fi
  fi
fi

if [ -n "$findings" ]; then
  printf '%s\n' "$findings"
  exit 1
fi
exit 0
