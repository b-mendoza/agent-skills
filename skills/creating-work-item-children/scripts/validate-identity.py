#!/usr/bin/env python3
"""Usage: python3 -I validate-identity.py < evidence.json

Read-only comparison of independently extracted plan and child content.
Exit 0: complete matching identity; 1: invalid, incomplete, or stale evidence.
"""
import hashlib
import json
import sys

FIELDS = {"title", "objective", "requirements", "dependencies", "questions",
          "implementation", "done", "artifacts"}


def task(value):
    if not isinstance(value, dict) or set(value) != FIELDS:
        raise ValueError("all task identity fields are required")
    if any(not isinstance(text, str) or not text.strip() for text in value.values()):
        raise ValueError("empty task identity field")
    return {key: text.replace("\r\n", "\n").strip() for key, text in value.items()}


def main():
    evidence = json.load(sys.stdin)
    parent = evidence["parent"]
    child = evidence["child"]
    if not isinstance(parent, str) or not parent.strip() or child["parent"] != parent:
        raise ValueError("parent identity mismatch")
    planned = task(evidence["task"])
    if task(child["task"]) != planned:
        raise ValueError("stale or conflicting task content; index is not identity")
    canonical = json.dumps({"parent": parent, "task": planned}, sort_keys=True,
                           ensure_ascii=False, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    print("IDENTITY: PASS sha256=" + digest)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, AttributeError) as error:
        print("IDENTITY: BLOCKED " + str(error), file=sys.stderr)
        sys.exit(1)
