#!/bin/sh
# POSIX sh. Usage: sh scoped-commit.sh changed -- <scope>...
# sh scoped-commit.sh prepare -- <scope>... < planner-reply
# sh scoped-commit.sh run < approved-artifact; -h prints usage.
# Exits: 0 success/help; 1 refused/clean stop; 2 usage/error; 3 observed mismatch.
# Side effects: private /tmp scratch index/objects, removed on exit; Git filters run.
# run additionally registers untracked group paths and commits once, with hooks;
# failure removes only newly registered entries, never a completed commit.
# Normal Git environment/configuration; no required custom environment variables.
# Check (read-only): sh scoped-commit.sh changed -- README.md
LC_ALL=C
GIT_OPTIONAL_LOCKS=0
export LC_ALL GIT_OPTIONAL_LOCKS
unset GIT_LITERAL_PATHSPECS GIT_GLOB_PATHSPECS GIT_NOGLOB_PATHSPECS GIT_ICASE_PATHSPECS
set -f
nl='
'
IFS=$nl
usage() {
  printf '%s\n' 'usage: sh scoped-commit.sh changed -- <scope>...' \
    '       sh scoped-commit.sh prepare -- <scope>... < planner-reply' \
    '       sh scoped-commit.sh run < approved-artifact' \
    '       sh scoped-commit.sh -h'
}
fail() { printf 'scoped-commit: %s\n' "$2" >&2; exit "$1"; }
valid_path() {
  case "$1" in
    ''|/*|*/|.|..|./*|../*|*/./*|*/../*|*/.|*/..|*//*|*[!\ -~]*|*' '*|*'"'*|*\\*) return 1 ;;
  esac
}
contains() { case "$nl$1$nl" in *"$nl$2$nl"*) return 0 ;; *) return 1 ;; esac; }
in_scope() {
  for scope in $scopes; do
    case "$scope" in */) case "$1" in "$scope"*) return 0 ;; esac ;; *) [ "$1" != "$scope" ] || return 0 ;; esac
  done
  return 1
}
g() { git --no-optional-locks -c core.quotePath=true -C "$root" "$@"; }
identity() {
  head=$(g rev-parse --verify HEAD) || fail 2 'cannot read HEAD'
  if ref=$(g symbolic-ref -q HEAD); then :
  else [ "$?" -eq 1 ] || fail 2 'cannot read ref'; ref=DETACHED; fi
  printf '%s\n%s\n' "$head" "$ref"
}
guards() {
  g rev-parse --verify HEAD >/dev/null 2>&1 || fail 1 'existing HEAD required'
  for marker in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply BISECT_START; do
    marker_path=$(g rev-parse --git-path "$marker") || fail 2 'cannot locate operation markers'
    case "$marker_path" in /*) ;; *) marker_path=$root/$marker_path ;; esac
    [ ! -e "$marker_path" ] || fail 1 'Git operation in progress'
  done
  attrs=$(g -c core.quotePath=false diff --cached --name-only --no-renames --no-ext-diff --no-textconv HEAD) || fail 2 'cannot read staged attributes'
  for p in $attrs; do
    case "$p" in
      .gitattributes|*/.gitattributes|*'/.gitattributes"')
        [ -f "$root/$p" ] && [ ! -L "$root/$p" ] || fail 1 'staged attributes lack a regular worktree copy' ;;
    esac
  done
}
observe() (
  guards
  concrete=
  for spec do
    p=${spec#':(literal)'}
    case "$p" in */) continue ;; esac
    [ ! -d "$root/$p" ] || [ -L "$root/$p" ] || fail 1 'directory scopes must end in /'
    concrete=${concrete:+$concrete$nl}$p
  done
  g status --porcelain=v1 --no-renames --untracked-files=all --ignore-submodules=none -- "$@" > "$tmp/status" || fail 2 'cannot read status'
  while IFS= read -r row; do
    p=${row#???}
    concrete=${concrete:+$concrete$nl}$p
  done < "$tmp/status"
  concrete=$(printf '%s\n' "$concrete" | sort -u) || fail 2 'cannot order concrete paths'
  set --
  for p in $concrete; do
    valid_path "$p" || fail 1 'unsupported concrete path'
    [ -L "$root/$p" ] || [ -f "$root/$p" ] || [ ! -e "$root/$p" ] || fail 1 'scoped entry is not a file or symlink'
    set -- "$@" ":(literal)$p"
  done
  : > "$tmp/real"; : > "$tmp/head"
  if [ "$#" -ne 0 ]; then
    g ls-files -v --stage -- "$@" > "$tmp/real" || fail 2 'cannot read index'
    g ls-tree -r HEAD -- "$@" > "$tmp/head" || fail 2 'cannot read HEAD entries'
  fi
  awk '$2 == "160000" || $1 == "160000" { exit 1 }' "$tmp/real" "$tmp/head" || fail 1 'scoped gitlink'
  awk '$4 != "0" { exit 1 } $1 == "S" || $1 == "s" { exit 1 }' "$tmp/real" || fail 1 'scoped unmerged or skip-worktree entry'
  export GIT_INDEX_FILE="$tmp/index" GIT_OBJECT_DIRECTORY="$tmp/objects"
  g -c core.splitIndex=false read-tree HEAD || fail 2 'cannot seed scratch index'
  for spec do
    if g -c core.splitIndex=false add -A -- "$spec" 2> "$tmp/add-error"; then :
    elif grep -q 'beyond a symbolic link' "$tmp/add-error"; then fail 1 'path beyond a symlinked directory'
    elif grep -q '^fatal: pathspec .* did not match any files$' "$tmp/add-error"; then :
    else fail 2 "scratch add failed: $(head -n 1 "$tmp/add-error")"; fi
  done
  : > "$tmp/entries"; : > "$tmp/changed"
  if [ "$#" -ne 0 ]; then
    g ls-files --stage -- "$@" > "$tmp/entries" || fail 2 'cannot read predicted entries'
    g diff --cached --name-only --no-renames HEAD -- "$@" > "$tmp/changed" || fail 2 'cannot read changed paths'
  fi
  g diff --cached --name-only --no-renames HEAD > "$tmp/all-changed" || fail 2 'cannot read full changed set'
  extra=$(awk 'FILENAME == ARGV[1] { selected[$0]; next } !($0 in selected) { print; exit }' "$tmp/changed" "$tmp/all-changed") || fail 2 'cannot compare selection'
  [ -z "$extra" ] || fail 1 "selection implicitly changes $extra"
  g -c core.splitIndex=false write-tree > "$tmp/tree" || fail 2 'cannot predict tree'
  real=$(cat "$tmp/real") || fail 2 'cannot read index snapshot'
  status=$(cat "$tmp/status") || fail 2 'cannot read status snapshot'
  entries=$(cat "$tmp/entries") || fail 2 'cannot read predicted entries'
  printf 'index\000%s\000status\000%s\000entries\000%s\000' "$real" "$status" "$entries" | g hash-object --stdin > "$tmp/digest" || fail 2 'cannot hash group'
)
fingerprint() (
  set --
  for p in $paths; do set -- "$@" ":(exclude,literal)$p"; done
  index=$(g ls-files -v --stage -- "$@") || fail 2 'cannot fingerprint index'
  diff=$(g diff --binary --no-ext-diff --no-textconv --no-renames --ignore-submodules=none --submodule=short -- "$@") || fail 2 'cannot fingerprint worktree'
  names=$(g -c core.quotePath=false ls-files --others --exclude-standard -- "$@") || fail 2 'cannot list untracked paths'
  records=$(
    for p in $names; do
      case "$p" in (\"*) fail 2 'Git-quoted unrelated untracked name' ;; esac
      if [ -L "$root/$p" ]; then
        target=$(readlink -n "$root/$p" && printf x) || fail 2 'cannot read unrelated link'
        oid=$(printf '%s' "${target%x}" | g hash-object --stdin) || fail 2 'cannot hash unrelated link'
        mode=120000
      elif [ -f "$root/$p" ]; then
        oid=$(g hash-object --no-filters -- "$root/$p") || fail 2 'cannot hash unrelated file'
        if [ -x "$root/$p" ]; then mode=100755; else mode=100644; fi
      else fail 2 'unsupported unrelated untracked entry'; fi
      printf '%s %s %s\n' "$mode" "$oid" "$p" || exit 2
    done
  ) || exit 2
  printf 'index\000%s\000diff\000%s\000objects\000%s\000' "$index" "$diff" "$records" | g hash-object --stdin || fail 2 'cannot hash fingerprint'
)
stop() {
  code=$1 detail=${2:-operation failed} rc=$3
  if [ -n "$before" ]; then
    if after=$(fingerprint); then
      if [ "$after" != "$before" ]; then
        unrelated=changed
        if [ "$rc" -ne 2 ]; then rc=3; code=MISMATCH; fi
      fi
    else unrelated=unverified; rc=2; code=ERROR; fi
  elif [ "$rc" -eq 2 ]; then unrelated=unverified; fi
  [ -z "$commit_oid" ] || detail="commit $commit_oid: $detail"
  printf 'STOPPED %s %s %s\nUNRELATED %s\n' "$number" "$code" "$detail" "$unrelated"
  exit "$rc"
}
abort() {
  if [ "$verb" = run ]; then
    printf 'scoped-commit: %s\n' "$2" >&2
    code=ERROR; [ "$1" -ne 1 ] || code=DIVERGED
    stop "$code" "$2" "$1"
  fi
  fail "$@"
}
check_group() {
  current=$(identity) || stop ERROR 'identity observation failed' 2
  if [ "$current" != "$parent$nl$expected_ref" ]; then
    commit_oid=${current%%"$nl"*}
    stop DIVERGED 'HEAD or ref changed' 1
  fi
  if [ -z "$before" ]; then before=$(fingerprint) || stop ERROR 'fingerprint failed' 2; fi
  if (observe "$@"); then :
  else rc=$?; [ "$rc" -ne 1 ] || stop DIVERGED 'group is no longer supported' 1; stop ERROR 'snapshot failed' 2; fi
  actual=$(cat "$tmp/digest") || stop ERROR 'cannot read digest' 2
  [ "$actual" = "$approved" ] || stop DIVERGED 'group changed since approval' 1
}
cleanup_entries() { [ -z "$introduced" ] || printf '%s\n' "$introduced" | g update-index --force-remove --stdin; }
case "${1-}" in
  -h) [ "$#" -eq 1 ] || { usage >&2; exit 2; }; usage; exit 0 ;;
  changed|prepare) verb=$1; [ "$#" -ge 3 ] && [ "$2" = -- ] || { usage >&2; exit 2; }; shift 2 ;;
  run) verb=$1; [ "$#" -eq 1 ] || { usage >&2; exit 2; }; shift ;;
  *) usage >&2; exit 2 ;;
esac
number=1; before=; paths=; unrelated=preserved; commit_oid=
for tool in git awk readlink mktemp; do command -v "$tool" >/dev/null 2>&1 || abort 2 "missing $tool"; done
root=$(git rev-parse --show-toplevel 2>/dev/null) || abort 1 'not a worktree'
scopes=
for p do
  valid_path "${p%/}" || abort 1 'unsupported scope'
  scopes=${scopes:+$scopes$nl}$p
done
objects=$(g rev-parse --path-format=absolute --git-path objects) || abort 2 'cannot locate object directory'
case "$objects" in *"$nl"*) abort 1 'object directory contains a newline' ;; esac
tmp=$(mktemp -d /tmp/scoped-commit.XXXXXX) || abort 2 'cannot create scratch directory'
trap 'rm -rf "$tmp"' 0
trap 'abort 2 interrupted' 1 2 3 15
mkdir -p "$tmp/objects/info" || abort 2 'cannot create scratch objects'
printf '%s\n' "$objects" > "$tmp/objects/info/alternates" || abort 2 'cannot write alternates'
validator=${0%/*}/validate-output.sh
if [ "$verb" != run ]; then
  if [ "$verb" = prepare ]; then
    cat > "$tmp/input" || fail 2 'cannot read planner reply'
    sh "$validator" < "$tmp/input"; rc=$?; [ "$rc" -eq 0 ] || exit "$rc"
    awk 'NF { first = first ? first : NR; last = NR } { L[NR] = $0 } END { for (i = first; i <= last; i++) print L[i] }' "$tmp/input" > "$tmp/plan" || fail 2 'cannot trim reply'
    [ "$(head -n 1 "$tmp/plan")" = 'COMMIT_PLAN: PASS' ] || { printf '%s\n' 'prepare: planner status is not PASS'; exit 1; }
    plan_paths=$(awk '/^Paths: / { for (i = 2; i <= NF; i++) print $i } /^Omit: / { print $2 }' "$tmp/plan") || fail 2 'cannot read plan paths'
    for p in $plan_paths; do valid_path "$p" || fail 1 'unsupported plan path'; done
  else plan_paths=; fi
  set --
  for p in $scopes $plan_paths; do set -- "$@" ":(literal)$p"; done
  observe "$@" || exit $?
  awk 'FILENAME == ARGV[1] { changed[$0]; next }
    { p = substr($0, 4); if (!seen[p]++) print (p in changed ? "changed " : "index-only ") p }
  ' "$tmp/changed" "$tmp/status" > "$tmp/classified" || fail 2 'cannot classify paths'
  if [ "$verb" = changed ]; then cat "$tmp/classified"; exit $?; fi
  owned=$plan_paths
  status_paths=$(sed 's/^[^ ]* //' "$tmp/classified") || fail 2 'cannot read status paths'
  changed=$(cat "$tmp/changed") || fail 2 'cannot read changed paths'
  : > "$tmp/findings"
  for p in $changed; do
    if in_scope "$p" && ! contains "$owned" "$p"; then printf 'prepare: uncovered changed path: %s\n' "$p" >> "$tmp/findings"; fi
  done
  while IFS= read -r row; do
    case "$row" in
      Paths:*) paths=$(printf '%s\n' "${row#Paths: }" | tr ' ' '\n'); for p in $paths; do contains "$changed" "$p" || printf 'prepare: group path is not changed: %s\n' "$p" >> "$tmp/findings"; done ;;
      Omit:*) p=${row#Omit: }; p=${p%% *}; if ! in_scope "$p" || ! contains "$status_paths" "$p"; then printf 'prepare: Omit is not a scoped status path: %s\n' "$p" >> "$tmp/findings"; fi ;;
    esac
  done < "$tmp/plan"
  [ ! -s "$tmp/findings" ] || { cat "$tmp/findings"; exit 1; }
  current=$(identity) || exit $?
  printf 'Parent: %s\nRef: %s\n' "${current%%"$nl"*}" "${current#*"$nl"}" > "$tmp/artifact"
  number=0
  while IFS= read -r row; do
    case "$row" in
      Message:*)
        message=${row#Message: }; if ! { IFS= read -r row && IFS= read -r verification; }; then fail 2 'cannot read group'; fi
        path_text=${row#Paths: }; paths=$(printf '%s\n' "$path_text" | tr ' ' '\n')
        set --; expansions=
        for p in $paths; do set -- "$@" ":(literal)$p"; if ! in_scope "$p"; then expansions=${expansions:+$expansions }$p; fi; done
        observe "$@" || exit $?
        replaced=$(awk '
          FILENAME == ARGV[1] { h[$4] = $1 " " $3; all[$4]; next }
          FILENAME == ARGV[2] { r[$5] = $2 " " $3; all[$5]; next }
          { e[$4] = $1 " " $2; all[$4] }
          END { for (p in all) if (r[p] != h[p] && r[p] != e[p]) print p }
        ' "$tmp/head" "$tmp/real" "$tmp/entries") || fail 2 'cannot compare staged versions'
        replacements=; for p in $paths; do if contains "$replaced" "$p"; then replacements=${replacements:+$replacements }$p; fi; done
        number=$((number + 1))
        printf 'Group: %s\nMessage: %s\nPaths: %s\nExpansions: %s\n%s\nStaged versions replaced: %s\nDigest: %s\n' "$number" "$message" "$path_text" "${expansions:-none}" "$verification" "${replacements:-none}" "$(cat "$tmp/digest")" >> "$tmp/artifact" ;;
      Omit:*) printf '%s\n' "$row" >> "$tmp/artifact" ;;
    esac
  done < "$tmp/plan"
  index_only=$(awk '$1 == "index-only" { print $2 }' "$tmp/classified") || fail 2 'cannot read index-only paths'
  index_text=; for p in $index_only; do if in_scope "$p"; then index_text=${index_text:+$index_text }$p; fi; done
  printf 'Index-only: %s\n' "${index_text:-none}" >> "$tmp/artifact"
  checksum=$(g hash-object --stdin < "$tmp/artifact") || fail 2 'cannot hash artifact'
  printf 'Artifact: %s\n' "$checksum" >> "$tmp/artifact"
  cat "$tmp/artifact"; exit $?
fi
cat > "$tmp/artifact" || stop ERROR 'cannot read artifact' 2
sed '$d' "$tmp/artifact" > "$tmp/body" || stop ERROR 'cannot read artifact body' 2
checksum=$(g hash-object --stdin < "$tmp/body") || stop ERROR 'cannot hash artifact' 2
[ "$(tail -n 1 "$tmp/artifact")" = "Artifact: $checksum" ] || stop ERROR 'artifact checksum mismatch' 2
parent=$(sed -n '1s/^Parent: //p' "$tmp/body") || stop ERROR 'cannot read parent' 2
expected_ref=$(sed -n '2s/^Ref: //p' "$tmp/body") || stop ERROR 'cannot read ref' 2
number=0; before=; unrelated=preserved
while IFS= read -r row; do
  case "$row" in Group:*) ;; *) continue ;; esac
  number=$((number + 1))
  if ! { IFS= read -r message && IFS= read -r row && IFS= read -r expansions && IFS= read -r verification && IFS= read -r replacements && IFS= read -r approved; }; then stop ERROR 'cannot read group' 2; fi
  message=${message#Message: }; verification=${verification#Verification: }; approved=${approved#Digest: }
  paths=$(printf '%s\n' "${row#Paths: }" | tr ' ' '\n')
  set --; for p in $paths; do set -- "$@" ":(literal)$p"; done
  check_group "$@"
  if [ "$verification" != none ] && ! (cd "$root" && sh -c "$verification") < /dev/null > "$tmp/verification" 2>&1; then
    tail -n 20 "$tmp/verification" | sed 's/^/| /'
    stop VERIFY_FAILED 'verification failed' 1
  fi
  check_group "$@"
  predicted=$(cat "$tmp/tree") || stop ERROR 'cannot read predicted tree' 2
  after=$(fingerprint) || stop ERROR 'fingerprint failed' 2
  [ "$after" = "$before" ] || { unrelated=changed; stop MISMATCH 'verification changed unrelated work' 3; }
  introduced=$(g ls-files --others --exclude-standard -- "$@") || stop ERROR 'cannot list untracked group paths' 2
  if ! (
    if [ -n "$introduced" ]; then
      (set --; for p in $introduced; do set -- "$@" ":(literal)$p"; done; g add -N -- "$@") || exit $?
    fi
    g commit --only -m "$message" -- "$@"
  ) < /dev/null > "$tmp/commit-error" 2>&1; then
    current=$(identity) || stop ERROR 'failed-attempt identity observation failed' 2
    if [ "$current" != "$parent$nl$expected_ref" ]; then
      commit_oid=${current%%"$nl"*}
      stop MISMATCH 'HEAD or ref moved during failed attempt' 3
    fi
    cleanup_entries || stop ERROR 'intent-to-add cleanup failed' 2
    stop COMMIT_FAILED "$(head -n 1 "$tmp/commit-error")" 1
  fi
  current=$(identity) || stop ERROR 'commit identity observation failed' 2
  new_head=${current%%"$nl"*}; new_ref=${current#*"$nl"}; commit_oid=$new_head
  if ! { parents=$(g log -1 --format=%P) && tree=$(g rev-parse 'HEAD^{tree}'); }; then stop ERROR 'commit observation failed' 2; fi
  [ "$new_ref" = "$expected_ref" ] && [ "$parents" = "$parent" ] && [ "$tree" = "$predicted" ] || stop MISMATCH 'commit parent, ref or tree differs' 3
  after=$(fingerprint) || stop ERROR 'fingerprint failed' 2
  [ "$after" = "$before" ] || { unrelated=changed; stop MISMATCH 'commit changed unrelated work' 3; }
  subject=$(g log -1 --format=%s) || stop ERROR 'cannot read commit subject' 2
  printf 'COMMITTED %s %s %s\n' "$number" "$new_head" "$subject"
  parent=$new_head; before=; commit_oid=
done < "$tmp/body"
printf 'UNRELATED preserved\n'
