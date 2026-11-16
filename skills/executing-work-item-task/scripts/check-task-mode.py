#!/usr/bin/env python3
r"""Reject human-only tasks before execution mutations.

Usage: python3 check-task-mode.py TASK_NUMBER < task-plan.md
Exit 0: AUTOMATED, continue ordinary readiness checks.
Exit 1: BLOCKED, hand off to the human owner.
Exit 2: ERROR, correct malformed input or usage before continuing.
Side effects: none. Reads stdin only; no files, git, network, or dependencies.
Smoke: printf '## Task 1: Code\n' | python3 check-task-mode.py 1  # exit 0
"""

import re
import sys


def summary_task_number(cell):
    mapping = re.fullmatch(r"(.*)(?:->|→)(.*)", cell)
    if mapping:
        if not mapping[1].strip():
            return None
        cell = mapping[2].strip()
    match = re.fullmatch(r"(?:Task )?([1-9][0-9]*)", cell)
    return match[1] if match else None


def check(plan, number):
    plan = plan.replace("**", "").replace("`", "")
    sections = re.findall(r"(?ms)^## Task " + number + r":[^\n]*(?:\n|\Z)(.*?)(?=^## |\Z)", plan)
    if len(sections) != 1:
        raise ValueError("selected task section missing or duplicated")
    section = sections[0]
    human = bool(re.search(
        r"Execution mode:[ \t]*human-only\b|Branch name:[ \t]*N/A \(human-only\)",
        section, re.I,
    ))
    for summary in re.findall(r"(?ms)^## Execution Order Summary\s*\n(.*?)(?=^## |\Z)", plan):
        task_column = None
        lines = summary.splitlines()
        for index, line in enumerate(lines):
            if not line.strip().startswith("|"):
                task_column = None
                continue
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            separator = lines[index + 1].strip().strip("|").split("|") if index + 1 < len(lines) else []
            if separator and all(re.fullmatch(r"\s*:?-+:?\s*", cell) for cell in separator):
                task_column = cells.index("Task") if "Task" in cells else None
                continue
            if not any(cell.casefold() == "n/a (human-only)" for cell in cells):
                continue
            task_cell = cells[task_column] if task_column is not None and task_column < len(cells) else ""
            task_number = summary_task_number(task_cell)
            if task_number is None:
                raise ValueError("unreadable summary Task cell " + repr(task_cell) + " with human-only sentinel")
            human = human or task_number == number
    if human:
        owner = re.search(
            r"(?:Human owner|Owner):[ \t]*([^\n]+?)(?=[ \t]+(?:Execution mode|Branch name):|\n|$)", section, re.I,
        )
        print("BLOCKED: human-only task; hand off to " + (owner[1].strip() if owner else "the human owner (not specified)"))
        return 1
    print("AUTOMATED: continue ordinary readiness checks")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2 or not re.fullmatch(r"[1-9][0-9]*", sys.argv[1]):
        print(__doc__)
        sys.exit(2)
    try:
        sys.exit(check(sys.stdin.read(), sys.argv[1]))
    except ValueError as error:
        print("ERROR: " + str(error))
        sys.exit(2)
