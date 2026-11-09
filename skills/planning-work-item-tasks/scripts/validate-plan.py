#!/usr/bin/env python3
"""Usage: python3 -I validate-plan.py PLAN KEY [APPROVED_DECISION ...]

Read-only validation of human-only/code branch discrimination and user overlays.
Exit 0 on valid input; 1 on a missing marker, invented branch, or lost decision.
"""
from pathlib import Path
import re
import sys


def field(body, name):
    match = re.search(r"\*\*" + re.escape(name) +
                      r":\*\*[^\S\n]*([^\n]*?)(?=[^\S\n]+\*\*[^*\n]+:\*\*|\n|$)", body)
    return match.group(1).strip().strip("`") if match else ""


def main():
    if len(sys.argv) < 3:
        raise ValueError(__doc__.splitlines()[0])
    path = Path(sys.argv[1])
    text = path.read_text(encoding="utf-8")
    key = sys.argv[2].lower()
    stage_one = path.name == f"{sys.argv[2]}-stage-1-detailed.md"
    pattern = (r"^### Task ([A-Z]+): ([^\n]+)\n(.*?)(?=^### Task |^## |\Z)"
               if stage_one else r"^## Task (\d+): ([^\n]+)\n(.*?)(?=^## |\Z)")
    tasks = list(re.finditer(pattern, text, re.M | re.S))
    if not tasks:
        raise ValueError("no lettered Stage 1 tasks" if stage_one else "no numbered tasks")
    for task in tasks:
        number, title, body = task.groups()
        branch = field(body, "Branch name")
        mode = field(body, "Execution mode")
        if mode not in ("", "code", "human-only"):
            raise ValueError("unknown execution mode")
        if mode == "human-only" and field(body, "Owner") != "Human":
            raise ValueError("human-only task requires Human owner")
        if stage_one:
            if branch and (mode != "human-only" or branch != "N/A (human-only)"):
                raise ValueError("Stage 1 must not assign code branches before final numbering")
            continue
        if mode == "human-only":
            if branch != "N/A (human-only)":
                raise ValueError("human-only task requires N/A branch")
        else:
            if not branch or branch.startswith("N/A") or re.search(r"[\s~^:?*\[\\]", branch):
                raise ValueError("code task requires a real branch")
            title = re.sub(r" \(was Task [A-Z]+\)$", "", title)
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40].rstrip("-") or "task"
            # Parent shape only; existing stage validators also own current-child mode.
            if f"{key}-task-" in branch and not branch.endswith(f"{key}-task-{number}-{slug}"):
                raise ValueError("non-deterministic code branch")
    section = re.search(r"^## Assumptions and Constraints\n(.*?)(?=^## |\Z)", text, re.M | re.S)
    for decision in sys.argv[3:]:
        if not section or decision not in section.group(1):
            raise ValueError("approved decision missing from assumptions")
    print("PLAN: PASS")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        print("PLAN: FAIL " + str(error), file=sys.stderr)
        sys.exit(1)
