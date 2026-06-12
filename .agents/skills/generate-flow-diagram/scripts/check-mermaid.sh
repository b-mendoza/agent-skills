#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  printf '%s\n' "usage: $0 <markdown-file>" >&2
  exit 64
fi

input_file="$1"
if [ ! -f "$input_file" ]; then
  printf '%s\n' "file not found: $input_file" >&2
  exit 66
fi

parser_kind=""
if command -v mmdc >/dev/null 2>&1; then
  parser_kind="mmdc"
elif command -v npx >/dev/null 2>&1; then
  parser_kind="npx"
else
  printf '%s\n' "parser unavailable" >&2
  exit 2
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

awk -v dir="$tmp_dir" '
  BEGIN { in_block = 0; count = 0 }
  /^```[[:space:]]*mermaid[[:space:]]*$/ {
    in_block = 1
    count++
    file = sprintf("%s/block-%03d.mmd", dir, count)
    next
  }
  /^```[[:space:]]*$/ && in_block {
    in_block = 0
    next
  }
  in_block { print > file }
  END {
    if (in_block) {
      print "unterminated mermaid block" > "/dev/stderr"
      exit 3
    }
    if (count == 0) {
      print "no mermaid blocks found" > "/dev/stderr"
      exit 4
    }
    print count > sprintf("%s/count", dir)
  }
' "$input_file"

count="$(cat "$tmp_dir/count")"
for ((i = 1; i <= count; i++)); do
  block_file="$(printf '%s/block-%03d.mmd' "$tmp_dir" "$i")"
  output_file="$(printf '%s/block-%03d.svg' "$tmp_dir" "$i")"
  error_file="$(printf '%s/block-%03d.err' "$tmp_dir" "$i")"

  if [ "$parser_kind" = "mmdc" ]; then
    if ! mmdc --input "$block_file" --output "$output_file" --quiet >"$error_file" 2>&1; then
      if grep -qi 'could not find chrome\|failed to launch\|executable.*not found' "$error_file"; then
        printf '%s\n' "parser unavailable" >&2
        cat "$error_file" >&2
        exit 2
      fi
      printf 'mermaid parse failed in block %s:\n' "$i" >&2
      cat "$error_file" >&2
      exit 1
    fi
  else
    if ! npx -y @mermaid-js/mermaid-cli --input "$block_file" --output "$output_file" --quiet >"$error_file" 2>&1; then
      if grep -qi 'could not find chrome\|failed to launch\|executable.*not found' "$error_file"; then
        printf '%s\n' "parser unavailable" >&2
        cat "$error_file" >&2
        exit 2
      fi
      printf 'mermaid parse failed in block %s:\n' "$i" >&2
      cat "$error_file" >&2
      exit 1
    fi
  fi
done

printf 'parsed %s mermaid block(s)\n' "$count"
