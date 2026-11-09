#!/usr/bin/env python3
"""Check selected-task planning outputs, without changing files.

Usage: python3 validate-output.py <plan|PREP|PLAN|TEST_SPEC|REFACTORING> < payload
       python3 validate-output.py --help
plan checks executable plan text for forbidden git-history/publication work.
Uppercase modes validate the exact one-line-field handoff before routing.
Exit: 0 valid, 1 contract findings (repair), 2 usage error (ERROR).
Side effects: none; stdlib only, no filesystem writes, git, or network.
Smoke: printf '1. Run node --test.\nDo not commit.\n' | python3 validate-output.py plan
"""

import re
import shlex
import sys

FIELDS = {
    "PREP": ["Task", "Brief", "Dependencies", "Questions", "References fetched", "Notes"],
    "PLAN": ["Execution plan", "Recommended skills", "References fetched", "Approach", "Blockers"],
    "TEST_SPEC": ["Spec", "Framework", "References fetched", "Coverage", "Blockers"],
    "REFACTORING": ["Refactoring plan", "Verdict", "References fetched", "Summary", "Blockers"],
}
FORBIDDEN = {"add", "stage", "commit", "push", "rebase", "reset", "cherry-pick", "revert", "merge", "am", "filter-branch", "filter-repo"}


def action_findings(payload):
    findings = []
    for n, original in enumerate(payload.splitlines(), 1):
        line = re.sub(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)?", "", original).replace("**", "")
        for line in re.split(r"(?<=[.!?])\s+(?!or\b)", line, flags=re.I):
            # Only a leading explicit prohibition is exempt. A safety aside later in
            # a line cannot hide an earlier action, nor can '; then commit' hide here.
            if re.match(r"(?i)(?:do not|don't|never|must not|no)\b", line) and not re.search(r"(?i)(?:;|\bthen\b|\bbut\b)", line):
                continue
            imperative = re.search(r"(?i)\b(?:stage|commit|push|rebase|cherry-pick|reset|rewrite)\b", line)
            directive = re.match(r"(?i)(?:then\s+)?(?:stage|commit|push|rebase|cherry-pick|reset|rewrite)\b", line)
            if directive or (imperative and re.search(r"(?i)\b(?:stage.+commit|create (?:a |the )?commit|make (?:a |the )?commit)\b", line)):
                findings.append(f"line {n}: action outside the execution boundary")
                continue
            for match in re.finditer(r"\bgit\s+([^`\n]+)", line):
                try:
                    tokens = shlex.split(match.group(1))
                except ValueError:
                    findings.append(f"line {n}: unparseable git command outside the execution boundary")
                    continue
                index = 0
                while index < len(tokens) and tokens[index].startswith("-"):
                    option = tokens[index]
                    index += 1
                    if option in {"-C", "-c", "--git-dir", "--work-tree", "--config-env"}:
                        index += 1
                if index < len(tokens) and tokens[index].rstrip(";,.:") in FORBIDDEN:
                    findings.append(f"line {n}: git {tokens[index]} is outside the execution boundary")
    return findings


def summary_findings(mode, payload):
    lines = payload.strip().splitlines()
    fields = FIELDS[mode]
    if len(lines) != len(fields) + 1:
        return [f"{mode}: expected {len(fields) + 1} lines"]
    match = re.fullmatch(re.escape(mode) + r": (PASS|FAIL|BLOCKED|ERROR)", lines[0])
    if not match:
        return [f"{mode}: invalid status"]
    findings = []
    values = {}
    for name, line in zip(fields, lines[1:]):
        if not line.startswith(name + ": ") or not line[len(name) + 2:].strip():
            findings.append(f"{mode}: missing or misplaced {name}")
        else:
            values[name] = line[len(name) + 2:]
    if match[1] == "PASS":
        path_field = fields[1] if mode == "PREP" else fields[0]
        if values.get(path_field, "Not written") == "Not written":
            findings.append(f"{mode}: PASS requires a written artifact")
        if mode == "PREP":
            if values.get("Dependencies") != "Satisfied" or values.get("Questions") != "Resolved":
                findings.append("PREP: PASS requires satisfied dependencies and resolved questions")
        elif values.get("Blockers") != "None":
            findings.append(f"{mode}: PASS requires Blockers: None")
    if mode == "REFACTORING" and values.get("Verdict") not in {"Refactor before", "Refactor during", "No refactoring needed"}:
        findings.append("REFACTORING: invalid verdict")
    return findings


if __name__ == "__main__":
    if sys.argv[1:] == ["--help"]:
        print(__doc__)
        sys.exit(0)
    if len(sys.argv) != 2 or sys.argv[1] not in {"plan", *FIELDS}:
        print(__doc__)
        sys.exit(2)
    mode = sys.argv[1]
    payload = sys.stdin.read()
    findings = action_findings(payload) if mode == "plan" else summary_findings(mode, payload)
    if not payload.strip():
        findings.append("empty payload")
    print("\n".join(findings) if findings else "VALID")
    sys.exit(1 if findings else 0)
