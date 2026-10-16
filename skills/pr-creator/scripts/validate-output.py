#!/usr/bin/env python3
# Proves JSON shape, canonical artifact/body digests, and approved-value preservation.
# Does not prove evidence truth, account existence, prose quality, or user consent.
# Usage: python3 -I validate-output.py ROLE < payload.json
#        python3 -I validate-output.py pr-submitter --approved-preview PATH < receipt.json
#        python3 -I validate-output.py {preview-approval|push-approval} < artifact.json
#        python3 -I validate-output.py --self-test | -h
# ROLE: repo-state-inspector, preflight-validator, diff-analyzer, pr-drafter,
#       review-metadata-suggester; pr-submitter always requires the preview path.
# Exit 0 conforms (including domain GAPS_FOUND); 1 shape findings, one per line;
#      2 bad invocation or checker failure. Missing Python is caller TOOLS_MISSING.
# Side effects: none. Reads stdin and only the explicit approved-preview file.
# No environment-variable configuration, network, Git, clock, randomness, or writes.

import argparse
import hashlib
import json
import re
import sys
from urllib.parse import urlsplit


PLATFORMS = {"github", "github-enterprise", "gitlab", "bitbucket"}
STATES = {"draft", "ready"}
TEXTS = ["text"]
METADATA = ("reviewers", "labels", "assignees")
COMMON = {"status": "text", "reason": "text", "decision_needed": ("text", None)}
APPROVAL = {
    "checkpoint": {"push", "preview"}, "run_id": "run-id",
    "artifact_digest": "digest", "user_approval_ref": "text",
}
PREVIEW = {
    "run_id": "run-id", "action": {"create"}, "platform": PLATFORMS,
    "create_plan": "text", "base_repository": "text", "head_repository": "text",
    "base_remote": "text", "head_remote": "text", "base_branch": "text",
    "head_branch": "text", "base_sha": "sha", "head_sha": "sha",
    "title": "nonempty", "body": "nonempty", "reviewers": TEXTS,
    "labels": TEXTS, "assignees": TEXTS, "requested_state": STATES,
    "effective_state": STATES,
}
PUSH = {
    "run_id": "run-id", "action": {"push"}, "head_repository": "text",
    "head_remote": "text", "source_sha": "sha", "destination_branch": "text",
    "refspec": "text",
}
TEMPLATE = {
    "kind": {"repository", "local"}, "repository": ("text", None),
    "revision": ("sha", None), "path": "text",
}
RETURNED = {
    "title": ("string", None), "base": ("string", None),
    "head_ref": ("string", None), "head_sha": ("sha", None),
    "state": ("text", None), "reviewers": (TEXTS, None),
    "labels": (TEXTS, None), "assignees": (TEXTS, None), "body": ("string", None),
}
SCOPE_RULES = {"adjusted-lines>1000", "changed-files>40", "unrelated-areas>=3"}
SCHEMAS = {
    "repo-state-inspector": {
        "current_branch": ("text", None), "target_branch": ("text", None),
        "target_branch_candidate": ("text", None), "requested_state": STATES,
        "remotes": [{"name": "text", "url": "text", "platform": PLATFORMS | {"unknown"}}],
        "head_remote": ("text", None), "base_remote": ("text", None),
        "head_repository": ("text", None), "base_repository": ("text", None),
        "topology": {"same-remote", "fork", "ambiguous"},
        "topology_candidates": [{"head_remote": "text", "base_remote": "text"}],
        "platform": PLATFORMS | {"unknown"}, "platform_adapter_needed": "bool",
        "safe_create_path": ("text", None),
        "requested_state_support": {"supported", "unsupported", "unknown"},
        "uncommitted_work": "text",
    },
    "preflight-validator": {
        "head_remote": ("text", None), "base_remote": ("text", None),
        "base_branch": ("text", None), "head_branch": ("text", None),
        "head_remote_state": {"up-to-date", "missing", "local-ahead", "diverged", "unknown"},
        "base_sha": ("sha", None), "head_sha": ("sha", None),
        "existing_pr": ("url", None), "push_attempted": "bool",
        "push": (PUSH, None), "approval_record": (APPROVAL, None),
        "push_rejection_reason": ("text", None),
    },
    "diff-analyzer": {
        "range": "text", "base_sha": "sha", "head_sha": "sha",
        "pinned_sha_match": "bool",
        "shortstat": {"files": "count", "insertions": "count", "deletions": "count"},
        "adjusted_changed_lines": "count", "changed_files": "count",
        "excluded_totals": {"files": "count", "lines": "count"},
        "scope_gate_rules": [SCOPE_RULES], "changed_paths": TEXTS,
        "grouped_areas": [{"area": "text", "paths": TEXTS}],
        "diff_summary": TEXTS,
        "type_candidates": [{"value": "text", "rationale": "text"}],
        "scope_candidates": [{"value": "text", "rationale": "text"}],
        "tests": TEXTS, "risk_notes": TEXTS,
    },
    "pr-drafter": {
        "title": ("nonempty", None), "body": ("nonempty", None),
        "title_source": {"override", "title-rules", "repository-rule", "fallback"},
        "title_rule": ("text", None), "title_rule_source": ("text", None),
        "body_source": {"override", "repository-template", "local-template", "settings-template", "fallback"},
        "template_source": ("source", None), "type_choice": ("text", None),
        "scope_choice": ("text", None), "traceability_notes": TEXTS,
        "choices": [{"type", "scope", "title-rule", "template"}],
        "source_candidates": [{"choice": {"title-rule", "template"}, "source": "source"}],
    },
    "review-metadata-suggester": {
        "reviewers": (TEXTS, None), "labels": (TEXTS, None), "assignees": (TEXTS, None),
        "reviewer_source": {"user", "CODEOWNERS", "none-confirmed", "none"},
        "solo_repository": ("bool", None), "codeowners_source": ("text", None),
        "codeowners_matches": [{"pattern": "text", "owners": TEXTS}],
        "label_source": {"override", "inferred", "none"},
        "invalid_labels": TEXTS, "suggested_valid_labels": TEXTS,
        "assignee_source": {"user", "none"},
        "assignment_support": {"supported", "unsupported", "unknown"},
        "invalid_assignees": TEXTS,
    },
    "pr-submitter": {
        "approval_record": (APPROVAL, None), "remote_head_sha": ("sha", None),
        "create_attempted": "bool", "create_retry_used": "bool",
        "outcome": {"created", "found"}, "url": ("url", None), "returned": RETURNED,
        "uncertain_check_commands": TEXTS,
    },
}
STATUSES = {
    "repo-state-inspector": {"PASS", "BLOCKED", "ERROR", "TOOLS_MISSING"},
    "preflight-validator": {
        "PASS", "PUSH_REQUIRED", "PUSH_REJECTED", "PR_EXISTS", "AUTH",
        "BASE_BRANCH_MISSING", "HEAD_BRANCH_UNPUSHED", "BLOCKED", "ERROR", "TOOLS_MISSING",
    },
    "diff-analyzer": {"PASS", "LARGE_PR_CONFIRMATION_REQUIRED", "EMPTY_DIFF", "ERROR", "TOOLS_MISSING"},
    "pr-drafter": {"PASS", "NEEDS_CHOICE", "ERROR", "TOOLS_MISSING"},
    "review-metadata-suggester": {
        "PASS", "NEEDS_REVIEWER", "INVALID_LABELS", "AUTH", "BLOCKED", "ERROR", "TOOLS_MISSING",
    },
    "pr-submitter": {
        "PASS", "GAPS_FOUND", "HEAD_MOVED", "CREATE_UNCERTAIN", "BLOCKED",
        "CREATE_ERROR", "AUTH", "ERROR", "TOOLS_MISSING",
    },
}
REQUIRED = {
    "repo-state-inspector": {"PASS": tuple(SCHEMAS["repo-state-inspector"])},
    "preflight-validator": {
        "PASS": tuple(SCHEMAS["preflight-validator"]),
        "PUSH_REQUIRED": ("push", "push_attempted", "approval_record"),
        "PUSH_REJECTED": ("push", "push_attempted", "approval_record", "push_rejection_reason"),
        "PR_EXISTS": ("existing_pr",),
    },
    "diff-analyzer": dict.fromkeys(
        ("PASS", "LARGE_PR_CONFIRMATION_REQUIRED", "EMPTY_DIFF"), tuple(SCHEMAS["diff-analyzer"])
    ),
    "pr-drafter": {"PASS": tuple(SCHEMAS["pr-drafter"]), "NEEDS_CHOICE": ("choices", "source_candidates")},
    "review-metadata-suggester": {
        "PASS": tuple(SCHEMAS["review-metadata-suggester"]),
        "INVALID_LABELS": ("invalid_labels", "suggested_valid_labels"),
        "BLOCKED": ("assignees", "invalid_assignees", "assignment_support"),
    },
    "pr-submitter": {
        "PASS": ("approval_record", "remote_head_sha", "create_attempted", "create_retry_used", "outcome", "url", "returned"),
        "GAPS_FOUND": ("approval_record", "remote_head_sha", "create_attempted", "create_retry_used", "outcome", "url", "returned"),
        "HEAD_MOVED": ("approval_record", "remote_head_sha", "create_attempted"),
        "CREATE_UNCERTAIN": ("create_attempted", "create_retry_used", "uncertain_check_commands"),
        "CREATE_ERROR": ("create_attempted", "create_retry_used"),
    },
}


def check(value, spec, path, findings, required=None):
    if spec == "source":
        if isinstance(value, dict) and value.get("kind") == "settings":
            check(value, {"kind": {"settings"}, "project": "text", "setting": "text"}, path, findings)
        else:
            count = len(findings)
            check(value, TEMPLATE, path, findings)
            if len(findings) == count:
                if value["kind"] == "repository":
                    for key in ("repository", "revision"):
                        if value[key] is None:
                            findings.append(f"{path}.{key}: required for repository source")
                elif value["repository"] is not None or value["revision"] is not None:
                    findings.append(f"{path}: local source requires null repository/revision")
        return
    if isinstance(spec, tuple):
        if value is not None:
            check(value, spec[0], path, findings)
        return
    if isinstance(spec, dict):
        if not isinstance(value, dict):
            findings.append(f"{path}: expected object")
            return
        for key in sorted(set(value) - set(spec)):
            findings.append(f"{path}[{key!r}]: unknown key")
        for key in sorted(set(spec if required is None else required) - set(value)):
            findings.append(f"{path}.{key}: required")
        for key in sorted(spec.keys() & value.keys()):
            check(value[key], spec[key], f"{path}.{key}", findings)
        return
    if isinstance(spec, list):
        if not isinstance(value, list):
            findings.append(f"{path}: expected array")
        else:
            for i, item in enumerate(value):
                check(item, spec[0], f"{path}[{i}]", findings)
        return
    if isinstance(spec, set):
        valid = isinstance(value, str) and value in spec
        expected = "one of " + ", ".join(sorted(spec))
    elif spec == "bool":
        valid, expected = type(value) is bool, "boolean"
    elif spec == "count":
        valid, expected = type(value) is int and value >= 0, "nonnegative integer (not boolean)"
    else:
        valid, expected = isinstance(value, str), spec
        if valid:
            if spec == "text":
                valid = bool(value.strip())
            elif spec == "nonempty":
                valid = bool(value)
            elif spec == "sha":
                valid = re.fullmatch(r"(?:[0-9a-f]{40}|[0-9a-f]{64})", value) is not None
            elif spec == "digest":
                valid = re.fullmatch(r"[0-9a-f]{64}", value) is not None
            elif spec == "run-id":
                valid = bool(value.strip()) and value not in {".", ".."} and "/" not in value
            elif spec == "url":
                try:
                    parsed = urlsplit(value)
                    valid = parsed.scheme in {"http", "https"} and bool(parsed.netloc) and not any(c.isspace() for c in value)
                except ValueError:
                    valid = False
    if not valid:
        findings.append(f"{path}: expected {expected}")


def digest(value):
    artifact = dict(value)
    for key in METADATA:
        if key in artifact:
            artifact[key] = sorted(set(artifact[key]))
    encoded = json.dumps(artifact, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def body_digest(body):
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def artifact_findings(mode, value):
    findings = []
    check(value, PREVIEW if mode == "preview-approval" else PUSH, mode, findings)
    if findings:
        return findings
    if mode == "push-approval":
        expected = f"{value['source_sha']}:refs/heads/{value['destination_branch']}"
        if value["refspec"] != expected:
            findings.append("push.refspec: must bind source_sha to destination_branch exactly")
    elif value["requested_state"] == "ready" and value["effective_state"] != "ready":
        findings.append("preview.effective_state: ready request cannot become draft")
    return findings


def bound_record(record, artifact, checkpoint, findings):
    if record is None:
        findings.append("approval_record: required nonnull approval")
        return
    for key, expected in (("checkpoint", checkpoint), ("run_id", artifact["run_id"]), ("artifact_digest", digest(artifact))):
        if record[key] != expected:
            findings.append(f"approval_record.{key}: does not bind current {checkpoint} artifact")


def role_findings(mode, value, preview=None):
    findings = []
    fields = COMMON | SCHEMAS[mode] | {"missing_tools": TEXTS}
    fields["status"] = STATUSES[mode]
    status = value.get("status") if isinstance(value, dict) else None
    required = set(COMMON)
    if isinstance(status, str):
        required.update(REQUIRED[mode].get(status, ()))
    if status == "TOOLS_MISSING":
        required.add("missing_tools")
    check(value, fields, mode, findings, required)
    if findings:
        return sorted(set(findings))

    def need(key):
        if not value.get(key):
            findings.append(f"{mode}.{key}: required nonempty for {status}")

    def equal(key, expected):
        if value.get(key) != expected:
            findings.append(f"{mode}.{key}: must be {expected!r} for {status}")

    if "missing_tools" in value:
        need("missing_tools")
    if mode == "repo-state-inspector" and status == "PASS":
        need("current_branch")
        need("remotes")
        if value["topology"] == "ambiguous":
            need("topology_candidates")
            need("decision_needed")
        else:
            names = {remote["name"] for remote in value["remotes"]}
            for key in ("head_remote", "base_remote", "head_repository", "base_repository"):
                need(key)
            for key in ("head_remote", "base_remote"):
                if value[key] not in names:
                    findings.append(f"{mode}.{key}: must name a reported remote")
        if value["requested_state_support"] == "supported":
            need("safe_create_path")
            if value["platform"] == "unknown":
                findings.append(f"{mode}.platform: supported state requires known platform")
    elif mode == "preflight-validator":
        push = value.get("push")
        if push is not None:
            findings.extend(artifact_findings("push-approval", push))
            for key, target in (("head_remote", "head_remote"), ("head_branch", "destination_branch")):
                if value.get(key) is not None and value[key] != push[target]:
                    findings.append(f"{mode}.{key}: differs from push artifact")
        if value.get("push_attempted"):
            need("push")
            if push is not None:
                bound_record(value.get("approval_record"), push, "push", findings)
            else:
                need("approval_record")
        if status == "PASS":
            for key in ("head_remote", "base_remote", "head_branch", "base_branch", "head_sha", "base_sha"):
                need(key)
            equal("head_remote_state", "up-to-date")
            equal("existing_pr", None)
            equal("push_rejection_reason", None)
            if value["push_attempted"] and push is not None:
                equal("head_sha", push["source_sha"])
            if not value["push_attempted"]:
                equal("push", None)
                equal("approval_record", None)
        elif status in {"PUSH_REQUIRED", "PUSH_REJECTED"}:
            need("push")
            need("decision_needed")
            equal("push_attempted", status == "PUSH_REJECTED")
            if status == "PUSH_REJECTED":
                need("push_rejection_reason")
        elif status == "PR_EXISTS":
            need("existing_pr")
    elif mode == "diff-analyzer" and status in {"PASS", "LARGE_PR_CONFIRMATION_REQUIRED", "EMPTY_DIFF"}:
        equal("pinned_sha_match", True)
        paths = value["changed_paths"]
        if value["changed_files"] != len(set(paths)) or len(paths) != len(set(paths)):
            findings.append(f"{mode}.changed_files: must equal distinct changed_paths count")
        if status == "EMPTY_DIFF":
            equal("changed_paths", [])
        else:
            need("changed_paths")
            need("diff_summary")
        rules = value["scope_gate_rules"]
        for rule, fired in (("adjusted-lines>1000", value["adjusted_changed_lines"] > 1000), ("changed-files>40", value["changed_files"] > 40)):
            if (rule in rules) != fired:
                findings.append(f"{mode}.scope_gate_rules: {rule} inconsistent with counts")
        if status == "LARGE_PR_CONFIRMATION_REQUIRED":
            need("scope_gate_rules")
            need("decision_needed")
    elif mode == "pr-drafter":
        source = value.get("template_source")
        candidates = value.get("source_candidates", [])
        if len(candidates) > 10:
            findings.append(f"{mode}.source_candidates: at most 10 identities")
        for candidate in candidates:
            if candidate["choice"] not in value.get("choices", []):
                findings.append(f"{mode}.source_candidates: choice must appear in choices")
            if candidate["choice"] == "title-rule" and candidate["source"]["kind"] != "repository":
                findings.append(f"{mode}.source_candidates: title rules require a repository source")
        if status == "PASS":
            need("title")
            need("body")
            equal("choices", [])
            equal("source_candidates", [])
            equal("decision_needed", None)
            if value["title_source"] == "override":
                equal("title_rule", None)
                equal("title_rule_source", None)
            else:
                need("title_rule")
                if value["title_source"] == "repository-rule":
                    need("title_rule_source")
            body_source = value["body_source"]
            if body_source in {"repository-template", "local-template", "settings-template"}:
                need("template_source")
                if source is not None and source["kind"] != body_source.split("-")[0]:
                    findings.append(f"{mode}.template_source.kind: differs from body_source")
            else:
                equal("template_source", None)
        elif status == "NEEDS_CHOICE":
            need("choices")
            need("decision_needed")
    elif mode == "review-metadata-suggester":
        if status == "PASS":
            for key in METADATA:
                if value[key] is None:
                    findings.append(f"{mode}.{key}: must be a known array for PASS")
            equal("invalid_labels", [])
            equal("invalid_assignees", [])
            equal("decision_needed", None)
            reviewers = value["reviewers"]
            if reviewers == []:
                equal("reviewer_source", "none-confirmed")
            elif reviewers and value["reviewer_source"] not in {"user", "CODEOWNERS"}:
                findings.append(f"{mode}.reviewer_source: nonempty reviewers require user or CODEOWNERS")
            if value["reviewer_source"] == "CODEOWNERS":
                need("codeowners_source")
            if value["assignees"]:
                equal("assignee_source", "user")
                equal("assignment_support", "supported")
            else:
                equal("assignee_source", "none")
        elif status == "INVALID_LABELS":
            need("invalid_labels")
            need("decision_needed")
        elif status == "NEEDS_REVIEWER":
            need("decision_needed")
        elif status == "BLOCKED":
            need("assignees")
    elif mode == "pr-submitter":
        record = value.get("approval_record")
        if record is not None:
            bound_record(record, preview, "preview", findings)
        if value.get("create_retry_used"):
            equal("create_attempted", True)
        if "outcome" in value and status not in {"PASS", "GAPS_FOUND"}:
            findings.append(f"{mode}.outcome: known object must use PASS or GAPS_FOUND")
        if status in {"PASS", "GAPS_FOUND"}:
            need("approval_record")
            if value["outcome"] == "created":
                equal("create_attempted", True)
        elif status == "HEAD_MOVED":
            need("approval_record")
            need("remote_head_sha")
            equal("create_attempted", False)
            if value["remote_head_sha"] == preview["head_sha"]:
                findings.append(f"{mode}.remote_head_sha: HEAD_MOVED requires a different SHA")
        elif status in {"CREATE_UNCERTAIN", "CREATE_ERROR"}:
            equal("create_attempted", True)
            if status == "CREATE_UNCERTAIN":
                need("uncertain_check_commands")
    return sorted(set(findings))


def compare(receipt, preview):
    returned = receipt["returned"]
    gaps = []
    for key, approved_key in (("title", "title"), ("base", "base_branch"), ("head_ref", "head_branch"), ("head_sha", "head_sha"), ("state", "effective_state")):
        if returned[key] is None:
            gaps.append(f"{key}: readback unavailable")
        elif returned[key] != preview[approved_key]:
            gaps.append(f"{key}: differs from approved value")
    additions = {}
    for key in METADATA:
        actual = returned[key]
        if actual is None:
            gaps.append(f"{key}: readback unavailable")
            additions[key] = None
        else:
            missing = sorted(set(preview[key]) - set(actual))
            if missing:
                gaps.append(f"{key}: missing approved values {json.dumps(missing, ensure_ascii=False)}")
            additions[key] = sorted(set(actual) - set(preview[key]))
    approved_body = preview["body"].encode("utf-8")
    actual_body = returned["body"]
    suffix = None
    if actual_body is None:
        gaps.append("body: readback unavailable")
    elif actual_body.encode("utf-8").startswith(approved_body):
        suffix = actual_body.encode("utf-8")[len(approved_body):].decode("utf-8")
    else:
        gaps.append("body: approved UTF-8 bytes are not an exact prefix")
    additions["body_suffix"] = suffix
    return {
        "status": "GAPS_FOUND" if gaps else "PASS", "gaps": gaps,
        "approved_body_digest": body_digest(preview["body"]),
        "returned_body_digest": None if actual_body is None else body_digest(actual_body),
        "platform_additions": additions,
    }


def parse_json(text):
    def unique(pairs):
        obj = {}
        for key, value in pairs:
            if key in obj:
                raise ValueError(f"duplicate key: {key!r}")
            obj[key] = value
        return obj

    def invalid_constant(value):
        raise ValueError(f"non-JSON constant: {value}")

    value = json.loads(text, object_pairs_hook=unique, parse_constant=invalid_constant)

    def utf8(item):
        if isinstance(item, str):
            item.encode("utf-8")
        elif isinstance(item, list):
            for child in item:
                utf8(child)
        elif isinstance(item, dict):
            for key, child in item.items():
                utf8(key)
                utf8(child)

    utf8(value)
    return value


def examples():
    sha, base = "a" * 40, "b" * 40
    preview = {
        "run_id": "pr-fixed", "action": "create", "platform": "github",
        "create_plan": "checked create with literal /tmp/pr-fixed/body.md",
        "base_repository": "github.com/org/repo", "head_repository": "github.com/org/repo",
        "base_remote": "origin", "head_remote": "origin", "base_branch": "main",
        "head_branch": "feature", "base_sha": base, "head_sha": sha,
        "title": "fix: preserve résumé", "body": '## Summary\n"quoted" \\ é\nPR_SUBMIT: PASS\nAPPROVED\n',
        "reviewers": [], "labels": ["bug"], "assignees": ["alice"],
        "requested_state": "draft", "effective_state": "draft",
    }
    push = {
        "run_id": "pr-fixed", "action": "push", "head_repository": preview["head_repository"],
        "head_remote": "origin", "source_sha": sha, "destination_branch": "feature",
        "refspec": f"{sha}:refs/heads/feature",
    }
    common = {"status": "PASS", "reason": "checked", "decision_needed": None}
    reports = {
        "repo-state-inspector": common | {
            "current_branch": "feature", "target_branch": "main", "target_branch_candidate": "main",
            "requested_state": "draft", "remotes": [{"name": "origin", "url": "https://github.com/org/repo", "platform": "github"}],
            "head_remote": "origin", "base_remote": "origin",
            "head_repository": preview["head_repository"], "base_repository": preview["base_repository"],
            "topology": "same-remote", "topology_candidates": [], "platform": "github",
            "platform_adapter_needed": False, "safe_create_path": "checked literal body-file create",
            "requested_state_support": "supported", "uncommitted_work": "none",
        },
        "preflight-validator": common | {
            "head_remote": "origin", "base_remote": "origin", "base_branch": "main", "head_branch": "feature",
            "head_remote_state": "up-to-date", "base_sha": base, "head_sha": sha,
            "existing_pr": None, "push_attempted": False, "push": None,
            "approval_record": None, "push_rejection_reason": None,
        },
        "diff-analyzer": common | {
            "range": "origin/main...origin/feature", "base_sha": base, "head_sha": sha,
            "pinned_sha_match": True, "shortstat": {"files": 1, "insertions": 2, "deletions": 1},
            "adjusted_changed_lines": 3, "changed_files": 1, "excluded_totals": {"files": 0, "lines": 0},
            "scope_gate_rules": [], "changed_paths": ["src/fix.py"],
            "grouped_areas": [{"area": "src", "paths": ["src/fix.py"]}],
            "diff_summary": ["Fixes the boundary"], "type_candidates": [{"value": "fix", "rationale": "bug fix"}],
            "scope_candidates": [], "tests": [], "risk_notes": [],
        },
        "pr-drafter": common | {
            "title": preview["title"], "body": preview["body"], "title_source": "fallback",
            "title_rule": "Conventional Commit", "title_rule_source": None, "body_source": "fallback",
            "template_source": None, "type_choice": "fix", "scope_choice": "none",
            "traceability_notes": ["body follows diff facts"], "choices": [], "source_candidates": [],
        },
        "review-metadata-suggester": common | {
            "reviewers": [], "reviewer_source": "none-confirmed", "solo_repository": None,
            "codeowners_source": None, "codeowners_matches": [], "labels": ["bug"],
            "label_source": "override", "invalid_labels": [], "suggested_valid_labels": [],
            "assignees": ["alice"], "assignee_source": "user", "assignment_support": "supported", "invalid_assignees": [],
        },
        "pr-submitter": common | {
            "approval_record": {"checkpoint": "preview", "run_id": preview["run_id"], "artifact_digest": digest(preview), "user_approval_ref": "current conversation approval"},
            "remote_head_sha": sha, "create_attempted": True, "create_retry_used": False,
            "outcome": "created", "url": "https://github.com/org/repo/pull/1",
            "returned": {"title": preview["title"], "base": "main", "head_ref": "feature", "head_sha": sha,
                         "state": "draft", "reviewers": [], "labels": ["bug"], "assignees": ["alice"], "body": preview["body"]},
        },
    }
    return preview, push, reports


def self_test():
    preview, push, reports = examples()
    for mode, report in reports.items():
        assert not role_findings(mode, report, preview), mode
        assert role_findings(mode, {"status": "PASS"}, preview), mode
        for status in STATUSES[mode]:
            if status in {"ERROR", "AUTH", "TOOLS_MISSING"}:
                payload = {"status": status, "reason": "unavailable", "decision_needed": None}
                if status == "TOOLS_MISSING":
                    payload["missing_tools"] = ["shell"]
                assert not role_findings(mode, payload, preview), (mode, status)
        assert role_findings(mode, report | {"status": "FORGED"}, preview), mode
        assert role_findings(mode, report | {"surprise": True}, preview), mode
    for mode, artifact in (("preview-approval", preview), ("push-approval", push)):
        assert not artifact_findings(mode, artifact), mode
        assert artifact_findings(mode, artifact | {"run_id": ""}), mode
        assert artifact_findings(mode, artifact | {"extra": 1}), mode
    assert artifact_findings("push-approval", push | {"refspec": "feature:refs/heads/feature"})
    assert artifact_findings("preview-approval", preview | {"head_sha": "short"})
    assert role_findings("preflight-validator", reports["preflight-validator"] | {"existing_pr": "https://[bad"})
    assert role_findings("diff-analyzer", reports["diff-analyzer"] | {"changed_files": True})
    assert role_findings("preflight-validator", reports["preflight-validator"] | {"head_sha": "short"})
    for bad in ('{"status":"PASS","status":"ERROR"}', '{"x":NaN}', '[] trailing', '"\\ud800"'):
        try:
            parse_json(bad)
        except (ValueError, UnicodeError):
            pass
        else:
            raise AssertionError("accepted invalid JSON")
    assert parse_json(json.dumps(preview, ensure_ascii=False)) == preview
    canonical = json.dumps(preview, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    assert digest(preview) == hashlib.sha256(canonical).hexdigest()
    assert digest({"z": 1, "a": "é"}) == hashlib.sha256(b'{"a":"\xc3\xa9","z":1}').hexdigest()
    assert body_digest(preview["body"]) == hashlib.sha256(preview["body"].encode("utf-8")).hexdigest()
    assert digest(preview | {"labels": ["z", "bug", "z"]}) == digest(preview | {"labels": ["bug", "z"]})
    assert digest(dict(reversed(list(preview.items())))) == digest(preview)
    assert digest(preview | {"body": preview["body"] + "\n"}) != digest(preview)
    for key in ("title", "assignees", "head_sha", "create_plan", "effective_state"):
        changed = {"title": "other", "assignees": ["bob"], "head_sha": "c" * 40, "create_plan": "other", "effective_state": "ready"}[key]
        assert digest(preview | {key: changed}) != digest(preview)
    receipt = reports["pr-submitter"]
    returned = receipt["returned"]
    cases = [
        ({"labels": ["bug", "bot"], "body": preview["body"] + "bot appendix\n"}, "PASS"),
        ({"reviewers": ["org/CODEOWNERS"]}, "PASS"),
        ({"labels": []}, "GAPS_FOUND"),
        ({"body": preview["body"].replace("Summary", "Changed")}, "GAPS_FOUND"),
        ({key: None for key in RETURNED}, "GAPS_FOUND"),
        ({"title": "altered"}, "GAPS_FOUND"),
        ({"assignees": []}, "GAPS_FOUND"),
        ({"assignees": ["alice", "bot"]}, "PASS"),
        ({"body": preview["body"].rstrip("\n")}, "GAPS_FOUND"),
    ]
    for changes, expected in cases:
        payload = receipt | {"returned": returned | changes}
        assert not role_findings("pr-submitter", payload, preview), changes
        result = compare(payload, preview)
        assert result["status"] == expected, changes
    added = compare(receipt | {"returned": returned | cases[0][0]}, preview)["platform_additions"]
    assert added["labels"] == ["bot"] and added["body_suffix"] == "bot appendix\n"
    assert compare(receipt, preview)["platform_additions"]["body_suffix"] == ""
    assert role_findings("pr-submitter", receipt | {"approval_record": receipt["approval_record"] | {"artifact_digest": "0" * 64}}, preview)
    assert role_findings("pr-submitter", receipt | {"approval_record": receipt["approval_record"] | {"run_id": "old-run"}}, preview)
    pushed = reports["preflight-validator"] | {
        "push_attempted": True, "push": push,
        "approval_record": {"checkpoint": "push", "run_id": push["run_id"], "artifact_digest": digest(push), "user_approval_ref": "current approval"},
    }
    assert not role_findings("preflight-validator", pushed)
    assert role_findings("preflight-validator", pushed | {"approval_record": None})
    pending = {"reason": "decision required", "decision_needed": "Choose next action"}
    settings_source = {"kind": "settings", "project": "gitlab.com/org/repo", "setting": "merge_requests_template"}
    settings_draft = reports["pr-drafter"] | {
        "body_source": "settings-template", "template_source": settings_source,
    }
    source_choice = pending | {
        "status": "NEEDS_CHOICE", "choices": ["template"], "source_candidates": [
            {"choice": "template", "source": settings_source},
            {"choice": "template", "source": {"kind": "repository", "repository": settings_source["project"], "revision": preview["base_sha"], "path": ".gitlab/merge_request_templates/Default.md"}},
        ],
    }
    for changes in ({"project": ""}, {"setting": None}, {"revision": preview["base_sha"]}, {"body": "raw template"}):
        assert role_findings("pr-drafter", settings_draft | {"template_source": settings_source | changes}), changes
    assert role_findings("pr-drafter", settings_draft | {"body_source": "repository-template"})
    assert role_findings("pr-drafter", source_choice | {"source_candidates": [{"choice": "template", "source": settings_source | {"body": "raw template"}}]})
    assert role_findings("pr-drafter", source_choice | {"source_candidates": source_choice["source_candidates"] * 6})
    assert role_findings("pr-drafter", source_choice | {"choices": ["title-rule"], "source_candidates": [{"choice": "title-rule", "source": settings_source}]})
    assert role_findings("pr-drafter", source_choice | {"choices": ["type"]})
    repository_source = source_choice["source_candidates"][1]["source"]
    assert role_findings("pr-drafter", source_choice | {"source_candidates": [{"choice": "template", "source": repository_source | {"revision": None}}]})
    assert role_findings("pr-drafter", {k: v for k, v in source_choice.items() if k != "source_candidates"})
    positives = [
        ("repo-state-inspector", reports["repo-state-inspector"] | pending | {
            "topology": "ambiguous", "topology_candidates": [{"head_remote": "origin", "base_remote": "origin"}],
        }),
        ("preflight-validator", pending | {"status": "PUSH_REQUIRED", "push": push, "push_attempted": False, "approval_record": None}),
        ("preflight-validator", pushed | pending | {"status": "PUSH_REJECTED", "push_rejection_reason": "protected branch"}),
        ("preflight-validator", pending | {"status": "PR_EXISTS", "existing_pr": receipt["url"]}),
        ("diff-analyzer", reports["diff-analyzer"] | pending | {
            "status": "LARGE_PR_CONFIRMATION_REQUIRED", "adjusted_changed_lines": 1001, "scope_gate_rules": ["adjusted-lines>1000"],
        }),
        ("diff-analyzer", reports["diff-analyzer"] | {
            "status": "EMPTY_DIFF", "changed_files": 0, "changed_paths": [], "adjusted_changed_lines": 0,
            "shortstat": {"files": 0, "insertions": 0, "deletions": 0}, "grouped_areas": [], "diff_summary": [], "type_candidates": [],
        }),
        ("pr-drafter", source_choice),
        ("pr-drafter", source_choice | {"choices": ["title-rule"], "source_candidates": [{"choice": "title-rule", "source": repository_source}]}),
        ("pr-drafter", pending | {"status": "NEEDS_CHOICE", "choices": ["type"], "source_candidates": []}),
        ("pr-drafter", settings_draft),
        ("pr-drafter", reports["pr-drafter"] | {
            "title_source": "repository-rule", "title_rule_source": "base rule at pinned revision",
            "body_source": "repository-template", "template_source": {"kind": "repository", "repository": preview["base_repository"], "revision": preview["base_sha"], "path": ".github/PULL_REQUEST_TEMPLATE.md"},
        }),
        ("pr-drafter", reports["pr-drafter"] | {
            "body_source": "local-template", "template_source": {"kind": "local", "repository": None, "revision": None, "path": "/explicit/template.md"},
        }),
        ("review-metadata-suggester", pending | {"status": "NEEDS_REVIEWER"}),
        ("review-metadata-suggester", pending | {"status": "INVALID_LABELS", "invalid_labels": ["absent"], "suggested_valid_labels": []}),
        ("review-metadata-suggester", pending | {"status": "BLOCKED", "assignees": ["unverified"], "invalid_assignees": ["unverified"], "assignment_support": "unknown"}),
        ("pr-submitter", pending | {"status": "HEAD_MOVED", "approval_record": receipt["approval_record"], "remote_head_sha": "c" * 40, "create_attempted": False}),
        ("pr-submitter", pending | {"status": "CREATE_UNCERTAIN", "create_attempted": True, "create_retry_used": False, "uncertain_check_commands": ["supported lookup"]}),
        ("pr-submitter", pending | {"status": "CREATE_ERROR", "create_attempted": True, "create_retry_used": False}),
    ]
    for mode, payload in positives:
        assert not role_findings(mode, payload, preview), (mode, role_findings(mode, payload, preview))
    for mode, payload in reports.items():
        for key in REQUIRED[mode]["PASS"]:
            assert role_findings(mode, {k: v for k, v in payload.items() if k != key}, preview), (mode, key)
    print("self-test: PASS (six roles, approvals, JSON, digests, preservation comparisons)")


def main():
    parser = argparse.ArgumentParser(
        description="Validate one JSON object from stdin; no environment-variable configuration or side effects.",
        epilog="Exit 0: conforms (domain GAPS_FOUND is valid); 1: shape findings, one per line; 2: bad invocation/checker failure. No Git/network/clock/randomness/writes.",
    )
    parser.add_argument("mode", nargs="?", choices=tuple(SCHEMAS) + ("preview-approval", "push-approval"))
    parser.add_argument("--approved-preview", metavar="PATH", help="read frozen preview; required only for pr-submitter")
    parser.add_argument("--self-test", action="store_true", help="run embedded fixed positive/negative checks")
    args = parser.parse_args()
    if args.self_test:
        if args.mode or args.approved_preview:
            parser.error("--self-test accepts no mode or preview path")
        self_test()
        return 0
    if args.mode is None:
        parser.error("a mode or --self-test is required")
    if (args.mode == "pr-submitter") != (args.approved_preview is not None):
        parser.error("--approved-preview is required for pr-submitter and forbidden otherwise")
    preview = None
    try:
        if args.approved_preview is not None:
            with open(args.approved_preview, "rb") as source:
                preview = parse_json(source.read().decode("utf-8"))
            findings = artifact_findings("preview-approval", preview)
            if findings:
                print("\n".join(findings))
                return 1
        value = parse_json(sys.stdin.buffer.read().decode("utf-8"))
    except (ValueError, UnicodeError, RecursionError) as error:
        print(f"JSON: {error}")
        return 1
    if args.mode in {"preview-approval", "push-approval"}:
        findings = artifact_findings(args.mode, value)
        result = None
        if not findings:
            result = {"artifact_digest": digest(value)}
            if args.mode == "preview-approval":
                result["approved_body_digest"] = body_digest(value["body"])
    else:
        findings = role_findings(args.mode, value, preview)
        result = None
        if not findings:
            result = compare(value, preview) if args.mode == "pr-submitter" and value["status"] in {"PASS", "GAPS_FOUND"} else {"status": value["status"]}
    if findings:
        print("\n".join(findings))
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(f"checker failure: {type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(2)
