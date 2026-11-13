#!/usr/bin/env python3
"""Validate PR envelopes and canonical approval digests (Python 3 stdlib only).

Usage: python3 -I validate-output.py <digest|verify> <push|scope|preview> < input.json
       python3 -I validate-output.py envelope <specialist> < output.txt
       python3 -I validate-output.py body < body.txt
       python3 -I validate-output.py -h
Environment variables: none. Side effects: none; stdin in, stdout/stderr out.
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
    "repo-state-inspector": ("REPO_STATE", "PASS BLOCKED ERROR", "Execution mode support|Current branch|Target branch|Target branch candidate|PR state|Remotes|Head remote|Base remote|Topology|Topology candidates|Platform|Platform adapter needed|Uncommitted work|Reason|Decision needed"),
    "preflight-validator": ("PREFLIGHT", "PASS PUSH_REQUIRED PUSH_REJECTED PR_EXISTS AUTH BASE_BRANCH_MISSING HEAD_BRANCH_UNPUSHED BLOCKED ERROR", "Platform|Head remote|Base remote|Base branch|Head branch|Head remote state|Base SHA|Head SHA|Existing PR|Push attempted|Push command|Push rejection reason|Approval record|Reason|Decision needed"),
    "diff-analyzer": ("DIFF_ANALYSIS", "PASS LARGE_PR_CONFIRMATION_REQUIRED STALE_PINS EMPTY_DIFF ERROR", "Range|Compared Base SHA|Compared Head SHA|Pinned SHA match|Shortstat|Adjusted changed lines|Changed files|Excluded generated/vendored/lock totals|Scope gate rule fired|Scope approval|Changed paths|Grouped areas|Diff summary|Behavior before|Behavior after|Retained behavior|Type candidates|Scope candidates|Tests|Risk notes|Reason|Decision needed"),
    "pr-drafter": ("PR_DRAFT", "PASS NEEDS_CHOICE ERROR", "Title|Title source|Body source|Template path|Type choice|Scope choice|Traceability notes|Body|Reason|Decision needed"),
    "review-metadata-suggester": ("REVIEW_METADATA", "PASS NEEDS_REVIEWER INVALID_LABELS INVALID_ASSIGNEES AUTH ERROR", "Reviewers|Reviewer source|Normalized reviewers|Solo repository condition|CODEOWNERS source|CODEOWNERS matches|Labels|Label source|Invalid labels|Suggested valid labels|Assignees|Invalid assignees|Reason|Decision needed"),
    "pr-submitter": ("PR_SUBMIT", "PASS CREATED_WITH_DRIFT HEAD_MOVED CREATE_UNCERTAIN BLOCKED CREATE_ERROR AUTH ERROR", "Approval record|Frozen head SHA|Remote head SHA before create|Existing PR race check|Create attempted|Create retry used|URL|Base returned|Head ref returned|Head SHA returned|Title returned|State returned|Reviewers returned|Labels returned|Assignees returned|Body first line returned|Body line count returned|Approved body digest|Returned body digest|Verification|Mismatched fields|Uncertain check commands|Reason|Decision needed"),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def canonical(kind, values):
    require(isinstance(values, dict), "values must be an object")
    fields = {
        "push": "headRemote currentBranch action",
        "scope": "baseSha headSha adjustedChangedLines changedFiles excludedTotals areas rules changedPaths",
        "preview": "baseRemote targetBranch headRemote currentBranch baseSha headSha title body reviewers labels assignees state effectiveState",
    }[kind].split()
    require(set(values) == set(fields), "values must have exactly: " + ", ".join(fields))
    result = dict(values)
    list_fields = {"areas", "rules", "changedPaths", "reviewers", "labels", "assignees"}
    for field, value in result.items():
        if field in list_fields:
            require(isinstance(value, list) and all(isinstance(item, str) and item for item in value), field + " must be a string list")
            require(len(set(value)) == len(value), field + " must not contain duplicates")
            result[field] = sorted(value)
        elif field in ("adjustedChangedLines", "changedFiles"):
            require(type(value) is int and value >= 0, field + " must be a nonnegative integer")
        else:
            require(isinstance(value, str) and value != "", field + " must be a nonempty string")
            if field.endswith("Sha"):
                require(re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", value) is not None, field + " must be a full lowercase SHA")
            if field in ("state", "effectiveState"):
                require(value in ("draft", "ready"), field + " must be draft or ready")
    if kind == "push":
        require(result["action"] == "git push " + result["headRemote"] + " " + result["currentBranch"], "push action differs from target")
    return result


def digests(kind, values):
    values = canonical(kind, values)
    serialized = json.dumps(values, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return {"valuesDigest": sha(serialized), "bodyDigest": sha(values["body"]) if kind == "preview" else "n/a"}


def envelope(specialist, text):
    prefix, statuses, field_text = ENVELOPES[specialist]
    lines = text.splitlines()
    require(bool(lines) and lines[0] in [prefix + ": " + status for status in statuses.split()], "invalid status line")
    if specialist == "pr-drafter":
        body_start = text.find("\nBody:")
        body_end = text.rfind("\nReason:")
        require(body_start >= 0 and body_end > body_start, "missing body boundaries")
        body_start += len("\nBody:")
        require(bool(text[body_start:body_end].strip()), "Body must not be empty")
        # Field-looking body lines remain user content, not envelope fields.
        text = text[:body_start] + " body bytes omitted from shape check" + text[body_end:]
    require(len(re.findall(r"^" + prefix + r":", text, re.M)) == 1, "status must occur exactly once")
    fields = field_text.split("|")
    positions = []
    for field in fields:
        matches = list(re.finditer(r"^" + re.escape(field) + r":(.*)$", text, re.M))
        require(len(matches) == 1, field + " must occur exactly once")
        positions.append(matches[0].start())
    require(positions == sorted(positions), "fields out of order")
    values = {}
    for index, field in enumerate(fields):
        end = positions[index + 1] if index + 1 < len(fields) else len(text)
        value = text[positions[index] + len(field) + 1:end].strip()
        require(bool(value), field + " must not be empty")
        values[field] = value
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
        "Reviewer source": ("user", "CODEOWNERS", "none-confirmed", "none"),
        "Solo repository condition": ("yes", "no", "unknown"),
        "Label source": ("override", "inferred", "none"),
        "Create attempted": ("yes", "no"),
        "Create retry used": ("yes", "no"),
    }
    for field, choices in enums.items():
        if field in values:
            require(values[field] in choices, "invalid " + field)
    if "PR state" in values:
        require(values["PR state"] in ("draft", "ready") or values["PR state"].startswith("invalid: "), "invalid PR state")
    if specialist == "preflight-validator" and status == "PASS":
        for field in ("Base SHA", "Head SHA"):
            require(re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", values[field]) is not None, field + " must be a full SHA")
    for field in ("Adjusted changed lines", "Changed files"):
        if field in values:
            require(re.fullmatch(r"[0-9]+", values[field]) is not None, field + " must be an integer")
    if specialist == "diff-analyzer" and status == "PASS":
        require(values["Pinned SHA match"] == "yes", "PASS requires matching pins")
        require(values["Scope approval"] in ("valid", "n/a"), "PASS requires valid scope approval or n/a")
    if specialist == "pr-submitter":
        require(values["Verification"] in ("pass", "fail", "not-run"), "invalid Verification")
        if status in ("PASS", "CREATED_WITH_DRIFT"):
            require(values["URL"].startswith("https://"), "confirmed PR requires URL")
        if status == "PASS":
            require(values["Verification"] == "pass" and values["Mismatched fields"] == "none", "PASS requires exact verification")
            require(re.fullmatch(r"[0-9a-f]{64}", values["Approved body digest"]) is not None and values["Approved body digest"] == values["Returned body digest"], "PASS requires equal SHA-256 body digests")
        if status == "CREATED_WITH_DRIFT":
            require(values["Verification"] != "pass" and values["Mismatched fields"] != "none", "drift requires mismatches or unreadable fields")
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
    valid = (len(args) == 1 and args[0] == "body") or (len(args) == 2 and ((args[0] in ("digest", "verify") and args[1] in ("push", "scope", "preview")) or (args[0] == "envelope" and args[1] in ENVELOPES)))
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
                print(json.dumps(digests(args[1], payload), sort_keys=True))
            else:
                require(isinstance(payload, dict) and set(payload) == {"values", "approval"}, "verify expects values and approval")
                expected = digests(args[1], payload["values"])
                record = payload["approval"]
                require(isinstance(record, dict) and set(record) == {"valuesDigest", "bodyDigest", "wording", "action"}, "invalid approval record")
                require(all(isinstance(record[key], str) and record[key].strip() for key in ("wording", "action")), "approval needs human wording and action")
                require(all(record[key] == value for key, value in expected.items()), "approval digest mismatch")
                print("valid")
        return 0
    except (ValueError, TypeError, UnicodeError) as error:
        print("invalid: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
