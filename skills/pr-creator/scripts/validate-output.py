#!/usr/bin/env python3
# Interpreter: python3 -I; Python 3.8+, stdlib only.
# Usage: python3 -I validate-output.py repo-preflight < reply.json
#        python3 -I validate-output.py pr-drafter < reply.json
#        python3 -I validate-output.py pr-submitter --preview PATH --sha256 HEX < reply.json
#        python3 -I validate-output.py approved-preview --preview PATH --sha256 HEX
# Check: python3 -I validate-output.py --self-test; help: -h / --help.
# Proves shape and comparison, not truth of facts or real user consent.
# Exits: 0 conforms; 1 findings on stdout; 2 usage/version error on stderr.
# Side effects: none except --self-test creates/removes one temporary directory.
import sys
if sys.version_info < (3, 8):
    sys.stderr.write("validate-output.py: Python 3.8+ required\n")
    sys.exit(2)

import argparse, hashlib, json, os, re, shlex
from pathlib import Path

METADATA = "reviewers labels assignees".split()
CONTEXT = "platform base_repository head_repository head_remote base_branch head_branch base_sha head_sha template_sha state".split()
STATUSES = {
    "repo-preflight": "PASS NEEDS_INPUT PUSH_REQUIRED BLOCKED ERROR TOOLS_MISSING".split(),
    "pr-drafter": "PASS NEEDS_INPUT BLOCKED ERROR TOOLS_MISSING".split(),
    "pr-submitter": "KNOWN_OBJECT HEAD_MOVED CREATE_UNCERTAIN BLOCKED ERROR TOOLS_MISSING".split(),
}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def clean(value):
    return isinstance(value, str) and bool(value) and not re.search(r"[\x00-\x1f\x7f]", value)

def ident(value):
    return clean(value) and not value.startswith("-") and not any(c.isspace() for c in value)

def sha(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}([0-9a-f]{24})?", value)

def keys(obj, required, optional=()):
    require(isinstance(obj, dict), "expected an object")
    require(not set(required) - set(obj), "missing keys: " + ", ".join(sorted(set(required) - set(obj))))
    require(not set(obj) - set(required) - set(optional), "unexpected keys: " + ", ".join(sorted(set(obj) - set(required) - set(optional))))

def pairs(items):
    obj = {}
    for key, value in items:
        require(key not in obj, "duplicate JSON key: " + key)
        obj[key] = value
    return obj

def invalid_constant(value):
    raise ValueError("invalid JSON constant: " + value)

def parse(raw):
    obj = json.loads(raw.decode("utf-8"), object_pairs_hook=pairs, parse_constant=invalid_constant)
    require(isinstance(obj, dict), "expected one JSON object")
    return obj

def context(obj):
    keys(obj, CONTEXT)
    for key in "base_repository head_repository head_remote base_branch head_branch".split():
        require(ident(obj[key]), key + ": expected IDENT")
    for key in ("base_repository", "head_repository"):
        require(len(obj[key].split("/")) >= 2 and all(obj[key].split("/")), key + ": expected [HOST/]OWNER/REPO")
    for key in ("base_sha", "head_sha", "template_sha"):
        require(sha(obj[key]), key + ": expected SHA")
    require(obj["platform"] in ("github", "gitlab"), "platform: expected github or gitlab")
    require(obj["state"] in ("draft", "ready"), "state: expected draft or ready")

def push(obj):
    keys(obj, "head_repository head_remote source_sha destination_branch".split())
    for key in ("head_repository", "head_remote", "destination_branch"):
        require(ident(obj[key]), key + ": expected IDENT")
    require(len(obj["head_repository"].split("/")) >= 2 and all(obj["head_repository"].split("/")), "head_repository: expected [HOST/]OWNER/REPO")
    require(sha(obj["source_sha"]), "source_sha: expected SHA")
    return shlex.join(["git", "push", "--no-follow-tags", obj["head_remote"], obj["source_sha"] + ":refs/heads/" + obj["destination_branch"]]) + "\n"

def preview(path, digest=None):
    require(isinstance(path, str) and os.path.isabs(path), "preview: expected absolute path")
    raw = Path(path).read_bytes()
    obj = parse(raw)
    keys(obj, CONTEXT + ["title", "body", "body_file"] + METADATA)
    context({key: obj[key] for key in CONTEXT})
    require(clean(obj["title"]), "title: expected TITLE")
    require(isinstance(obj["body"], str), "body: expected string")
    require(isinstance(obj["body_file"], str) and os.path.isabs(obj["body_file"]), "body_file: expected absolute path")
    require(os.path.dirname(os.path.realpath(obj["body_file"])) == os.path.dirname(os.path.realpath(path)), "body_file: must be in the preview directory")
    for key in METADATA:
        values = obj[key]
        require(isinstance(values, list) and all(clean(v) and not v.startswith("@") and "," not in v for v in values),
                key + ": expected NAMES")
        require(values == sorted(set(values)), key + ": must be unique and ascending-sorted")
    require(Path(obj["body_file"]).read_bytes() == obj["body"].encode("utf-8"), "body_file: bytes differ from body")
    actual = hashlib.sha256(raw).hexdigest()
    if digest is not None:
        require(isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{64}", digest), "sha256: expected 64 lowercase hex characters")
        require(actual == digest, "sha256: preview bytes differ from approved digest")
    return obj, actual

def render(obj, digest):
    same = obj["base_repository"] == obj["head_repository"]
    if obj["platform"] == "github":
        head = obj["head_branch"] if same else obj["head_repository"].split("/")[-2] + ":" + obj["head_branch"]
        argv = ["gh", "pr", "create", "--repo", obj["base_repository"], "--base", obj["base_branch"],
                "--head", head, "--title", obj["title"], "--body-file", obj["body_file"]]
    else:
        argv = ["glab", "mr", "create", "--repo", obj["base_repository"], "--head", obj["head_repository"]]
        argv += ["--source-branch", obj["head_branch"], "--target-branch", obj["base_branch"],
                 "--title", obj["title"], "--description-file", obj["body_file"]]
    argv += ["--draft"] if obj["state"] == "draft" else []
    for key, flag in zip(METADATA, ("--reviewer", "--label", "--assignee")):
        if obj[key]:
            argv += [flag, ",".join(obj[key])]
    argv += ["--yes"] if obj["platform"] == "gitlab" else []
    return ("Platform:  {platform}\nBase:      {base_repository} {base_branch} @ {base_sha}\n"
            "Head:      {head_repository} {head_branch} @ {head_sha} (remote {head_remote})\n"
            "State:     {state}\nTitle:     {title}\n").format(**obj) + "".join(
                "{:<11}{}\n".format(key.capitalize() + ":", ", ".join(obj[key]) or "none") for key in METADATA
            ) + "SHA-256:   " + digest + "\nCommand:   " + shlex.join(argv) + "\nBody (" + obj["body_file"] + "):\n" + obj["body"]

def compare(obj, approved):
    returned, gaps, additions = obj["returned"], [], {}
    for key, source in (("title", "title"), ("base", "base_branch"), ("head_ref", "head_branch"),
                        ("head_sha", "head_sha"), ("state", "state")):
        value, expected = returned[key], approved[source]
        if value is None:
            gaps.append(key + ": unavailable")
        elif value != expected and not (key == "title" and approved["platform"] == "gitlab"
                                       and approved["state"] == "draft" and value == "Draft: " + expected):
            gaps.append("{}: expected {}, got {}".format(key, expected, value))
    for key in METADATA:
        value = returned[key]
        additions[key] = None if value is None else sorted(set(value) - set(approved[key]))
        missing = sorted(set(approved[key]) - set(value or []))
        if value is None:
            gaps.append(key + ": unavailable")
        elif missing:
            gaps.append(key + ": missing " + ", ".join(missing))
    additions["body_suffix"] = None
    if returned["body"] is None:
        gaps.append("body: unavailable")
    elif returned["body"].encode("utf-8").startswith(approved["body"].encode("utf-8")):
        additions["body_suffix"] = returned["body"][len(approved["body"]):]
    else:
        gaps.append("body: approved body is not a prefix of the returned body")
    if obj["url"] is None:
        gaps.append("url: unavailable")
    return json.dumps({"status": "GAPS_FOUND" if gaps else "PASS", "gaps": gaps, "additions": additions}) + "\n"

def check(mode, raw, path=None, digest=None):
    if mode == "approved-preview":
        preview(path, digest)
        return ""
    obj = parse(raw)
    status = obj.get("status")
    require(status in STATUSES[mode], "status: not allowed")
    required, optional = ["status"], ["notes"]
    (optional if status in ("PASS", "KNOWN_OBJECT") else required).append("reason")
    if status == "NEEDS_INPUT":
        required.append("question")
    extra = {"PASS": "context" if mode == "repo-preflight" else "preview", "PUSH_REQUIRED": "push",
             "KNOWN_OBJECT": "outcome url returned", "HEAD_MOVED": "remote_head_sha"}.get(status, "")
    keys(obj, required + extra.split(), optional)
    for key in ("reason", "question"):
        if key in obj:
            require(isinstance(obj[key], str) and bool(obj[key]), key + ": expected nonempty string")
    if "notes" in obj:
        require(isinstance(obj["notes"], list) and all(isinstance(v, str) and bool(v) for v in obj["notes"]), "notes: expected nonempty strings")
    if mode == "repo-preflight" and status == "PASS":
        context(obj["context"])
    elif status == "PUSH_REQUIRED":
        return push(obj["push"])
    elif mode == "pr-drafter" and status == "PASS":
        return render(*preview(obj["preview"]))
    elif status == "HEAD_MOVED":
        require(sha(obj["remote_head_sha"]), "remote_head_sha: expected different SHA")
        approved, _ = preview(path, digest)
        require(obj["remote_head_sha"] != approved["head_sha"], "remote_head_sha: expected different SHA")
    elif status == "KNOWN_OBJECT":
        require(obj["outcome"] in ("created", "found"), "outcome: expected created or found")
        require(obj["url"] is None or isinstance(obj["url"], str) and obj["url"].startswith(("http://", "https://")), "url: expected HTTP(S) URL or null")
        keys(obj["returned"], ["title", "base", "head_ref", "head_sha", "state", "body"] + METADATA)
        for key, value in obj["returned"].items():
            require(value is None or (isinstance(value, list) and all(isinstance(v, str) for v in value)
                    if key in METADATA else isinstance(value, str)), "returned." + key + ": invalid type")
        approved, _ = preview(path, digest)
        return compare(obj, approved)
    return ""

def self_test():
    import subprocess, tempfile
    with tempfile.TemporaryDirectory() as directory:
        path, body = os.path.join(directory, "preview.json"), os.path.join(directory, "body.md")
        ctx = dict(platform="github", base_repository="up/repo", head_repository="host/fork/repo", head_remote="origin",
                   base_branch="main", head_branch="feature", base_sha="a" * 40, head_sha="b" * 64, template_sha="c" * 40, state="draft")
        draft = dict(ctx, title="A fix", body="hé\n\n", body_file=body, reviewers=["alice"], labels=[], assignees=[])
        def run(mode, payload):
            return check(mode, payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8"), path, hashlib.sha256(Path(path).read_bytes()).hexdigest())
        def bad(mode, payload):
            try:
                run(mode, payload)
            except (ValueError, OSError):
                return
            raise AssertionError("accepted invalid " + mode)
        Path(body).write_bytes(draft["body"].encode("utf-8"))
        Path(path).write_bytes(json.dumps(draft).encode("utf-8"))
        assert run("repo-preflight", dict(status="PASS", context=ctx)) == "", 'preflight PASS'
        publication = dict(head_repository="fork/repo", head_remote="origin", source_sha="a" * 40, destination_branch="feature")
        assert run("repo-preflight", dict(status="PUSH_REQUIRED", reason="publish", push=publication)) == "git push --no-follow-tags origin " + "a" * 40 + ":refs/heads/feature\n", 'push command rendering'
        command = "gh pr create --repo up/repo --base main --head fork:feature --title 'A fix' --body-file " + body + " --draft --reviewer alice"
        digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        expected = ("Platform:  github\nBase:      up/repo main @ {base_sha}\nHead:      host/fork/repo feature @ {head_sha} (remote origin)\nState:     draft\nTitle:     A fix\nReviewers: alice\nLabels:    none\nAssignees: none\nSHA-256:   ").format(**ctx) + digest + "\nCommand:   " + command + "\nBody (" + body + "):\nhé\n\n"
        assert run("pr-drafter", dict(status="PASS", preview=path)) == expected, 'exact GitHub preview layout'
        returned = dict(title="A fix", base="main", head_ref="feature", head_sha=ctx["head_sha"], state="draft", body=draft["body"], reviewers=["alice"], labels=[], assignees=[])
        receipt = dict(status="KNOWN_OBJECT", outcome="created", url="https://host/pr/1", returned=returned)
        assert json.loads(run("pr-submitter", receipt)) == dict(status="PASS", gaps=[], additions=dict(reviewers=[], labels=[], assignees=[], body_suffix="")), 'matching readback comparison'
        draft["platform"] = "gitlab"
        Path(path).write_bytes(json.dumps(draft).encode("utf-8"))
        assert "Command:   glab mr create --repo up/repo --head host/fork/repo --source-branch feature --target-branch main --title 'A fix' --description-file " + body + " --draft --reviewer alice --yes\n" in run("pr-drafter", dict(status="PASS", preview=path)), 'GitLab --head/--yes placement'
        draft["head_repository"] = draft["base_repository"]
        Path(path).write_bytes(json.dumps(draft).encode("utf-8"))
        same_command = "Command:   glab mr create --repo up/repo --head up/repo --source-branch feature --target-branch main --title 'A fix' --description-file " + body + " --draft --reviewer alice --yes\n"
        assert same_command in run("pr-drafter", dict(status="PASS", preview=path)), 'GitLab same-repository --head'
        returned.update(title="Draft: A fix", body=draft["body"] + "suffix", labels=["z", "a", "z"])
        assert json.loads(run("pr-submitter", receipt)) == dict(status="PASS", gaps=[], additions=dict(reviewers=[], labels=["a", "z"], assignees=[], body_suffix="suffix")), "GitLab draft title and additions"
        returned.update(reviewers=[], state=None, body="wrong")
        receipt["url"] = None
        assert json.loads(run("pr-submitter", receipt))["gaps"] == ["state: unavailable", "reviewers: missing alice", "body: approved body is not a prefix of the returned body", "url: unavailable"], 'null fields, missing reviewer, and body mismatch gaps'
        for mode in STATUSES:
            assert run(mode, dict(status="ERROR", reason="failed")) == "", 'conforming ERROR envelope'
            bad(mode, dict(status="ERROR", reason="failed", question="forbidden"))
            for raw in (b'[]', b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":Infinity}', b'\xff', b'{} {}'):
                bad(mode, raw)
        bad("repo-preflight", dict(status="PASS", context={key: value for key, value in ctx.items() if key != "template_sha"}))
        bad("repo-preflight", dict(status="PASS", context=dict(ctx, template_sha="BAD")))
        bad("repo-preflight", dict(status="PASS", context=dict(ctx, head_sha="BAD")))
        bad("pr-submitter", dict(status="HEAD_MOVED", reason="moved", remote_head_sha=ctx["head_sha"]))
        assert run("pr-submitter", dict(status="HEAD_MOVED", reason="moved", remote_head_sha="d" * 40)) == "", 'HEAD_MOVED with approved digest'
        reader, writer = os.pipe()
        try:
            result = subprocess.run([sys.executable, "-I", __file__, "approved-preview", "--preview", path, "--sha256", hashlib.sha256(Path(path).read_bytes()).hexdigest()], stdin=reader, capture_output=True, timeout=5)
            assert result.returncode == 0 and not result.stdout and not result.stderr, 'approved preview does not read stdin'
        except subprocess.TimeoutExpired:
            raise AssertionError('approved preview reads stdin')
        finally:
            os.close(reader)
            os.close(writer)
        for argv, raw, code, finding in [
            (["approved-preview", "--preview", path, "--sha256", hashlib.sha256(Path(path).read_bytes()).hexdigest()], b"not JSON", 0, b""),
            (["approved-preview", "--preview", path, "--sha256", "0" * 64], b"", 1, b"sha256: preview bytes differ"),
            (["approved-preview", "--preview", path, "--sha256", "A" * 64], b"", 1, b"sha256: expected 64 lowercase hex"),
            (["approved-preview", "--preview", path, "--sha256", "not-a-digest"], b"", 1, b"sha256: expected 64 lowercase hex"),
            (["pr-submitter", "--preview", path + ".missing", "--sha256", digest], b'{"status":"BLOCKED","reason":"missing preview"}', 0, b""),
            (["pr-submitter", "--preview", path + ".missing", "--sha256", digest], b'{"status":"BLOCKED","reason":null}', 1, b"reason: expected nonempty string"),
            (["pr-submitter", "--preview", path + ".missing", "--sha256", digest], json.dumps(dict(receipt, outcome="bad")).encode("utf-8"), 1, b"outcome: expected created or found"),
            (["pr-submitter", "--preview", path + ".missing", "--sha256", digest], b'{"status":"HEAD_MOVED","reason":"moved","remote_head_sha":"bad"}', 1, b"remote_head_sha: expected different SHA"),
            (["pr-submitter", "--preview", path, "--sha256", "0" * 64], json.dumps(receipt).encode("utf-8"), 1, b"sha256: preview bytes differ"),
            (["pr-submitter", "--preview", path, "--sha256", "0" * 64], json.dumps(dict(status="HEAD_MOVED", reason="moved", remote_head_sha="d" * 40)).encode("utf-8"), 1, b"sha256: preview bytes differ"),
            (["pr-submitter", "--preview", path], b"", 2, b""),
            (["approved-preview", "--preview", path], b"", 2, b""),
            (["pr-submitter", "--sha256", digest], b"", 2, b""),
            (["approved-preview", "--sha256", digest], b"", 2, b""),
            (["repo-preflight", "--sha256", digest], b'{"status":"ERROR","reason":"failed"}', 2, b""),
            (["pr-drafter", "--sha256", digest], b'{"status":"ERROR","reason":"failed"}', 2, b""),
            (["repo-preflight", "--preview", path], b"", 2, b""),
            (["pr-drafter", "--preview", path], b"", 2, b""),
        ]:
            result = subprocess.run([sys.executable, "-I", __file__] + argv, input=raw, capture_output=True)
            assert result.returncode == code and finding in result.stdout, (argv, code, result.returncode, result.stdout, result.stderr)
            assert bool(result.stdout) == (code == 1) and bool(result.stderr) == (code == 2), (argv, result.stdout, result.stderr)
        Path(body).write_bytes(b"different")
        bad("pr-drafter", dict(status="PASS", preview=path))
        result = subprocess.run([sys.executable, "-I", __file__, "approved-preview", "--preview", path, "--sha256", hashlib.sha256(Path(path).read_bytes()).hexdigest()], input=b"", capture_output=True)
        assert result.returncode == 1 and b"body_file: bytes differ from body" in result.stdout and not result.stderr, 'approved preview body-file mismatch'
        for status in ("BLOCKED", "ERROR", "CREATE_UNCERTAIN", "TOOLS_MISSING"):
            for source in (path, path + ".missing"):
                assert check("pr-submitter", json.dumps(dict(status=status, reason="failed")).encode("utf-8"), source, "0" * 64) == "", 'error envelope ignores missing or changed preview'
    print("self-test: PASS")

def main():
    parser = argparse.ArgumentParser(description="Validate shape and comparison, not facts or real consent.",
        usage="python3 -I %(prog)s repo-preflight < reply.json\n"
              "       python3 -I %(prog)s pr-drafter < reply.json\n"
              "       python3 -I %(prog)s pr-submitter --preview PATH --sha256 HEX < reply.json\n"
              "       python3 -I %(prog)s approved-preview --preview PATH --sha256 HEX\n"
              "       python3 -I %(prog)s --self-test | -h",
        epilog="Exit codes: 0 conforms; 1 findings; 2 usage/version error. Side effects: none except --self-test creates/removes one temporary directory.", allow_abbrev=False)
    parser.add_argument("mode", nargs="?", choices=tuple(STATUSES) + ("approved-preview",))
    parser.add_argument("--preview", metavar="PATH", action="append")
    parser.add_argument("--sha256", metavar="HEX", action="append")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test and len(sys.argv) != 2:
        parser.error("--self-test takes no other arguments")
    if not args.self_test and (not args.mode or (args.mode in ("pr-submitter", "approved-preview")) != bool(args.preview)
                              or bool(args.preview) != bool(args.sha256) or args.preview and len(args.preview) != 1
                              or args.sha256 and len(args.sha256) != 1):
        parser.error("specify a mode; --preview PATH and --sha256 HEX are required only for pr-submitter and approved-preview")
    try:
        if args.self_test:
            self_test()
        else:
            sys.stdout.write(check(args.mode, b"" if args.mode == "approved-preview" else sys.stdin.buffer.read(),
                                   args.preview[0] if args.preview else None, args.sha256[0] if args.sha256 else None))
        return 0
    except (AssertionError, ValueError, OSError, RecursionError) as error:
        print((args.mode or "self-test: FAIL") + ": " + str(error).encode("unicode_escape").decode("ascii"))
        return 1

if __name__ == "__main__":
    sys.exit(main())
