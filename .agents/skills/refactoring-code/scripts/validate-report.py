#!/usr/bin/env python3
"""Validate bounded refactor reports or choose a failure route; never mutate files."""

import json
import pathlib
import re
import sys

MAX_BYTES = 12 * 1024
MAX_FINDINGS = 12
STATUSES = {
    "behavior-mapper": {"PASS", "NO_CHANGE_CANDIDATE", "NEEDS_CLARIFICATION", "ERROR"},
    "chunk-analyst": {"PASS", "NEEDS_CLARIFICATION", "ERROR"},
    "refactor-implementer": {"PASS", "PASS_WITH_WARNINGS", "BLOCKED", "ERROR"},
    "refactor-reviewer": {"PASS", "FAIL", "ERROR"},
}
PREFIXES = {
    "behavior-mapper": "BEHAVIOR_MAP",
    "refactor-implementer": "IMPLEMENTATION",
    "refactor-reviewer": "REFACTOR_REVIEW",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def nonnegative(value):
    return type(value) is int and value >= 0


def analyst_status(text):
    report = json.loads(text)
    require(isinstance(report, dict), "report must be an object")
    require(report.get("version") == 1, "unsupported version")
    require(report.get("from") == "chunk-analyst", "wrong report producer")
    require(isinstance(report.get("chunk"), str) and report["chunk"], "missing chunk")
    findings = report.get("findings")
    require(isinstance(findings, list) and len(findings) <= MAX_FINDINGS, "findings cap is 12")
    total, omitted = report.get("total_findings"), report.get("omitted_count")
    require(nonnegative(total) and nonnegative(omitted), "invalid finding counts")
    require(total == len(findings) + omitted, "incomplete overflow accounting")
    categories = report.get("omitted_categories")
    require(isinstance(categories, list), "missing omitted categories")
    require(bool(categories) == bool(omitted), "omitted categories must explain overflow")
    require(all(isinstance(item, str) and item.strip() for item in categories), "empty category")
    high_omitted = report.get("omitted_high_priority")
    require(nonnegative(high_omitted) and high_omitted <= omitted, "invalid high-priority count")
    for item in findings:
        require(isinstance(item, dict), "finding must be an object")
        for key in ("location", "problem", "transformation", "reuse_evidence"):
            require(isinstance(item.get(key), str) and item[key].strip(), "missing " + key)
        require(item.get("priority") in ("high", "normal"), "invalid priority")
        require(item.get("confidence") in ("high", "low"), "invalid confidence")
        require(item.get("reuse_rung") in (
            "avoid", "reuse-repo", "stdlib", "platform", "installed-dep", "new-code", "n/a"
        ), "invalid reuse rung")
        require(type(item.get("net_lines")) is int, "invalid net line estimate")
    require(not high_omitted or (
        len(findings) == MAX_FINDINGS and all(item["priority"] == "high" for item in findings)
    ), "include high-priority findings before lower-priority findings")
    return report.get("status")


REQUIRED_FIELDS = {
    "behavior-mapper": (
        "Target", "Files inspected", "Worktree baseline", "Commit", "Porcelain summary",
        "Pre-existing dirty files", "Current behavior facts", "Validation candidates",
        "User command", "Discovered candidates", "File sizes", "Proposed chunks", "Risk notes",
    ),
    "refactor-implementer": (
        "Fix cycle", "Changes made", "Per-file disposition", "File sizes after change",
        "Net lines", "Baseline checkpoint", "Validation evidence", "Command", "Safety class",
        "Exit code", "Coverage evidence", "Result", "Warnings", "Deviations", "Reviewer focus",
        "Risk notes",
    ),
    "refactor-reviewer": (
        "Fix cycle reviewed", "Behavior verdict", "Simplification verdict", "Baseline scope check",
        "Implementer-reported files reviewed", "Files changed outside report", "Plan conformance",
        "Behavior and protected-boundary check", "Simplification outcome", "Net lines",
        "Duplication", "Reuse rungs", "Size policy check", "Validation evidence check",
        "Findings", "Required fixes", "Minor notes for handoff", "Risk notes",
    ),
}
CONDITIONAL_FIELDS = {"ERROR": "Error detail", "BLOCKED": "Blocked reason", "NEEDS_CLARIFICATION": "Question if blocked"}


def text_fields(text, names):
    pattern = r"^[ \t]*(?:-[ \t]+)?(" + "|".join(re.escape(name) for name in names) + r"):[ \t]*(.*)$"
    matches = list(re.finditer(pattern, text, re.MULTILINE))
    fields = {}
    for index, match in enumerate(matches):
        name = match.group(1)
        require(name not in fields, "duplicate field: " + name)
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        fields[name] = (match.group(2) + text[match.end():end]).strip()
    return fields


def text_status(role, text):
    lines = text.splitlines()
    require(len(lines) <= 60, "report exceeds 60 lines")
    require(bool(lines), "empty report")
    prefix = PREFIXES[role]
    require(lines[0].startswith(prefix + ": "), "missing status prefix")
    status = lines[0][len(prefix) + 2:].strip()
    require(status in STATUSES[role], "unknown status")
    names = (*REQUIRED_FIELDS[role], *CONDITIONAL_FIELDS.values(), prefix)
    fields = text_fields(text, names)
    for name in REQUIRED_FIELDS[role]:
        require(name in fields, "missing field: " + name)
        # A section heading may contain only its subordinate named fields.
        start = re.search(r"^(?:- )?" + re.escape(name) + r":[ \t]*(.*)$", text, re.MULTILINE)
        remainder = text[start.end():].lstrip() if start else ""
        require(bool(fields[name]) or remainder.startswith("- "), "empty field: " + name)
    for name in CONDITIONAL_FIELDS.values():
        if name in fields:
            require(bool(fields[name]), "empty field: " + name)
    if status in CONDITIONAL_FIELDS:
        name = CONDITIONAL_FIELDS[status]
        require(bool(fields.get(name)), "missing field: " + name)
    if role == "refactor-reviewer":
        verdicts = [fields["Behavior verdict"], fields["Simplification verdict"]]
        require(all(value in ("pass", "fail") for value in verdicts), "invalid reviewer verdict")
        require(status != "PASS" or verdicts == ["pass", "pass"], "PASS contradicts reviewer verdicts")
    if role == "refactor-implementer":
        require(fields["Safety class"] in ("safe", "state-mutating", "destructive", "warning path"), "invalid safety class")
        require(fields["Result"] in ("pass", "fail", "not run", "pre-existing failure"), "invalid validation result")
        require(bool(re.fullmatch(r"-?\d+|not run", fields["Exit code"])), "invalid exit code")
        if status == "PASS":
            require(fields["Result"] == "pass", "PASS contradicts validation Result: " + fields["Result"])
            require(fields["Exit code"] == "0", "PASS contradicts validation Exit code: " + fields["Exit code"])
            require(fields["Safety class"] != "warning path", "PASS contradicts validation Safety class: warning path")
            require(fields["Command"] != "not run" and fields["Coverage evidence"] != "not run", "PASS needs command and coverage")
    if role == "behavior-mapper" and status == "PASS":
        chunks = re.findall(r"^- .+", fields["Proposed chunks"], re.MULTILINE)
        require(2 <= len(chunks) <= 5, "PASS requires 2-5 analysis chunks")
    return status


def validate_report(role, report_path, run_dir):
    run = pathlib.Path(run_dir).resolve(strict=True)
    path = pathlib.Path(report_path)
    require(not path.is_symlink(), "symlink report forbidden")
    resolved = path.resolve(strict=True)
    require(resolved.is_relative_to(run) and resolved != run, "report outside owned run")
    with resolved.open("rb") as source:
        payload = source.read(MAX_BYTES + 1)
    require(len(payload) <= MAX_BYTES, "report exceeds 12 KiB")
    text = payload.decode("utf-8")
    if role == "chunk-analyst":
        status = analyst_status(text)
    else:
        status = text_status(role, text)
    require(status in STATUSES[role], "unknown status")
    return status


def retry_route(role, attempts, evidence):
    require(attempts in ("0", "1"), "retry count must be 0 or 1")
    require(evidence in ("host-transient", "report-transient", "permanent"), "invalid evidence kind")
    if role == "refactor-implementer":
        return "RECONCILE"
    if attempts == "1" or evidence == "permanent":
        return "STOP"
    return "RETRY"


def main():
    args = sys.argv[1:]
    require(len(args) == 4, "usage: validate-report.py report ROLE REPORT_PATH RUN_DIR | retry ROLE RETRIES EVIDENCE")
    mode, role, first, second = args
    require(role in STATUSES, "unknown role")
    if mode == "report":
        print(validate_report(role, first, second))
    elif mode == "retry":
        print(retry_route(role, first, second))
    else:
        raise ValueError("unknown mode")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, UnicodeError, KeyError, TypeError) as error:
        print("invalid refactor contract: " + str(error), file=sys.stderr)
        sys.exit(1)
