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

import hashlib
import os
import stat
import subprocess
import sys


def git(*args, data=None):
    result = subprocess.run(
        ["git", "--literal-pathspecs", *args], input=data,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    if result.returncode:
        raise ValueError(result.stderr.decode(errors="replace").strip())
    return result.stdout


def paths_from(data):
    return {os.fsdecode(path) for path in data.split(b"\0") if path}


def regular_mode(path, info, trust_filemode):
    if trust_filemode:
        return b"100755" if info.st_mode & stat.S_IXUSR else b"100644"
    entries = git("ls-files", "--stage", "-z", "--", path).split(b"\0")
    entries = [entry for entry in entries if entry]
    if len(entries) > 1:
        raise ValueError("unmerged index entries: " + path)
    mode = entries[0].split(b" ", 1)[0] if entries else b"100644"
    return mode if mode in (b"100644", b"100755") else b"100644"


def worktree(path, trust_filemode):
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
            return regular_mode(path, info, trust_filemode), source.read()
    if stat.S_ISDIR(info.st_mode):
        # Only a gitlink is a file-like group member. Ordinary folders are
        # expanded to exact paths by the planner, never recursively followed.
        entries = git("ls-files", "--stage", "-z", "--", path).split(b"\0")[:-1]
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
    if git("rev-parse", "--show-prefix").strip():
        raise ValueError("run from repository root")
    if git("rev-parse", "--show-object-format").strip() != b"sha1":
        raise ValueError("only SHA-1 repositories are supported by the envelope")
    head_paths = paths_from(git("ls-tree", "-rz", "--name-only", "HEAD"))
    index_paths = paths_from(git("ls-files", "-z"))
    untracked = paths_from(git("ls-files", "--others", "--exclude-standard", "-z"))
    known = head_paths | index_paths | untracked
    if mode != "preserve" and not set(supplied) <= known:
        raise ValueError("unknown or ignored path in group")
    paths = sorted(known - set(supplied) if mode == "preserve" else supplied, key=os.fsencode)
    filemode = git("config", "--bool", "--default=true", "core.filemode").strip()
    if filemode not in (b"true", b"false"):
        raise ValueError("invalid core.filemode value")
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
    try:
        output = main()
    except (OSError, ValueError) as error:
        print("collect-state: " + str(error), file=sys.stderr)
        sys.exit(2)
    sys.stdout.write(output)
