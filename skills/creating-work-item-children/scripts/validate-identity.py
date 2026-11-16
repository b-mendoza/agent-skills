#!/usr/bin/env python3
"""Usage: python3 -I validate-identity.py < evidence.json

Compare independently extracted plan and child content; no arguments or env vars.
Exit 0: matching identity; 1: invalid/incomplete/stale evidence (BLOCKED); 2: usage (ERROR).
Side effects: none.
Smoke: printf '%s' '{}' | python3 -I skills/creating-work-item-children/scripts/validate-identity.py  # exit 1
"""
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
    print("IDENTITY: PASS")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(__doc__)
        sys.exit(2)
    try:
        main()
    except (ValueError, KeyError, TypeError, AttributeError) as error:
        print("IDENTITY: BLOCKED " + str(error), file=sys.stderr)
        sys.exit(1)
