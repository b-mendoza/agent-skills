#!/usr/bin/env python3
"""Consumer-side shape validator for council-of-advisors payloads.

usage: python3 "${SKILL_DIR}/scripts/validate_packet.py" <kind> [web] < payload

kind: reversibility | analysis | branch | chair | handoff
web:  pass when the run declared research_tools: web (seat kinds only; the
      handoff kind reads its own research_tools key).
Exit 0 accepts. Exit 1 rejects and prints one finding per line. Exit 2 is bad usage.
Checks required top-level keys and closed enums only (stdlib, no YAML parser).
Smoke: printf 'seat: x\\nbranch: merge\\n' | python3 validate_packet.py branch  # exits 1
"""
import re
import sys

STATUS = ("BLOCKED", "FAIL", "ERROR")  # escalation envelope, seat kinds only
VERDICT = ("go", "hold", "rework", "abandon")
CONF = ("low", "medium", "high")
BOOL = ("true", "false")
REQUIRED = {
    "reversibility": ("seat", "decision_type", "reversal_cost_estimate", "rationale",
                      "confidence", "depth_setting", "what_would_change_my_mind"),
    "analysis": ("seat", "seat_class", "mandate", "verdict", "reasoning_chain",
                 "key_risks_or_upside", "what_would_change_my_mind", "confidence",
                 "mental_model_in_use"),
    "branch": ("seat", "branch", "rationale", "candidates"),
    "chair": ("seat", "agreements_across_council", "disagreements_within_council",
              "recommendation", "confidence", "reasoning_chain", "minority_report",
              "required_kill_criterion", "power_questions_to_answer_before_proceeding"),
    "handoff": ("status", "subject", "high_stakes_disclosure", "decision_type",
                "classification_basis", "chair_recommendation", "final_recommendation",
                "override_applied", "confidence", "research_tools", "minority_report",
                "required_kill_criterion", "power_questions_to_answer_before_proceeding",
                "seat_packets", "educate_me", "gates", "execution_fidelity", "run_log"),
}
ORIGINALITY_EXTRA = ("prior_art_exists", "differentiation_named", "prior_art_check_strength")
ENUM = {
    "decision_type": ("type_1", "type_2"), "confidence": CONF, "depth_setting": ("standard", "deep"),
    "seat_class": ("recommending", "informational"), "branch": ("differentiate", "pivot", "abandon"),
    "recommendation": VERDICT, "chair_recommendation": VERDICT,
    "final_recommendation": VERDICT + ("do_not_commit_yet",),
    "classification_basis": ("seat_verdict", "defaulted_low_confidence"),
    "research_tools": ("none", "web"), "execution_fidelity": ("subagents", "inline_degraded"),
    "override_applied": BOOL, "prior_art_exists": BOOL, "differentiation_named": BOOL,
    "prior_art_check_strength": ("verified", "indicative_only"),
}
FIELD = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$")


def parse(text):
    fields = {}
    for line in text.splitlines():
        m = FIELD.match(line)
        if m and m.group(1) not in fields:
            fields[m.group(1)] = m.group(2).strip().strip("\"'").rstrip(",")
    return fields


def validate(kind, text, web=False):
    f, out = parse(text), []
    if kind != "handoff" and f.get("status") in STATUS:  # escalation envelope
        for k in ("seat", "reason", "needed_input"):
            if k not in f:
                out.append("escalation: missing key " + k)
        if not f.get("reason"):
            out.append("escalation: reason must be non-empty")
        return out
    req = REQUIRED[kind]
    if kind == "analysis" and f.get("seat") == "originality-seat":
        req += ORIGINALITY_EXTRA
    if kind == "analysis" and f.get("seat_class") == "informational":
        req += ("headline_finding",)
    for k in req:
        if k not in f:
            out.append("missing key " + k)
    if kind == "handoff":
        ENUM_STATUS = ("ready", "needs_input", "blocked", "error")
        if f.get("status") not in ENUM_STATUS:
            out.append("status must be one of " + "|".join(ENUM_STATUS))
    for k, allowed in ENUM.items():
        if k in f and f[k] not in allowed:
            out.append("%s must be one of %s" % (k, "|".join(allowed)))
    if kind == "analysis":
        sc, v = f.get("seat_class"), f.get("verdict")
        if sc == "recommending" and v not in VERDICT:
            out.append("recommending seat verdict must be one of " + "|".join(VERDICT))
        if sc == "informational" and v != "information_only":
            out.append("informational seat verdict must be information_only")
    if kind == "reversibility" and f.get("decision_type") in ENUM["decision_type"]:
        want = "deep" if f["decision_type"] == "type_1" else "standard"
        if f.get("depth_setting") != want:
            out.append("depth_setting must be %s for %s" % (want, f["decision_type"]))
    if kind == "chair" and f.get("recommendation") == "go" and f.get("confidence") != "high":
        out.append("recommendation go requires confidence high")
    web = web or (kind == "handoff" and f.get("research_tools") == "web")
    if re.search(r"^\s*source:\s*tool_verified\b", text, re.M) and not web:
        out.append("tool_verified present but research_tools is not web")
    return out


def main(argv):
    if len(argv) < 2 or argv[1] not in REQUIRED or argv[2:] not in ([], ["web"]):
        sys.stderr.write(__doc__)
        return 2
    findings = validate(argv[1], sys.stdin.read(), web=argv[2:] == ["web"])
    for finding in findings:
        print(finding)
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
