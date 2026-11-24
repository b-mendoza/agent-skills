import { GITHUB_ACTIONS } from "#/cases/pr-creator-fake-actions.ts";
import { GH_LOG } from "#/fixtures/fixtures.ts";

// A shared fake for these three adjacent GitHub workflows, not a network emulator.
export const FAKE_GH = String.raw`#!/usr/bin/env python3
import json
from pathlib import Path
import subprocess
import sys

root = Path(__EVAL_REPO_PATH__)
state = json.loads((root / ".git/fake-gh-state.json").read_text())
args = sys.argv[1:]
with (root / "${GH_LOG}").open("a") as stream:
    stream.write(json.dumps(args) + "\n")

def option(name):
    for index, arg in enumerate(args):
        if arg == name and index + 1 < len(args):
            return args[index + 1]
        if arg.startswith(name + "="):
            return arg.split("=", 1)[1]
        if name in ("-X", "-H") and arg.startswith(name) and arg != name:
            return arg[len(name):]
    return None

def emit(value):
    projection = option("--jq") or option("-q")
    if projection:
        result = subprocess.run(["jq", "-r", projection], input=json.dumps(value), text=True)
        sys.exit(result.returncode)
    print(json.dumps(value))
    sys.exit(0)

def refuse():
    print("fake gh: unsupported command: " + repr(args), file=sys.stderr)
    sys.exit(79)

def options(name):
    values = []
    for index, arg in enumerate(args):
        if arg == name and index + 1 < len(args):
            values.extend(args[index + 1].split(","))
        elif arg.startswith(name + "="):
            values.extend(arg.split("=", 1)[1].split(","))
    return values

usage = {
    "pr create": "--repo --base --head --title --body-file --draft --reviewer --assignee --label",
    "pr edit": "--repo --title --body-file --add-reviewer --add-assignee --add-label",
    "pr ready": "--repo --undo", "pr view": "--repo --json number,url,state,baseRefName,headRefName,headRefOid,title,body,isDraft,reviewRequests,labels,assignees,closingIssuesReferences",
    "issue comment": "--repo --body-file", "issue close": "--repo --reason", "issue view": "--repo --json number,title,url,state,stateReason",
    "api": "--hostname --method --include --paginate --raw-field", "auth status": "--hostname --active --no-refresh",
}
if args[-1:] == ["--help"] and " ".join(args[:-1]) in usage:
    key = " ".join(args[:-1]); print("Usage: gh " + key + " " + usage[key]); sys.exit(0)

def valid_repo(value):
    repo = state['repo']['full_name']
    return value in (repo, 'github.com/' + repo)

if option('--hostname') not in (None, 'github.com'): refuse()
if (option('--repo') or option('-R')) and not valid_repo(option('--repo') or option('-R')): refuse()
if args[:1] == ['api']:
    method = option('--method') or option('-X')
    has_fields = any(arg.startswith(('-f','-F')) or arg.split('=')[0] in ('--raw-field','--field','--input') for arg in args)
    if method and method.upper() not in ('GET','HEAD'): refuse()
    if not method and has_fields and 'graphql' not in args: refuse()

${GITHUB_ACTIONS}

if args[:2] == ["pr", "create"] and state.get("allow_create"):
    fields = write_options(None, ('--base','--head','--title','--body-file','--label','--reviewer','--assignee'), ('--draft',))
    if state["existing"] or any(len(fields.get(key, [])) != 1 for key in ('--base','--head','--title','--body-file')): refuse()
    title, body_file = option("--title"), option("--body-file")
    if not title or not body_file or option("--base") != "main" or option("--head") not in (pr["headRefName"], "eval-org:" + pr["headRefName"]) or not valid_repo(option("--repo") or option("-R")):
        refuse()
    body = sys.stdin.buffer.read().decode("utf-8") if body_file == "-" else Path(body_file).read_bytes().decode("utf-8")
    assignees, labels, reviewers = options("--assignee"), options("--label"), options("--reviewer")
    assignees = [state["me"] if login == "@me" else login for login in assignees]
    if any(login not in ("maintainer", state["me"]) for login in assignees):
        refuse()
    captured = {"args": args, "body": body, "title": title, "assignees": assignees, "labels": labels, "reviewers": reviewers}
    (root / ".git/eval-created.json").write_text(json.dumps(captured))
    pr = state["pr"]
    pr.update(title=title, body=body, isDraft="--draft" in args, draft="--draft" in args,
              assignees=[{"login": login} for login in assignees], labels=[{"name": label} for label in labels],
              reviewRequests=[{"login": login} for login in reviewers])
    if state.get("readback_drift"):
        pr["body"] += "\nAutomation footer\n"
        pr["labels"].append({"name": "automation"})
    refresh_closures()
    pr.update(state.get("readback", {}))
    state["graphql"]["data"]["repository"]["pullRequest"].update(pr)
    state["existing"] = True
    (root / ".git/fake-gh-state.json").write_text(json.dumps(state))
    print(pr["url"])
    sys.exit(0)

method = option("--method") or option("-X")
if method and method.upper() not in ("GET", "HEAD"):
    refuse()
if any(arg in ("create", "edit", "review", "comment", "merge", "close", "reopen", "ready") for arg in args[:2]):
    refuse()
if args[:2] == ["auth", "status"]:
    print("Logged in to github.com as " + state["me"])
    sys.exit(0)
if args == ["--version"]:
    print("gh version 2.80.0 (fixture)")
    sys.exit(0)
if args[:2] == ["repo", "view"]:
    emit(state["repo"])
if args[:2] == ["label", "list"]:
    emit([])
if args[:2] == ["pr", "list"]:
    fields = {key:option("--"+key) for key in ("base", "head", "state") if option("--"+key)}
    emit(listed_prs(fields))
if args[:2] == ["pr", "view"]:
    if issues and len(args) > 2 and args[2].isdigit() and (not state["existing"] or int(args[2]) != pr["number"]): emit(pr_by_number(int(args[2])))
    if (state.get("allow_create") or state.get("allow_edit")) and state["existing"]:
        (root / ".git/eval-readback.json").write_text(json.dumps(state["pr"]))
    emit(state["pr"])
if args[:2] == ["pr", "diff"]:
    if "--name-only" in args:
        print("pricing.py")
    else:
        print(state["diff"], end="")
    sys.exit(0)
if args[:2] == ["pr", "checks"]:
    emit([])
if args and args[0] == "api":
    endpoints = [arg for arg in args if arg == "graphql" or arg.startswith("repos/") or arg == "user"]
    if len(endpoints) != 1:
        refuse()
    endpoint = endpoints[0]
    if endpoint == "graphql":
        if any("mutation" in arg for arg in args):
            refuse()
        if (state.get("allow_create") or state.get("allow_edit")) and state["existing"]:
            (root / ".git/eval-readback.json").write_text(json.dumps(state["pr"]))
        emit(state["graphql"])
    if endpoint == "user":
        emit({"login": state["me"]})
    prefix = "repos/eval-org/cart"
    suffix = endpoint.removeprefix(prefix).split("?", 1)[0]
    if not endpoint.startswith(prefix):
        refuse()
    if suffix == "":
        if "--include" in args or "-i" in args: print("HTTP/2.0 200 OK\n", flush=True)
        emit(state["repo"])
    if suffix.startswith("/labels/"):
        print("HTTP 404: Not Found", file=sys.stderr); sys.exit(1)
    if suffix == "/assignees":
        emit([{"login": "maintainer"}])
    if suffix.startswith("/assignees/"):
        if suffix in ("/assignees/maintainer", "/assignees/" + state["me"]):
            if "-i" in args or "--include" in args:
                print("HTTP/2.0 204 No Content\n")
            sys.exit(0)
        if "-i" in args or "--include" in args:
            print("HTTP/2.0 404 Not Found\n")
        print("HTTP 404: not assignable", file=sys.stderr)
        sys.exit(1)
    if suffix == "/pulls":
        fields = dict(value.split('=', 1) for value in options('--raw-field') + options('-f'))
        emit(listed_prs(fields, rest=True))
    if issues and re.fullmatch(r"/pulls/[0-9]+", suffix) and (not state["existing"] or suffix != "/pulls/17"):
        other = pr_by_number(int(suffix.split("/")[-1])); emit({**other, "state":other["state"].lower()})
    if suffix == "/pulls/17":
        if (state.get("allow_create") or state.get("allow_edit")) and state["existing"]:
            (root / ".git/eval-readback.json").write_text(json.dumps(state["pr"]))
        if option("-H") and "diff" in option("-H"):
            print(state["diff"], end="")
            sys.exit(0)
        emit({**state["pr"], "state": "open"})
    if suffix in ("/pulls/17/comments", "/pulls/comments"):
        emit(state["comments"])
    if suffix.startswith("/collaborators/"):
        listed = suffix.removeprefix("/collaborators/") in state.get("collaborators", [])
        if "--include" in args or "-i" in args:
            print("HTTP/2.0 204 No Content" if listed else "HTTP/2.0 404 Not Found")
        if not listed: print("HTTP 404: Not Found", file=sys.stderr)
        sys.exit(0 if listed else 1)
    if suffix == "/collaborators": emit([{"login": login} for login in state.get("collaborators", [])])
    if suffix in ("/pulls/17/reviews", "/issues/17/comments", "/labels", "/teams"):
        emit([])
    if suffix == "/pulls/17/files":
        emit(state["pr"]["files"])
    if suffix.startswith("/compare/"):
        emit({"merge_base_commit": {"sha": state["base"]}, "files": state["pr"]["files"], "status": "ahead", "ahead_by": 1, "behind_by": 0})
    if suffix.startswith("/contents/"):
        path = suffix.removeprefix("/contents/")
        if path == "pricing.py":
            content = state["base_source"] if state["base"] in endpoint or "ref=main" in endpoint else state["head_source"]
            if option("-H") and "raw" in option("-H"):
                print(content, end="")
                sys.exit(0)
            import base64
            emit({"type": "file", "path": path, "encoding": "base64", "content": base64.b64encode(content.encode()).decode()})
        refuse()
    if suffix.startswith("/commits/") and suffix.endswith("/check-runs"):
        emit({"total_count": 0, "check_runs": []})
    if suffix.startswith("/commits/") and suffix.endswith("/status"):
        emit({"state": "pending", "statuses": [], "total_count": 0})
    refuse()
refuse()
`;
