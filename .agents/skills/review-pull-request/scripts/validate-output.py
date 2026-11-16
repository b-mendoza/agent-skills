#!/usr/bin/env python3
r"""Usage: python3 -I validate-output.py <context|chunk|author|verify> < payload | -h
Proves envelope, exact JSON keys/types, enums, identities and declared cross-field constraints.
Does not prove evidence, coverage, review quality, live identity, approval or external effects.
Exit 0 conforms; 1 one "<mode>: line N: <message>" finding per defect (repair);
     2 bad/missing mode or invocation (ERROR). Missing python3 is the caller's TOOLS_MISSING.
Side effects: none. Environment: none.
Check (expect 0): printf 'VERIFY: PASS\n{"issues":[],"observed_checks":["ok"]}' | python3 -I validate-output.py verify; echo $?
"""
import json
import re
import sys
from urllib.parse import urlsplit

MODES = ("context", "chunk", "author", "verify")
FAILURES = ("NEEDS_CONTEXT", "TOOLS_MISSING", "ERROR")

def text(value):
    return isinstance(value, str) and bool(value.strip())

def positive(value):
    return type(value) is int and value >= 1


def repo_path(value):
    # Git paths use / separators; a backslash within a POSIX filename is legitimate.
    return (isinstance(value, str) and bool(value) and not value.startswith(("/", "\\\\"))
            and not re.match(r"^[A-Za-z]:[/\\\\]", value) and "\x00" not in value
            and all(part not in ("", ".", "..") for part in value.split("/")))


def prose_errors(value):
    if not text(value):
        return []  # The required-string check owns this diagnostic.
    prose = re.sub(r"(?ms)^\s*(`{3,}|~{3,})[^\n]*\n.*?^\s*\1\s*$", "", value)
    prose = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", prose)
    errors = []
    if len(prose.split()) >= 130:
        errors.append("expected fewer than 130 prose words (fenced code excluded)")
    if re.search(r"(?im)^\s*(?:#{1,6}\s*)?(?:\[(?:P[0-3]|blocking|important|nit|suggestion)\]|(?:blocking|important|nit|suggestion|severity)\s*:)", prose):
        errors.append("public severity labels are not allowed")
    if re.search(r"(?i)\b(?:footgun|under the hood|at the end of the day|nice catch|great job)\b", prose):
        errors.append("replace idiom or praise filler with literal language")
    if re.search(r"(?ms)^\s*```suggestion\s*\n\s*none\s*\n\s*```", value):
        errors.append("unsafe placeholder suggestion")
    return errors

def url(value):
    try:
        parsed = urlsplit(value) if text(value) else None
        return bool(parsed and parsed.scheme == "https" and parsed.hostname
                    and not any(char.isspace() for char in value) and parsed.port != 0)
    except ValueError:
        return False

def validate(mode, raw):
    errors = []
    def check(condition, path, message, line=2):
        if not condition:
            errors.append(f"{mode}: line {line}: {path or '$'}: {message}")
    def location(path, key):
        key = json.dumps(key, ensure_ascii=True)[1:-1]
        return f"{path}.{key}" if path else key
    def record(value, path, strings, others="", optional=""):
        if not isinstance(value, dict):
            check(False, path, "expected object")
            return {}
        keys = set((strings + " " + others).split())
        for key in sorted((keys - value.keys()) | (value.keys() - keys - set(optional.split()))):
            check(False, location(path, key), "extra key" if key in value else "missing key")
        fields(value, strings, path)
        return value
    def fields(data, keys, path="", predicate=text, message="expected non-empty string"):
        for key in keys.split():
            if key in data:
                check(predicate(data[key]), location(path, key), message)
    def array(data, key, path="", predicate=None, message="expected non-empty string"):
        value, path = data.get(key, []), location(path, key)
        check(isinstance(value, list), path, "expected array")
        if not isinstance(value, list):
            return []
        if predicate:
            for index, item in enumerate(value):
                check(predicate(item), f"{path}[{index}]", message)
        return value
    def records(values, key, strings, others=""):
        return [(record(value, f"{key}[{i}]", strings, others), f"{key}[{i}]")
                for i, value in enumerate(values)]
    def unique(values, path, key=None):
        identities = [row.get(key) if isinstance(row, dict) else None for row in values] if key else values
        for index, identity in enumerate(identities):
            target = location(f"{path}[{index}]", key) if key else f"{path}[{index}]"
            check(identity is None or identity not in identities[:index], target, "duplicate value")
    def enum(data, key, choices, path=""):
        fields(data, key, path, lambda value: value in choices, "expected one of " + ", ".join(choices))
    def findings(data, authored=False):
        values = array(data, "findings")
        unique(values, "findings", "id")
        if authored:
            unique(values, "findings", "root_comment_id")
        for index, value in enumerate(values):
            path = f"findings[{index}]"
            strings = "id title evidence failure_scenario minimal_fix"
            others = "severity confidence anchor sources"
            placement = value.get("placement") if isinstance(value, dict) else None
            if authored:
                others += " placement" + (" root_comment_id" if placement == "reply" else "")
                strings += " body" if placement in ("inline", "reply") else ""
            value = record(value, path, strings, others)
            if not authored and text(data.get("dimension")) and text(value.get("id")):
                check(re.fullmatch(re.escape(data["dimension"]) + r"-[1-9][0-9]*", value["id"]),
                      path + ".id", "expected dimension-N id (N >= 1)")
            enum(value, "severity", ("blocking", "important", "nit", "suggestion"), path)
            enum(value, "confidence", ("high", "medium", "low"), path)
            array(value, "sources", path, url, "expected HTTPS URL with host")
            if value.get("anchor") is not None:
                target = path + ".anchor"
                anchor = record(value["anchor"], target, "", "path line side", "start_line")
                fields(anchor, "path", target, repo_path, "expected repository-relative path")
                fields(anchor, "line start_line", target, positive, "expected integer >= 1")
                enum(anchor, "side", ("RIGHT", "LEFT"), target)
                if positive(anchor.get("start_line")) and positive(anchor.get("line")):
                    check(anchor["start_line"] < anchor["line"], target + ".start_line", "must be < line")
            if authored:
                enum(value, "placement", ("inline", "reply", "summary", "unknown"), path)
                if placement == "inline" and "anchor" in value:
                    check(value["anchor"] is not None, path + ".anchor", "inline requires non-null anchor")
                if placement == "reply":
                    fields(value, "root_comment_id", path, positive, "expected integer >= 1")
    def unpack(value, path=""):
        if isinstance(value, tuple):
            result = {}
            for key, item in value:
                check(key not in result, location(path, key), "duplicate key")
                result[key] = unpack(item, location(path, key))
            return result
        if isinstance(value, list):
            return [unpack(item, f"{path}[{index}]") for index, item in enumerate(value)]
        return value
    def invalid_constant(value):
        raise ValueError("invalid JSON constant " + value)

    try:
        payload = raw.decode("utf-8")
        header, _, body = payload.partition("\n")
        statuses = ("PASS",) + (("FAIL",) if mode == "verify" else ()) + FAILURES
        status = header.removeprefix(mode.upper() + ": ")
        check(header == mode.upper() + ": " + status and status in statuses,
              "envelope", "expected " + mode.upper() + ": " + "|".join(statuses), 1)
        data = unpack(json.loads(body, object_pairs_hook=tuple, parse_constant=invalid_constant))
    except UnicodeDecodeError as error:
        check(False, "$", "invalid UTF-8", raw[:error.start].count(b"\n") + 1)
        return errors
    except json.JSONDecodeError as error:
        check(False, "$", error.msg, error.lineno + 1)
        return errors
    except (ValueError, RecursionError) as error:
        check(False, "$", "invalid JSON: " + str(error))
        return errors
    if not isinstance(data, dict):
        check(False, "$", "expected object")
        return errors
    if status in FAILURES:
        record(data, "", "reason next_step")
        return errors
    if mode == "context":
        record(data, "", "title author base head ci behavior_summary",
               "pr state base_sha head_sha shortstat changed_files linked_context test_signals risk_areas "
               "dimensions history threads feedback references limitations posting_basis")
        fields(data, "shortstat linked_context test_signals", predicate=lambda v: isinstance(v, str),
               message="expected string")
        fields(data, "base_sha head_sha", predicate=lambda v: isinstance(v, str)
               and re.fullmatch(r"[0-9a-f]{40}", v), message="expected lowercase SHA (40 hex)")
        fields(data, "pr", predicate=lambda v: isinstance(v, str) and re.fullmatch(
            r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[1-9][0-9]*", v),
            message="expected canonical GitHub PR URL")
        enum(data, "state", ("open", "closed", "merged"))
        enum(data, "history", ("complete", "partial", "unknown"))
        if data.get("posting_basis") is not None:
            basis = record(data["posting_basis"], "posting_basis", "viewer history_sha256", "approval_urls")
            fields(basis, "history_sha256", "posting_basis", lambda v: isinstance(v, str)
                   and re.fullmatch(r"[0-9a-f]{64}", v), "expected SHA-256 (64 hex)")
            array(basis, "approval_urls", "posting_basis", url, "expected HTTPS URL with host")
        changed = array(data, "changed_files", predicate=repo_path,
                        message="expected repository-relative path")
        unique(changed, "changed_files")
        dimensions = array(data, "dimensions")
        if isinstance(data.get("dimensions"), list):
            check(1 <= len(dimensions) <= 6, "dimensions", "expected 1..6 items")
        unique(dimensions, "dimensions", "name")
        for value, path in records(dimensions, "dimensions", "rationale", "name files"):
            fields(value, "name", path, lambda v: isinstance(v, str) and re.fullmatch(r"[a-z][a-z0-9-]*", v),
                   "expected dimension name matching ^[a-z][a-z0-9-]*$")
            files = array(value, "files", path, repo_path, "expected repository-relative path")
            if isinstance(value.get("files"), list):
                check(bool(files), path + ".files", "expected non-empty array")
            for index, name in enumerate(files):
                check(name in changed, f"{path}.files[{index}]", "not in changed_files")
        threads = array(data, "threads")
        unique(threads, "threads", "root_comment_id")
        for value, path in records(threads, "threads", "thread_id summary",
                                   "path is_resolved line root_comment_id root_url"):
            fields(value, "path", path, repo_path, "expected repository-relative path")
            fields(value, "is_resolved", path, lambda v: type(v) is bool, "expected boolean")
            fields(value, "line", path, lambda v: v is None or positive(v), "expected integer >= 1 or null")
            fields(value, "root_comment_id", path, positive, "expected integer >= 1")
            fields(value, "root_url", path, url, "expected HTTPS URL with host")
        for value, path in records(array(data, "feedback"), "feedback", "summary", "kind url"):
            enum(value, "kind", ("review-summary", "discussion"), path)
            fields(value, "url", path, url, "expected HTTPS URL with host")
    elif mode == "chunk":
        record(data, "", "dimension", "inspected gaps findings residual_risks references")
        inspected, gaps = array(data, "inspected"), array(data, "gaps")
        if all(isinstance(data.get(key), list) for key in ("inspected", "gaps")):
            check(bool(inspected or gaps), "inspected/gaps", "must not both be empty")
        for value, path in records(inspected, "inspected", "ranges", "path"):
            fields(value, "path", path, repo_path, "expected repository-relative path")
        for value, path in records(gaps, "gaps", "detail", "path kind"):
            fields(value, "path", path, repo_path, "expected repository-relative path")
            enum(value, "kind", ("unavailable", "truncated", "binary", "omitted"), path)
        findings(data)
    elif mode == "author":
        record(data, "", "summary", "decision findings dropped residual_risks references thread_assessments")
        assessments = array(data, "thread_assessments")
        unique(assessments, "thread_assessments", "root_comment_id")
        for value, path in records(assessments, "thread_assessments", "evidence", "root_comment_id status"):
            fields(value, "root_comment_id", path, positive, "expected integer >= 1")
            enum(value, "status", ("still-valid", "fixed", "out-of-scope", "unverifiable"), path)
        enum(data, "decision", ("COMMENT", "REQUEST_CHANGES", "APPROVE"))
        findings(data, authored=True)
        texts = [("summary", data.get("summary"))]
        finding_values = data.get("findings") if isinstance(data.get("findings"), list) else []
        texts += [(f"findings[{i}].{key}", f.get(key)) for i, f in enumerate(finding_values)
                  if isinstance(f, dict) for key in ("title", "body") if key in f]
        for path, value in texts:
            for error in prose_errors(value):
                check(False, path, error)
        if isinstance(data.get("findings"), list):
            check(data.get("decision") != "REQUEST_CHANGES" or bool(data["findings"]), "findings",
                  "REQUEST_CHANGES requires at least one finding")
        records(array(data, "dropped"), "dropped", "candidate reason")
    elif mode == "verify":
        record(data, "", "", "issues observed_checks")
        issues = array(data, "issues", predicate=text)
        if isinstance(data.get("issues"), list):
            check(bool(issues) == (status == "FAIL"), "issues", "must be empty on PASS and non-empty on FAIL")
        array(data, "observed_checks", predicate=text)
    if mode in ("context", "chunk", "author"):
        for key in (("risk_areas", "limitations") if mode == "context" else ("residual_risks",)):
            array(data, key, predicate=text)
        array(data, "references", predicate=url, message="expected HTTPS URL with host")
    return errors

if __name__ == "__main__":
    arguments = sys.argv[1:]
    if arguments == ["-h"] or len(arguments) != 1 or arguments[0] not in MODES:
        print(__doc__.strip(), file=sys.stdout if arguments == ["-h"] else sys.stderr)
        sys.exit(0 if arguments == ["-h"] else 2)
    errors = validate(arguments[0], sys.stdin.buffer.read())
    print("\n".join(errors), end="\n" if errors else "")
    sys.exit(int(bool(errors)))
