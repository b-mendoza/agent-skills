#!/usr/bin/env python3
"""Reject human-only tasks before execution mutations.

Usage: python3 check-task-mode.py TASK_NUMBER < task-plan.md
       python3 check-task-mode.py --help
Exit 0: selected task is not marked human-only; continue other readiness checks.
Exit 1: BLOCKED, human handoff required.
Exit 2: malformed input or usage, including an unreadable summary Task cell
        whose Branch cell is N/A (human-only); ERROR quotes that cell. Stop.
Summary Task cells name positive N as N, Task N, or either form after the
last -> or → with a nonempty source, including chains such as A -> B -> 1.
Whitespace, paired **bold** and `backticks` around the cell or either mapping
side are ignored. Titles, T1, #1 and internal formatting are not accepted.
Unreadable Task cells without the branch sentinel are ignored.
Side effects: none. Reads stdin only; no filesystem, git, network, or dependencies.
Smoke: printf '## Task 1: Code\n' | python3 check-task-mode.py 1
"""

import re
import sys


def strip_task_formatting(cell):
    cell = cell.strip()
    while True:
        for marker in ("**", "`"):
            if (len(cell) >= 2 * len(marker) and cell.startswith(marker)
                    and cell.endswith(marker) and marker not in cell[len(marker):-len(marker)]):
                cell = cell[len(marker):-len(marker)].strip()
                break
        else:
            return cell


def summary_task_number(cell):
    cell = strip_task_formatting(cell)
    mapping = re.fullmatch(r"(.*)(?:->|→)(.*)", cell)
    if mapping:
        if not strip_task_formatting(mapping[1]):
            return None
        cell = strip_task_formatting(mapping[2])
    match = re.fullmatch(r"(?:Task )?([1-9][0-9]*)", cell)
    return match[1] if match else None


def check(plan, number):
    starts = list(re.finditer(r"(?m)^## Task " + re.escape(number) + r":[^\n]*$", plan))
    if len(starts) != 1:
        raise ValueError("selected task section missing or duplicated")
    start = starts[0].end()
    end = re.search(r"(?m)^## ", plan[start:])
    section = plan[start:start + end.start()] if end else plan[start:]
    clean = section.replace("**", "").replace("`", "")
    modes = re.findall(r"(?im)^\s*(?:[-*]\s+)?Execution mode:\s*([^\n]+)", clean)
    owners = re.findall(r"(?im)^\s*(?:[-*]\s+)?(?:Human owner|Owner):\s*([^\n]+)", clean)
    branches = re.findall(r"(?im)^\s*(?:[-*]\s+)?Branch name:\s*([^\n]+)", clean)
    # A selected execution-order row is a fallback branch source too. Check it
    # independently so a stale code branch in the task cannot hide its sentinel.
    summary = re.search(r"(?ms)^## Execution Order Summary\s*\n(.*?)(?=^## |\Z)", plan)
    if summary:
        lines = summary[1].splitlines()
        headers = None
        for line in lines:
            if not line.strip().startswith("|"):
                continue
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            header_cells = [cell.replace("**", "").strip("`") for cell in cells]
            if "Task" in header_cells and any(cell in {"Branch", "Branch name"} for cell in header_cells):
                headers = header_cells
                continue
            if headers and len(cells) == len(headers):
                row = dict(zip(headers, cells))
                task_cell = row.get("Task", "")
                task_number = summary_task_number(task_cell)
                branch = row.get("Branch name", row.get("Branch", "")).replace("**", "").strip(" \t\r\n`")
                is_sentinel = branch.casefold() == "n/a (human-only)"
                if task_number is None and is_sentinel:
                    raise ValueError("unreadable summary Task cell " + repr(task_cell) + " with human-only branch sentinel")
                if task_number == number:
                    branches.append(branch)
    human = any(mode.strip().casefold() == "human-only" for mode in modes)
    sentinel = any(branch.strip().casefold() == "n/a (human-only)" for branch in branches)
    if human or sentinel:
        print("BLOCKED: human-only task; hand off to " + (owners[0].strip() if owners else "the human owner (not specified)"))
        return 1
    print("AUTOMATED: continue ordinary readiness checks")
    return 0


if __name__ == "__main__":
    if sys.argv[1:] == ["--help"]:
        print(__doc__)
        sys.exit(0)
    if len(sys.argv) != 2 or not re.fullmatch(r"[1-9][0-9]*", sys.argv[1]):
        print(__doc__)
        sys.exit(2)
    try:
        sys.exit(check(sys.stdin.read(), sys.argv[1]))
    except ValueError as error:
        print("ERROR: " + str(error))
        sys.exit(2)
