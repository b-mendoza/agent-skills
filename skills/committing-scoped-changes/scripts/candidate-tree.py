#!/usr/bin/env python3
"""Usage: python3 -I candidate-tree.py build [--no-export] PATH... [--hunks BASE TOKEN...]
       python3 -I candidate-tree.py commit TREE MESSAGE PATH... --hunks BASE TOKEN...
       python3 -I candidate-tree.py clean DIR
       python3 -I candidate-tree.py prove TREE PARENT PATH...

Run on POSIX from the root of a SHA-1 Git worktree with HEAD, local objects,
Python 3.9+, and no concurrent writers.
Pass each literal, whitespace-free repository-relative filename separately.
TREE, PARENT and BASE are full object IDs. Each PATH#NEW[+PRIOR] token names
numbered hunks listed by collect-state.py against the original BASE. HEAD must
contain exactly PRIOR for each split path. Build uses throwaway objects. Commit
requires tokens; it runs hooks on a private index and a temporary copy of the
worktree (including ignored files), writes repository objects, replaces group
entries in the real index, and prints 'Commit: <oid>' and the Tree proof.
Warning: a split file's staged edits are replaced, not merged. Use trusted
hooks: the copy isolates ordinary worktree writes, not writes through absolute
paths, external symlinks or Git metadata. Allow space for the copy.
Build prints the tree OID followed by the export directory (only the OID with
--no-export). Clean takes that directory and prints nothing. Prove prints
'Tree: <candidate>=<committed>'. Exit 0 on success, 2 for usage, Git or read
errors before commit, 3 for failures with a commit in place, 4 for a refused
commit and 5 for HEAD or candidate divergence. Errors print only to stderr.

An export is a checkout, not a sandbox: ignored dependencies link back into the
worktree. Use trusted Git filters and checks that do not modify their inputs.
"""

import os
from pathlib import Path
import re
import runpy
import shutil
import stat
import subprocess
import sys
import tempfile
from typing import NamedTuple


USAGE = __doc__.split("\n\n", 1)[0]
OID = re.compile(rb"[0-9a-f]{40}")
PREFIX = "scoped-candidate-"
MARKER = ".candidate-export"


class ProofFailure(ValueError):
    """Read succeeded, but the commit did not pass all four comparisons."""


class Diverged(ValueError):
    """HEAD is not the approved intermediate state, or the rebuilt tree changed."""


class CommitRefused(ValueError):
    """Git did not create the commit."""


class Split(NamedTuple):
    mode: bytes
    selected: bytes
    raw: bytes


def run(command, *, env=None, data=None):
    result = subprocess.run(command, env=env, input=data, capture_output=True)
    if result.returncode:
        raise ValueError(os.fsdecode(result.stderr).strip() or f"{command[0]} exited {result.returncode}")
    return result.stdout


def git(*args, **kwargs):
    return run(["git", "--no-optional-locks", "--literal-pathspecs", *args], **kwargs)


def validate_paths(paths):
    if not paths or len(paths) != len(set(paths)):
        raise ValueError("expected distinct group paths")
    for path in paths:
        if (any(part.lower() in ("", ".", "..", ".git") for part in path.split("/"))
                or any(char.isspace() for char in path)):
            raise ValueError(f"invalid group path: {path!r}")
        if any(parent.is_symlink() for parent in Path(path).parents):
            raise ValueError(f"symlink ancestor: {path}")


def parse_group(args):
    if "--hunks" not in args:
        validate_paths(args)
        return args, {}
    # -I excludes the script directory from sys.path. Load this exact sibling,
    # not a namesake on the import path; do not create a .pyc in the skill.
    collector = runpy.run_path(str(Path(__file__).resolve().with_name("collect-state.py")))
    paths, base, tokens = collector["group_args"](args)
    validate_paths(paths)
    splits = {}
    for path, token in tokens.items():
        file = collector["HunkFile"](base, path)
        selected = file.selected(token)
        prior = collector["blob_oid"](file.select(token.prior))
        entry = git("ls-tree", "-z", "HEAD", "--", path).partition(b"\t")[0].split()
        if len(entry) != 3 or entry[0] not in (b"100644", b"100755") or entry[2] != prior:
            raise Diverged("HEAD is not BASE plus PRIOR: " + path)
        splits[path] = Split(entry[0], selected, file.raw)
    return paths, splits


def private_objects(private):
    objects = private / "objects"
    (objects / "info").mkdir(parents=True)
    real_objects = os.fsdecode(git("rev-parse", "--git-path", "objects").removesuffix(b"\n"))
    # A relative alternate via a symlink can name even a real path containing ':' or LF.
    (private / "source-objects").symlink_to(Path(real_objects).absolute())
    (objects / "info/alternates").write_bytes(b"../source-objects\n")
    return str(objects)


def head_index(private, repository_objects=False):
    env = {**os.environ, "GIT_INDEX_FILE": str(private / "index")}
    if not repository_objects:
        env["GIT_OBJECT_DIRECTORY"] = private_objects(private)

    def private_git(*args, data=None):
        return git("-c", "core.hooksPath=" + os.devnull, "-c", "core.splitIndex=false",
                   "-c", "core.sparseCheckout=false", "-c", "core.fsmonitor=false",
                   *args, env=env, data=data)

    private_git("read-tree", "HEAD")
    return private_git


def write_candidate(private_git, paths, splits, export=None):
    whole = [path for path in paths if path not in splits]
    if whole:
        private_git("update-index", "--add", "--remove", "--", *whole)
    for path, split in splits.items():
        oid = private_git("hash-object", "-w", "--stdin", data=split.selected).strip()
        private_git("update-index", "--cacheinfo", split.mode, oid, path)
    tree = private_git("write-tree").strip()
    # A directory/file collision in the private index must not evict a non-group path.
    changed = private_git("diff-tree", "--no-renames", "--name-only", "-r", "-z", "HEAD", tree, "--")
    if set(changed.split(b"\0")) - {b""} - set(map(os.fsencode, paths)):
        raise ValueError("candidate would replace paths outside the group")
    if export is not None:
        git_dir = os.fsdecode(git("rev-parse", "--absolute-git-dir").removesuffix(b"\n"))
        private_git("-C", export, "--git-dir=" + git_dir, "--work-tree=.", "checkout-index", "--all")
        # checkout-index can smudge even when the incoming LF bytes clean unchanged.
        for path, split in splits.items():
            (export / path).write_bytes(split.selected)
        link_ignored(export)
    return tree.decode("ascii")


def link_ignored(export):
    ignored = git("ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z")
    linked = set()
    for filename in sorted(ignored.split(b"\0")[:-1]):
        relative = Path(os.fsdecode(filename))
        # Git can report both a collapsed directory and its ignored children.
        if any(parent in linked for parent in relative.parents):
            continue
        destination = export / relative
        for parent in reversed(relative.parents):
            ancestor = export / parent
            if ancestor.is_symlink():
                raise ValueError(f"cannot link ignored path through candidate symlink: {relative}")
            ancestor.mkdir(exist_ok=True)
        if not os.path.lexists(destination):
            destination.symlink_to(Path.cwd() / relative)
            linked.add(relative)


def marker_contents(export):
    info = export.lstat()
    return f"candidate-tree-v1 {export.parent.name} {info.st_dev} {info.st_ino}\n".encode()


def validate_group_members(paths):
    # update-index would silently ignore a missing path or accept an ignored file.
    known = git("ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", *paths)
    known += git("ls-tree", "-rz", "--name-only", "HEAD", "--", *paths)
    if not set(map(os.fsencode, paths)) <= set(known.split(b"\0")):
        raise ValueError("unknown, ignored or non-file path in group")
    for path in paths:
        if not os.path.islink(path) and os.path.isdir(path):
            entry = git("ls-files", "--stage", "-z", "--", path)
            if not re.fullmatch(rb"160000 [0-9a-f]{40} 0\t" + re.escape(os.fsencode(path)) + b"\0", entry):
                raise ValueError(f"expected a file or stage-0 gitlink: {path}")


def temp_parent():
    temp = Path(tempfile.gettempdir()).resolve()
    if Path.cwd() in (temp, *temp.parents):
        raise ValueError("system temp directory must be outside the repository")
    return temp


def build(paths, splits, with_export):
    validate_group_members(paths)
    root = Path(tempfile.mkdtemp(prefix=PREFIX, dir=temp_parent()))
    keep_export = False
    try:
        export = root / "tree" if with_export else None
        if export is not None:
            export.mkdir()
        with tempfile.TemporaryDirectory(dir=root) as private:
            tree = write_candidate(head_index(Path(private)), paths, splits, export)
        if export is None:
            return tree
        (root / MARKER).write_bytes(marker_contents(export))
        keep_export = True
        return f"{tree} {export}"
    finally:
        if not keep_export:
            shutil.rmtree(root)


def clean(export):
    root = export.parent
    marker = root / MARKER
    if not (export.name == "tree" and root.parent == Path(tempfile.gettempdir()).resolve()
            and root.name.startswith(PREFIX) and stat.S_ISDIR(root.lstat().st_mode)
            and root.lstat().st_uid == os.getuid() and stat.S_ISDIR(export.lstat().st_mode)
            and stat.S_ISREG(marker.lstat().st_mode) and marker.read_bytes() == marker_contents(export)
            and set(root.iterdir()) == {marker, export}):
        raise ValueError("not a candidate export directory")
    shutil.rmtree(export)
    marker.unlink()
    root.rmdir()


def worktree_failures(root, paths, head, splits):
    failures = []
    whole = [path for path in paths if path not in splits]
    if whole:
        with tempfile.TemporaryDirectory() as private:
            compare = head_index(Path(private))
            changed = compare("-C", root, "--work-tree=.", "diff", "--no-ext-diff", "--no-textconv",
                              "--no-renames", "--ignore-submodules=dirty", "--name-only", "-z", "HEAD", "--", *whole)
        for path in whole:
            # Git diff does not list an untracked recreation after a committed deletion.
            if os.fsencode(path) in changed.split(b"\0") or (path not in head and os.path.lexists(root / path)):
                failures.append(f"worktree differs from HEAD: {path}")
    for path, split in splits.items():
        file = root / path
        if (any((root / p).is_symlink() for p in Path(path).parents) or not stat.S_ISREG(file.lstat().st_mode)
                or file.read_bytes() != split.raw):
            failures.append(f"split worktree bytes changed: {path}")
    return failures


def prove(tree, parent, paths, splits=None, hook_worktree=None):
    committed, *parents = git("log", "-1", "--format=%T %P", "HEAD").decode("ascii").split()
    failures = []
    if parents != [parent]:
        failures.append(f"parent expected {parent}, found {' '.join(parents) or 'none'}")
    if committed != tree:
        failures.append(f"tree expected {tree}, committed {committed}")

    head = {}
    for row in git("ls-tree", "-z", "HEAD", "--", *paths).split(b"\0")[:-1]:
        metadata, path = row.split(b"\t", 1)
        mode, _, oid = metadata.split()
        head[os.fsdecode(path)] = mode, oid
    index = {}
    for row in git("ls-files", "--stage", "-z", "--", *paths).split(b"\0")[:-1]:
        metadata, path = row.split(b"\t", 1)
        mode, oid, stage = metadata.split()
        index[os.fsdecode(path)] = (mode, oid) if stage == b"0" else None

    failures.extend(worktree_failures(Path.cwd(), paths, head, splits or {}))
    if hook_worktree is not None:
        failures.extend(worktree_failures(hook_worktree, paths, head, splits))
    trust_mode = git("config", "--bool", "--default=true", "core.filemode").strip() == b"true"
    for path in paths:
        indexed, committed_entry = index.get(path), head.get(path)
        # With filemode off, --only can retain a staged chmod in the real index.
        regular_modes = (b"100644", b"100755")
        retained_chmod = (splits is None and not trust_mode and indexed and committed_entry
                          and indexed[0] in regular_modes and committed_entry[0] in regular_modes
                          and indexed[1] == committed_entry[1])
        if (indexed != committed_entry and not retained_chmod) or (path in index and indexed is None):
            failures.append(f"index differs from HEAD: {path}")
    if failures:
        raise ProofFailure("; ".join(failures))
    return f"Tree: {tree}={committed}"


def check_index_collisions(paths):
    group = set(map(Path, paths))
    parents = {parent for path in group for parent in path.parents}
    for name in git("ls-files", "-z").split(b"\0")[:-1]:
        indexed = Path(os.fsdecode(name))
        if indexed not in group and (indexed in parents or not group.isdisjoint(indexed.parents)):
            raise ValueError(f"group would replace unrelated index entry: {indexed}")


def sync_group_index(paths):
    # NUL-framed exact entries: a pathspec reset can recurse into a directory.
    rows = {}
    for row in git("ls-tree", "-z", "HEAD", "--", *paths).split(b"\0")[:-1]:
        metadata, name = row.split(b"\t", 1)
        mode, kind, oid = metadata.split()
        if kind == b"tree":
            raise ProofFailure("committed directory at group file: " + os.fsdecode(name))
        rows[name] = mode + b" " + oid
    missing = b"0 " + b"0" * 40
    data = b"".join(rows.get(name, missing) + b"\t" + name + b"\0" for name in map(os.fsencode, paths))
    git("-c", "core.hooksPath=" + os.devnull, "update-index", "-z", "--index-info", data=data)


def copy_hook_worktree(destination):
    # A rejecting formatter can edit files before it exits. Do not attempt to
    # roll those edits back in the real worktree, especially unrelated files.
    root = Path.cwd()
    git_dir = os.fsdecode(git("rev-parse", "--absolute-git-dir").removesuffix(b"\n"))
    shutil.copytree(root, destination, symlinks=True,
                    ignore=lambda directory, names: [".git"] if Path(directory) == root else [])
    (destination / ".git").symlink_to(git_dir)
    return git_dir


def commit(tree, message, paths, splits):
    if not splits:
        raise ValueError("commit requires a hunk group")
    validate_group_members(paths)
    check_index_collisions(paths)
    parent = git("rev-parse", "HEAD").decode().strip()
    staged = git("diff", "--cached", "--no-renames", "--name-only", "-z", parent, "--", *splits).split(b"\0")[:-1]
    created = False
    try:
        with tempfile.TemporaryDirectory(prefix=PREFIX, dir=temp_parent()) as private:
            private_git = head_index(Path(private), repository_objects=True)
            if write_candidate(private_git, paths, splits) != tree:
                raise Diverged("rebuilt candidate differs from approved tree " + tree)
            hook_worktree = Path(private) / "worktree"
            git_dir = copy_hook_worktree(hook_worktree)
            env = {**os.environ, "GIT_INDEX_FILE": str(Path(private) / "index"),
                   "GIT_DIR": git_dir, "GIT_WORK_TREE": str(hook_worktree)}
            try:
                git("-C", hook_worktree, "-c", "core.splitIndex=false", "-c", "core.fsmonitor=false",
                    "commit", "-m", message, env=env)
            except ValueError as error:
                if git("rev-parse", "HEAD").decode().strip() != parent:
                    raise ProofFailure("HEAD moved despite commit failure: " + str(error)) from error
                raise CommitRefused(str(error)) from error
            created = True
            validate_paths(paths)
            sync_group_index(paths)
            proof = prove(tree, parent, paths, splits, hook_worktree)
            oid = git("rev-parse", "HEAD").decode().strip()
        if staged:
            print("warning: replaced staged entries with committed hunks: " + ", ".join(map(os.fsdecode, staged)),
                  file=sys.stderr)
        return f"Commit: {oid}\n{proof}"
    except (ValueError, OSError) as error:
        if created:
            raise ProofFailure(str(error)) from error
        raise


def main(args):
    # Read-only Git commands may fetch missing objects.
    os.environ["GIT_NO_LAZY_FETCH"] = "1"
    if args == ["--help"]:
        return __doc__.rstrip()
    if args[:1] == ["clean"] and len(args) == 2:
        clean(Path(args[1]))
        return None
    if args[:1] in (["build"], ["prove"], ["commit"]):
        if git("rev-parse", "--show-prefix").strip():
            raise ValueError("run from repository root")
        if git("rev-parse", "--show-object-format").strip() != b"sha1":
            raise ValueError("only SHA-1 repositories are supported")
    if args[:1] == ["build"]:
        with_export = args[1:2] != ["--no-export"]
        paths, splits = parse_group(args[1:] if with_export else args[2:])
        return build(paths, splits, with_export)
    if args[:1] == ["commit"] and len(args) >= 4:
        tree, message = args[1:3]
        if not OID.fullmatch(os.fsencode(tree)):
            raise ValueError("TREE must be a full SHA-1 object ID")
        paths, splits = parse_group(args[3:])
        return commit(tree, message, paths, splits)
    if args[:1] == ["prove"] and len(args) >= 4:
        tree, parent, *paths = args[1:]
        if not all(OID.fullmatch(os.fsencode(value)) for value in (tree, parent)):
            raise ValueError("TREE and PARENT must be full SHA-1 object IDs")
        validate_paths(paths)
        return prove(tree, parent, paths)
    raise ValueError(USAGE)


if __name__ == "__main__":
    try:
        output = main(sys.argv[1:])
        if output is not None:
            print(output)
    except (ValueError, OSError) as error:
        print("candidate-tree: " + " ".join(str(error).splitlines()), file=sys.stderr)
        sys.exit({ProofFailure: 3, CommitRefused: 4, Diverged: 5}.get(type(error), 2))
