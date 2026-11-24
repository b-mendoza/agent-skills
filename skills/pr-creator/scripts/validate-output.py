#!/usr/bin/env python3
"""Validate PR envelopes and canonical approval digests (Python 3 stdlib only).

Usage: python3 -I validate-output.py <digest|verify> <kind>       (JSON on stdin)
       python3 -I validate-output.py title                        (JSON on stdin)
       python3 -I validate-output.py compare preview              (JSON on stdin)
       python3 -I validate-output.py envelope <specialist>        (block on stdin)
       python3 -I validate-output.py body                         (exact bytes on stdin)
       python3 -I validate-output.py -h
Input always arrives on stdin, from a pipe or a quoted heredoc. Never stage a file to feed it.
Kinds: push, scope, rebase, force-push, preview.
Environment variables: none. Side effects: none; stdin in, stdout/stderr out, no files.
Exit 0: valid/result; 1: invalid input (repair or new approval); 2: usage error.
Smoke: printf '{}' | python3 -I validate-output.py digest preview # exit 1
"""
import hashlib
import json
import re
import sys

USAGE = __doc__
# Exact field order is part of each co-located specialist's output contract.
ENVELOPES = {
    "branch-rebaser": ("REBASE", "REBASED PUSHED CONFLICT LEASE_REJECTED PUSH_REJECTED KEPT DISCARDED BLOCKED ERROR", "Action|Approval record|Head remote|Head branch|Base SHA|Old head SHA|New head SHA|Commits before|Commits after|Patches changed|Conflict paths|Backup ref|Push command|Push extras|Remote head after|Worktree removed|Checkout unchanged|Local branch|Kept ref|Uncommitted changes preserved|Reason|Decision needed"),
    "diff-analyzer": ("DIFF_ANALYSIS", "PASS LARGE_PR_CONFIRMATION_REQUIRED STALE_PINS EMPTY_DIFF ERROR", "Range|Compared Base SHA|Compared Head SHA|Pinned SHA match|Shortstat|Adjusted changed lines|Changed files|Excluded generated/vendored/lock totals|Scope gate rule fired|Scope approval|Scope values|Changed paths|Issue mentions|Issue mentions omitted|Grouped areas|Diff summary|Behavior before|Behavior after|Retained behavior|Type candidates|Scope candidates|Tests|Risk notes|Reason|Decision needed"),
    "issue-reference-resolver": ("ISSUE_REFS", "PASS NEEDS_DECISION INVALID_ISSUES AUTH ERROR", "Repository|Default branch|Target branch|Auto-close|Closes|Related|Candidates|Dropped candidates|Invalid|Warnings|Reason|Decision needed"),
    "pr-drafter": ("PR_DRAFT", "PASS NEEDS_CHOICE ERROR", "Title|Title source|Body source|Template path|Type choice|Scope choice|Traceability notes|Body|Reason|Decision needed"),
    "pr-submitter": ("PR_SUBMIT", "PASS CREATED_WITH_ADDITIONS CREATED_WITH_DRIFT HEAD_MOVED CREATE_UNCERTAIN BLOCKED CREATE_ERROR AUTH ERROR", "Approval record|Frozen head SHA|Remote head SHA before create|Existing PR race check|Create attempted|Create retry used|URL|Base returned|Head ref returned|Head SHA returned|Title returned|State returned|Reviewers returned|Labels returned|Assignees returned|Body first line returned|Body line count returned|Approved body digest|Returned body digest|Outcome|Mismatched fields|Added fields|Closing issues returned|Returned values file|Uncertain check commands|Reason|Decision needed"),
    "preflight-validator": ("PREFLIGHT", "PASS PUSH_REQUIRED PUSH_REJECTED PR_EXISTS AUTH BASE_BRANCH_MISSING HEAD_BRANCH_UNPUSHED BLOCKED ERROR", "Platform|Unsupported fields|Head remote|Base remote|Base repository|Base branch|Head branch|Head remote state|Head source|Local head state|Offer source|Source SHA|Source behind base|Differing pairs|Local-only commits|Published-only commits|Head behind base|Head ahead of base|Base SHA|Head SHA|Existing PR|Push attempted|Push command|Push extras|Push rejection reason|Approval record|Reason|Decision needed"),
    "repo-state-inspector": ("REPO_STATE", "PASS BLOCKED ERROR", "Execution mode support|Current branch|Head branch|Head source|Target branch|Target branch candidate|PR state|Remotes|Head remote|Base remote|Topology|Topology candidates|Platform|Platform adapter needed|Uncommitted work|Reason|Decision needed"),
    "review-metadata-suggester": ("REVIEW_METADATA", "PASS NEEDS_REVIEWER INVALID_LABELS INVALID_ASSIGNEES AUTH ERROR", "Reviewers|Reviewer source|Normalized reviewers|Solo repository condition|CODEOWNERS source|CODEOWNERS matches|Labels|Label source|Invalid labels|Suggested valid labels|Assignees|Invalid assignees|Reason|Decision needed"),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


SCOPE_OBSERVED = "baseSha headSha changedPaths excludedPaths adjustedChangedLines excludedLines"
RESULT = "title body state reviewers labels assignees closes related autoClose unsupported"
SCHEMAS = {
    "push": "headRemote headBranch headSha extras action",
    "scope": SCOPE_OBSERVED + " rules",
    "rebase": "baseRemote targetBranch baseSha headRemote headBranch oldHeadSha sourceSha",
    "force-push": "headRemote headBranch baseSha oldHeadSha newHeadSha source extras action",
    "preview": "repository baseRemote targetBranch headRemote headBranch baseSha headSha effectiveState " + RESULT,
}
OBSERVED = {"scope": SCOPE_OBSERVED}
LISTS = {"excludedPaths", "rules", "changedPaths", "reviewers", "labels", "assignees", "closes", "related", "unsupported"}
REPO = r"[\w.-]+(?:/[\w.-]+)+"
NUMBER = r"[1-9][0-9]*"
REF = rf"(?:https?://[^/\s]+/{REPO}/(?:-/)?issues/{NUMBER}|(?:{REPO})?#{NUMBER})(?![\w-])"
KEYWORD = r"\b(?:clos(?:e[sd]?|ing)|fix(?:es|ed|ing)?|resolv(?:e[sd]?|ing)|implement(?:s|ed|ing)?)\b"
REF_LIST = re.compile(rf"{KEYWORD}(?:\s*:)?\s+(?:issues?\s+)?(?P<refs>{REF}(?:(?:\s*,\s*(?:and\s+)?|\s+and\s+){REF})*)", re.I)


def exact_keys(obj, fields, name):
    require(isinstance(obj, dict), name + " must be an object")
    difference = set(fields.split()) ^ obj.keys()
    require(not difference, name + " missing or unexpected: " + ", ".join(sorted(difference)))


def string_list(field, value):
    require(isinstance(value, list) and all(isinstance(item, str) and item for item in value), field + " must be a string list")
    require(len(set(value)) == len(value), field + " must not contain duplicates")
    return sorted(value)


def validate_extra(item):
    require(isinstance(item, str) and item.strip(), "expected a non-empty push setting")
    require(not re.search(r"[A-Za-z][A-Za-z0-9+.-]*://[^/\s?#@]*@", item), "push setting contains URL credentials")
    require(re.fullmatch(r"[A-Za-z0-9-]+\.(?:[^=\r\n]+\.)?[A-Za-z][A-Za-z0-9-]*=[^\r\n]*", item), "expected one git setting as key=value")


def normalized_fields(values, schema):
    exact_keys(values, schema, "values")
    result = dict(values)
    for key, value in values.items():
        if key == "extras":
            require(isinstance(value, list), "extras must be a list")
            for item in value:
                validate_extra(item)
            result[key] = sorted(value)
        elif key in LISTS:
            result[key] = string_list(key, value)
        elif key in ("adjustedChangedLines", "excludedLines"):
            require(type(value) is int and value >= 0, "invalid " + key)
        else:
            require(isinstance(value, str) and value, key + " must be a string and not empty")
            if key.endswith("Sha"):
                require(re.fullmatch(r"[a-f0-9]{40}|[a-f0-9]{64}", value), key + " must be a full lowercase SHA")
            elif key == "repository":
                require(re.fullmatch(REPO, value), "invalid repository")
            elif key in ("state", "effectiveState"):
                require(value in ("draft", "ready"), "invalid " + key)
    return result


def validate_scope(values):
    paths = values["changedPaths"]
    require(set(values["excludedPaths"]) <= set(paths), "excludedPaths outside changedPaths")
    rules = set(values["rules"])
    measured = {"adjusted-lines>1000": values["adjustedChangedLines"] > 1000, "changed-files>40": len(paths) > 40}
    require(rules and rules <= {*measured, "unrelated-areas>=3"}, "invalid scope rules")
    for rule, fired in measured.items():
        require((rule in rules) == fired, "inconsistent rule " + rule)


def references(text, repository):
    refs = set()
    for match in re.finditer(REF, text, re.I):
        ref = match.group()
        if "://" in ref:
            path = ref.split("://", 1)[1].split("/", 1)[1]
            ref = re.sub(r"/(?:-/)?issues/([0-9]+)$", r"#\1", path, flags=re.I)
        refs.add(repository + ref if ref.startswith("#") else ref)
    return refs


def validate_result(v):
    closes, related = set(v["closes"]), set(v["related"])
    require(all(re.fullmatch(REPO + "#" + NUMBER, ref) for ref in closes | related), "noncanonical issue reference")
    require(not closes & related, "closes and related overlap")
    unsupported = set(v["unsupported"])
    require(unsupported <= {"closes", "assignees", "labels"}, "invalid unsupported field")
    for field in unsupported - {"closes"}:
        require(not v[field], field + " is unsupported")
    mode = v["autoClose"]
    require(mode in (("yes", "no", "unverifiable") if closes else ("none",)), "autoClose inconsistent with closes")
    require(not closes or (mode == "unverifiable") == ("closes" in unsupported), "autoClose inconsistent with unsupported")
    attached = set()
    for match in REF_LIST.finditer(v["body"]):
        attached.update(references(match["refs"], v["repository"]))
    require(attached == closes, "body closing references differ from closes")
    require(related <= references(v["body"], v["repository"]), "body missing related reference")


def canonical(kind, values):
    v = normalized_fields(values, SCHEMAS[kind])
    if kind == "scope":
        validate_scope(v)
    elif kind == "push":
        require(v["action"] == "git push {headRemote} {headBranch}".format(**v), "push action differs from target")
    elif kind == "force-push":
        require(v["source"] in ("rebase", "local-branch"), "invalid force-push source")
        command = "git push --force-with-lease=refs/heads/{headBranch}:{oldHeadSha} {headRemote} {newHeadSha}:refs/heads/{headBranch}"
        require(v["action"] == command.format(**v), "force-push action differs from pinned lease")
        require(v["newHeadSha"] != v["oldHeadSha"], "newHeadSha equals oldHeadSha")
    elif kind == "rebase":
        require(v["baseSha"] != v["sourceSha"], "baseSha equals sourceSha")
    elif kind == "preview":
        validate_result(v)
    return v


def digests(kind, values):
    values = canonical(kind, values)
    serialized = json.dumps(values, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return {"valuesDigest": sha(serialized), "bodyDigest": sha(values["body"]) if kind == "preview" else "n/a"}


def verify(kind, payload):
    exact_keys(payload, "values approval" + (" observed" if kind in OBSERVED else ""), "verify")
    record = payload["approval"]
    exact_keys(record, "kind valuesDigest bodyDigest wording action", "approval")
    require(record["kind"] == kind, "approval kind mismatch")
    require(all(isinstance(record[k], str) and record[k].strip() for k in ("wording", "action")), "approval needs human wording and action")
    require(not re.fullmatch(r"(?:approved\s+)?[0-9a-f]{64}", record["wording"].strip(), re.I), "digest is not approval wording")
    expected = digests(kind, payload["values"])
    require(all(record[key] == expected[key] for key in ("valuesDigest", "bodyDigest")), "approval digest mismatch")
    if kind in ("push", "force-push"):
        require(record["action"] == payload["values"]["action"], "approval action differs from push command")
    if kind in OBSERVED:
        fields = OBSERVED[kind]
        observed = normalized_fields(payload["observed"], fields)
        approved = normalized_fields({k: payload["values"][k] for k in fields.split()}, fields)
        for key in approved:
            require(observed[key] == approved[key], "observed differs: " + key)


TYPE = r"[A-Za-z][A-Za-z0-9-]*"
HEADER = re.compile(rf"(?P<type>{TYPE})(?:\((?P<scope>[^()\s][^()]*?)\))?!?: (?P<subject>\S.*)")
MINOR_WORDS = set("a an and as at but by for in nor of on or the to vs via with".split())
CLAUSES = {"type": rf"{TYPE}(?:\|{TYPE})*", "scope": "required|forbidden|optional",
           "ticket": r"(?:\?|[^\s@;:\[\]()]+)@(?:start|after-colon|end)",
           "case": "title|sentence|lower|any", "max": "[0-9]+"}


def validate_title(payload):
    exact_keys(payload, "convention title", "title input")
    convention, title = payload["convention"], payload["title"]
    require(isinstance(convention, str) and isinstance(title, str), "convention and title must be strings")
    require(title and title == title.strip() and len(title.splitlines()) == 1, "title must be one nonempty trimmed line")
    require(len(title) <= 255, "title exceeds 255 characters")
    if convention == "override":
        return
    clauses = {}
    for clause in convention.split(";") if convention else ():
        name, _, value = clause.strip().partition("=")
        require(name in CLAUSES and name not in clauses and re.fullmatch(CLAUSES[name], value), "invalid clause: " + clause)
        clauses[name] = value
    findings = []
    if "max" in clauses:
        limit = int(clauses["max"])
        require(10 <= limit <= 255, "max must be 10..255")
        if len(title) > limit:
            findings.append("title exceeds max")
    if "ticket" in clauses:
        key, placement = clauses["ticket"].split("@")
        if key == "?" or title.count(key) != 1:
            findings.append("ticket key missing" if key == "?" or key not in title else "ticket key repeated")
        elif placement == "start" and title.startswith(key + " "):
            title = title[len(key) + 1:]
        elif placement == "end" and title.endswith(" (" + key + ")") and title[:-len(key)-3] == title[:-len(key)-3].rstrip():
            title = title[:-len(key)-3]
        elif placement == "after-colon" and (m := HEADER.fullmatch(title)) and m["subject"].startswith(key + " "):
            title = title[:m.start("subject")] + m["subject"][len(key)+1:]
        else:
            raise ValueError("incorrect ticket placement")
    match = HEADER.fullmatch(title)
    if not match:
        findings.append("expected conventional commit title")
    else:
        if "type" in clauses and match["type"] not in clauses["type"].split("|"):
            findings.append("invalid type")
        scope = clauses.get("scope")
        if (scope == "required" and not match["scope"]) or (scope == "forbidden" and match["scope"]):
            findings.append("invalid scope")
        subject, case = match["subject"], clauses.get("case")
        words = subject.split()
        if case == "title" and not all(word[0].isupper() or re.search(r"[\d_./`]", word) or
                                       (0 < i < len(words)-1 and word in MINOR_WORDS) for i, word in enumerate(words)):
            findings.append("expected title case")
        if case == "sentence" and not subject[0].isupper():
            findings.append("expected sentence case")
        if case == "lower" and subject != subject.lower():
            findings.append("expected lower case")
    require(not findings, "; ".join(findings))


def compare(kind, payload):
    exact_keys(payload, "values returned", "compare")
    v = canonical(kind, payload["values"])
    returned = payload["returned"]
    exact_keys(returned, "baseRef headRef headSha title body state reviewers labels assignees closes", "returned")
    expected = dict(v)
    expected.update(baseRef=v["targetBranch"], headRef=v["headBranch"], state=v["effectiveState"])
    if v["autoClose"] != "yes":
        expected["closes"] = []
    fields, extras = {}, {}
    for key, actual in returned.items():
        if key in v["unsupported"]:
            fields[key] = "unsupported" if actual is None else "changed"
        elif actual is None:
            fields[key] = "unreadable"
        elif key in LISTS:
            members = set(string_list(key, actual))
            approved = set(expected[key])
            if members == approved:
                fields[key] = "exact"
            elif key != "closes" and members > approved:
                fields[key] = "added"
                extras[key] = sorted(members - approved)
            else:
                fields[key] = "changed"
        else:
            require(isinstance(actual, str), "invalid returned " + key)
            if actual == expected[key]:
                fields[key] = "exact"
            elif key == "body" and actual.startswith(v[key]):
                fields[key] = "appended"
                extras[key] = actual[len(v[key]):]
            else:
                fields[key] = "changed"
    statuses = set(fields.values())
    outcome = "drift" if statuses & {"changed", "unreadable"} else "additions" if extras else "exact"
    return {"outcome": outcome, "fields": fields, "extras": extras, "notCompared": v["unsupported"],
            "approvedBodyDigest": sha(v["body"]), "returnedBodyDigest": None if returned["body"] is None else sha(returned["body"])}


def count(field, v):
    require(re.fullmatch(r"[0-9]+", v[field]), field + " must be a nonnegative integer")
    return int(v[field])


def full_sha(field, v):
    require(re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", v[field]), field + " must be a full SHA")


def https_url(value):
    return re.fullmatch(r"https://[^\s/]+(?:/\S*)?", value) is not None


def equal_body_digests(v):
    digest = v["Approved body digest"]
    require(re.fullmatch(r"[0-9a-f]{64}", digest) and digest == v["Returned body digest"], "expected equal SHA-256 body digests")


def comma_list(value):
    return [] if value == "none" else string_list("comma list", [item.strip() for item in value.split(",")])


def approved(v):
    require(v["Approval record"] == "valid", "expected Approval record: valid")



FULL_SHA = r"(?:[0-9a-f]{40}|[0-9a-f]{64})"


def validate_offer(status, v):
    required = status in ("PASS", "PR_EXISTS")
    if required or v["Source SHA"] != "unavailable":
        full_sha("Source SHA", v)
    if required or v["Source behind base"] != "unavailable":
        count("Source behind base", v)
    for field in ("Differing pairs", "Local-only commits", "Published-only commits"):
        if v[field] == "none":
            continue
        rows = v[field].splitlines()
        ids = FULL_SHA + (" ! " + FULL_SHA if field == "Differing pairs" else "")
        require(len(rows) <= 20 and all(re.fullmatch(rf'- {ids} ".*"', row) for row in rows), "invalid " + field)
        require(v["Offer source"] != "published", "published source requires empty commit lists")
    if v["Offer source"] == "local":
        require(v["Head remote state"] == "diverged", "local offer requires diverged head")
        require(v["Published-only commits"] == "none", "local offer forbids published-only commits")
    elif v["Offer source"] == "none":
        require(v["Reason"].casefold() not in ("none", "n/a", "unavailable"), "withheld offer requires a reason")


def preflight_envelope(status, v):
    validate_offer(status, v)
    if v["Push attempted"] == "yes":
        approved(v)
    repository = v["Base repository"]
    require(re.fullmatch(REPO, repository) or (repository == "unavailable" and status not in ("PASS", "PR_EXISTS")), "invalid Base repository")
    require(set(comma_list(v["Unsupported fields"])) <= {"assignees", "labels", "closes"}, "invalid Unsupported fields")
    if status == "PASS":
        for field in ("Base SHA", "Head SHA"):
            full_sha(field, v)
        for field in ("Head behind base", "Head ahead of base"):
            count(field, v)
        require(v["Existing PR"] == "none", "PASS requires no existing PR")
    elif status == "PR_EXISTS":
        require(https_url(v["Existing PR"]), "PR_EXISTS requires an HTTPS URL")
    elif status == "PUSH_REQUIRED":
        full_sha("Head SHA", v)
        require(v["Head source"] == "checkout", "PUSH_REQUIRED requires checkout")


def analyzer_envelope(status, v):
    mentions = comma_list(v["Issue mentions"])
    refs = set()
    for item in mentions:
        match = re.fullmatch(rf"((?:{REPO})?#{NUMBER}) \((?:branch|commit [0-9a-fA-F]{{7,40}})\)", item)
        require(match and match[1] not in refs, "invalid or duplicate Issue mentions item")
        refs.add(match[1])
    require(len(mentions) <= 20, "too many Issue mentions")
    require(count("Issue mentions omitted", v) == 0 or len(mentions) == 20, "omitted count requires 20 mentions")
    for field in ("Behavior before", "Behavior after"):
        for item in v[field].splitlines():
            require(re.fullmatch(r"(?:- )?(?:B[1-9][0-9]*: \S.*|unknown|n/a)", item), field + " fact needs a Bn: id")
    lines, files = count("Adjusted changed lines", v), count("Changed files", v)
    rules = comma_list(v["Scope gate rule fired"])
    approval = v["Scope approval"]
    if rules:
        require(len(v["Scope values"].splitlines()) == 1, "Scope values must be one JSON line")
        scope = canonical("scope", json.loads(v["Scope values"], object_pairs_hook=unique_object))
        require(scope["rules"] == rules, "Scope values rules differ")
        require(scope["adjustedChangedLines"] == lines and len(scope["changedPaths"]) == files, "Scope values counts differ")
        totals = v["Excluded generated/vendored/lock totals"]
        excluded = (0, 0)
        if totals != "none":
            match = re.fullmatch(r"([0-9]+) files?, ([0-9]+) lines?", totals)
            require(match, "invalid excluded totals")
            excluded = tuple(map(int, match.groups()))
        require(excluded == (len(scope["excludedPaths"]), scope["excludedLines"]), "Scope values excluded totals differ")
        require(scope["baseSha"] == v["Compared Base SHA"] and scope["headSha"] == v["Compared Head SHA"], "Scope values pins differ")
        if status == "PASS":
            require(approval == "valid", "fired rule requires valid approval")
        elif status == "LARGE_PR_CONFIRMATION_REQUIRED":
            require(approval in ("missing", "digest-mismatch"), "confirmation requires a missing or stale record")
    else:
        require(v["Scope values"] == "n/a", "Scope values require a fired rule")
        require(status != "LARGE_PR_CONFIRMATION_REQUIRED", "confirmation requires a fired rule")
        if status == "PASS":
            require(lines <= 1000 and files <= 40, "scope threshold exceeded without a fired rule")
            require(approval == "n/a", "no fired rule requires approval n/a")
    if status == "PASS":
        require(v["Pinned SHA match"] == "yes", "PASS requires matching pins")


def metadata_envelope(status, v):
    for field, invalid_status in (("Invalid labels", "INVALID_LABELS"), ("Invalid assignees", "INVALID_ASSIGNEES")):
        if status == "PASS":
            require(v[field] == "none", "PASS requires " + field + ": none")
        elif status == invalid_status:
            require(v[field] not in ("none", "n/a"), invalid_status + " requires " + field)


def submit_envelope(status, v):
    if v["Create attempted"] == "yes":
        approved(v)
    created = {"PASS": "exact", "CREATED_WITH_ADDITIONS": "additions", "CREATED_WITH_DRIFT": "drift"}
    if status not in created:
        require(v["URL"] == "unavailable", status + " requires URL: unavailable")
        return
    require(https_url(v["URL"]), "confirmed PR requires an HTTPS URL")
    require(v["Outcome"] == created[status], "Outcome differs from status")
    if status == "CREATED_WITH_DRIFT":
        require(v["Mismatched fields"] not in ("none", "n/a"), "drift requires mismatched fields")
    else:
        require(v["Mismatched fields"] == "none", "unexpected mismatched fields")
        if status == "PASS":
            require(v["Added fields"] == "none", "PASS forbids additions")
            equal_body_digests(v)
        else:
            require(v["Added fields"] not in ("none", "n/a"), "additions require added fields")


def valid_ref(ref):
    return (ref.startswith("refs/") and not re.search(r"[\x00-\x20\x7f~^:?*\[\\]|\.\.|@\{", ref)
            and not ref.endswith(".") and all(part and not part.startswith(".") and not part.endswith(".lock") for part in ref.split("/")))


def rebase_envelope(status, v):
    kept = v["Kept ref"]
    require(kept == "n/a" or valid_ref(kept), "invalid Kept ref")
    if status in ("KEPT", "DISCARDED"):
        require(v["Approval record"] == v["Backup ref"] == "n/a", status + " requires no approval or backup")
        if status == "KEPT":
            require(v["Action"] == "keep", "KEPT requires keep action")
            if v["Local branch"] == "unchanged":
                require(re.fullmatch(r"refs/pr-creator/[^/]+/rebased", kept), "expected run's rebased ref")
            else:
                require(v["Local branch"] in ("moved", "created") and kept.startswith("refs/heads/")
                        and v["Uncommitted changes preserved"] != "no", "invalid kept branch evidence")
        else:
            require(v["Action"] == "discard" and kept == "n/a" and v["Checkout unchanged"] == "yes"
                    and v["Local branch"] in ("unchanged", "n/a"), "invalid discard evidence")
    if status in ("REBASED", "PUSHED", "CONFLICT", "LEASE_REJECTED", "PUSH_REJECTED"):
        approved(v)
    if status == "LEASE_REJECTED":
        require(v["Backup ref"] == "n/a", "LEASE_REJECTED requires Backup ref: n/a")
    if status in ("LEASE_REJECTED", "PUSH_REJECTED"):
        require(v["Action"] == "push", status + " requires push action")
    require(v["Action"] in ("rebase", "push", "keep", "discard"), "invalid rebase Action")
    if status in ("REBASED", "CONFLICT"):
        require(v["Action"] == "rebase", status + " requires rebase action")
        require(v["Checkout unchanged"] == v["Worktree removed"] == "yes", status + " requires cleanup and unchanged checkout")
    if status == "REBASED":
        for field in ("Base SHA", "Old head SHA", "New head SHA"):
            full_sha(field, v)
        require(v["Old head SHA"] != v["New head SHA"], "rebased head must change")
    elif status == "CONFLICT":
        require(v["Conflict paths"] not in ("none", "n/a"), "CONFLICT requires conflict paths")
    elif status == "PUSHED":
        full_sha("New head SHA", v)
        require(v["Action"] == "push" and v["Remote head after"] == v["New head SHA"], "PUSHED requires new remote head")
        require(re.fullmatch(r"refs/pr-creator/backup/[^\s/]+(?:/[^\s/]+)*", v["Backup ref"]) and ".." not in v["Backup ref"], "invalid Backup ref")


def resolver_envelope(status, v):
    if status == "PASS":
        require(v["Candidates"] == v["Invalid"] == "none", "PASS requires Candidates: none and Invalid: none")
    elif status == "INVALID_ISSUES":
        require(v["Invalid"] != "none", "INVALID_ISSUES requires invalid references")


def envelope(specialist, text):
    prefix, statuses, field_text = ENVELOPES[specialist]
    lines = text.splitlines()
    require(bool(lines) and lines[0] in [prefix + ": " + status for status in statuses.split()], "invalid status line")
    if specialist == "pr-drafter":
        body_start = text.find("\nBody:")
        body_end = text.rfind("\nReason:")
        require(body_start >= 0 and body_end > body_start, "missing body boundaries")
        body_start += len("\nBody:")
        body_marker = "body bytes omitted" if text[body_start:body_end].strip() else ""
        # Field-looking body lines remain user content, not envelope fields.
        text = text[:body_start] + body_marker + text[body_end:]
    fields = field_text.split("|")
    expected = [prefix, *fields]
    labels = "|".join(map(re.escape, expected))
    headers = list(re.finditer(r"^(" + labels + r"):", text, re.M))
    require([header[1] for header in headers] == expected, "missing, duplicated or out-of-order envelope field")
    values = {}
    for index, header in enumerate(headers[1:], 2):
        end = headers[index].start() if index < len(headers) else len(text)
        value = text[header.end():end].strip()
        require(value, header[1] + " must not be empty")
        values[header[1]] = value
    status = lines[0].split(": ")[1]
    enums = {
        "Execution mode support": ("dispatch-compatible", "inline-compatible"),
        "Topology": ("same-remote", "fork", "ambiguous"),
        "Platform": ("github", "github-enterprise", "gitlab", "bitbucket", "unknown"),
        "Platform adapter needed": ("yes", "no"),
        "Head remote state": ("up-to-date", "missing", "local-ahead", "diverged", "unknown"),
        "Offer source": ("published", "local", "none"),
        "Local branch": ("moved", "created", "unchanged", "n/a"),
        "Uncommitted changes preserved": ("yes", "no", "n/a"),
        "Push attempted": ("yes", "no"),
        "Push rejection reason": ("diverged", "protected branch", "permission", "other", "n/a"),
        "Approval record": ("valid", "missing", "digest-mismatch", "n/a"),
        "Pinned SHA match": ("yes", "no"),
        "Scope approval": ("valid", "missing", "digest-mismatch", "n/a"),
        "Title source": ("override", "generated"),
        "Body source": ("override", "template", "generated"),
        "Head source": ("checkout", "remote"),
        "Auto-close": ("yes", "no", "unverifiable", "none"),
        "Outcome": ("exact", "additions", "drift", "n/a"),
        "Reviewer source": ("user", "CODEOWNERS", "none-confirmed", "none"),
        "Solo repository condition": ("yes", "no", "unknown"),
        "Label source": ("override", "inferred", "none"),
        "Create attempted": ("yes", "no"),
        "Create retry used": ("yes", "no"),
    }
    for field, choices in enums.items():
        if field in values:
            require(values[field] in choices, "invalid " + field)
    if "Push extras" in values and values["Push extras"] != "none":
        for item in values["Push extras"].split("; "):
            require(len(item.splitlines()) == 1 and item != "none", "invalid Push extras")
            validate_extra(item)
    if specialist == "repo-state-inspector":
        require(values["PR state"] in ("draft", "ready") or values["PR state"].startswith("invalid: "), "invalid PR state")
    checks = {"issue-reference-resolver": resolver_envelope, "preflight-validator": preflight_envelope, "diff-analyzer": analyzer_envelope,
              "review-metadata-suggester": metadata_envelope, "pr-submitter": submit_envelope,
              "branch-rebaser": rebase_envelope}
    if specialist in checks:
        checks[specialist](status, values)
    print("valid")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate JSON key: " + key)
        result[key] = value
    return result


def main():
    args = sys.argv[1:]
    if args in (["-h"], ["--help"]):
        print(USAGE)
        return 0
    modes = {"digest": SCHEMAS, "verify": SCHEMAS, "envelope": ENVELOPES, "compare": ("preview",)}
    valid = (len(args) == 1 and args[0] in ("body", "title")) or (len(args) == 2 and args[1] in modes.get(args[0], ()))
    if not valid:
        print(USAGE, file=sys.stderr)
        return 2
    try:
        # Read bytes and decode explicitly: never apply universal-newline conversion.
        text = sys.stdin.buffer.read().decode("utf-8")
        if args[0] == "body":
            print(sha(text))
        elif args[0] == "envelope":
            envelope(args[1], text)
        else:
            payload = json.loads(text, object_pairs_hook=unique_object)
            if args[0] == "digest":
                print(json.dumps({"kind": args[1], **digests(args[1], payload)}, sort_keys=True))
            elif args[0] == "compare":
                print(json.dumps(compare(args[1], payload), sort_keys=True))
            else:
                if args[0] == "title":
                    validate_title(payload)
                else:
                    verify(args[1], payload)
                print("valid")
        return 0
    except (ValueError, TypeError, UnicodeError) as error:
        print("invalid: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
