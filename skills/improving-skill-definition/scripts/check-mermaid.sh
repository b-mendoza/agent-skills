#!/usr/bin/env bash
# Bash arrays preserve parser argv; the indexed loop preserves block numbering.
# Usage: bash check-mermaid.sh [-h] [--allow-npx] <markdown-file>
# Environment: PATH (tool lookup), TMPDIR (temporary directory base).
# Exit 0 PASS | 1,3,4 FAIL (repair) | 2 TOOLS_MISSING, or BLOCKED pending approval
#      64 ERROR (usage/setup) | 66 BLOCKED (input missing) | other ERROR.
# Side effects: temporary extraction/render/error files, removed on exit.
# --allow-npx uses @mermaid-js/mermaid-cli@12.0.0 (Node >=22.13.0) and permits
# third-party package/install-script execution, npm cache writes and possible
# Puppeteer Chrome download. Caller owns approval.
# Check: f=$(mktemp); printf '```mermaid\nflowchart TD\n  A-->B\n```\n' > "$f"
#        bash check-mermaid.sh "$f"; s=$?; rm -f "$f"; test "$s" = 0 -o "$s" = 2
set -euo pipefail

usage() { printf '%s\n' "usage: bash $0 [-h] [--allow-npx] <markdown-file>; environment: PATH, TMPDIR"; }
if [ "$#" -eq 1 ] && [ "$1" = '-h' ]; then usage; exit 0; fi
allow_npx=false
if [ "${1-}" = '--allow-npx' ]; then allow_npx=true; shift; fi
if [ "$#" -ne 1 ] || [[ "$1" = -* ]]; then
  usage >&2
  exit 64
fi

input_file="$1"
if [ ! -f "$input_file" ]; then
  printf '%s\n' "file not found: $input_file" >&2
  usage >&2
  exit 66
fi

if command -v mmdc >/dev/null 2>&1; then
  parser_command=(mmdc)
elif command -v npx >/dev/null 2>&1; then
  if ! "$allow_npx"; then
    printf '%s\n' 'parser unavailable: npx approval required' >&2
    exit 2
  fi
  parser_command=(npx -y @mermaid-js/mermaid-cli@12.0.0)
else
  printf '%s\n' 'parser unavailable' >&2
  exit 2
fi

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/check-mermaid.XXXXXX")" || exit 64
trap 'rm -rf "$tmp_dir"' EXIT

awk -v dir="$tmp_dir" '
  {
    sub(/\r$/, "")
    if (fence != "") {
      line = $0; sub(/^ ? ? ?/, "", line)
      if (match(line, "^" fence fence fence "+") && RLENGTH >= width && substr(line, RLENGTH + 1) ~ /^[ \t]*$/) {
        fence = ""
        if (mermaid) close(file)
      } else if (mermaid) {
        for (j = 0; j < indent; j++) sub(/^ /, "")
        print > file
      }
      next
    }
    if (match($0, /^ ? ? ?(```+|~~~+)/)) {
      marker = substr($0, 1, RLENGTH)
      info = substr($0, RLENGTH + 1)
      if (index(marker, "`") && index(info, "`")) next
      indent = match(marker, /[^ ]/) - 1
      sub(/^ */, "", marker)
      fence = substr(marker, 1, 1); width = length(marker)
      mermaid = (info ~ /^[ \t]*mermaid([ \t]|$)/)
      if (mermaid) {
        file = sprintf("%s/block-%03d.mmd", dir, ++count)
        printf "%s", "" > file
      }
    }
  }
  END {
    if (fence != "" && mermaid) {
      print "unterminated mermaid block" > "/dev/stderr"
      exit 3
    }
    if (count == 0) {
      print "no mermaid blocks found" > "/dev/stderr"
      exit 4
    }
    print count > sprintf("%s/count", dir)
  }
' "$input_file" || {
  status=$?
  case "$status" in 3|4) exit "$status" ;; *) exit 64 ;; esac
}

if ! "${parser_command[@]}" --version >"$tmp_dir/parser.err" 2>&1; then
  printf '%s\n' 'parser unavailable' >&2
  cat "$tmp_dir/parser.err" >&2
  exit 2
fi

count="$(cat "$tmp_dir/count")" || exit 64
for ((i = 1; i <= count; i++)); do
  block_file="$(printf '%s/block-%03d.mmd' "$tmp_dir" "$i")"
  output_file="$(printf '%s/block-%03d.svg' "$tmp_dir" "$i")"
  error_file="$(printf '%s/block-%03d.err' "$tmp_dir" "$i")"

  if "${parser_command[@]}" --input "$block_file" --output "$output_file" --quiet >"$error_file" 2>&1; then
    continue
  else
    if grep -qiE 'Error: (ENOSPC|EACCES|EROFS):' "$error_file"; then
      parser_status=64
      printf '%s\n' 'setup error: renderer filesystem failure' >&2
    elif grep -qi 'could not find chrome\|failed to launch\|executable.*not found' "$error_file"; then
      parser_status=2
      printf '%s\n' 'parser unavailable' >&2
    else
      parser_status=1
      printf 'mermaid parse failed in block %s:\n' "$i" >&2
    fi
    cat "$error_file" >&2
    exit "$parser_status"
  fi
done

printf 'parser: %s\n' "${parser_command[*]}"
cat "$tmp_dir/parser.err" || exit 64
printf 'parsed %s mermaid block(s)\n' "$count"
