#!/usr/bin/env python3
"""Check selected-task planning outputs, without changing files.

Usage: python3 validate-output.py <plan|PREP|PLAN|TEST_SPEC|REFACTORING> < payload
       python3 validate-output.py --help
plan lexically checks executable clauses for Git staging/history/publication work.
Objects are distinguished by their head/context, including named branches with
origin/upstream or Git-reference destinations, bare origin/upstream refspecs for
push, and option-leading mutations. Rebase/cherry-pick and bare publication/file
actions stay conservative. Prohibitions are clause-local.
Equivalent instructions outside the recognized wording need semantic review.
Uppercase modes validate the exact one-line-field handoff before routing.
Exit: 0 valid, 1 contract findings (repair), 2 usage error (ERROR).
Side effects: none; stdlib only, no filesystem writes, git, or network.
Smoke: printf '1. Run node --test.\nDo not commit.\n' | python3 validate-output.py plan
"""

import re
import shlex
import sys

FIELDS = {
    "PREP": ["Task", "Brief", "Dependencies", "Questions", "References fetched", "Notes"],
    "PLAN": ["Execution plan", "Recommended skills", "References fetched", "Approach", "Blockers"],
    "TEST_SPEC": ["Spec", "Framework", "References fetched", "Coverage", "Blockers"],
    "REFACTORING": ["Refactoring plan", "Verdict", "References fetched", "Summary", "Blockers"],
}
FORBIDDEN = {"add", "stage", "commit", "push", "rebase", "reset", "cherry-pick", "revert", "merge", "am", "filter-branch", "filter-repo"}
# Object heads, not words anywhere in a sentence, distinguish Git operands
# from "search index", "commit event", or a destination such as "remote cache".
DETERMINERS = r"(?:(?:the|a|an|this|that|these|those|our|your|my)\s+)*"
HEAD_END = r"(?=$|[.,;:!?]|\s+(?:to|onto|from|with|using|after|before|once|when|if|so|for|as)\b)"
GIT_TARGET = re.compile(
    r"^(?:(?:to|onto)\s+)?" + DETERMINERS
    + r"(?:git\s+)?(?:branch(?:es)?|(?:commit\s+)?history|commits?|index|worktree|working[ -]tree|repository|repo|remotes?|origin|upstream)"
    + HEAD_END,
    re.I,
)
# HEAD is case-sensitive; IDs require mixed hex and at least seven characters.
# This keeps ordinary words ("facade") and numeric product values out.
GIT_REFERENCE = re.compile(
    r"^(?:HEAD(?:[~^]\d*)?\b|(?=[a-f0-9]{7,40}\b)(?=[a-f0-9]*[a-f])(?=[a-f0-9]*\d)[a-f0-9]+\b)"
)
CHANGE_TARGET = re.compile(
    r"^(?:(?:the|a|all|this|that|these|those|our|your|my|only|exactly|changed|modified|staged|selected|named|tracked|untracked|source|\d+)\s+)*"
    r"(?:changes?|fix(?:es)?|files?|paths?|patch(?:es)?|implementation|code|work|everything|all|[^\s]+/[^\s]+|[^\s]+\.[a-z0-9]+)\b",
    re.I,
)
# Message-bearing commits and counted/adjectival commit creation cover #123.
COMMIT_MESSAGE = re.compile(r"^(?:(?:with|using)\b.*\bmessage\b|-m(?:\s|=|$))", re.I)
CREATED_COMMIT = re.compile(r"^(?:[\w-]+\s+){0,3}commit" + HEAD_END, re.I)
# Boundaries end the scope of a prohibition or an earlier action's object.
CLAUSE_SEPARATOR = re.compile(r";\s*|,?\s+\b(?:and|then|but)\b\s*", re.I)
PROHIBITION = re.compile(r"^(?:do not|don't|never|must not|no)\b", re.I)


def is_git_action(action, target, product_antecedent):
    target = target.strip()
    if action in {"rebase", "cherry-pick"}:
        return True
    if action in {"create", "make"}:
        return bool(CREATED_COMMIT.match(target))
    if GIT_TARGET.match(target) or GIT_REFERENCE.match(target):
        return True
    # Only push takes a bare remote/refspec pair; a determiner makes it a
    # product object, as in "push the origin story to the CMS".
    if action == "push" and re.match(r"(?i)^(?:origin|upstream)\s+\S+" + HEAD_END, target):
        return True
    # A branch name alone is ambiguous with "branch counter". Require a
    # destination that names a conventional remote or a Git reference.
    branch = re.match(r"(?i)^" + DETERMINERS + r"(?:git\s+)?branch\s+\S+\s+(?:to|onto)\s+(.+)", target)
    if branch and (
        GIT_REFERENCE.match(branch[1])
        or re.match(r"(?i)^(?:origin|upstream)(?:/\S+)?" + HEAD_END, branch[1])
    ):
        return True
    if action in {"stage", "commit", "push", "reset"} and re.match(r"^--?[a-zA-Z0-9]", target):
        return True
    # A reset with no product object, just "to <ref>", stays conservative,
    # including short refs such as "reset to abc123".
    if action == "reset" and re.match(r"(?i)^to\s+\S+", target):
        return True
    if action not in {"stage", "commit", "push"}:
        return False
    if action == "commit" and COMMIT_MESSAGE.match(target):
        return True
    # Bare/conditional publication and conventional file/change operands remain
    # Git work. No domain keyword allowlist is needed for other product objects.
    if not target.strip(".,;:!") or re.match(r"(?i)^(?:after|once|when|if)\b", target):
        return True
    if re.match(r"(?i)^(?:it|them)\b", target):
        # A later pronoun can refer to earlier product work, e.g. "open the
        # transaction, write both rows, then commit it". Bare "commit it" cannot.
        return not product_antecedent
    return bool(CHANGE_TARGET.match(target))


def command_findings(clause, line_number):
    findings = []
    # Keep explicit Git-command checks independent of natural-language objects.
    for match in re.finditer(r"\bgit\s+([^`\n]+)", clause):
        try:
            tokens = shlex.split(match.group(1))
        except ValueError:
            findings.append(f"line {line_number}: unparseable git command outside the execution boundary")
            continue
        index = 0
        while index < len(tokens) and tokens[index].startswith("-"):
            option = tokens[index]
            index += 1
            if option in {"-C", "-c", "--git-dir", "--work-tree", "--config-env"}:
                index += 1
        if index < len(tokens) and tokens[index].rstrip(";,.:") in FORBIDDEN:
            findings.append(f"line {line_number}: git {tokens[index]} is outside the execution boundary")
    return findings


def action_findings(payload):
    findings = []
    for n, original in enumerate(payload.splitlines(), 1):
        line = re.sub(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)?", "", original).replace("**", "")
        # A standalone '.' can be a Git path operand, not a sentence ending.
        for sentence in re.split(r"(?<=\S[.!?])\s+(?!or\b)", line, flags=re.I):
            product_antecedent = False
            for clause in CLAUSE_SEPARATOR.split(sentence):
                clause = clause.strip()
                # Conditions and ordering adverbs must not hide a directive.
                clause = re.sub(r"(?i)^(?:once|after|when|if)\b[^,]*,\s*", "", clause)
                clause = re.sub(r"(?i)^(?:(?:then|finally|next|afterwards)\b[,\s]*)+", "", clause)
                if not clause or PROHIBITION.match(clause):
                    continue
                directive = re.match(r"(?i)^(stage|commit|push|rebase|cherry-pick|reset|rewrite|create|make)\b(.*)", clause)
                if directive and is_git_action(directive[1].lower(), directive[2], product_antecedent):
                    findings.append(f"line {n}: action outside the execution boundary")
                    continue
                commands = command_findings(clause, n)
                findings.extend(commands)
                # A positive, non-Git clause with an object supplies a possible
                # product antecedent; prohibitions never supply one.
                if not commands and re.match(r"(?i)^[a-z-]+\s+\S", clause):
                    product_antecedent = True
    # Two clauses on one line can raise the same finding; report it once.
    return list(dict.fromkeys(findings))


def summary_findings(mode, payload):
    lines = payload.strip().splitlines()
    fields = FIELDS[mode]
    if len(lines) != len(fields) + 1:
        return [f"{mode}: expected {len(fields) + 1} lines"]
    match = re.fullmatch(re.escape(mode) + r": (PASS|FAIL|BLOCKED|ERROR)", lines[0])
    if not match:
        return [f"{mode}: invalid status"]
    findings = []
    values = {}
    for name, line in zip(fields, lines[1:]):
        if not line.startswith(name + ": ") or not line[len(name) + 2:].strip():
            findings.append(f"{mode}: missing or misplaced {name}")
        else:
            values[name] = line[len(name) + 2:]
    if match[1] == "PASS":
        path_field = fields[1] if mode == "PREP" else fields[0]
        if values.get(path_field, "Not written") == "Not written":
            findings.append(f"{mode}: PASS requires a written artifact")
        if mode == "PREP":
            if values.get("Dependencies") != "Satisfied" or values.get("Questions") != "Resolved":
                findings.append("PREP: PASS requires satisfied dependencies and resolved questions")
        elif values.get("Blockers") != "None":
            findings.append(f"{mode}: PASS requires Blockers: None")
    if mode == "REFACTORING" and values.get("Verdict") not in {"Refactor before", "Refactor during", "No refactoring needed"}:
        findings.append("REFACTORING: invalid verdict")
    return findings


if __name__ == "__main__":
    if sys.argv[1:] == ["--help"]:
        print(__doc__)
        sys.exit(0)
    if len(sys.argv) != 2 or sys.argv[1] not in {"plan", *FIELDS}:
        print(__doc__)
        sys.exit(2)
    mode = sys.argv[1]
    payload = sys.stdin.read()
    findings = action_findings(payload) if mode == "plan" else summary_findings(mode, payload)
    if not payload.strip():
        findings.append("empty payload")
    print("\n".join(findings) if findings else "VALID")
    sys.exit(1 if findings else 0)
