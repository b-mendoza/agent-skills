#!/usr/bin/env python3
"""Maintain workflow progress, with phase and task state kept separate.

Usage: python3 progress.py < request.json
       python3 progress.py --help
Request: ticket_key, action; phase_skills for initialization;
phase/status/summary for updates; tasks for Phase 4; task_number for task actions;
reason for skip_task. Action names are read, initialize, update, initialize_task,
update_task, skip_task. Keys and paths are data, never shell commands.
Exit: 0 success; 1 invalid request/state or filesystem failure (PROGRESS: ERROR);
2 CLI usage error. Side effects: writes only the two named progress files under
the existing docs/ contract. read never writes. A first Phase 1 update creates
fresh progress; other first mutations preserve inferred planning state. Missing
task records can resume only with all four task planning artifacts; inference
notes are audit text, not recovery permission. No network or git writes.
Smoke: echo '{"ticket_key":"DEMO-1","action":"read"}' | python3 progress.py
"""

import datetime
import json
from pathlib import Path
import re
import sys

DISPLAY = {"pending": "⬜ Pending", "active": "🔄 Active", "complete": "✅ Complete",
           "failed": "❌ Failed", "skipped": "⏭️ Skipped"}
LABELS = {5: "5/7 Plan", 6: "6/7 Critique", 7: "7/7 Execute"}
ACTIONS = {"read", "initialize", "update", "initialize_task", "update_task", "skip_task"}
TASK_COLUMNS = ["Task", "Title", "Dependencies", "Priority", "Child item", "Current Phase", "Status", "Detail", "Outcome", "Execution mode", "Human owner", "Branch name"]
PHASE_COLUMNS = ["Phase", "Skill", "Status", "Completed at", "Notes"]
INFERRED_NOTE = "Inferred from existing artifacts; phase validation still required."


def require(condition, message):
    if not condition:
        raise ValueError(message)


def text(value, label):
    require(isinstance(value, str) and bool(value.strip()) and "\n" not in value and "\r" not in value,
            f"{label} must be one nonempty line")
    return value.strip().replace("|", "&#124;")


def number(value, label):
    require(type(value) is int and value > 0, f"{label} must be a positive integer")
    return value


def status(value):
    normalized = re.sub(r"^[^\w]+", "", value.strip()).casefold()
    require(normalized in DISPLAY, f"invalid status: {value}")
    return normalized


def table(content, first):
    lines = content.splitlines()
    starts = [i for i, line in enumerate(lines) if line.startswith(f"| {first} |")]
    require(len(starts) <= 1, f"duplicate {first} table")
    if not starts:
        return [], []
    start = starts[0]
    columns = [cell.strip() for cell in lines[start].strip("|").split("|")]
    require(len(set(columns)) == len(columns), "duplicate table columns")
    rows = []
    for line in lines[start + 2:]:
        if not line.startswith("|"):
            break
        values = [cell.strip() for cell in line.strip("|").split("|")]
        require(len(values) == len(columns), f"malformed {first} row")
        rows.append(dict(zip(columns, values)))
    require(len({row[first] for row in rows}) == len(rows), f"duplicate {first} identity")
    return columns, rows


def render(columns, rows):
    return "\n".join(["| " + " | ".join(columns) + " |", "| " + " | ".join("---" for _ in columns) + " |"] +
                     ["| " + " | ".join(row.get(column, "—") for column in columns) + " |" for row in rows])


def replace_table(content, first, columns, rows):
    pattern = rf"(?m)^\| {first} \|[^\n]*\n\|[^\n]*\n(?:\|[^\n]*(?:\n|$))*"
    replacement = render(columns, rows) + "\n"
    if re.search(pattern, content):
        return re.sub(pattern, lambda _: replacement, content, count=1)
    placeholder = r"(?m)^_No tasks yet[^\n]*_$"
    require(first == "Task" and re.search(placeholder, content), f"missing {first} table")
    return re.sub(placeholder, lambda _: replacement, content, count=1)


def find(rows, column, value):
    matched = [row for row in rows if row[column] == str(value)]
    require(len(matched) == 1, f"missing or duplicate {column} {value}")
    return matched[0]


def phase_rows(skills, start, stop):
    require(isinstance(skills, list) and len(skills) == 7, "phase_skills needs seven skill names")
    return [{"Phase": str(phase), "Skill": text(skills[phase - 1], "skill"),
             "Status": DISPLAY["pending"], "Completed at": "—", "Notes": "—"}
            for phase in range(start, stop + 1)]


def main_template(key, skills):
    return (f"# {key} — Workflow Progress\n\n{render(PHASE_COLUMNS, phase_rows(skills, 1, 4))}\n\n"
            "## Task Execution (Phases 5–7)\n\n_No tasks yet_\n\n## Execution Log\n")


def task_template(key, row, skills):
    return (f"# {key} — Task {row['Task']}: {row['Title']} — Progress\n\n"
            f"{render(PHASE_COLUMNS, phase_rows(skills, 5, 7))}\n\n## Re-plan History\n\n_None_\n\n## Activity Log\n")


def task_markers(key, root):
    path = root / f"{key}-tasks.md"
    if not path.exists():
        return {}
    require(not path.is_symlink(), "task plan must not be a symlink")
    plan = path.read_text().replace("**", "").replace("`", "")
    result = {}
    for match in re.finditer(r"(?m)^## Task ([1-9][0-9]*):[^\n]*$", plan):
        tail = plan[match.end():]
        end = re.search(r"(?m)^## ", tail)
        section = tail[:end.start()] if end else tail
        fields = dict((item[0].strip().casefold(), item[1].strip()) for item in
                      re.findall(r"(?m)^\s*(?:[-*]\s+)?([^:\n]+):[ \t]*([^\n]*)", section))
        markers = {}
        if fields.get("execution mode", "").casefold() == "human-only":
            markers["Execution mode"] = "human-only"
        owner = fields.get("human owner", fields.get("owner"))
        if owner:
            markers["Human owner"] = owner
        if fields.get("branch name"):
            markers["Branch name"] = fields["branch name"]
        result[match[1]] = markers
    summary = re.search(r"(?ms)^## Execution Order Summary[ \t]*\n(.*?)(?=^## |\Z)", plan)
    if summary:
        _, rows = table(summary[1], "Task") if "| Task |" in summary[1] else ([], [])
        # Tables commonly begin with Order rather than Task.
        if not rows and "| Order |" in summary[1]:
            _, rows = table(summary[1], "Order")
        for row in rows:
            branch = row.get("Branch name", row.get("Branch", ""))
            if branch.casefold() == "n/a (human-only)":
                result.setdefault(row.get("Task", "").removeprefix("Task "), {})["Branch name"] = branch
    return result


def human_only(row):
    return row.get("Execution mode", "code").casefold() == "human-only" or row.get("Branch name", "").casefold() == "n/a (human-only)"


def enrich_task(row, markers):
    for name, value in markers.get(row["Task"], {}).items():
        # A stale code branch cannot erase an already-recorded human sentinel.
        if name == "Branch name" and row.get(name, "").casefold() == "n/a (human-only)":
            continue
        row[name] = text(value, name)


def inferred_task_phase(key, root, task_number):
    prefix = f"{key}-task-{task_number}"
    if not all((root / f"{prefix}-{suffix}.md").exists()
               for suffix in ["brief", "execution-plan", "test-spec", "refactoring-plan"]):
        return 5
    return 7 if all((root / f"{prefix}-{suffix}.md").exists()
                    for suffix in ["critique", "decisions"]) else 6


def infer_task_progress(key, root, row, skills):
    content = task_template(key, row, skills)
    columns, phases = table(content, "Phase")
    resume = inferred_task_phase(key, root, row["Task"])
    for phase in phases:
        if int(phase["Phase"]) < resume:
            phase.update({"Status": DISPLAY["complete"], "Notes": INFERRED_NOTE})
    return replace_table(content, "Phase", columns, phases) + INFERRED_NOTE + "\n"


def infer_progress(key, root, skills=None):
    snapshot = root / f"{key}.md"
    plan_path = root / f"{key}-tasks.md"
    if not snapshot.exists() and not plan_path.exists():
        return None
    plan = plan_path.read_text() if plan_path.exists() else ""
    content = main_template(key, skills if skills is not None else ["inferred"] * 7)
    _, phases = table(content, "Phase")
    done = [snapshot.exists(), plan_path.exists(),
            (root / f"{key}-upfront-critique.md").exists() and "## Decisions Log" in plan,
            "## GitHub Task Issues" in plan or "## Jira Subtasks" in plan]
    for row, complete in zip(phases, done):
        if complete:
            row["Status"] = DISPLAY["complete"]
    content = replace_table(content, "Phase", PHASE_COLUMNS, phases)
    tasks = []
    for match in re.finditer(r"(?m)^## Task ([1-9][0-9]*):[ \t]*(.+)$", plan):
        tail = plan[match.end():]
        end = re.search(r"(?m)^## ", tail)
        block = (tail[:end.start()] if end else tail).replace("**", "")
        fields = dict((item[0].strip().casefold(), item[1].strip()) for item in
                      re.findall(r"(?m)^([^:\n]+):[ \t]*([^\n]*)", block))
        tasks.append({"Task": match[1], "Title": text(match[2], "task title"),
                      "Dependencies": fields.get("dependencies / prerequisites", fields.get("dependencies", "None")),
                      "Priority": fields.get("priority", "Unknown"), "Child item": fields.get("github task issue", fields.get("jira subtask", "Unknown (legacy)")),
                      "Current Phase": "—", "Status": DISPLAY["pending"],
                      "Detail": f"`{root}/{key}-task-{match[1]}-progress.md`", "Outcome": "—",
                      "Execution mode": "code", "Human owner": "Not specified", "Branch name": "Unknown"})
    for row in tasks:
        resume = inferred_task_phase(key, root, row["Task"])
        if resume > 5:
            row.update({"Current Phase": LABELS[resume], "Status": DISPLAY["active"]})
    if tasks:
        content = replace_table(content, "Task", TASK_COLUMNS, tasks)
    return content + INFERRED_NOTE + "\n"


def summarize(key, content, root):
    print("PROGRESS: OK")
    print(f"Workflow: {key}")
    if content is None:
        print(f"Summary: No progress found for {key}. Fresh start.")
        print("Resume from: Phase 1")
        return
    _, phases = table(content, "Phase")
    _, tasks = table(content, "Task")
    require([row["Phase"] for row in phases] == ["1", "2", "3", "4"], "main phase rows must be 1-4")
    states = [status(row["Status"]) for row in phases]
    print("Phases: " + " | ".join(f"{index + 1} {state}" for index, state in enumerate(states)))
    markers = task_markers(key, root)
    remaining = []
    complete = skipped = 0
    for row in tasks:
        enrich_task(row, markers)
        state = status(row["Status"])
        detail = root / f"{key}-task-{row['Task']}-progress.md"
        phase = 5
        if state != "skipped" and detail.exists():
            require(not detail.is_symlink(), "task progress must not be a symlink")
            _, task_phases = table(detail.read_text(), "Phase")
            require([item["Phase"] for item in task_phases] == ["5", "6", "7"], "task phase rows must be 5-7")
            unfinished = [int(item["Phase"]) for item in task_phases if status(item["Status"]) != "complete"]
            phase = unfinished[0] if unfinished else 7
            # Legacy rows could incorrectly say Complete after Phase 5 or 6.
            state = ("complete" if not unfinished else "failed" if state == "failed" else "active")
        elif state == "complete":
            require(False, f"Task {row['Task']} completion lacks Phase 7 evidence")
        elif state != "skipped":
            phase = inferred_task_phase(key, root, row["Task"])
            if phase > 5:
                state = "active"
        if state == "complete":
            complete += 1
        elif state == "skipped":
            skipped += 1
        else:
            remaining.append((row, state, phase))
    if tasks:
        print(f"Tasks: {complete}/{len(tasks)} complete | {skipped} skipped | {len(remaining)} remaining")
        print("Remaining:")
        for row, state, _ in remaining:
            print(f"  - Task {row['Task']} | {row['Title']} | Depends on: {row['Dependencies']} | Priority: {row['Priority']} | Status: {state} | Execution mode: {row.get('Execution mode', 'code')} | Human owner: {row.get('Human owner', 'Not specified')} | Branch name: {row.get('Branch name', 'Unknown')}")
    print("Last activity: " + (content.rstrip().splitlines()[-1] if "## Execution Log\n" in content else "none"))
    if any(state != "complete" for state in states):
        resume = f"Phase {next(i + 1 for i, state in enumerate(states) if state != 'complete')}"
    elif remaining:
        started = next(((row, phase) for row, state, phase in remaining if state in {"active", "failed"} and not human_only(row)), None)
        resume = f"Phase {started[1]}, Task {started[0]['Task']}" if started else "Phase 5 (task selection)"
    else:
        resume = "None (all tasks accounted for)" if tasks else "Phase 5 (task selection)"
    print(f"Resume from: {resume}")


def run(request):
    require(isinstance(request, dict), "request must be an object")
    key = text(request.get("ticket_key"), "ticket_key")
    require(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", key) and ".." not in key, "unsafe ticket_key")
    action = request.get("action")
    require(action in ACTIONS, "unknown action")
    root = Path("docs")
    require(not root.is_symlink(), "docs must not be a symlink")
    path = root / f"{key}-progress.md"
    content = path.read_text() if path.exists() else None
    if action == "read":
        if content is None:
            content = infer_progress(key, root)
        summarize(key, content, root)
        return
    require(not path.is_symlink(), "progress file must not be a symlink")
    if content is not None:
        import contextlib
        import io
        with contextlib.redirect_stdout(io.StringIO()):
            summarize(key, content, root)
    # Phase 1's own snapshot does not turn a fresh workflow into a recovery.
    if content is None and not (action == "update" and request.get("phase") == 1):
        content = infer_progress(key, root, request.get("phase_skills"))
    if content is None:
        require(action in {"initialize", "update"}, "main progress file is missing")
        content = main_template(key, request.get("phase_skills"))
    _, phases = table(content, "Phase")
    if request.get("phase_skills") is not None:
        supplied_phases = phase_rows(request["phase_skills"], 1, 4)
        for row, supplied in zip(phases, supplied_phases):
            if row["Skill"] == "inferred":
                row["Skill"] = supplied["Skill"]
        content = replace_table(content, "Phase", PHASE_COLUMNS, phases)
    columns, tasks = table(content, "Task")
    markers = task_markers(key, root)
    if tasks:
        for column in ["Child item", "Outcome", "Execution mode", "Human owner", "Branch name"]:
            if column not in columns:
                columns.append(column)
        for existing in tasks:
            enrich_task(existing, markers)
            existing.setdefault("Child item", "Unknown (legacy)")
            existing.setdefault("Outcome", "—")
            existing.setdefault("Execution mode", "code")
            existing.setdefault("Human owner", "Not specified")
            existing.setdefault("Branch name", "Unknown")
            detail = root / f"{key}-task-{existing['Task']}-progress.md"
            if detail.exists() and status(existing["Status"]) != "skipped":
                _, recorded = table(detail.read_text(), "Phase")
                unfinished = [item for item in recorded if status(item["Status"]) != "complete"]
                if unfinished:
                    existing["Status"] = DISPLAY["failed" if status(unfinished[0]["Status"]) == "failed" else "active"]
                    existing["Current Phase"] = LABELS[int(unfinished[0]["Phase"])]
                else:
                    existing["Status"] = DISPLAY["complete"]
        content = replace_table(content, "Task", columns, tasks)
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    task_path = None
    task_content = None
    log = None
    if action == "update":
        phase = number(request.get("phase"), "phase")
        require(phase in range(1, 5), "update accepts only phases 1-4")
        state = request.get("status")
        require(state in {"active", "complete", "failed", "skipped"}, "invalid update status")
        summary = text(request.get("summary"), "summary")
        row = find(phases, "Phase", phase)
        if phase == 4 and state == "complete":
            # A first write may reconcile an inferred table. Once persisted as
            # complete, Phase 4 cannot replace task identities or metadata.
            require(not tasks or not path.exists() or status(row["Status"]) != "complete",
                    "Phase 4 task table already exists; reconcile explicitly, never reset progress")
        row.update({"Status": DISPLAY[state], "Completed at": timestamp, "Notes": summary})
        content = replace_table(content, "Phase", PHASE_COLUMNS, phases)
        if phase == 4 and state == "complete":
            supplied = request.get("tasks")
            require(isinstance(supplied, list) and supplied, "Phase 4 completion needs tasks")
            inferred_tasks = {row["Task"]: row for row in tasks}
            if inferred_tasks:
                require({str(task.get("number")) for task in supplied} == set(inferred_tasks),
                        "Phase 4 tasks differ from inferred tasks; reconcile explicitly")
            tasks = []
            for task in supplied:
                n = number(task.get("number"), "task number")
                tasks.append({"Task": str(n), "Title": text(task.get("title"), "title"),
                              "Dependencies": text(task.get("dependencies", "None"), "dependencies"),
                              "Priority": text(task.get("priority", "Unknown"), "priority"),
                              "Child item": text(task.get("child_item", "Not Created"), "child item"),
                              "Current Phase": "—", "Status": DISPLAY["pending"],
                              "Detail": f"`{root}/{key}-task-{n}-progress.md`", "Outcome": "—",
                              "Execution mode": text(task.get("execution_mode", "code"), "execution mode"),
                              "Human owner": text(task.get("human_owner", "Not specified"), "human owner"),
                              "Branch name": text(task.get("branch_name", "Unknown"), "branch name")})
            for task_row in tasks:
                inferred = inferred_tasks.get(task_row["Task"], {})
                for field in ["Current Phase", "Status", "Detail", "Outcome"]:
                    if field in inferred:
                        task_row[field] = inferred[field]
                enrich_task(task_row, markers)
            require(len({row['Task'] for row in tasks}) == len(tasks), "duplicate task identity")
            content = replace_table(content, "Task", TASK_COLUMNS, tasks)
        log = f"Phase {phase}: {state} — {summary}"
    elif action in {"initialize_task", "update_task", "skip_task"}:
        n = number(request.get("task_number"), "task_number")
        row = find(tasks, "Task", n)
        require(status(row["Status"]) not in {"complete", "skipped"}, "terminal task cannot be restarted implicitly")
        if action != "skip_task":
            require(not human_only(row), "human-only task requires a human handoff, not Phases 5-7")
        task_path = root / f"{key}-task-{n}-progress.md"
        require(not task_path.is_symlink(), "task progress must not be a symlink")
        task_content = task_path.read_text() if task_path.exists() else None
        if action == "skip_task":
            reason = text(request.get("reason"), "reason")
            row.update({"Status": DISPLAY["skipped"], "Outcome": reason})
            log = f"Task {n}: skipped — {reason}"
            if task_content is not None:
                task_content += f"{timestamp} — {log}\n"
        elif action == "initialize_task":
            require(task_content is None, "task already initialized; resume instead")
            resume = inferred_task_phase(key, root, n)
            task_content = (infer_task_progress(key, root, row, request.get("phase_skills", ["inferred"] * 7))
                            if resume > 5 else task_template(key, row, request.get("phase_skills")))
            row.update({"Current Phase": LABELS[resume], "Status": DISPLAY["active"]})
            log = f"Task {n} started: {row['Title']}"
        else:
            if task_content is None and inferred_task_phase(key, root, n) > 5:
                task_content = infer_task_progress(key, root, row, request.get("phase_skills", ["inferred"] * 7))
            require(task_content is not None, "task has not been initialized")
            phase = number(request.get("phase"), "phase")
            require(phase in LABELS, "update_task accepts only phases 5-7")
            state = request.get("status")
            require(state in {"active", "complete", "failed"}, "task phase status must be active, complete, or failed; use skip_task for exclusions")
            summary = text(request.get("summary"), "summary")
            phase_columns, task_phases = table(task_content, "Phase")
            if request.get("phase_skills") is not None:
                supplied_phases = phase_rows(request["phase_skills"], 5, 7)
                for item, supplied in zip(task_phases, supplied_phases):
                    if item["Skill"] == "inferred":
                        item["Skill"] = supplied["Skill"]
            require(all(status(item["Status"]) == "complete" for item in task_phases if int(item["Phase"]) < phase), "earlier task phases are not complete")
            find(task_phases, "Phase", phase).update({"Status": DISPLAY[state], "Completed at": timestamp, "Notes": summary})
            for later in task_phases:
                if int(later["Phase"]) > phase:
                    later.update({"Status": DISPLAY["pending"], "Completed at": "—", "Notes": "Invalidated by earlier-phase update"})
            task_content = replace_table(task_content, "Phase", phase_columns, task_phases)
            task_content += f"{timestamp} — Phase {phase}: {state} — {summary}\n"
            task_state = "complete" if phase == 7 and state == "complete" else "failed" if state == "failed" else "active"
            row.update({"Current Phase": LABELS[min(phase + 1, 7)] if state == "complete" else LABELS[phase], "Status": DISPLAY[task_state]})
            log = f"Task {n} Phase {phase}: {state} — {summary}"
        content = replace_table(content, "Task", columns, tasks)
    if log:
        content += f"{timestamp} — {log}\n"
    # Validate the in-memory tables before any write. Task state is computed above;
    # the read path additionally checks completion against the per-task artifact.
    require([row["Phase"] for row in table(content, "Phase")[1]] == ["1", "2", "3", "4"], "invalid main phases")
    root.mkdir(parents=True, exist_ok=True)
    if task_content is not None:
        task_path.write_text(task_content)
    path.write_text(content)
    summarize(key, content, root)


if __name__ == "__main__":
    if len(sys.argv) != 1:
        print(__doc__)
        sys.exit(0 if sys.argv[1:] == ["--help"] else 2)
    try:
        run(json.load(sys.stdin))
    except (ValueError, TypeError, KeyError, OSError) as error:
        print(f"PROGRESS: ERROR\nReason: {error}")
        sys.exit(1)
