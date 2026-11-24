#!/usr/bin/env python3
"""Read-only Git state collector. Usage: python3 -I collect-state.py group|preserve|blobs PATH...

Pass each literal repository-relative file as a separate quoted argument, from
repository root. Whitespace paths cannot be represented by the plan envelope.
Outputs one SHA-1 Git blob digest (group/preserve), or mode/OID/path lines
(blobs, with 000000 - for a deletion). Exit 0 on success, 2 on any failure;
failures print only a diagnostic to stderr, never a partial result to stdout.
Requires Python 3 and Git, a SHA-1 repository with HEAD, and no concurrent writers.
Gitlinks use their own HEAD, or the index OID when uninitialized; missing paths
are deletions. An initialized gitlink without a resolvable HEAD is an error.
"""

from difflib import SequenceMatcher
import hashlib
import os
import re
from typing import NamedTuple
import stat
import subprocess
import sys


USAGE = ("usage: python3 -I collect-state.py hunks PATH | group PATH... [--hunks BASE TOKEN...] | preserve PATH... or "
         "python3 -I collect-state.py resolve-scope (--all | --include=PATH ...) --exclude=PATH ...")


class SelectionError(ValueError):
    """The selectors are well formed but cannot describe a valid scope here."""


def git(*args, data=None):
    result = subprocess.run(
        ["git", "--no-optional-locks", "--literal-pathspecs", *args], input=data,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    if result.returncode:
        raise ValueError(result.stderr.decode(errors="replace").strip())
    return result.stdout


def paths_from(data):
    return {os.fsdecode(path) for path in data.split(b"\0") if path}


def path_entries(path, index_entries):
    if index_entries is not None:
        return index_entries.get(path, [])
    return git("ls-files", "--stage", "-z", "--", path).split(b"\0")[:-1]


def regular_mode(path, info, trust_filemode, index_entries):
    if trust_filemode:
        return b"100755" if info.st_mode & stat.S_IXUSR else b"100644"
    entries = path_entries(path, index_entries)
    if len(entries) > 1:
        raise ValueError("unmerged index entries: " + path)
    mode = entries[0].split(b" ", 1)[0] if entries else b"100644"
    return mode if mode in (b"100644", b"100755") else b"100644"


def file_digest(source):
    digest = hashlib.sha256()
    for chunk in iter(lambda: source.read(1 << 20), b""):
        digest.update(chunk)
    return digest.digest()


def worktree(path, trust_filemode, index_entries=None):
    prefix = os.path.dirname(path)
    while prefix:
        if os.path.islink(prefix):
            raise ValueError("symlink ancestor: " + path)
        prefix = os.path.dirname(prefix)
    try:
        info = os.lstat(path)
    except FileNotFoundError:
        return b"000000", b""
    if stat.S_ISLNK(info.st_mode):
        return b"120000", os.fsencode(os.readlink(path))
    if stat.S_ISREG(info.st_mode):
        with open(path, "rb") as source:
            mode = regular_mode(path, info, trust_filemode, index_entries)
            return mode, source.read() if index_entries is None else file_digest(source)
    if stat.S_ISDIR(info.st_mode):
        # Only a gitlink is a file-like group member. Ordinary folders are
        # expanded to exact paths by the planner, never recursively followed.
        entries = path_entries(path, index_entries)
        if len(entries) != 1:
            raise ValueError("expected one gitlink index entry: " + path)
        entry = entries[0].split(b"\t", 1)[0].split()
        if len(entry) != 3 or entry[0] != b"160000" or entry[2] != b"0":
            raise ValueError("not a stage-0 gitlink or regular file: " + path)
        # A nonempty prefix means Git discovered an ancestor repository, not
        # one owned by this directory. Its HEAD would track the parent commit.
        if git("-C", path, "rev-parse", "--show-prefix").strip():
            return b"160000", entry[1]
        return b"160000", git("-C", path, "rev-parse", "HEAD").strip()
    raise ValueError("unsupported file type: " + path)


def frame(parts):
    return b"".join(str(len(part)).encode() + b":" + part for part in parts)


def blob_oid(payload):
    return hashlib.sha1(b"blob " + str(len(payload)).encode() + b"\0" + payload).hexdigest().encode()


def blob_digest(records):
    return blob_oid(frame(records)).decode() + "\n"


class Token(NamedTuple):
    text: str
    new: set
    prior: set


def group_args(args):
    if "--hunks" not in args:
        return args, None, {}
    marker = args.index("--hunks")
    paths, suffix = args[:marker], args[marker + 1:]
    if not paths or len(suffix) < 2 or not re.fullmatch(r"[0-9a-f]{40}", suffix[0]):
        raise ValueError("expected PATH... --hunks BASE TOKEN...")
    base, *texts = suffix
    if git("cat-file", "-t", base).strip() != b"commit":
        raise ValueError("BASE must be a commit ID")
    tokens = {}
    numbers = r"[1-9][0-9]*(?:,[1-9][0-9]*)*"
    for text in texts:
        path, _, selection = text.rpartition("#")
        match = re.fullmatch(rf"({numbers})(?:\+({numbers}))?", selection)
        if not match or path not in paths or path in tokens:
            raise ValueError(f"invalid or duplicate token: {text}")
        new, prior = ([int(n) for n in s.split(",")] if s else [] for s in match.groups())
        if new != sorted(set(new)) or prior != sorted(set(prior)) or set(new).intersection(prior):
            raise ValueError(f"invalid token numbers: {text}")
        tokens[path] = Token(text, set(new), set(prior))
    return paths, base, tokens


def check_raw_blob(path, content):
    if git("hash-object", "--path=" + path, "--stdin", data=content).strip() != blob_oid(content):
        raise ValueError("Git would convert split content: " + path)


def unified_range(start, end):
    count = end - start
    first = start + bool(count)
    return str(first) if count == 1 else f"{first},{count}"


class HunkFile:
    def __init__(self, base, path):
        self.path = path
        row = git("ls-tree", "-z", base, "--", path)
        entry = re.fullmatch(rb"(100644|100755) blob ([a-f0-9]{40})\t" + re.escape(os.fsencode(path)) + b"\0", row)
        indexed = path_entries(path, None)
        if not entry or len(indexed) != 1 or not re.fullmatch(
                rb"100(?:644|755) [0-9a-f]{40} 0\t" + re.escape(os.fsencode(path)), indexed[0]):
            raise ValueError("split file must be tracked and regular: " + path)
        self.mode, self.base_oid = entry.groups()
        mode, self.raw = worktree(path, True)
        if mode != self.mode:
            raise ValueError("split file deleted or mode changed: " + path)
        original = git("cat-file", "blob", self.base_oid)
        attr = git("check-attr", "-z", "diff", "--", path).split(b"\0")[2]
        driver_binary = (attr not in (b"set", b"unset", b"unspecified") and
                         git("config", "--bool", "--default=false", b"diff." + attr + b".binary").strip() == b"true")
        if b"\0" in original or b"\0" in self.raw or attr == b"unset" or driver_binary:
            raise ValueError("binary split file: " + path)
        check_raw_blob(path, self.raw)
        # Git lines end only at LF. Keep delimiters so a missing final LF survives selection.
        self.old = re.findall(rb"[^\n]*\n|[^\n]+\Z", original)
        self.new = re.findall(rb"[^\n]*\n|[^\n]+\Z", self.raw)
        self.hunks = [(a, b, c, d) for op, a, b, c, d in
                      SequenceMatcher(None, self.old, self.new, autojunk=False).get_opcodes() if op != "equal"]

    def listing(self):
        rows = []
        for n, (a, b, c, d) in enumerate(self.hunks, 1):
            header = f"#{n} @@ -{unified_range(a, b)} +{unified_range(c, d)} @@ "
            preview = b"-" + self.old[a] if b > a else b"+" + self.new[c]
            rows.append(os.fsencode(self.path) + header.encode() + preview.removesuffix(b"\n") + b"\n")
        return b"".join(rows)

    def select(self, numbers):
        if numbers and max(numbers) > len(self.hunks):
            raise ValueError("unknown hunk number: " + self.path)
        lines, cursor = [], 0
        for n, (a, b, c, d) in enumerate(self.hunks, 1):
            if n in numbers:
                lines.extend(self.old[cursor:a])
                lines.extend(self.new[c:d])
                cursor = b
        lines.extend(self.old[cursor:])
        return b"".join(lines)

    def selected(self, token):
        content = self.select(token.prior | token.new)
        check_raw_blob(self.path, content)
        return content


def cleaned_oids(paths):
    # --stdin-paths reads one C-quoted pathname per line, not a NUL-separated list.
    lines = []
    for path in paths:
        escaped = path.replace(b'\\', b'\\\\').replace(b'"', b'\\"').replace(b'\n', b'\\n')
        lines.append(b'"' + escaped + b'"\n')
    return git("hash-object", "--stdin-paths", data=b"".join(lines))


def preserve(supplied, filemode):
    head = {}
    for row in git("ls-tree", "-rz", "HEAD").split(b"\0")[:-1]:
        metadata, path = row.split(b"\t", 1)
        head[os.fsdecode(path)] = metadata
    index_entries = {}
    for entry in git("ls-files", "--stage", "-z").split(b"\0")[:-1]:
        path = os.fsdecode(entry.split(b"\t", 1)[1])
        index_entries.setdefault(path, []).append(entry)

    # XY distinguishes intent-to-add from a staged empty blob, and a visible
    # worktree change from one hidden by assume-unchanged, without binding flags.
    statuses = {}
    # Inspect gitlinks only after exclusion: an approved one may be broken.
    status = git("status", "--porcelain=v1", "-z", "--no-renames",
                 "--ignore-submodules=all", "--untracked-files=no")
    for row in status.split(b"\0")[:-1]:
        if row[2:3] != b" ":
            raise ValueError("malformed porcelain status")
        statuses[os.fsdecode(row[3:])] = row[:2]
    untracked = paths_from(git("ls-files", "--others", "--exclude-standard", "-z"))
    records = [b"scoped-preserve-v2", filemode]
    dirty_files = []
    protected = (set(head) | set(index_entries) | untracked) - set(supplied)
    for path in sorted(protected, key=os.fsencode):
        mode, value = worktree(path, filemode == b"true", index_entries)
        xy = statuses.get(path, b"")
        submodule_diff = b""
        if mode in (b"100644", b"100755") and xy[1:] not in (b"", b" "):
            dirty_files.append(os.fsencode(path))
        if mode == b"160000":
            xy = git("status", "--porcelain=v1", "-z", "--no-renames",
                     "--ignore-submodules=none", "--untracked-files=all", "--", path)
            submodule_diff = git("diff", "--no-ext-diff", "--no-textconv", "--no-renames",
                                 "--binary", "HEAD", "--", path)
        records.append(frame([
            os.fsencode(path), head.get(path, b""), frame(index_entries.get(path, [])),
            xy, b"?" if path in untracked else b"", mode, value, submodule_diff,
        ]))
    # A clean filter can change Git's view without changing raw bytes or XY.
    records.append(cleaned_oids(dirty_files))
    return blob_digest(records)


def require_repo_root():
    if git("rev-parse", "--show-prefix").strip():
        raise ValueError("run from repository root")


def is_literal_file_path(path):
    return (all(part not in ("", ".", "..") for part in path.split("/"))
            and not any(char.isspace() or char in "*?[]" for char in path))


def scope_selectors(arguments):
    includes, excludes = [], []
    all_paths = False
    for argument in arguments:
        if argument == "--all" and not all_paths:
            all_paths = True
            continue
        option, equals, path = argument.partition("=")
        if option not in ("--include", "--exclude") or not equals:
            raise ValueError(USAGE)
        literal = path[:-1] if path.endswith("/") else path
        if not is_literal_file_path(literal):
            raise ValueError("invalid resolve-scope selector: " + repr(path))
        (includes if option == "--include" else excludes).append(os.fsencode(path))
    if all_paths == bool(includes) or not excludes:
        raise ValueError(USAGE)
    return includes, excludes


def changed_path_groups():
    status = git("status", "--porcelain=v1", "-z", "--untracked-files=all",
                 "--ignore-submodules=none")
    fields = status.split(b"\0")
    if fields.pop():
        raise ValueError("unterminated porcelain status")
    records = iter(fields)
    for record in records:
        xy, path = record[:2], record[3:]
        if record[2:3] != b" " or not path:
            raise ValueError("malformed porcelain status")
        if b"R" in xy or b"C" in xy:
            source = next(records, None)
            if not source:
                raise ValueError("missing porcelain source path")
            if b"R" in xy:
                yield source, path
                continue
            # A copy changes its destination; a modified source has its own entry.
        yield (path,)


def matches_selector(path, selector):
    return path.startswith(selector) if selector.endswith(b"/") else path == selector


def resolve_scope(arguments):
    includes, excludes = scope_selectors(arguments)
    require_repo_root()
    changes = list(changed_path_groups())
    # Status supplies untracked files and HEAD-only paths (deletions and rename
    # sources). The index supplies the remaining known paths, including clean ones.
    known = set(git("ls-files", "--cached", "-z").split(b"\0")[:-1])
    for group in changes:
        known.update(group)
    for selector in includes + excludes:
        if not any(matches_selector(path, selector) for path in known):
            raise SelectionError("no known path matches " + repr(os.fsdecode(selector)))

    selected = set()
    for group in changes:
        matches = [path for path in group
                   if (not includes or any(matches_selector(path, inc) for inc in includes))
                   and not any(matches_selector(path, exc) for exc in excludes)]
        if matches and len(matches) != len(group):
            raise SelectionError("rename crosses scope: %r -> %r" % tuple(map(os.fsdecode, group)))
        for path in matches:
            literal = os.fsdecode(path)
            if any(char.isspace() for char in literal):
                raise SelectionError("selected path contains whitespace: " + repr(literal))
        selected.update(matches)
    return b"".join(path + b"\n" for path in sorted(selected))


def main():
    if sys.argv[1:] in (["-h"], ["--help"]):
        return __doc__ + "\n"
    if len(sys.argv) < 3 or sys.argv[1] not in ("group", "preserve", "blobs"):
        raise ValueError("usage: python3 -I collect-state.py group|preserve|blobs PATH...")
    mode, supplied = sys.argv[1], sys.argv[2:]
    if len(set(supplied)) != len(supplied):
        raise ValueError("duplicate paths")
    for path in supplied:
        if (os.path.isabs(path) or any(p in ("", ".", "..") for p in path.split("/"))
                or any(c.isspace() for c in path)):
            raise ValueError("expected a literal file path without whitespace: " + repr(path))
        # Never traverse a directory symlink to read outside the repository.
        prefix = os.path.dirname(path)
        while prefix:
            if os.path.islink(prefix):
                raise ValueError("symlink ancestor: " + path)
            prefix = os.path.dirname(prefix)
    require_repo_root()
    if git("rev-parse", "--show-object-format").strip() != b"sha1":
        raise ValueError("only SHA-1 repositories are supported by the envelope")
    filemode = git("config", "--bool", "--default=true", "core.filemode").strip()
    if filemode not in (b"true", b"false"):
        raise ValueError("invalid core.filemode value")
    if mode == "hunks":
        return HunkFile("HEAD", supplied[0]).listing()
    if mode == "preserve":
        return preserve(supplied, filemode)
    head_paths = paths_from(git("ls-tree", "-rz", "--name-only", "HEAD"))
    index_paths = paths_from(git("ls-files", "-z"))
    untracked = paths_from(git("ls-files", "--others", "--exclude-standard", "-z"))
    known = head_paths | index_paths | untracked
    if not set(supplied) <= known:
        raise ValueError("unknown or ignored path in group")
    paths = sorted(supplied, key=os.fsencode)
    records = [b"scoped-state-v1", mode.encode(), filemode]
    blob_lines = []
    for path in paths:
        file_mode, content = worktree(path, filemode == b"true")
        if mode == "blobs":
            if file_mode == b"000000":
                oid = b"-"
            elif file_mode == b"160000":
                oid = content
            elif file_mode == b"120000":
                oid = git("hash-object", "--stdin", data=content).strip()
            else:
                oid = git("hash-object", "--path=" + path, "--stdin", data=content).strip()
            blob_lines.append(os.fsdecode(file_mode + b" " + oid) + " " + path)
        else:
            records.append(frame([
                os.fsencode(path), file_mode, content,
                git("ls-files", "--stage", "-z", "--", path),
                git("status", "--porcelain=v1", "-z", "--untracked-files=all", "--", path),
                git("diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--binary", "HEAD", "--", path),
            ]))
    if mode == "blobs":
        return "\n".join(blob_lines) + "\n"
    payload = frame(records)
    # Compute only after every read and Git call succeeded.
    oid = hashlib.sha1(b"blob " + str(len(payload)).encode() + b"\0" + payload).hexdigest()
    return oid + "\n"


if __name__ == "__main__":
    os.environ["GIT_NO_LAZY_FETCH"] = "1"
    try:
        output = main()
    except (OSError, ValueError) as error:
        print("collect-state: " + str(error), file=sys.stderr)
        sys.exit(2)
    sys.stdout.write(output)
