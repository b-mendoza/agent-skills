#!/usr/bin/env python3
r"""Check selected-task planning outputs, without changing files.

Usage: python3 validate-output.py <plan|PREP|PLAN|TEST_SPEC|REFACTORING> < payload
plan checks each git word followed by whitespace, through the next backtick or
line end. Tokenize with shlex.split, falling back to str.split on ValueError.
Skip leading options; -C, -c, --git-dir, --work-tree and --config-env take a value.
Reject a first remaining token in FORBIDDEN after stripping trailing ;,.:
Exempt commands whose clause begins do not, don't, never, must not or no,
ignoring leading punctuation and list markers. Clauses start after sentence
ends, semicolons, and, then or but; prohibitions do not carry across and.
Prose directives require model review. Uppercase modes validate handoff fields.
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
PROHIBITION = re.compile(r"^(?:do not|don't|never|must not|no)\b", re.I)
CLAUSE_SEPARATOR = re.compile(r"(?<=\S[.!?])\s+|;|\b(?:and|then|but)\b", re.I)


def action_findings(payload):
    findings = []
    for n, line in enumerate(payload.splitlines(), 1):
        for command in re.finditer(r"\bgit\s+", line):
            clause = CLAUSE_SEPARATOR.split(line[:command.start()])[-1]
            clause = re.sub(r"^[\W\d_]+", "", clause)
            if PROHIBITION.match(clause):
                continue
            arguments = line[command.end():].split("`", 1)[0]
            try:
                tokens = shlex.split(arguments)
            except ValueError:
                tokens = arguments.split()
            index = 0
            while index < len(tokens) and tokens[index].startswith("-"):
                option = tokens[index]
                index += 1
                if option in {"-C", "-c", "--git-dir", "--work-tree", "--config-env"}:
                    index += 1
            if index < len(tokens):
                subcommand = tokens[index].rstrip(";,.:")
                if subcommand in FORBIDDEN:
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
