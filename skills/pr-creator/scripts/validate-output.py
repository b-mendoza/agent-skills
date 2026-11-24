#!/usr/bin/env python3
"""Validate PR envelopes and canonical approval digests (Python 3 stdlib only).

Usage: python3 -I validate-output.py <digest|verify> <kind>       (JSON on stdin)
       python3 -I validate-output.py envelope <specialist>        (block on stdin)
       python3 -I validate-output.py body                         (exact bytes on stdin)
       python3 -I validate-output.py -h
Input always arrives on stdin, from a pipe or a quoted heredoc. Never stage a file to feed it.
Kinds: push, scope, preview.
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
    "repo-state-inspector": ("REPO_STATE", "PASS BLOCKED ERROR", "Execution mode support|Current branch|Head branch|Head source|Target branch|Target branch candidate|PR state|Remotes|Head remote|Base remote|Topology|Topology candidates|Platform|Platform adapter needed|Uncommitted work|Reason|Decision needed"),
    "preflight-validator": ("PREFLIGHT", "PASS PUSH_REQUIRED PUSH_REJECTED PR_EXISTS AUTH BASE_BRANCH_MISSING HEAD_BRANCH_UNPUSHED BLOCKED ERROR", "Platform|Head remote|Base remote|Base branch|Head branch|Head remote state|Head source|Local head state|Base SHA|Head SHA|Existing PR|Push attempted|Push command|Push extras|Push rejection reason|Approval record|Reason|Decision needed"),
    "diff-analyzer": ("DIFF_ANALYSIS", "PASS LARGE_PR_CONFIRMATION_REQUIRED STALE_PINS EMPTY_DIFF ERROR", "Range|Compared Base SHA|Compared Head SHA|Pinned SHA match|Shortstat|Adjusted changed lines|Changed files|Excluded generated/vendored/lock totals|Scope gate rule fired|Scope approval|Scope values|Changed paths|Grouped areas|Diff summary|Behavior before|Behavior after|Retained behavior|Type candidates|Scope candidates|Tests|Risk notes|Reason|Decision needed"),
    "pr-drafter": ("PR_DRAFT", "PASS NEEDS_CHOICE ERROR", "Title|Title source|Body source|Template path|Type choice|Scope choice|Traceability notes|Body|Reason|Decision needed"),
    "review-metadata-suggester": ("REVIEW_METADATA", "PASS NEEDS_REVIEWER INVALID_LABELS INVALID_ASSIGNEES AUTH ERROR", "Reviewers|Reviewer source|Normalized reviewers|Solo repository condition|CODEOWNERS source|CODEOWNERS matches|Labels|Label source|Invalid labels|Suggested valid labels|Assignees|Invalid assignees|Reason|Decision needed"),
    "pr-submitter": ("PR_SUBMIT", "PASS CREATED_WITH_DRIFT HEAD_MOVED CREATE_UNCERTAIN BLOCKED CREATE_ERROR AUTH ERROR", "Approval record|Frozen head SHA|Remote head SHA before create|Existing PR race check|Create attempted|Create retry used|URL|Base returned|Head ref returned|Head SHA returned|Title returned|State returned|Reviewers returned|Labels returned|Assignees returned|Body first line returned|Body line count returned|Approved body digest|Returned body digest|Verification|Mismatched fields|Uncertain check commands|Reason|Decision needed"),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


SCOPE_OBSERVED = "baseSha headSha changedPaths excludedPaths adjustedChangedLines excludedLines"
SCHEMAS = {
    "push": "headRemote headBranch headSha extras action",
    "scope": SCOPE_OBSERVED + " rules",
    "preview": "baseRemote targetBranch headRemote headBranch baseSha headSha title body reviewers labels assignees state effectiveState",
}
OBSERVED = {"scope": SCOPE_OBSERVED}
LISTS = {"excludedPaths", "rules", "changedPaths", "reviewers", "labels", "assignees"}


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


def canonical(kind, values):
    v = normalized_fields(values, SCHEMAS[kind])
    if kind == "scope":
        validate_scope(v)
    elif kind == "push":
        require(v["action"] == "git push {headRemote} {headBranch}".format(**v), "push action differs from target")
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
    if kind == "push":
        require(record["action"] == payload["values"]["action"], "approval action differs from push command")
    if kind in OBSERVED:
        fields = OBSERVED[kind]
        observed = normalized_fields(payload["observed"], fields)
        approved = normalized_fields({k: payload["values"][k] for k in fields.split()}, fields)
        for key in approved:
            require(observed[key] == approved[key], "observed differs: " + key)


def count(field, v):
    require(re.fullmatch(r"[0-9]+", v[field]), field + " must be a nonnegative integer")
    return int(v[field])


def full_sha(field, v):
    require(re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", v[field]), field + " must be a full SHA")


def equal_body_digests(v):
    digest = v["Approved body digest"]
    require(re.fullmatch(r"[0-9a-f]{64}", digest) and digest == v["Returned body digest"], "expected equal SHA-256 body digests")


def comma_list(value):
    return [] if value == "none" else string_list("comma list", [item.strip() for item in value.split(",")])


def approved(v):
    require(v["Approval record"] == "valid", "expected Approval record: valid")


def preflight_envelope(status, v):
    if v["Push attempted"] == "yes":
        approved(v)
    if status == "PASS":
        for field in ("Base SHA", "Head SHA"):
            full_sha(field, v)
    elif status == "PUSH_REQUIRED":
        full_sha("Head SHA", v)
        require(v["Head source"] == "checkout", "PUSH_REQUIRED requires checkout")


def analyzer_envelope(status, v):
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


def submit_envelope(status, v):
    if v["Create attempted"] == "yes":
        approved(v)
    require(v["Verification"] in ("pass", "fail", "not-run"), "invalid Verification")
    if status in ("PASS", "CREATED_WITH_DRIFT"):
        require(v["URL"].startswith("https://"), "confirmed PR requires URL")
    if status == "PASS":
        require(v["Verification"] == "pass" and v["Mismatched fields"] == "none", "PASS requires exact verification")
        equal_body_digests(v)
    if status == "CREATED_WITH_DRIFT":
        require(v["Verification"] != "pass" and v["Mismatched fields"] != "none", "drift requires mismatches or unreadable fields")


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
        "Push attempted": ("yes", "no"),
        "Push rejection reason": ("diverged", "protected branch", "permission", "other", "n/a"),
        "Approval record": ("valid", "missing", "digest-mismatch", "n/a"),
        "Pinned SHA match": ("yes", "no"),
        "Scope approval": ("valid", "missing", "digest-mismatch", "n/a"),
        "Title source": ("override", "generated"),
        "Body source": ("override", "template", "generated"),
        "Head source": ("checkout", "remote"),
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
    checks = {"preflight-validator": preflight_envelope, "diff-analyzer": analyzer_envelope, "pr-submitter": submit_envelope}
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
    modes = {"digest": SCHEMAS, "verify": SCHEMAS, "envelope": ENVELOPES}
    valid = (len(args) == 1 and args[0] == "body") or (len(args) == 2 and args[1] in modes.get(args[0], ()))
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
            else:
                verify(args[1], payload)
                print("valid")
        return 0
    except (ValueError, TypeError, UnicodeError) as error:
        print("invalid: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
