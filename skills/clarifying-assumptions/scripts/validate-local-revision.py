#!/usr/bin/env python3
"""Usage: python3 -I validate-local-revision.py ROOT KEY MODE TASK < evidence.json

Evidence: {"files": {relative_path: before_text}, "replacements": [{"old": ..., "new": ...}]}.
Capture before_text with read_bytes().decode("utf-8") after recording decisions
but before applying approved copy edits. Preserve all newline bytes in JSON strings.
Exit 0 verifies exact edits across the complete artifact set; 1 fails closed.
This proves byte consistency, not semantic equivalence. The recorder must first
establish that the user requested only wording changes, with no contract change.
"""
import json
from pathlib import Path
import re
import sys


def main():
    if len(sys.argv) != 5:
        raise ValueError(__doc__.splitlines()[0])
    root, key, mode, number = sys.argv[1:]
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]*", key):
        raise ValueError("invalid key")
    if mode == "upfront":
        suffixes = ["tasks", "stage-1-detailed", "stage-2-prioritized"]
    elif mode == "critique" and re.fullmatch(r"[1-9][0-9]*", number):
        suffixes = ["tasks"] + [f"task-{number}-{part}" for part in
                              ("brief", "execution-plan", "test-spec", "refactoring-plan")]
    else:
        raise ValueError("invalid mode or task")
    expected_paths = {f"docs/{key}-{suffix}.md" for suffix in suffixes}
    evidence = json.load(sys.stdin)
    files = evidence["files"]
    edits = evidence["replacements"]
    if not isinstance(files, dict) or set(files) != expected_paths or not edits:
        raise ValueError("incomplete artifact inventory")
    for edit in edits:
        old, new = edit["old"], edit["new"]
        if (not isinstance(old, str) or not isinstance(new, str) or not old.strip()
                or not new.strip() or old == new or
                any(char in old + new for char in "\n\r`|#<>")):
            raise ValueError("copy edits must be nonempty, single-line prose")
        if not any(old in text for text in files.values()):
            raise ValueError("unmatched copy edit")
    base = Path(root).resolve(strict=True)
    changed = 0
    for relative, before in files.items():
        if not isinstance(before, str):
            raise ValueError("before text must be a string")
        path = base / relative
        if path.is_symlink() or not path.resolve(strict=True).is_relative_to(base):
            raise ValueError("artifact escapes root")
        before_bytes = before.encode("utf-8")
        expected = before_bytes
        for edit in edits:
            expected = expected.replace(edit["old"].encode("utf-8"),
                                        edit["new"].encode("utf-8"))
        after = path.read_bytes()
        if after != expected:
            raise ValueError("stale artifact or unexpected edit: " + relative)
        changed += before_bytes != after
    if not changed:
        raise ValueError("no applied copy edit")
    print(f"LOCAL_REVISION: PASS files={len(files)}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError) as error:
        print("LOCAL_REVISION: FAIL " + str(error), file=sys.stderr)
        sys.exit(1)
