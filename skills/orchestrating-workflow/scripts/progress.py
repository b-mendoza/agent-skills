#!/usr/bin/env python3
"""Maintain one workflow progress file: docs/<KEY>-progress.md.

Usage: python3 progress.py < request.json   (python3 progress.py --help prints this)
Request: JSON object with ticket_key, action, and that action's fields: read; update (phase
  1-4, status active|complete|failed|skipped, summary; Phase 4 complete also takes tasks:
  number, title, optional dependencies, priority, child_item, execution_mode, human_owner,
  branch_name); initialize_task (task_number); update_task (task_number, phase 5-7, status
  active|complete|failed, summary); skip_task (task_number, reason). Values are data only.
Exit: 0 success (PROGRESS: OK); 1 invalid request or state, or filesystem failure
(PROGRESS: ERROR plus Reason); 2 CLI usage error.
Side effects: read never writes. Other actions rewrite only docs/<KEY>-progress.md,
creating docs/ when missing. Without that file, state is inferred read-only from docs/<KEY>.md,
docs/<KEY>-tasks.md, the upfront critique and task artifacts. No network, no git.
Smoke: echo '{"ticket_key":"DEMO-1","action":"read"}' | python3 progress.py
"""

from collections import namedtuple
import datetime
import json
from pathlib import Path
import re
import sys

DISPLAY = {"pending": "⬜ Pending", "active": "🔄 Active", "complete": "✅ Complete",
           "failed": "❌ Failed", "skipped": "⏭️ Skipped"}
PHASE_NAMES = {1: "Fetch work item", 2: "Plan tasks", 3: "Clarify and critique",
               4: "Create child items"}
LABELS = {5: "5/7 Plan", 6: "6/7 Critique", 7: "7/7 Execute"}
ACTIONS = {"read", "update", "initialize_task", "update_task", "skip_task"}
PHASE_COLUMNS = ["Phase", "Name", "Status", "Completed at", "Notes"]
TASK_COLUMNS = ["Task", "Title", "Dependencies", "Priority", "Child item", "Current Phase",
                "Status", "Outcome", "Execution mode", "Human owner", "Branch name"]
# Optional Phase 4 request field -> (task column, default). These columns come from the plan.
TASK_FIELDS = {"dependencies": ("Dependencies", "None"), "priority": ("Priority", "Unknown"),
               "child_item": ("Child item", "Not Created"),
               "execution_mode": ("Execution mode", "code"),
               "human_owner": ("Human owner", "Not specified"),
               "branch_name": ("Branch name", "Unknown")}
TASK_DEFAULTS = dict(TASK_FIELDS.values())
# Plan section fields that fill an inferred row's column, in order of preference.
PLAN_FIELDS = {"Dependencies": ["dependencies / prerequisites", "dependencies"],
               "Priority": ["priority"], "Child item": ["github task issue", "jira subtask"]}
NEW_TASK = {"Current Phase": "—", "Status": DISPLAY["pending"], "Outcome": "—"}
HUMAN_ONLY_BRANCH = "N/A (human-only)"
HUMAN_ONLY_MARKER = re.compile(
    r"Execution mode:[ \t]*human-only\b|Branch name:[ \t]*N/A \(human-only\)", re.I)
# A summary Task cell: N or "Task N", alone or after the last arrow of a non-empty mapping.
SUMMARY_TASK = re.compile(r"(?:(.*)(?:->|→))?\s*(?:Task )?([1-9][0-9]*)")
SEPARATOR_CELL = re.compile(r":?-+:?")
PLAN_FIELD = re.compile(r"(?m)^\s*(?:[-*]\s+)?([^:\n]+):[ \t]*([^\n]*)")
PLANNING_ARTIFACTS = {"brief", "execution-plan", "test-spec", "refactoring-plan"}
CRITIQUE_ARTIFACTS = {"critique", "decisions"}
Progress = namedtuple("Progress", "phases tasks log")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def text(value, label):
    require(isinstance(value, str) and bool(value.strip())
            and "\n" not in value and "\r" not in value, f"{label} must be one nonempty line")
    return value.strip().replace("|", "&#124;")


def number(value, label):
    require(type(value) is int and value > 0, f"{label} must be a positive integer")
    return value


def status(value):
    normalized = re.sub(r"^[^\w]+", "", value.strip()).casefold()
    require(normalized in DISPLAY, f"invalid status: {value}")
    return normalized


def unformatted(value):
    return value.replace("**", "").replace("`", "")


def table_cells(line):
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def parse_table(content, first):
    """Return the rows of the one table whose first header cell is `first`, keyed by header."""
    lines = content.splitlines()
    starts = [i for i, line in enumerate(lines) if unformatted(line).startswith(f"| {first} |")]
    require(len(starts) <= 1, f"duplicate {first} table")
    if not starts:
        return []
    columns = table_cells(unformatted(lines[starts[0]]))
    require(len(set(columns)) == len(columns), "duplicate table columns")
    rows = []
    for line in lines[starts[0] + 2:]:
        if not line.startswith("|"):
            break
        values = table_cells(line)
        require(len(values) == len(columns), f"malformed {first} row")
        rows.append(dict(zip(columns, values)))
    require(len({row[first] for row in rows}) == len(rows), f"duplicate {first} identity")
    return rows


def current_phase(row):
    phases = [phase for phase, label in LABELS.items() if row.get("Current Phase") == label]
    require(phases, f"Task {row['Task']} has no current phase")
    return phases[0]


def parse_progress(content):
    phases = parse_table(content, "Phase")
    require([row["Phase"] for row in phases] == ["1", "2", "3", "4"], "main phase rows must be 1-4")
    tasks = parse_table(content, "Task")
    for row in phases:
        status(row.get("Status", ""))
    for row in tasks:
        state = status(row.get("Status", ""))
        if state == "complete":
            # Phase 5 or 6 completion leaves a task active; only Phase 7 completes it.
            require(row.get("Current Phase") == LABELS[7],
                    f"Task {row['Task']} completion lacks Phase 7 evidence")
        if state in {"active", "failed"}:
            current_phase(row)  # Rejected here, before any write, not after one.
    log_section = re.search(r"(?ms)^## Execution Log[ \t]*$(.*?)(?=^## |\Z)", content)
    log = [line for line in log_section[1].splitlines() if line.strip()] if log_section else []
    return Progress(phases, tasks, log)


def fresh_progress():
    return Progress([{"Phase": str(phase), "Status": DISPLAY["pending"], "Completed at": "—",
                      "Notes": "—"} for phase in PHASE_NAMES], [], [])


def render(key, progress):
    def table(columns, rows):
        lines = ["| " + " | ".join(columns) + " |", "|" + " --- |" * len(columns)]
        return "\n".join(lines + ["| " + " | ".join(row.get(column, "—") for column in columns)
                                  + " |" for row in rows])
    phases = [{**row, "Name": PHASE_NAMES[int(row["Phase"])]} for row in progress.phases]
    tasks = table(TASK_COLUMNS, progress.tasks) if progress.tasks else "_No tasks yet_"
    return (f"# {key} — Workflow Progress\n\n{table(PHASE_COLUMNS, phases)}\n\n"
            f"## Task Execution (Phases 5–7)\n\n{tasks}\n\n## Execution Log\n"
            + "".join(f"{line}\n" for line in progress.log))


def summary_human_only(summary):
    """Return the task numbers named by summary rows that hold a N/A (human-only) cell.

    A header is a row followed directly by a separator row, and its Task cell picks the
    column; every other row, even one with a Task cell, is a data row.
    """
    lines = [line.strip() for line in summary.splitlines()]
    numbers, task_column = set(), None
    for line, following in zip(lines, lines[1:] + [""]):
        if not line.startswith("|"):
            task_column = None  # A table ends at the first line that is not a row.
            continue
        cells = table_cells(line)
        if following.startswith("|") and all(SEPARATOR_CELL.fullmatch(cell) for cell in table_cells(following)):
            task_column = cells.index("Task") if "Task" in cells else None
            continue
        if not any(cell.casefold() == HUMAN_ONLY_BRANCH.casefold() for cell in cells):
            continue
        has_task_cell = task_column is not None and task_column < len(cells)
        task_cell = cells[task_column] if has_task_cell else ""
        match = SUMMARY_TASK.fullmatch(task_cell)
        require(match and (match[1] is None or match[1].strip()),
                f"unreadable summary Task cell {task_cell!r} with human-only sentinel")
        numbers.add(match[2])
    return numbers


def parse_plan(plan):
    """Return the plan's (number, title, body) task sections and its human-only task numbers."""
    parts = re.split(r"(?m)^## (.*)$", unformatted(plan))
    tasks, human_only = [], set()
    for heading, body in zip(parts[1::2], parts[2::2]):
        heading = heading.strip()
        task = re.fullmatch(r"Task ([1-9][0-9]*):\s*(.*)", heading)
        if task:
            tasks.append((task[1], task[2], body))
            if HUMAN_ONLY_MARKER.search(body):
                human_only.add(task[1])
        elif heading == "Execution Order Summary":
            human_only |= summary_human_only(body)
    return tasks, human_only


def mark_human_only(progress, numbers):
    # The current plan overrides stale code metadata recorded in progress.
    for row in progress.tasks if progress else []:
        if row["Task"] in numbers:
            row.update({"Execution mode": "human-only", "Branch name": HUMAN_ONLY_BRANCH})


def is_human_only(row):
    return (row.get("Execution mode", "code").casefold() == "human-only"
            or row.get("Branch name", "").casefold() == HUMAN_ONLY_BRANCH.casefold())


def inferred_task(root, key, task, title, body):
    fields = {name.strip().casefold(): value.strip().replace("|", "&#124;")
              for name, value in PLAN_FIELD.findall(body) if value.strip()}
    # Unlike a Phase 4 row, an inferred row has no verified child item.
    row = {**TASK_DEFAULTS, "Child item": "Unknown (legacy)", **NEW_TASK,
           "Task": task, "Title": text(title, "task title")}
    for column, names in PLAN_FIELDS.items():
        row[column] = next((fields[name] for name in names if name in fields), row[column])
    present = {suffix for suffix in PLANNING_ARTIFACTS | CRITIQUE_ARTIFACTS
               if (root / f"{key}-task-{task}-{suffix}.md").exists()}
    if present >= PLANNING_ARTIFACTS:
        resume = 7 if present >= CRITIQUE_ARTIFACTS else 6
        row.update({"Current Phase": LABELS[resume], "Status": DISPLAY["active"]})
    return row


def infer_progress(root, key, plan, plan_tasks):
    """Rebuild progress from artifacts on disk; None when no workflow artifact exists."""
    snapshot = (root / f"{key}.md").exists()
    if not snapshot and plan is None:
        return None
    plan_text = plan or ""
    critique = (root / f"{key}-upfront-critique.md").exists()
    children = "## GitHub Task Issues" in plan_text or "## Jira Subtasks" in plan_text
    progress = fresh_progress()
    done = [snapshot, plan is not None, critique and "## Decisions Log" in plan_text, children]
    for row, complete in zip(progress.phases, done):
        if complete:
            row["Status"] = DISPLAY["complete"]
    if children:
        # Task rows exist only once Phase 4 has created the child items.
        progress.tasks.extend(inferred_task(root, key, task, title, body)
                              for task, title, body in plan_tasks)
    return progress


def summarize(key, progress):
    print(f"PROGRESS: OK\nWorkflow: {key}")
    if progress is None:
        print(f"Summary: No progress found for {key}. Fresh start.\nResume from: Phase 1")
        return
    phase_states = list(enumerate((status(row["Status"]) for row in progress.phases), 1))
    print("Phases: " + " | ".join(f"{phase} {state}" for phase, state in phase_states))
    task_states = [status(row["Status"]) for row in progress.tasks]
    remaining = [(row, state) for row, state in zip(progress.tasks, task_states)
                 if state not in {"complete", "skipped"}]
    if progress.tasks:
        print(f"Tasks: {task_states.count('complete')}/{len(progress.tasks)} complete | "
              f"{task_states.count('skipped')} skipped | {len(remaining)} remaining")
        print("Remaining:")
    for row, state in remaining:
        cells = [f"Task {row['Task']}", row.get("Title", "—"),
                 f"Depends on: {row.get('Dependencies', '—')}",
                 f"Priority: {row.get('Priority', '—')}", f"Status: {state}"]
        cells += [f"{column}: {row.get(column, '—')}"
                  for column in ["Execution mode", "Human owner", "Branch name"]]
        print("  - " + " | ".join(cells))
    print("Last activity: " + (progress.log[-1] if progress.log else "none"))
    unfinished = [phase for phase, state in phase_states if state != "complete"]
    started = [row for row, state in remaining
               if state in {"active", "failed"} and not is_human_only(row)]
    if unfinished:
        resume = f"Phase {unfinished[0]}"
    elif started:
        resume = f"Phase {current_phase(started[0])}, Task {started[0]['Task']}"
    elif progress.tasks and not remaining:
        resume = "None (all tasks accounted for)"
    else:
        resume = "Phase 5 (task selection)"
    print(f"Resume from: {resume}")


def phase_four_tasks(progress, supplied):
    """Build the Phase 4 table; a rerun of an unfinished Phase 4 keeps each row's task state."""
    require(isinstance(supplied, list) and supplied, "Phase 4 completion needs tasks")
    existing = {row["Task"]: row for row in progress.tasks}
    rows = []
    for task in supplied:
        row = {"Task": str(number(task.get("number"), "task number")),
               "Title": text(task.get("title"), "title")}
        for field, (column, default) in TASK_FIELDS.items():
            row[column] = text(task.get(field, default), field.replace("_", " "))
        kept = existing.get(row["Task"], NEW_TASK)
        rows.append({**row, **{column: kept.get(column, "—") for column in NEW_TASK}})
    if existing:
        require(status(progress.phases[3]["Status"]) != "complete"
                and set(existing) == {row["Task"] for row in rows},
                "Phase 4 task table already exists; reconcile explicitly, never reset progress")
    return rows


def apply_update(progress, request, timestamp):
    phase = number(request.get("phase"), "phase")
    require(phase in PHASE_NAMES, "update accepts only phases 1-4")
    state = request.get("status")
    require(state in {"active", "complete", "failed", "skipped"}, "invalid update status")
    summary = text(request.get("summary"), "summary")
    if phase == 4 and state == "complete":
        progress.tasks[:] = phase_four_tasks(progress, request.get("tasks"))
    progress.phases[phase - 1].update(
        {"Status": DISPLAY[state], "Completed at": timestamp, "Notes": summary})
    return f"Phase {phase}: {state} — {summary}"


def apply_task_action(progress, action, request):
    task_number = number(request.get("task_number"), "task_number")
    row = next((row for row in progress.tasks if row["Task"] == str(task_number)), None)
    require(row is not None, f"missing Task {task_number}")
    state = status(row["Status"])
    require(state not in {"complete", "skipped"}, "terminal task cannot be restarted implicitly")
    if action == "skip_task":
        reason = text(request.get("reason"), "reason")
        row.update({"Status": DISPLAY["skipped"], "Outcome": reason})
        return f"Task {task_number}: skipped — {reason}"
    require(not is_human_only(row), "human-only task requires a human handoff, not Phases 5-7")
    if action == "initialize_task":
        require(state == "pending", "task already initialized; resume instead")
        row.update({"Current Phase": LABELS[5], "Status": DISPLAY["active"]})
        return f"Task {task_number} started: {row['Title']}"
    require(state != "pending", "task has not been initialized")
    phase = number(request.get("phase"), "phase")
    require(phase in LABELS, "update_task accepts only phases 5-7")
    phase_state = request.get("status")
    require(phase_state in {"active", "complete", "failed"},
            "task phase status must be active, complete, or failed; use skip_task for exclusions")
    summary = text(request.get("summary"), "summary")
    require(phase <= current_phase(row), "earlier task phases are not complete")
    # Completing Phase 5 or 6 moves to the next phase; only Phase 7 completes the task.
    next_phase = min(phase + 1, 7) if phase_state == "complete" else phase
    task_state = "active" if phase_state == "complete" and phase < 7 else phase_state
    row.update({"Current Phase": LABELS[next_phase], "Status": DISPLAY[task_state]})
    return f"Task {task_number} Phase {phase}: {phase_state} — {summary}"


def run(request):
    require(isinstance(request, dict), "request must be an object")
    key = text(request.get("ticket_key"), "ticket_key")
    require(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", key) and ".." not in key,
            "unsafe ticket_key")
    action = request.get("action")
    require(action in ACTIONS, "unknown action")
    root = Path("docs")
    path, plan_path = root / f"{key}-progress.md", root / f"{key}-tasks.md"
    for checked, label in [(root, "docs"), (path, "progress file"), (plan_path, "task plan")]:
        require(not checked.is_symlink(), f"{label} must not be a symlink")
    plan = plan_path.read_text() if plan_path.exists() else None
    plan_tasks, human_only = parse_plan(plan or "")
    progress = (parse_progress(path.read_text()) if path.exists()
                else infer_progress(root, key, plan, plan_tasks))
    mark_human_only(progress, human_only)
    if action == "read":
        summarize(key, progress)
        return
    if progress is None:
        require(action == "update", "main progress file is missing")
        progress = fresh_progress()
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    entry = (apply_update(progress, request, timestamp) if action == "update"
             else apply_task_action(progress, action, request))
    mark_human_only(progress, human_only)  # Phase 4 may have added rows.
    require(len({row["Task"] for row in progress.tasks}) == len(progress.tasks),
            "duplicate task identity")
    progress.log.append(f"{timestamp} — {entry}")
    root.mkdir(parents=True, exist_ok=True)
    path.write_text(render(key, progress))
    summarize(key, progress)


if __name__ == "__main__":
    if len(sys.argv) != 1:
        print(__doc__)
        sys.exit(0 if sys.argv[1:] == ["--help"] else 2)
    try:
        run(json.load(sys.stdin))
    except (ValueError, TypeError, KeyError, AttributeError, OSError) as error:
        print(f"PROGRESS: ERROR\nReason: {error}")
        sys.exit(1)
