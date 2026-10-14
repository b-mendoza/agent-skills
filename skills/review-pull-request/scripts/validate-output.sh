#!/bin/sh
# POSIX sh + stdlib Python 3; stdin only. No files, network, clock, randomness or git.
command -v python3 >/dev/null 2>&1 || { echo 'TOOLS_MISSING: python3 unavailable' >&2; exit 3; }
exec python3 -I -B -c '
import json, re, sys
TEXT = lambda v: isinstance(v, str) and bool(v.strip())
POS = lambda v: type(v) is int and v > 0
BOOL = lambda v: type(v) is bool
SHA = lambda v: isinstance(v, str) and re.fullmatch(r"[0-9a-fA-F]{40}", v)
PR = lambda v: isinstance(v, str) and re.fullmatch(r"https://github.com/[A-Za-z0-9][A-Za-z0-9-]*/(?!\.{1,2}/)[A-Za-z0-9_.-]+/pull/[1-9][0-9]*", v)
DECISION = ("APPROVE", "REQUEST_CHANGES", "COMMENT")
STATES = ("COMPLETE", "PARTIAL", "UNAVAILABLE")
POSTING = ("DRAFT", "CANCELLED", "POSTED", "FAILED", "PARTIAL", "UNCERTAIN")
IDENTITY = dict(pr_url=PR, base_sha=SHA, head_sha=SHA)
THREAD = dict(comment_id=POS, root_id=POS, resolution=("OPEN", "RESOLVED", "UNKNOWN"))
ANCHOR = dict(path=TEXT, line=POS, side=("LEFT", "RIGHT"))
RISK = dict(description=TEXT, blocks_approval=BOOL, blocks_posting=BOOL)
TRACE = dict(id=TEXT, disposition=("CONFIRM", "ADJUST", "DROP"), reason=TEXT)
FINDING = dict.fromkeys("id title location evidence failure_scenario impact minimal_fix body".split(), TEXT)
FINDING.update(severity=("blocking", "important", "nit", "suggestion"), confidence=("high", "medium", "low"),
               sources=[TEXT], classification=("NEW", "FOLLOW_UP", "UNCLASSIFIED"), anchor=lambda v: v is None or isinstance(v, dict), thread=lambda v: v is None or isinstance(v, dict))
PACKAGE = dict(IDENTITY, revision=POS, decision=DECISION, summary=TEXT, history=dict(state=STATES),
               findings=[FINDING], source_checks=[TEXT], dropped=[TRACE], residual_risks=[RISK], create_review=BOOL)
EVIDENCE = ("PASS", "PARTIAL", "BLOCKED", "TOOLS_MISSING", "RATE_LIMIT", "ERROR")
MODES = {m: (m.upper(), EVIDENCE) for m in ("context", "chunk", "adjudicate")}
MODES.update({m: ("DRAFT", ("PASS", "BLOCKED", "TOOLS_MISSING", "ERROR")) for m in ("prepare", "materialize", "update-status")})
MODES.update(verify=("VERIFY", ("PASS", "FAIL", "BLOCKED", "TOOLS_MISSING", "RATE_LIMIT", "ERROR")), post=("POST", EVIDENCE))
HELP = """Usage: sh validate-output.sh MODE < payload | -h | --self-test
Dependencies/env: POSIX sh; stdlib python3 found through PATH; no other environment inputs.
Exits: 0 accepted/help/self-test pass; 1 payload defects (one line each, shape repair);
2 invocation/internal error (ERROR); 3 missing python3 (TOOLS_MISSING).
Side effects: none. No files, network, clock, randomness or git.
Reply: exact first line TOKEN: STATUS, then {reason:string,data:object|null} only.
Non-PASS reason is nonempty. PASS/FAIL/PARTIAL require data; other failures may use null,
except BLOCKED context/chunk require data.reason_code=NEEDS_CONTEXT|OTHER.
Evidence data always has usable:bool,limitations:[string]. PASS/PARTIAL require usable=true; context/adjudicate PASS requires COMPLETE history.
Usable context: pr_url,base_sha,head_sha,history,dimensions:[{dimension:string,files:[string]}], 1..6 unique dimensions.
Usable chunk: pr_url,base_sha,head_sha,dimension:string,files:[string],findings,residual_risks,source_checks.
Usable adjudicate: pr_url,base_sha,head_sha,history,findings,dropped,residual_risks,source_checks.
Evidence PARTIAL also requires nonempty completed:[string],uncompleted:[string],limitations.
prepare: package_path:string,revision:positive-int.
materialize/update-status: package_path,revision,output_file:string,posting_status:DRAFT|CANCELLED|POSTED|FAILED|PARTIAL|UNCERTAIN.
verify: package_path,revision,head_sha,decision,publication_ready:bool; FAIL adds nonempty issues:[string],repair_owner:CONTEXT|CHUNK|ADJUDICATE|DRAFT; non-PASS cannot be publication_ready.
post: nonempty actions:[{kind:REVIEW|REPLY,effect:COMPLETED|NOT_PERFORMED|UNCERTAIN}]; REPLY adds root_id:positive-int; COMPLETED adds id:positive-int,url:nonempty-string. PASS requires all COMPLETED; PARTIAL lists scope through effects.
package: pure JSON {pr_url,base_sha,head_sha,revision,decision,summary,history,findings,source_checks,dropped,residual_risks,create_review:bool}.
pr_url=https://github.com/OWNER/REPO/pull/POSITIVE_NUMBER; SHAs=40 hex; decision=APPROVE|REQUEST_CHANGES|COMMENT; summary nonempty.
history={state:COMPLETE|PARTIAL|UNAVAILABLE,limitation:nonempty-string when incomplete}; context/adjudicate also require threads:[{comment_id,root_id,resolution,path:string,line:positive-int|null,summary:string}].
findings=[{id,title,severity:blocking|important|nit|suggestion,confidence:high|medium|low,location,evidence,failure_scenario,impact,minimal_fix,sources:[string],classification:NEW|FOLLOW_UP|UNCLASSIFIED,anchor,thread,body}]; prose nonempty, IDs unique.
anchor=null|{path:string,line:positive-int,side:LEFT|RIGHT[,start_line:positive-int,start_side:LEFT|RIGHT]}; no extra keys, paired range keys.
thread=null|{comment_id:positive-int,root_id:positive-int,resolution:OPEN|RESOLVED|UNKNOWN}; FOLLOW_UP roots unique.
source_checks=[string]; dropped=[{id,disposition:CONFIRM|ADJUST|DROP,reason}]; residual_risks=[{description,blocks_approval:bool,blocks_posting:bool}].
NEW requires anchor; FOLLOW_UP requires thread. Package NEW requires COMPLETE history; UNCLASSIFIED requires incomplete history.
APPROVE requires COMPLETE history and no blocks_approval risk; create_review=true for NEW or empty findings.
Only routed fields are checked; extra object keys ignored except reply envelope and anchor. Duplicate keys/NaN rejected everywhere."""
def check(value, spec, path, errors):
    before = len(errors)
    if isinstance(spec, dict):
        if not isinstance(value, dict): errors.append(path + ": expected object")
        else:
            for key, rule in spec.items():
                if key not in value: errors.append(path + "." + key + ": required")
                else: check(value[key], rule, path + "." + key, errors)
    elif isinstance(spec, list):
        if not isinstance(value, list): errors.append(path + ": expected array")
        else:
            for i, item in enumerate(value): check(item, spec[0], f"{path}[{i}]", errors)
    elif not (value in spec if isinstance(spec, tuple) else spec(value)): errors.append(path + ": invalid value/type")
    return len(errors) == before

def records(data, errors, package=False):
    history = data.get("history")
    if history and history["state"] != "COMPLETE": check(history.get("limitation"), TEXT, "history.limitation", errors)
    ids, roots = set(), set()
    for i, finding in enumerate(data.get("findings", [])):
        p, anchor, thread = f"findings[{i}]", finding["anchor"], finding["thread"]
        if finding["id"] in ids: errors.append(p + ".id: duplicate")
        ids.add(finding["id"])
        if anchor is not None:
            check(anchor, ANCHOR, p + ".anchor", errors)
            if set(anchor) - set(ANCHOR) - {"start_line", "start_side"}: errors.append(p + ".anchor: extra API keys")
            if "start_line" in anchor or "start_side" in anchor: check(anchor, dict(start_line=POS, start_side=("LEFT", "RIGHT")), p + ".anchor", errors)
        if thread is not None: check(thread, THREAD, p + ".thread", errors)
        kind = finding["classification"]
        if kind == "NEW" and anchor is None: errors.append(p + ": NEW requires anchor")
        if kind == "FOLLOW_UP":
            if thread is None: errors.append(p + ": FOLLOW_UP requires thread")
            elif POS(thread.get("root_id")):
                if thread["root_id"] in roots: errors.append(p + ".thread.root_id: duplicate FOLLOW_UP root")
                roots.add(thread["root_id"])
        if package and ((kind == "NEW" and history["state"] != "COMPLETE") or (kind == "UNCLASSIFIED" and history["state"] == "COMPLETE")):
            errors.append(p + ": classification conflicts with history")
    if package:
        if data["decision"] == "APPROVE" and (history["state"] != "COMPLETE" or any(r["blocks_approval"] for r in data["residual_risks"])): errors.append("decision: APPROVE conflicts with history/risk")
        if (not data["findings"] or any(f["classification"] == "NEW" for f in data["findings"])) and not data["create_review"]: errors.append("create_review: required for NEW/empty findings")

def pairs(items):
    result = {}
    for key, value in items:
        if key in result: raise ValueError("duplicate key " + repr(key))
        result[key] = value
    return result

def reject_constant(value): raise ValueError("non-finite number " + value)
def validate(mode, payload):
    errors = []
    try:
        if mode != "package":
            first, payload = payload.split("\n", 1)
            token, statuses = MODES[mode]
            if first not in [token + ": " + s for s in statuses]: return ["status: unexpected token/status"]
            status = first[len(token) + 2:]
        obj = json.loads(payload, object_pairs_hook=pairs, parse_constant=reject_constant)
        json.dumps(obj, ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (ValueError, UnicodeError, RecursionError) as exc: return ["JSON: " + str(exc).replace("\n", " ")]
    if mode == "package":
        if check(obj, PACKAGE, "package", errors): records(obj, errors, True)
        return errors
    if not check(obj, dict(reason=lambda v: isinstance(v, str), data=lambda v: v is None or isinstance(v, dict)), "reply", errors): return errors
    if set(obj) != {"reason", "data"}: errors.append("reply: only reason and data allowed")
    data = obj["data"]
    if status != "PASS": check(obj["reason"], TEXT, "reason", errors)
    if data is None:
        if status in ("PASS", "FAIL", "PARTIAL") or (status == "BLOCKED" and mode in ("context", "chunk")): errors.append("data: required for status")
        return errors
    if mode in ("context", "chunk", "adjudicate"):
        if not check(data, dict(usable=BOOL, limitations=[TEXT]), "data", errors): return errors
        if mode in ("context", "chunk") and status == "BLOCKED": check(data.get("reason_code"), ("NEEDS_CONTEXT", "OTHER"), "data.reason_code", errors)
        if status in ("PASS", "PARTIAL") and not data["usable"]: errors.append("data.usable: must be true")
        if status == "PARTIAL":
            check(data, dict(completed=[TEXT], uncompleted=[TEXT]), "data", errors)
            for key in ("completed", "uncompleted", "limitations"):
                if isinstance(data.get(key), list) and not data[key]: errors.append("data." + key + ": must be nonempty")
        if data["usable"]:
            schema = dict(IDENTITY)
            if mode != "chunk": schema["history"] = dict(state=STATES, threads=[dict(THREAD, path=TEXT, line=lambda v: v is None or POS(v), summary=TEXT)])
            if mode == "context": schema["dimensions"] = [dict(dimension=TEXT, files=[TEXT])]
            else: schema.update(findings=[FINDING], residual_risks=[RISK], source_checks=[TEXT])
            if mode == "chunk": schema.update(dimension=TEXT, files=[TEXT])
            if mode == "adjudicate": schema["dropped"] = [TRACE]
            if check(data, schema, "data", errors):
                records({key: data[key] for key in schema}, errors)
                if mode != "chunk" and status == "PASS" and data["history"]["state"] != "COMPLETE": errors.append("data.history.state: PASS requires COMPLETE")
                if mode == "context" and not 1 <= len({d["dimension"] for d in data["dimensions"]}) == len(data["dimensions"]) <= 6: errors.append("data.dimensions: require 1..6 unique ordered dimensions")
    elif mode == "post":
        if check(data, dict(actions=[dict(kind=("REVIEW", "REPLY"), effect=("COMPLETED", "NOT_PERFORMED", "UNCERTAIN"))]), "data", errors):
            if not data["actions"]: errors.append("data.actions: must be nonempty")
            for i, action in enumerate(data["actions"]):
                if action["kind"] == "REPLY": check(action.get("root_id"), POS, f"actions[{i}].root_id", errors)
                if action["effect"] == "COMPLETED": check(action, dict(id=POS, url=TEXT), f"actions[{i}]", errors)
                elif status == "PASS": errors.append(f"actions[{i}]: PASS requires COMPLETED")
    else:
        schema = dict(package_path=TEXT, revision=POS)
        if mode in ("materialize", "update-status"): schema.update(output_file=TEXT, posting_status=POSTING)
        if mode == "verify":
            schema.update(head_sha=SHA, decision=DECISION, publication_ready=BOOL)
            if status == "FAIL": schema.update(issues=[TEXT], repair_owner=("CONTEXT", "CHUNK", "ADJUDICATE", "DRAFT"))
        if check(data, schema, "data", errors) and mode == "verify":
            if status == "FAIL" and not data["issues"]: errors.append("data.issues: FAIL requires issues")
            if status != "PASS" and data["publication_ready"]: errors.append("data.publication_ready: requires PASS")
    return errors

def self_test():
    identity = dict(pr_url="https://github.com/a/b/pull/1", base_sha="a"*40, head_sha="b"*40)
    package = dict(identity, revision=1, decision="APPROVE", summary="No findings.\n", history=dict(state="COMPLETE"), findings=[], source_checks=[], dropped=[], residual_risks=[], create_review=True)
    evidence = dict(identity, usable=True, limitations=[], history=dict(state="COMPLETE", threads=[]), findings=[], dropped=[], residual_risks=[], source_checks=[], dimension="tests", files=[], dimensions=[dict(dimension="tests", files=[])])
    receipt = dict(package_path="/run/review-package.json", revision=1, output_file="review.md", posting_status="DRAFT", head_sha="b"*40, decision="COMMENT", publication_ready=True)
    cases = [("package", json.dumps(package), False)]
    for mode, (token, _) in MODES.items():
        data = evidence if mode in ("context", "chunk", "adjudicate") else dict(actions=[dict(kind="REVIEW", effect="COMPLETED", id=1, url="https://github.com/a/b/pull/1#review-1")]) if mode == "post" else receipt
        cases.extend([(mode, token + ": PASS\n" + json.dumps(dict(reason="", data=data)), False), (mode, token + ": PASS\n" + json.dumps(dict(reason="", data=None)), True)])
    for mode in ("context", "adjudicate"):
        for state in ("PARTIAL", "UNAVAILABLE"):
            data = dict(evidence, history=dict(state=state, limitation="history gap", threads=[]), limitations=["history gap"], completed=["metadata"], uncompleted=["history"])
            for status in ("PASS", "PARTIAL", "TOOLS_MISSING"):
                cases.append((mode, mode.upper() + ": " + status + "\n" + json.dumps(dict(reason="history gap", data=data)), status == "PASS"))
    for mode, patch in (("chunk", dict(history={"note": "extra"})), ("context", dict(findings=[{"note": "extra"}])), ("adjudicate", dict(reason_code="extra"))):
        cases.append((mode, mode.upper() + ": PASS\n" + json.dumps(dict(reason="", data=dict(evidence, **patch))), False))
    for key, value in (("head_sha", "bad"), ("summary", ""), ("history", dict(state="PARTIAL", limitation="page failed")), ("create_review", False), ("residual_risks", [dict(description="gap", blocks_approval=True, blocks_posting=False)])):
        cases.append(("package", json.dumps(dict(package, **{key: value})), True))
    finding = dict.fromkeys("id title location evidence failure_scenario impact minimal_fix body".split(), "x")
    finding.update(severity="important", confidence="high", sources=[], classification="FOLLOW_UP", anchor=None, thread=dict(comment_id=2, root_id=1, resolution="UNKNOWN"))
    follow = dict(package, decision="COMMENT", findings=[finding], create_review=False)
    cases.extend([("package", json.dumps(follow), False), ("package", json.dumps(dict(follow, findings=[finding, dict(finding, id="y")])), True)])
    for patch in (dict(classification="NEW", thread=None, anchor=dict(path="x", line=1, side="RIGHT", body="injection")), dict(thread=None)):
        cases.append(("package", json.dumps(dict(follow, create_review=True, findings=[dict(finding, **patch)])), True))
    cases.extend([("package", "{\"summary\":1,\"summary\":2}", True), ("package", "{\"summary\":NaN}", True)])
    failures = [f"case {i} ({m})" for i, (m, p, bad) in enumerate(cases, 1) if bool(validate(m, p)) != bad]
    print(f"self-test: {len(cases)-len(failures)}/{len(cases)} passed" + ("; " + ", ".join(failures) if failures else ""))
    return 2 if failures else 0
try:
    args = sys.argv[1:]
    if args == ["-h"] or len(args) != 1 or args[0] not in (*MODES, "package", "--self-test"):
        print(HELP)
        for mode, (token, statuses) in MODES.items(): print(mode + ": " + token + ": " + "|".join(statuses))
        sys.exit(0 if args == ["-h"] else 2)
    if args == ["--self-test"]: sys.exit(self_test())
    defects = validate(args[0], sys.stdin.read())
    for defect in defects: print(defect)
    sys.exit(1 if defects else 0)
except Exception as exc:
    print("ERROR: " + type(exc).__name__ + ": " + str(exc).replace("\n", " "), file=sys.stderr)
    sys.exit(2)
' "$@"
