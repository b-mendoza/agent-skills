#!/usr/bin/env python3
# Proves shape only: status/field order, types, records, uniqueness, counts and
# declared cross-field constraints. Bodies and summaries remain opaque Markdown.
# Does not prove evidence, coverage, quality, canonical fidelity, live identities,
# authority, postability, file safety/existence, digest truth or external effects.
# Usage: python3 -I "${SKILL_DIR}/scripts/validate-output.py" <context|chunk|adjudicate|comments|verify|write|post> < payload
#        python3 -I "${SKILL_DIR}/scripts/validate-output.py" --self-test | -h
# Exit: 0 conforms; 1 one "<mode>: line N: <message>" finding per defect (repair);
#       2 bad/missing mode or invocation (ERROR). Missing Python is host TOOLS_MISSING.
# Side effects: none. No network, clock, randomness, file writes or workspace imports.

import re
import sys
from dataclasses import dataclass, field
from urllib.parse import urlsplit


def schema(declaration):
    return [tuple(part.strip().split("=", 1)) for part in declaration.split(";") if part.strip()]


SEVERITY = "blocking|important|nit|suggestion"
DECISION = "comment|request changes|approve"
HISTORY = "History availability=complete|partial|unknown;"
PINS = "PR=pr; REVIEWED_BASE_SHA=sha; REVIEWED_HEAD_SHA=sha;"
REFERENCES = "References fetched=urls;"
THREAD = """thread_id=node; is_resolved=true|false; viewer_can_unresolve=true|false;
path=text; line=positive|null; root_comment_id=uint|null; root_url=url|null;
comments_total=uint; comments_returned=uint; comments_truncated=true|false;"""
FINDING = """Severity=SEVERITY; Title=text; Location=inline|summary;
Path=text?Location:inline; Line=range?Location:inline; Side=RIGHT|LEFT?Location:inline;
Evidence=text; Failure scenario=text; Minimal fix=text; External sources=urls;
Confidence=high|medium|low;""".replace("SEVERITY", SEVERITY)
RECORDS = {
    "thread": THREAD + "Summary=text;",
    "target": THREAD,
    "dimension": "Name=text; Files=list:text; Rationale=text;",
    "feedback": "Kind=review-summary|discussion; URL=url; Summary=text;",
    "scope": "Path=text; Ranges=ranges;",
    "gap": "Path=text; Kind=unavailable|truncated|binary|omitted; Detail=text;",
    "candidate": "ID=text;" + FINDING,
    "finding": "ID=text; Candidate IDs=csv; Disposition=confirmed|adjusted;"
               + "Original severity=" + SEVERITY + "?Disposition:adjusted;" + FINDING
               + "Dedup=new|follow-up|summary|unknown; Target=fields:target?Dedup:follow-up;",
    "drop": "ID=text; Reason=cause;",
    "comment": """Finding ID=text; Kind=new|follow-up; Path=text?Kind:new;
Line=positive?Kind:new; Side=RIGHT|LEFT?Kind:new; Start line=positive|none?Kind:new;
Start side=RIGHT|LEFT|none?Kind:new; Reopen=yes|no?Kind:follow-up;
Suggestion included=yes|no; Body=markdown; Suggestion=none|included in body;""",
    "action": """Action ID=text; Kind=review|inline|reopen|reply; Finding ID=text;
State=confirmed|failed|unattempted|uncertain; ID=text; URL=url|none;
thread_id=node?Kind:reopen,reply; root_comment_id=uint?Kind:reply; Detail=text;""",
    "checks": """Version identity=check; Canonical fidelity=check; Coverage=check;
Evidence support=check; External sources=check; Self-containment=check;
Line metadata=check; Dedup dispositions=check; Suggestion safety=check; Severity=check;
Review decision=check; CI evidence=check; Language=check;""",
    "package": "Findings count=uint; New comments=uint; Follow-up replies=uint;"
               + "Review decision=" + DECISION + "; Residual risks=text;",
}
STATUSES = {
    "context": "PASS|AUTH|NOT_FOUND|NEEDS_CONTEXT|TOOLS_MISSING|ERROR",
    "chunk": "PASS|NO_FINDINGS|NEEDS_CONTEXT|TOOLS_MISSING|ERROR",
    "adjudicate": "PASS|NO_FINDINGS|TOOLS_MISSING|ERROR",
    "comments": "PASS|NEEDS_METADATA|TOOLS_MISSING|ERROR",
    "verify": "PASS|FAIL|NEEDS_CONTEXT|TOOLS_MISSING|ERROR",
    "write": "PASS|TOOLS_MISSING|ERROR",
    "post": "PASS|PREVIEW_REQUIRED|AUTH|METADATA_INVALID|TOOLS_MISSING|PARTIAL|ERROR",
}
SUCCESS = {"chunk": ("PASS", "NO_FINDINGS"), "adjudicate": ("PASS", "NO_FINDINGS"),
           "verify": ("PASS", "FAIL")}
MODES = {
    "context": (
        """PR=pr; PR state=open|closed|merged; Title=text; Author=text; Base=text; Head=text;
REVIEWED_BASE_SHA=sha; REVIEWED_HEAD_SHA=sha; Output file=file; Shortstat=text;
Changed files=list:text; CI collected at=timestamp; CI=text; Linked issue/context=text;
Behavior summary=text; Risk areas=list:text; Test signals=text; Dimensions=list:dimension;"""
        + HISTORY + "Existing threads=list:thread; Top-level feedback=list:feedback;" + REFERENCES
        + "Context limitations=list:text; Reason=none; Decision needed=none;",
        "PR=pr; Reason=cause; Decision needed=cause;"),
    "chunk": (PINS + "Dimension=text; Inspected scope=list:scope; Coverage gaps=list:gap;"
              + "Findings=list:candidate; Residual risks=list:text; Context needed=none;"
              + REFERENCES + "Reason=none;",
              "PR=pr; Dimension=text; Context needed=cause; Reason=cause;"),
    "adjudicate": (PINS + HISTORY + "Confirmed findings=list:finding; Dropped=list:drop;"
                   + "Residual risks=list:text;" + REFERENCES + "Reason=none;",
                   "PR=pr; Reason=cause; Next step=cause;"),
    "comments": ("PR=pr; PR state=open|closed|merged; REVIEWED_BASE_SHA=sha; REVIEWED_HEAD_SHA=sha;"
                 + HISTORY + "Review decision recommendation=" + DECISION + ";"
                 + """Findings count=uint; New comments=uint; Follow-up replies=uint;
Review summary=markdown; Confirmed findings=list:finding; Dropped=list:drop;
Residual risks=list:text; Comments=list:comment; Metadata gaps=list:text;"""
                 + REFERENCES + "Reason=none;",
                 "PR=pr; Metadata gaps=list+:text; Reason=cause;"),
    "verify": (PINS + "Checks=rows:checks; Verified package summary=rows:package;"
               + "Issues=list:text; Observed checks=list:text;" + REFERENCES
               + "Fix target=pr-context-collector|finding-adjudicator|comment-drafter|none; Reason=text;",
               "PR=pr; Issues=list+:text; Reason=cause; Next step=cause;"),
    "write": ("Mode=write|update; File=file; File effect=created|replaced|updated; Content SHA256=sha256;"
              + "Findings count=uint; Review decision=" + DECISION + ";"
              + "Posting status=draft|posted|cancelled|failed; Receipt saved=yes|not applicable; Reason=none;",
              "Mode=write|update; File=file; File effect=none|created|replaced|updated|uncertain;"
              + "Reason=cause; Next step=cause;"),
    "post": (PINS + "Preview approved=true|false; Review decision posted=" + DECISION + "|none|uncertain;"
             + """New comments posted=uint; Follow-up replies posted=uint; Read-back verified=yes|no|partial;
Actions=list+:action; Skipped or failed comments=list:text;""" + REFERENCES
             + "Reason=text; Next step=text;", ""),
}


@dataclass
class Field:
    key: str
    value: str
    line: int
    indent: int
    children: list = field(default_factory=list)
    data: object = None


def value(record, key):
    return record[key].value if key in record else ""


def data(record, key, default=None):
    return record[key].data if key in record and record[key].data is not None else default


def integer(text):
    # Nine-digit chunks also accept large decimal counts under Python's int-string limit.
    result = 0
    for start in range(0, len(text), 9):
        chunk = text[start:start + 9]
        result = result * 10 ** len(chunk) + int(chunk)
    return result


def is_range(text):
    if not re.fullmatch(r"[0-9]+(?:-[0-9]+)?", text):
        return False
    ends = [integer(end) for end in text.split("-")]
    return ends[0] > 0 and ends[0] <= ends[-1]


def is_url(text):
    if re.search(r"\s", text):
        return False
    try:
        parts = urlsplit(text)
        return (parts.scheme in ("https", "http") and bool(parts.hostname)
                and bool(parts.netloc) and (parts.port is None or 0 < parts.port < 65536))
    except ValueError:
        return False


def is_file(text):
    return (text.endswith(".md") and not text.startswith("/") and "\\" not in text
            and not re.match(r"[A-Za-z]:", text)
            and all(part not in ("", ".", "..", ".git") for part in text.split("/")))


TYPES = {
    "text": lambda s: bool(s.strip()) and "\r" not in s,
    "cause": lambda s: bool(s.strip()) and s != "none" and "\r" not in s,
    "pr": lambda s: bool(re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+#[1-9][0-9]*", s)),
    "uint": lambda s: bool(re.fullmatch(r"[0-9]+", s)),
    "positive": lambda s: bool(re.fullmatch(r"[0-9]+", s)) and integer(s) > 0,
    "node": lambda s: bool(s) and s != "null" and s != "none"
                      and not s.isdecimal() and not re.search(r"\s", s),
    "sha": lambda s: bool(re.fullmatch(r"[a-fA-F0-9]{40}", s)),
    "sha256": lambda s: bool(re.fullmatch(r"[a-fA-F0-9]{64}", s)),
    "timestamp": lambda s: bool(re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z", s)),
    "url": is_url,
    "file": is_file,
    "range": is_range,
    "ranges": lambda s: s == "whole file" or all(is_range(p.strip()) for p in s.split(",")),
    "urls": lambda s: s == "none" or all(is_url(p.strip()) for p in s.split(",")),
    "csv": lambda s: bool(s) and all(p.strip() and p.strip() != "none" for p in s.split(",")),
    "check": lambda s: bool(re.fullmatch(r"(?:pass|fail|not applicable) - \S[^\r\n]*", s)),
}


class Validator:
    def __init__(self, mode):
        self.mode = mode
        self.findings = []

    def require(self, condition, where, message):
        if not condition:
            line = where.line if isinstance(where, Field) else where
            self.findings.append(f"{self.mode}: line {line}: {message}")

    def fields(self, lines, indent, declaration, parent=1):
        nodes = []
        header = re.compile(r" {" + str(indent) + r"}([A-Za-z][A-Za-z0-9 _/-]*):(?: ([^\n]*))?\n?")
        for number, raw in lines:
            match = header.fullmatch(raw)
            if match:
                nodes.append(Field(match[1], match[2], number, indent))
            elif nodes:
                nodes[-1].children.append((number, raw))
            else:
                self.require(False, number, "expected a field at indentation " + str(indent))
        record = {}
        for node in nodes:
            self.require(node.key not in record, node, "duplicate field " + node.key)
            record.setdefault(node.key, node)
        expected = []
        for key, kind in schema(declaration):
            kind, _, condition = kind.partition("?")
            if condition:
                selector, choices = condition.split(":", 1)
                if value(record, selector) not in choices.split(","):
                    continue
            expected.append(key)
            if key not in record:
                self.require(False, parent, "missing field " + key)
            else:
                self.field(record[key], kind)
        positions = {key: pos for pos, key in enumerate(expected)}
        previous = -1
        for node in nodes:
            if node.key not in positions:
                self.require(False, node, "unexpected field " + node.key)
            else:
                position = positions[node.key]
                self.require(position > previous, node, "field out of order: " + node.key)
                previous = max(previous, position)
        return record

    def field(self, node, kind):
        if kind == "markdown":
            self.require(node.value is None, node, node.key + " must be a block")
            self.require(bool(node.children), node, node.key + " needs a content line")
            for number, raw in node.children:
                self.require(raw.startswith(" " * (node.indent + 2)), number,
                             node.key + " content has wrong container indentation")
                self.require(raw.endswith("\n"), number, "Markdown content must end in LF")
            node.data = "".join(raw for _, raw in node.children)
        elif kind.startswith("fields:"):
            self.require(node.value is None, node, node.key + " must contain fields")
            node.data = self.fields(node.children, node.indent + 2, RECORDS[kind[7:]], node.line)
        elif kind.startswith(("list:", "list+:", "rows:")):
            self.require(node.value is None, node, node.key + " must start on the following line")
            self.list(node, kind)
        else:
            self.require(not node.children, node, node.key + " must occupy one line")
            text = node.value or ""
            valid = bool(text.strip()) and any(TYPES.get(choice, lambda s, c=choice: s == c)(text)
                                                  for choice in kind.split("|"))
            self.require(valid, node, node.key + " must be " + kind)
            node.data = integer(text) if valid and "uint" in kind.split("|") and text.isascii() and text.isdecimal() else text
            if valid and kind == "positive":
                node.data = integer(text)
            if valid and kind == "csv":
                node.data = [part.strip() for part in text.split(",")]
                self.unique(node.data, node, "comma-separated ID")

    def list(self, node, kind):
        style, subtype = kind.split(":", 1)
        lines = node.children
        prefix = " " * node.indent + "- "
        empty = [(n, raw) for n, raw in lines if raw.removesuffix("\n") == prefix + "none"]
        if empty:
            self.require(len(lines) == 1, empty[0][0], "- none cannot mix with other list entries")
            self.require(style == "list", node, node.key + " must not be empty")
            node.data = [] if style != "rows" else {}
            return
        self.require(bool(lines), node, node.key + " needs a list or - none")
        groups = []
        for number, raw in lines:
            if raw.startswith(prefix):
                groups.append([(number, " " * (node.indent + 2) + raw[len(prefix):])])
            elif groups:
                groups[-1].append((number, raw))
            else:
                self.require(False, number, "expected list entry at indentation " + str(node.indent))
        if style == "rows":
            for group in groups:
                self.require(len(group) == 1, group[0][0], "each row must have its own list bullet")
            node.data = self.fields([line for group in groups for line in group], node.indent + 2,
                                    RECORDS[subtype], node.line)
        elif subtype == "text":
            node.data = []
            for group in groups:
                number, raw = group[0]
                text = raw[node.indent + 2:].removesuffix("\n")
                self.require(len(group) == 1 and bool(text.strip()), number, "list entries are nonempty single lines")
                self.require(text.strip() != "none", number, "empty list must be exactly - none, alone")
                node.data.append(text)
            self.unique(node.data, node, node.key + " entry")
        else:
            node.data = [self.fields(group, node.indent + 2, RECORDS[subtype], group[0][0]) for group in groups]
            first_key = schema(RECORDS[subtype])[0][0]
            if first_key in ("ID", "Name", "thread_id", "Finding ID", "Action ID"):
                self.unique([value(record, first_key) for record in node.data], node, first_key)
            else:
                self.unique(["".join(raw for _, raw in group) for group in groups], node, node.key + " record")
            for record in node.data:
                if subtype in ("thread", "target"):
                    self.thread(record)

    def unique(self, values, where, label):
        seen = set()
        for item in values:
            self.require(item not in seen, where, "duplicate " + label + ": " + repr(item))
            seen.add(item)

    def thread(self, record):
        total, returned = data(record, "comments_total"), data(record, "comments_returned")
        if isinstance(total, int) and isinstance(returned, int) and "comments_truncated" in record:
            self.require(returned <= total, record["comments_returned"], "returned count exceeds total")
            self.require((returned < total) == (value(record, "comments_truncated") == "true"),
                         record["comments_truncated"], "truncation flag must agree with total/returned counts")

    def equal(self, record, key, expected):
        self.require(data(record, key) == expected, record[key], key + " must equal " + str(expected))

    def constraints(self, record, status):
        if self.mode == "post":
            self.post(record, status)
            return
        if status not in SUCCESS.get(self.mode, ("PASS",)):
            return
        if self.mode in ("adjudicate", "comments"):
            self.canonical(record)
        if self.mode in ("chunk", "adjudicate"):
            key = "Findings" if self.mode == "chunk" else "Confirmed findings"
            self.require(bool(data(record, key)) == (status == "PASS"), record[key],
                         key + " must be nonempty for PASS and - none for NO_FINDINGS")
        if self.mode == "context":
            dimensions = data(record, "Dimensions")
            self.require(1 <= len(dimensions) <= 6, record["Dimensions"], "expected 1 to 6 dimensions")
            for dimension in dimensions:
                self.require(set(data(dimension, "Files")) <= set(data(record, "Changed files")),
                             dimension["Files"], "dimension files must belong to Changed files")
            if value(record, "History availability") == "complete":
                for thread in data(record, "Existing threads"):
                    self.equal(thread, "comments_truncated", "false")
        elif self.mode == "chunk":
            self.require(bool(data(record, "Inspected scope") or data(record, "Coverage gaps")),
                         record["Inspected scope"], "supply inspected scope or an explicit coverage gap")
            for finding in data(record, "Findings"):
                expected = re.escape(value(record, "Dimension")) + r"-0*[1-9][0-9]*"
                self.require(bool(re.fullmatch(expected, value(finding, "ID"))), finding["ID"],
                             "finding ID must be <Dimension>-<positive integer>")
        elif self.mode == "comments":
            self.comments(record)
        elif self.mode == "verify":
            self.verify(record, status)
        elif self.mode == "write":
            update = value(record, "Mode") == "update"
            effect = value(record, "File effect")
            self.require(effect == "updated" if update else effect in ("created", "replaced"),
                         record["File effect"], "file effect must match write/update mode")
            self.equal(record, "Receipt saved", "yes" if update else "not applicable")
            if update:
                self.require(value(record, "Posting status") != "draft", record["Posting status"],
                             "update posting status must be posted, cancelled or failed")

    def canonical(self, record):
        claimed = []
        for finding in data(record, "Confirmed findings"):
            candidates = data(finding, "Candidate IDs")
            self.require(value(finding, "ID") in candidates, finding["ID"], "retained ID must belong to Candidate IDs")
            claimed.extend(candidates)
            if value(finding, "Location") == "summary":
                self.equal(finding, "Dedup", "summary")
            if value(finding, "Dedup") == "follow-up":
                self.thread(data(finding, "Target"))
        claimed.extend(value(dropped, "ID") for dropped in data(record, "Dropped"))
        self.unique(claimed, record["Confirmed findings"], "candidate disposition")

    def comments(self, record):
        findings = {value(f, "ID"): f for f in data(record, "Confirmed findings")}
        comments = data(record, "Comments")
        self.equal(record, "Findings count", len(findings))
        for key, kind in (("New comments", "new"), ("Follow-up replies", "follow-up")):
            self.equal(record, key, sum(value(c, "Kind") == kind for c in comments))
        self.equal(record, "Metadata gaps", [])
        for finding_id, finding in findings.items():
            expected = int(value(finding, "Dedup") in ("new", "follow-up"))
            self.require(sum(value(c, "Finding ID") == finding_id for c in comments) == expected,
                         finding["Dedup"], "finding needs exactly " + str(expected) + " matching comments")
        for comment in comments:
            finding = findings.get(value(comment, "Finding ID"))
            self.require(finding is not None, comment["Finding ID"], "comment must name a confirmed finding")
            kind = value(comment, "Kind")
            if finding:
                self.require(kind == value(finding, "Dedup"), comment["Kind"], "comment Kind must match finding Dedup")
                if kind == "follow-up" and value(comment, "Reopen") == "yes":
                    target = data(finding, "Target", {})
                    self.require(value(target, "is_resolved") == "true" and value(target, "viewer_can_unresolve") == "true",
                                 comment["Reopen"], "Reopen yes requires a resolved target and unresolve capability")
            if kind == "new":
                start, side = value(comment, "Start line"), value(comment, "Start side")
                self.require((start == "none") == (side == "none"), comment["Start line"], "start fields must both be none or both supplied")
                if start != "none" and side == value(comment, "Side"):
                    self.require(integer(start) < integer(value(comment, "Line")), comment["Start line"], "start line must precede ending line; single lines use none")
            suggestion = value(comment, "Suggestion included") == "yes"
            self.equal(comment, "Suggestion", "included in body" if suggestion else "none")
            if suggestion:
                body = data(comment, "Body")
                opening = re.search(r"(?m)^ {4} {0,3}(`{3,}|~{3,})suggestion(?::[^\n]*|[ \t][^\n]*)?\n", body)
                closing = None
                if opening:
                    fence = opening[1]
                    closing = re.search(r"(?m)^ {4} {0,3}" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}[ \t]*\n", body[opening.end():])
                self.require(bool(closing), comment["Body"], "Suggestion included yes requires a suggestion fence in Body")

    def verify(self, record, status):
        checks = data(record, "Checks")
        for key in ("Version identity", "Canonical fidelity", "Coverage", "Evidence support", "Review decision"):
            self.require(not value(checks, key).startswith("not applicable - "), checks[key], key + " cannot be not applicable")
        failed = any(node.value.startswith("fail - ") for node in checks.values())
        self.require(failed == (status == "FAIL"), record["Checks"], "FAIL needs a failed check; PASS permits none")
        self.require(bool(data(record, "Issues")) == (status == "FAIL"), record["Issues"], "FAIL needs issues; PASS requires - none")
        for key in ("Fix target", "Reason"):
            self.require((value(record, key) != "none") == (status == "FAIL"), record[key], key + " must be none only for PASS")
        package = data(record, "Verified package summary")
        self.require(data(package, "Findings count") >= data(package, "New comments") + data(package, "Follow-up replies"),
                     package["Findings count"], "findings count cannot be less than new plus follow-up counts")

    def post(self, record, status):
        actions = data(record, "Actions")
        self.require(value(actions[0], "Kind") == "review" and sum(value(a, "Kind") == "review" for a in actions) == 1,
                     record["Actions"], "Actions must start with exactly one review")
        followups = False
        creations = []
        for index, action in enumerate(actions):
            kind, finding_id = value(action, "Kind"), value(action, "Finding ID")
            self.equal(action, "Action ID", "review" if kind == "review" else kind + ":" + finding_id)
            self.require((finding_id == "none") == (kind == "review"), action["Finding ID"], "only review has Finding ID none")
            if kind == "inline":
                self.require(not followups, action["Kind"], "inline actions must precede follow-ups")
            followups |= kind in ("reopen", "reply")
            if kind in ("inline", "reply"):
                creations.append(finding_id)
            identifier = value(action, "ID")
            confirmed = value(action, "State") == "confirmed"
            if identifier != "none":
                rule = "node" if kind == "reopen" else "uint"
                self.require(TYPES[rule](identifier), action["ID"], "action ID must be " + rule + " or none")
            if confirmed:
                self.require(identifier != "none" and value(action, "URL") != "none", action["ID"], "confirmed action requires ID and URL")
                if kind == "reopen":
                    self.equal(action, "ID", value(action, "thread_id"))
            if kind == "reopen":
                reply = actions[index + 1] if index + 1 < len(actions) else {}
                self.require(value(reply, "Kind") == "reply" and value(reply, "Finding ID") == finding_id
                             and value(reply, "thread_id") == value(action, "thread_id"), action["Kind"],
                             "reopen must immediately precede its paired reply")
            if kind == "review":
                decision = value(record, "Review decision posted")
                allowed = DECISION.split("|") if confirmed else ["uncertain" if value(action, "State") == "uncertain" else "none"]
                self.require(decision in allowed, record["Review decision posted"], "posted decision must match review action state")
        self.unique(creations, record["Actions"], "comment creation finding ID")
        for key, kind in (("New comments posted", "inline"), ("Follow-up replies posted", "reply")):
            self.equal(record, key, sum(value(a, "Kind") == kind and value(a, "State") == "confirmed" for a in actions))
        confirmed_count = sum(value(a, "State") == "confirmed" for a in actions)
        if status == "PASS":
            self.equal(record, "Preview approved", "true")
            self.require(confirmed_count == len(actions), record["Actions"], "PASS requires all actions confirmed")
            self.equal(record, "Read-back verified", "yes")
            self.equal(record, "Skipped or failed comments", [])
        elif status == "PARTIAL":
            self.require(confirmed_count > 0 and (confirmed_count < len(actions) or value(record, "Read-back verified") != "yes"),
                         record["Actions"], "PARTIAL needs a confirmed action and non-confirmed actions or incomplete read-back")
        elif status == "ERROR":
            self.require(confirmed_count == 0, record["Actions"], "confirmed incomplete effects require PARTIAL, not ERROR")
        elif status in ("PREVIEW_REQUIRED", "AUTH", "METADATA_INVALID", "TOOLS_MISSING"):
            self.require(all(value(a, "State") == "unattempted" for a in actions), record["Actions"], "pre-effect status requires all actions unattempted")
            self.equal(record, "Review decision posted", "none")
        for key in ("Reason", "Next step"):
            self.require((value(record, key) == "none") == (status == "PASS"), record[key], key + " must be none only for PASS")


def fixtures():
    pins = "PR: acme/widgets#7\nREVIEWED_BASE_SHA: " + "a" * 40 + "\nREVIEWED_HEAD_SHA: " + "b" * 40 + "\n"
    target = """    thread_id: PRRT_example
    is_resolved: true
    viewer_can_unresolve: true
    path: billing.py
    line: 12
    root_comment_id: 123
    root_url: https://github.com/acme/widgets/pull/7#discussion_r123
    comments_total: 2
    comments_returned: 2
    comments_truncated: false
"""
    candidate = """- ID: security-1
  Severity: important
  Title: Check authorization before loading the export
  Location: inline
  Path: billing.py
  Line: 12-14
  Side: RIGHT
  Evidence: billing.py:12 loads the export before the guard.
  Failure scenario: A non-admin can read another account's export.
  Minimal fix: Move the guard before the lookup.
  External sources: none
  Confidence: high
"""
    confirmed = candidate.replace("  Severity:", "  Candidate IDs: security-1\n  Disposition: confirmed\n  Severity:", 1)
    confirmed += "  Dedup: follow-up\n  Target:\n" + target
    confirmed += """- ID: security-2
  Candidate IDs: security-2
  Disposition: adjusted
  Original severity: important
  Severity: suggestion
  Title: Document the migration risk
  Location: summary
  Evidence: The migration affects deployments outside the changed files.
  Failure scenario: Operators can miss a required migration.
  Minimal fix: Document the ordering.
  External sources: https://example.com/migrations
  Confidence: medium
  Dedup: summary
"""
    context = """CONTEXT: PASS
PR: acme/widgets#7
PR state: open
Title: Secure exports
Author: octocat
Base: main
Head: fix-exports
""" + pins.split("\n", 1)[1] + """Output file: reviews/pr-7.md
Shortstat: 1 file changed, 2 insertions, 1 deletion
Changed files:
- billing.py
CI collected at: 2026-10-15T10:00:00Z
CI: reported passing at collection
Linked issue/context: none
Behavior summary: Tightens export access.
Risk areas:
- Authorization before lookup
Test signals: Guard regression test added
Dimensions:
- Name: security
  Files:
  - billing.py
  Rationale: Authorization changed
History availability: complete
Existing threads:
""" + "- " + target[4:].replace("\n    ", "\n  ").rstrip("\n") + "\n  Summary: Prior authorization concern\n" + """Top-level feedback:
- Kind: review-summary
  URL: https://github.com/acme/widgets/pull/7#pullrequestreview-5
  Summary: Please check access control.
References fetched: none
Context limitations:
- none
Reason: none
Decision needed: none
"""
    chunk = "CHUNK: PASS\n" + pins + """Dimension: security
Inspected scope:
- Path: billing.py
  Ranges: 1-20, 25
Coverage gaps:
- none
Findings:
""" + candidate + """Residual risks:
- none
Context needed: none
References fetched: none
Reason: none
"""
    sections = "History availability: complete\nConfirmed findings:\n" + confirmed + """Dropped:
- ID: security-3
  Reason: Already protected by the caller.
Residual risks:
- Deployment evidence unavailable
"""
    adjudicate = "ADJUDICATE: PASS\n" + pins + sections + "References fetched: none\nReason: none\n"
    comments = "COMMENTS: PASS\nPR: acme/widgets#7\nPR state: open\n" + pins.split("\n", 1)[1] + """History availability: complete
Review decision recommendation: request changes
Findings count: 2
New comments: 0
Follow-up replies: 1
Review summary:
  Please fix the access control issue before merge.
\x20\x20
  ## Migration observation
  Document deployment ordering.
""" + sections.split("\n", 1)[1] + """Comments:
- Finding ID: security-1
  Kind: follow-up
  Reopen: yes
  Suggestion included: no
  Body:
    Following up on this thread: exports are still loaded before the admin guard. A non-admin can read another account's export. Could we move the guard before the lookup?
\x20\x20\x20\x20
    Reason: this is body text, not a routed field.\x20\x20
  Suggestion: none
Metadata gaps:
- none
References fetched: none
Reason: none
"""
    verify = "VERIFY: PASS\n" + pins + """Checks:
- Version identity: pass - Both pinned versions match.
- Canonical fidelity: pass - Records and exact Markdown match.
- Coverage: pass - The supplied scope and gaps match.
- Evidence support: pass - Evidence supports the findings.
- External sources: pass - Cited documentation was fetched.
- Self-containment: pass - Comments explain cause and fix.
- Line metadata: not applicable - No new inline comments.
- Dedup dispositions: pass - Existing target preserved.
- Suggestion safety: not applicable - No patch suggested.
- Severity: pass - Severity matches the observed impact.
- Review decision: pass - The access defect blocks merge.
- CI evidence: pass - Collection-time evidence is qualified.
- Language: pass - Attribution and language checked.
Verified package summary:
- Findings count: 2
- New comments: 0
- Follow-up replies: 1
- Review decision: request changes
- Residual risks: Deployment evidence unavailable
Issues:
- none
Observed checks:
- Validator passed; no local tests were executed.
References fetched: none
Fix target: none
Reason: none
"""
    write = """WRITE: PASS
Mode: write
File: reviews/pr-7.md
File effect: created
Content SHA256: """ + "c" * 64 + """
Findings count: 2
Review decision: request changes
Posting status: draft
Receipt saved: not applicable
Reason: none
"""
    post = "POST: PASS\n" + pins + """Preview approved: true
Review decision posted: request changes
New comments posted: 0
Follow-up replies posted: 1
Read-back verified: yes
Actions:
- Action ID: review
  Kind: review
  Finding ID: none
  State: confirmed
  ID: 456
  URL: https://github.com/acme/widgets/pull/7#pullrequestreview-456
  Detail: Exact review read back.
- Action ID: reopen:security-1
  Kind: reopen
  Finding ID: security-1
  State: confirmed
  ID: PRRT_example
  URL: https://github.com/acme/widgets/pull/7#discussion_r123
  thread_id: PRRT_example
  Detail: Thread reopened and read back.
- Action ID: reply:security-1
  Kind: reply
  Finding ID: security-1
  State: confirmed
  ID: 789
  URL: https://github.com/acme/widgets/pull/7#discussion_r789
  thread_id: PRRT_example
  root_comment_id: 123
  Detail: Exact reply read back.
Skipped or failed comments:
- none
References fetched: none
Reason: none
Next step: none
"""
    return dict(context=context, chunk=chunk, adjudicate=adjudicate, comments=comments,
                verify=verify, write=write, post=post)


def self_test():
    good = fixtures()
    cases = [(mode + " good", mode, text, True) for mode, text in good.items()]
    cases += [(mode + " bad enum", mode, text.replace(": PASS", ": BOGUS", 1), False)
              for mode, text in good.items()]
    c = good["comments"]
    partial = good["post"].replace("POST: PASS", "POST: PARTIAL").replace(
        "Follow-up replies posted: 1", "Follow-up replies posted: 0").replace(
        "Read-back verified: yes", "Read-back verified: partial").replace(
        "State: confirmed\n  ID: 789\n  URL: https://github.com/acme/widgets/pull/7#discussion_r789",
        "State: failed\n  ID: none\n  URL: none").replace(
        "Skipped or failed comments:\n- none", "Skipped or failed comments:\n- security-1 reply failed").replace(
        "Reason: none\nNext step: none", "Reason: Reply failed\nNext step: Reconcile read-only")
    fail = good["verify"].replace("VERIFY: PASS", "VERIFY: FAIL").replace(
        "Coverage: pass", "Coverage: fail").replace("Issues:\n- none", "Issues:\n- Missing scope").replace(
        "Fix target: none", "Fix target: pr-context-collector").replace("Reason: none", "Reason: Missing coverage")
    cases += [
        ("findings exceed comments", "comments", c, True),
        ("reopen unresolved target", "comments", c.replace("is_resolved: true", "is_resolved: false"), False),
        ("reopen without capability", "comments", c.replace("viewer_can_unresolve: true", "viewer_can_unresolve: false"), False),
        ("partial post", "post", partial, True),
        ("partial is not pass", "post", partial.replace("POST: PARTIAL", "POST: PASS"), False),
        ("pass is not partial", "post", good["post"].replace("POST: PASS", "POST: PARTIAL").replace(
            "Reason: none\nNext step: none", "Reason: All effects verified\nNext step: Report PASS"), False),
        ("valid repair owner", "verify", fail, True),
        ("invalid repair owner", "verify", fail.replace("pr-context-collector", "orchestrator-decision"), False),
    ]
    for readback in ("partial", "no"):
        incomplete = good["post"].replace("Read-back verified: yes", "Read-back verified: " + readback)
        confirmed_partial = incomplete.replace("POST: PASS", "POST: PARTIAL").replace(
            "Reason: none\nNext step: none", "Reason: Read-back incomplete\nNext step: Reconcile read-only")
        cases += [
            ("all confirmed read-back " + readback + " is PARTIAL", "post", confirmed_partial, True),
            ("all confirmed read-back " + readback + " is not PASS", "post", incomplete, False),
            ("all confirmed read-back " + readback + " is not ERROR", "post", confirmed_partial.replace("POST: PARTIAL", "POST: ERROR"), False),
        ]
    mutations = {
        "context": [
            ("dimension outside changed set", "  - billing.py", "  - missing.py", False),
            ("duplicate dimensions", "  Rationale: Authorization changed\n", "  Rationale: Authorization changed\n- Name: security\n  Files:\n  - billing.py\n  Rationale: Second\n", False),
            ("zero dimensions", "- Name: security\n  Files:\n  - billing.py\n  Rationale: Authorization changed", "- none", False),
            ("decimal thread ID", "thread_id: PRRT_example", "thread_id: 123", False),
            ("returned count exceeds total", "comments_returned: 2", "comments_returned: 3", False),
            ("complete history cannot truncate", "comments_total: 2", "comments_total: 3", False),
            ("partial history carries truncation", "History availability: complete", "History availability: partial", True),
            ("unsafe output path", "reviews/pr-7.md", "../pr-7.md", False),
        ],
        "chunk": [
            ("reversed range", "Line: 12-14", "Line: 14-12", False),
            ("whole file inspection", "Ranges: 1-20, 25", "Ranges: whole file", True),
            ("whole file not an anchor", "Line: 12-14", "Line: whole file", False),
            ("wrong dimension ID", "ID: security-1", "ID: tests-1", False),
            ("zero finding suffix", "ID: security-1", "ID: security-0", False),
            ("empty PASS", "Findings:\n" + good["chunk"].split("Findings:\n")[1].split("Residual risks:")[0], "Findings:\n- none\n", False),
            ("sources need URLs", "External sources: none", "External sources: remembered docs", False),
        ],
        "adjudicate": [
            ("summary needs summary dedup", "Dedup: summary", "Dedup: new", False),
            ("adjustment needs original severity", "  Original severity: important\n", "", False),
            ("confirmed omits original severity", "  Disposition: confirmed\n", "  Disposition: confirmed\n  Original severity: nit\n", False),
            ("dropped candidate cannot survive", "- ID: security-3", "- ID: security-1", False),
            ("retained ID must be a candidate", "Candidate IDs: security-1", "Candidate IDs: other-1", False),
            ("duplicate candidates", "Candidate IDs: security-1", "Candidate IDs: security-1, security-1", False),
            ("null roots remain draft data", "root_comment_id: 123", "root_comment_id: null", True),
            ("decimal REST root only", "root_comment_id: 123", "root_comment_id: PRRC_example", False),
        ],
        "comments": [
            ("wrong total", "Findings count: 2", "Findings count: 1", False),
            ("counts cannot be negative", "New comments: 0", "New comments: -1", False),
            ("wrong reply count", "Follow-up replies: 1", "Follow-up replies: 0", False),
            ("missing matching comment", "Finding ID: security-1", "Finding ID: unknown-1", False),
            ("suggestion requires fence", "Suggestion included: no", "Suggestion included: yes", False),
            ("summary may contain fields", "  Document deployment ordering.", "  Findings count: 999\n  ```\n  opaque  \n  ```", True),
            ("unindented blank summary", "\x20\x20\n  ##", "\n  ##", False),
            ("opaque empty body line", "    Following up on this thread: exports are still loaded before the admin guard. A non-admin can read another account's export. Could we move the guard before the lookup?", "\x20\x20\x20\x20", True),
            ("PASS has no metadata gaps", "Metadata gaps:\n- none", "Metadata gaps:\n- Missing line", False),
        ],
        "verify": [
            ("PASS has no failures", "Coverage: pass", "Coverage: fail", False),
            ("mandatory check cannot be NA", "Coverage: pass", "Coverage: not applicable", False),
            ("PASS has no repair target", "Fix target: none", "Fix target: comment-drafter", False),
            ("every check needs explanation", "Version identity: pass - Both pinned versions match.", "Version identity: pass", False),
            ("counts may exceed actions", "- Findings count: 2", "- Findings count: 3", True),
            ("actions cannot exceed findings", "- Findings count: 2", "- Findings count: 0", False),
        ],
        "write": [
            ("write cannot claim update", "File effect: created", "File effect: updated", False),
            ("write has no receipt", "Receipt saved: not applicable", "Receipt saved: yes", False),
            ("update needs updated effect", "Mode: write", "Mode: update", False),
            ("bad digest", "c" * 64, "c" * 63, False),
        ],
        "post": [
            ("approval required", "Preview approved: true", "Preview approved: false", False),
            ("readback required", "Read-back verified: yes", "Read-back verified: partial", False),
            ("confirmed reply count", "Follow-up replies posted: 1", "Follow-up replies posted: 0", False),
            ("reopen ID matches thread", "  ID: PRRT_example", "  ID: PRRT_other", False),
            ("confirmed REST ID decimal", "  ID: 789", "  ID: PRRC_example", False),
            ("action ID matches kind/finding", "Action ID: reply:security-1", "Action ID: reply:other-1", False),
            ("PASS needs posted decision", "Review decision posted: request changes", "Review decision posted: none", False),
            ("review is mandatory", good["post"].split("Actions:\n")[1].split("- Action ID: reopen:")[0], "", False),
            ("preeffect cannot confirm", "POST: PASS", "POST: AUTH", False),
        ],
    }
    for mode, changes in mutations.items():
        for name, old, new, expected in changes:
            assert old in good[mode], name
            cases.append((name, mode, good[mode].replace(old, new, 1), expected))
    new = c.replace("  Dedup: follow-up\n  Target:\n" + c.split("  Target:\n", 1)[1].split("- ID: security-2", 1)[0], "  Dedup: new\n").replace(
        "New comments: 0\nFollow-up replies: 1", "New comments: 1\nFollow-up replies: 0").replace(
        "  Kind: follow-up\n  Reopen: yes", "  Kind: new\n  Path: billing.py\n  Line: 14\n  Side: RIGHT\n  Start line: 12\n  Start side: RIGHT")
    suggestion = new.replace("Suggestion included: no", "Suggestion included: yes").replace(
        "  Suggestion: none", "    ```suggestion\n    guard_admin()\n    ```\n  Suggestion: included in body")
    cases += [
        ("new multiline metadata", "comments", new, True),
        ("new single-line metadata", "comments", new.replace("Start line: 12\n  Start side: RIGHT", "Start line: none\n  Start side: none"), True),
        ("paired start fields", "comments", new.replace("Start side: RIGHT", "Start side: none"), False),
        ("ordered start fields", "comments", new.replace("Start line: 12", "Start line: 15"), False),
        ("real suggestion", "comments", suggestion, True),
        ("suggestion fence must close", "comments", suggestion.replace("    ```\n", ""), False),
        ("not a suggestion fence", "comments", suggestion.replace("```suggestion\n", "```suggestionary\n"), False),
        ("null/truncated target remains visible", "comments", c.replace("History availability: complete", "History availability: partial").replace("root_comment_id: 123", "root_comment_id: null").replace("comments_total: 2", "comments_total: 3").replace("comments_truncated: false", "comments_truncated: true"), True),
        ("write update", "write", good["write"].replace("Mode: write", "Mode: update").replace("File effect: created", "File effect: updated").replace("Posting status: draft", "Posting status: posted").replace("Receipt saved: not applicable", "Receipt saved: yes"), True),
        ("distinct feedback same kind", "context", good["context"].replace("References fetched: none", "- Kind: review-summary\n  URL: https://example.com/other\n  Summary: Additional review\nReferences fetched: none"), True),
        ("rows each require a bullet", "verify", good["verify"].replace("- Coverage:", "  Coverage:"), False),
        ("ERROR cannot conceal partial effects", "post", partial.replace("POST: PARTIAL", "POST: ERROR"), False),
        ("URL port must be numeric", "post", good["post"].replace("https://github.com/", "https://github.com:bad/", 1), False),
        ("text lists cannot mix none", "context", good["context"].replace("Context limitations:\n- none", "Context limitations:\n- none\n- Missing context"), False),
        ("empty list sentinel must be exact", "context", good["context"].replace("Context limitations:\n- none", "Context limitations:\n- none "), False),
        ("duplicate multiline record", "context", good["context"].replace("References fetched: none", "- Kind: review-summary\n  URL: https://github.com/acme/widgets/pull/7#pullrequestreview-5\n  Summary: Please check access control.\nReferences fetched: none"), False),
        ("seven dimensions", "context", good["context"].replace("History availability: complete", "".join("- Name: dimension-" + str(i) + "\n  Files:\n  - billing.py\n  Rationale: Check\n" for i in range(6)) + "History availability: complete"), False),
        ("scope or gap must be supplied", "chunk", good["chunk"].replace("- Path: billing.py\n  Ranges: 1-20, 25", "- none"), False),
        ("single line needs none start", "comments", new.replace("Start line: 12", "Start line: 14"), False),
    ]
    inline_post = good["post"].replace("New comments posted: 0", "New comments posted: 1").replace(
        "- Action ID: reopen:security-1", "- Action ID: inline:security-4\n  Kind: inline\n  Finding ID: security-4\n  State: confirmed\n  ID: 900\n  URL: https://example.com/inline\n  Detail: Read back\n- Action ID: reopen:security-1")
    cases.append(("confirmed inline creation", "post", inline_post, True))
    failure_blocks = {
        "context": "PR: acme/widgets#7\nReason: Context unavailable\nDecision needed: Supply context\n",
        "chunk": "PR: acme/widgets#7\nDimension: security\nContext needed: Source unavailable\nReason: Cannot inspect\n",
        "adjudicate": "PR: acme/widgets#7\nReason: Evidence unavailable\nNext step: Supply evidence\n",
        "comments": "PR: acme/widgets#7\nMetadata gaps:\n- Missing target\nReason: Cannot draft\n",
        "verify": "PR: acme/widgets#7\nIssues:\n- Missing evidence\nReason: Cannot verify\nNext step: Supply evidence\n",
        "write": "Mode: write\nFile: reviews/pr-7.md\nFile effect: uncertain\nReason: Write result unavailable\nNext step: Inspect without replay\n",
    }
    for mode, block in failure_blocks.items():
        for status in STATUSES[mode].split("|"):
            if status not in SUCCESS.get(mode, ("PASS",)):
                payload = mode.upper() + ": " + status + "\n" + block
                cases.append((mode + " " + status, mode, payload, True))
    for mode, key in (("chunk", "Findings"), ("adjudicate", "Confirmed findings")):
        payload = good[mode].replace(": PASS", ": NO_FINDINGS", 1)
        records = payload.split(key + ":\n", 1)[1].split("Residual risks:" if mode == "chunk" else "Dropped:", 1)[0]
        cases.append((mode + " no findings", mode, payload.replace(records, "- none\n", 1), True))
    before_effects = re.sub(r"(?m)^  (ID|URL): .*", lambda m: "  " + m[1] + ": none", good["post"]).replace(
        "State: confirmed", "State: unattempted").replace("Review decision posted: request changes", "Review decision posted: none").replace(
        "Follow-up replies posted: 1", "Follow-up replies posted: 0").replace("Read-back verified: yes", "Read-back verified: no").replace(
        "Reason: none\nNext step: none", "Reason: No authorization\nNext step: Obtain fresh preview")
    for status in ("PREVIEW_REQUIRED", "AUTH", "METADATA_INVALID", "TOOLS_MISSING", "ERROR"):
        cases.append(("post " + status, "post", before_effects.replace("POST: PASS", "POST: " + status), True))
    for mode, payload in good.items():
        field_lines = payload.splitlines(keepends=True)
        cases += [
            (mode + " missing PR/file", mode, "".join(field_lines[:1] + field_lines[2:]), False),
            (mode + " extra field", mode, payload + "Extra: text\n", False),
            (mode + " out of order", mode, field_lines[0] + field_lines[2] + field_lines[1] + "".join(field_lines[3:]), False),
            (mode + " duplicate field", mode, field_lines[0] + field_lines[1] + "".join(field_lines[1:]), False),
            (mode + " fenced payload", mode, "```text\n" + payload + "```\n", False),
        ]
    failures = 0
    for name, mode, payload, expected in cases:
        findings = validate(mode, payload)
        if (not findings) != expected:
            failures += 1
            print("self-test: FAIL " + name + ": expected " + ("accept" if expected else "reject"))
            for line in findings:
                print(line)
    print("self-test: " + str(len(cases) - failures) + "/" + str(len(cases)) + " passed")
    return int(bool(failures))


def validate(mode, payload):
    checker = Validator(mode)
    lines = list(enumerate(re.findall(r"[^\n]*\n|[^\n]+$", payload), 1))
    status = lines[0][1].removesuffix("\n") if lines else ""
    prefix = mode.upper() + ": "
    status = status[len(prefix):] if status.startswith(prefix) else ""
    if status not in STATUSES[mode].split("|"):
        checker.require(False, 1, "expected " + prefix + STATUSES[mode])
        return checker.findings
    success = mode == "post" or status in SUCCESS.get(mode, ("PASS",))
    declaration = mode.upper() + "=" + STATUSES[mode] + ";" + MODES[mode][0 if success else 1]
    record = checker.fields(lines, 0, declaration)
    if not checker.findings:
        checker.constraints(record, status)
    return checker.findings


USAGE = """Usage: python3 -I "${SKILL_DIR}/scripts/validate-output.py" <context|chunk|adjudicate|comments|verify|write|post> < payload
       python3 -I "${SKILL_DIR}/scripts/validate-output.py" --self-test
       python3 -I "${SKILL_DIR}/scripts/validate-output.py" -h
Exit 0: conforms. Exit 1: shape defects or failed self-test. Exit 2: bad invocation.
Side effects: none. Shape only, never semantic proof. Environment variables: none;
SKILL_DIR in the shell command locates this script, not an input to the checker."""


def main(arguments):
    if arguments == ["-h"]:
        print(USAGE)
        return 0
    if arguments == ["--self-test"]:
        return self_test()
    if len(arguments) != 1 or arguments[0] not in STATUSES:
        print(USAGE, file=sys.stderr)
        return 2
    mode = arguments[0]
    try:
        payload = sys.stdin.buffer.read().decode("utf-8")
    except UnicodeDecodeError:
        print(mode + ": line 1: payload must be UTF-8")
        return 1
    findings = validate(mode, payload)
    for finding in findings:
        print(finding)
    return int(bool(findings))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
