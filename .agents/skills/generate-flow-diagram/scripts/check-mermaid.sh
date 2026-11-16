#!/bin/sh
# POSIX sh. Usage: sh check-mermaid.sh [-h] <markdown-file>; environment: PATH, TMPDIR.
# Exit 0 PASS (parsed) | 1 FAIL (repair) | 2 TOOLS_MISSING (inspect manually)
#      | 64 ERROR (usage/setup) | 66 BLOCKED (input missing) | other ERROR.
# Side effects: scratch directory under ${TMPDIR:-/tmp}, removed on exit.
# Check: sh check-mermaid.sh -h # expects usage and exit 0
set -eu
usage() {
  printf '%s\n' "usage: sh $0 [-h] <markdown-file>; environment: PATH, TMPDIR"
}
if [ "$#" -eq 1 ] && [ "$1" = '-h' ]; then
  usage
  exit 0
fi
if [ "$#" -ne 1 ]; then
  usage >&2
  exit 64
fi
if [ ! -f "$1" ]; then
  printf 'file not found: %s\n' "$1" >&2
  exit 66
fi
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/check-mermaid.XXXXXX")" || exit 64
trap 'rm -rf "$tmp_dir"' EXIT
awk -v dir="$tmp_dir" '
  { sub(/\r$/, "") }
  $0 == "```mermaid" && !file {
    file = sprintf("%s/block-%010d.mmd", dir, ++count)
    printf "%s", "" > file
    next
  }
  /(```|~~~).*mermaid/ {
    error = "unsupported mermaid fence at line " NR
    exit 1
  }
  file && $0 == "```" {
    close(file)
    file = ""
    next
  }
  file { print > file }
  END {
    if (!error && file) error = "unterminated mermaid block"
    if (!error && !count) error = "no mermaid blocks found"
    if (error) {
      print error > "/dev/stderr"
      exit 1
    }
  }
' "$1" || {
  status=$?
  [ "$status" -eq 1 ] && exit 1
  exit 64
}
printf 'flowchart TD\nA --> B\n' >"$tmp_dir/probe.mmd" || exit 64
if ! mmdc --input "$tmp_dir/probe.mmd" --output "$tmp_dir/probe.svg" --quiet >"$tmp_dir/parser.err" 2>&1; then
  printf '%s\n' 'parser unavailable' >&2
  cat "$tmp_dir/parser.err" >&2 || exit 64
  exit 2
fi
count=0
for block in "$tmp_dir"/block-*.mmd; do
  count=$((count + 1))
  if ! mmdc --input "$block" --output "$block.svg" --quiet >"$tmp_dir/parser.err" 2>&1; then
    printf 'mermaid parse failed in block %s:\n' "$count" >&2
    cat "$tmp_dir/parser.err" >&2 || exit 64
    exit 1
  fi
done
version="$(mmdc --version)" || exit 64
printf 'parser: mmdc\n%s\nparsed %s mermaid block(s)\n' "$version" "$count" || exit 64
