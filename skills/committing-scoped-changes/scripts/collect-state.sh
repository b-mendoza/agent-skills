#!/bin/sh
# Read-only Git evidence. Dependencies: POSIX sh, awk, git, readlink.
# Usage: sh collect-state.sh <group|preserve> -- <sorted-file-paths...>
#        sh collect-state.sh <-h|--self-test>
# Environment: normal Git repository configuration; no required custom variables.
# Exit 0: one 40-hex digest (or help/self-test); 1: unsupported input;
#      2: usage, missing capability, or collection failure; never a partial digest.
# Side effects: no files, index, objects, network or temporary files written.
# Git attributes/filters are inherited, not sandboxed. Check: --self-test.

LC_ALL=C
GIT_OPTIONAL_LOCKS=0
export LC_ALL GIT_OPTIONAL_LOCKS
unset GIT_LITERAL_PATHSPECS GIT_GLOB_PATHSPECS GIT_NOGLOB_PATHSPECS GIT_ICASE_PATHSPECS
set -f
IFS='
'

usage() {
  printf '%s\n' 'usage: sh collect-state.sh <group|preserve> -- <sorted-file-paths...>' \
    '       sh collect-state.sh <-h|--self-test>'
}
fail() { printf 'collect-state: %s\n' "$2" >&2; exit "$1"; }
valid_path() {
  case "$1" in
    ''|/*|*/|.|..|./*|../*|*/./*|*/../*|*/.|*/..|*//*|*[!\ -~]*|*' '*|*'"'*|*\\*) return 1 ;;
    *) return 0 ;;
  esac
}
self_test() {
  for p in 'src/routes/[id]/+page.svelte' 'app/(group)/@slot/page.tsx' '.dot' 'a*?;b' "a'b"; do
    valid_path "$p" || fail 2 'self-test rejected supported punctuation'
  done
  for p in 'a b' 'a"b' 'a\b' '../x' '/x' "$(printf 'a\tb')" "$(printf '\303\251')"; do
    if valid_path "$p"; then fail 2 'self-test accepted an unsafe path'; fi
  done
  captured=$(printf 'target\nx') || fail 2 'self-test capture failed'
  captured=${captured%x}
  [ "${#captured}" -eq 7 ] || fail 2 'self-test lost target newline'
  if bad=$(false || exit 2; printf 'partial'); then fail 2 'self-test masked failure'; fi
  [ -z "$bad" ] || fail 2 'self-test leaked partial evidence'
  a=$(printf 'a\000b\000' | git hash-object --stdin) || fail 2 'self-test hash failed'
  b=$(printf 'a\000b\000' | git hash-object --stdin) || fail 2 'self-test hash failed'
  [ "$a" = "$b" ] || fail 2 'self-test framing is unstable'
  printf '%s\n' 'collect-state: self-test PASS'
}
case "${1-}" in
  -h|--help) [ "$#" -eq 1 ] || { usage >&2; exit 2; }; usage; exit 0 ;;
  --self-test) [ "$#" -eq 1 ] || { usage >&2; exit 2; }; self_test; exit 0 ;;
  group|preserve) mode=$1 ;;
  *) usage >&2; exit 2 ;;
esac
[ "$#" -ge 3 ] && [ "$2" = -- ] || { usage >&2; exit 2; }
shift 2
for tool in git awk readlink; do command -v "$tool" >/dev/null 2>&1 || fail 2 "missing $tool"; done
paths=
separator=
for p do
  valid_path "$p" || fail 1 "unsupported path: $p"
  paths=$paths$separator$p
  separator='
'
done
printf '%s\n' "$paths" | awk 'NR > 1 && ("x" $0 <= "x" prev) { exit 1 } { prev = $0 }' || fail 1 'paths must be unique and byte-sorted'
root=$(git rev-parse --show-toplevel) || fail 2 'not a readable worktree'
g() { git --no-optional-locks -c core.quotePath=true -C "$root" "$@"; }
g rev-parse --verify HEAD >/dev/null 2>&1 || fail 1 'existing HEAD required'
format=$(g rev-parse --show-object-format) || fail 2 'cannot determine object format'
[ "$format" = sha1 ] || fail 1 'only SHA-1 Git repositories are supported'

# A link itself is supported; crossing an ancestor link is not a Git path.
for p in $paths; do
  ancestor=$p
  while case "$ancestor" in */*) true ;; *) false ;; esac; do
    ancestor=${ancestor%/*}
    [ ! -L "$root/$ancestor" ] || fail 1 "symlinked ancestor: $ancestor"
  done
done

# Inputs have no whitespace and globbing is disabled; Git receives literal specs.
set --
for p in $paths; do
  if [ "$mode" = group ]; then set -- "$@" ":(literal)$p"
  else set -- "$@" ":(exclude,literal)$p"; fi
done
index=$(g ls-files --stage -- "$@") || fail 2 'cannot collect index'
status=
if [ "$mode" = group ]; then
  head=$(g ls-tree -r HEAD -- "$@") || fail 2 'cannot collect HEAD entries'
  printf '%s\n%s\n' "$head" "$index" | awk '$1 == "160000" { exit 1 }' || fail 1 'scoped gitlinks are unsupported'
  printf '%s\n' "$index" | awk 'NF && $3 != "0" { exit 1 }' || fail 1 'unmerged scoped index entries'
  status=$(g status --porcelain=v1 --untracked-files=all --no-renames --ignore-submodules=none -- "$@") || fail 2 'cannot collect status'
  diff=$(g diff --binary --no-ext-diff --no-textconv --no-renames --ignore-submodules=none --submodule=short HEAD -- "$@") || fail 2 'cannot collect group diff'
  objects=$paths
else
  diff=$(g diff --binary --no-ext-diff --no-textconv --no-renames --ignore-submodules=none --submodule=short -- "$@") || fail 2 'cannot collect preservation diff'
  objects=$(g -c core.quotePath=false ls-files --others --exclude-standard -- "$@") || fail 2 'cannot collect untracked paths'
  for p in $objects; do
    case "$p" in
      ''|'"'*|/*|.|..|./*|../*|*/./*|*/../*|*/.|*/..|*//*) fail 1 "unsupported untracked path: $p" ;;
    esac
  done
fi

records=$(
  for p in $objects; do
    if [ -L "$root/$p" ]; then
      # Command substitution strips newlines; a sentinel preserves target bytes.
      target=$(readlink -n "$root/$p" && printf x) || fail 2 "cannot read link: $p"
      target=${target%x}
      oid=$(printf '%s' "$target" | g hash-object --stdin) || fail 2 "cannot hash link: $p"
      file_mode=120000
    elif [ -f "$root/$p" ]; then
      if [ "$mode" = preserve ]; then
        oid=$(g hash-object --no-filters -- "$root/$p") || fail 2 "cannot hash file: $p"
      else
        oid=$(g hash-object --path="$p" -- "$root/$p") || fail 2 "cannot hash file: $p"
      fi
      if [ -x "$root/$p" ]; then file_mode=100755; else file_mode=100644; fi
    elif [ ! -e "$root/$p" ] && [ "$mode" = group ]; then
      file_mode=000000
      oid=absent
    else
      fail 1 "unsupported entry: $p"
    fi
    printf '%s %s %s\n' "$file_mode" "$oid" "$p" || fail 2 'cannot frame object'
  done
) || exit $?
# All fallible collection finished before this pipeline; NUL separates sections.
digest=$(printf 'index\000%s\000status\000%s\000diff\000%s\000objects\000%s\000' \
  "$index" "$status" "$diff" "$records" | g hash-object --stdin) || fail 2 'cannot hash evidence'
[ "${#digest}" -eq 40 ] || fail 2 'invalid digest'
case "$digest" in *[!0-9a-f]*) fail 2 'invalid digest' ;; esac
printf '%s\n' "$digest"
