import assert from "node:assert/strict";

import { normalizeReplyText } from "#/cases/shared-checks.ts";

export interface PreviewIssue {
  readonly title: string;
  readonly body: string;
  readonly args: readonly string[];
}
interface DisplayLabel {
  readonly kind: string;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}
const FIRST_INDEX = 0;
const NEXT_CHARACTER = 1;
const LAST_LINE = -1;
const COMMAND_WORDS = 2;

// Deliberately only literal POSIX words: no expansion, substitution or operators.
function literalWords(command: string): string[] {
  const words: string[] = [];
  const pattern = /(?:[^\s'"\\$`;&|<>()]+|'[^']*'|\\[\\' ])+/g;
  let end = FIRST_INDEX;
  for (const match of command.matchAll(pattern)) {
    assert.equal(
      command.slice(end, match.index).trim(),
      "",
      "unsupported shell syntax in preview",
    );
    words.push(
      match[FIRST_INDEX].replace(
        /'(?<quoted>[^']*)'|\\(?<escaped>[\\' ])/g,
        (_match, quoted: string | undefined, escaped: string | undefined) =>
          quoted ?? escaped ?? "",
      ),
    );
    end = match.index + match[FIRST_INDEX].length;
  }
  assert.equal(
    command.slice(end).trim(),
    "",
    "unsupported shell syntax in preview",
  );
  return words;
}

function takeCreateOption(args: string[]) {
  const argument = args.shift();
  assert.ok(argument !== undefined);
  const separator = argument.indexOf("=");
  if (separator === LAST_LINE) return { key: argument, value: args.shift() };
  return {
    key: argument.slice(FIRST_INDEX, separator),
    value: argument.slice(separator + NEXT_CHARACTER),
  };
}

/** Equivalence is limited to option order and --key=value versus --key value. */
export function createOptions(args: readonly string[]): Record<string, string> {
  assert.deepEqual(args.slice(FIRST_INDEX, COMMAND_WORDS), ["issue", "create"]);
  const options: Record<string, string> = {};
  const remaining = args.slice(COMMAND_WORDS);
  while (remaining.length > FIRST_INDEX) {
    const { key, value } = takeCreateOption(remaining);
    assert.ok(
      ["--repo", "--title", "--body-file"].includes(key),
      `unapproved create option: ${key}`,
    );
    assert.ok(!(key in options), `duplicate create option: ${key}`);
    assert.ok(value !== undefined, `missing create value: ${key}`);
    assert.notEqual(value, "", `empty create value: ${key}`);
    options[key] = value;
  }
  assert.equal(options["--repo"], "b-mendoza/agent-skills");
  assert.equal(options["--body-file"], "-");
  assert.ok(options["--title"] !== undefined);
  return options;
}

function parsePreviewPayload(groups: Record<string, string>): PreviewIssue {
  const { command: rawCommand, body } = groups;
  assert.ok(rawCommand !== undefined && body !== undefined);
  const command = rawCommand.replaceAll(/\\\r?\n/g, " ");
  assert.match(
    command,
    /--title(?:\s+|=)'(?:[^']|'\\'')*'/,
    "preview needs its literal single-quoted title",
  );
  const [executable, ...args] = literalWords(command);
  assert.equal(executable, "gh");
  const options = createOptions(args);
  const title = options["--title"];
  assert.ok(title !== undefined);
  return { title, body, args };
}

function fenceMarker(line: string): string | undefined {
  return /^(?<fence>`{3,}|~{3,})/.exec(line.trimStart())?.groups?.["fence"];
}

function parseLabel(line: string, start: number, end: number): DisplayLabel[] {
  const groups = /^(?<kind>Title|Body|Command):(?<value>.*)$/.exec(
    normalizeReplyText(line).trim(),
  )?.groups;
  if (groups === undefined) return [];
  const { kind, value } = groups;
  assert.ok(kind !== undefined && value !== undefined);
  return [{ kind, value: value.trimStart(), start, end }];
}

/** Ignore labels quoted inside evidence or command fences. */
function displayLabels(text: string): DisplayLabel[] {
  let fence = "";
  let offset = 0;
  return text.split("\n").flatMap((line) => {
    const start = offset;
    offset += line.length + NEXT_CHARACTER;
    const marker = fenceMarker(line);
    if (marker !== undefined) {
      fence = nextFence(fence, marker);
      return [];
    }
    if (fence !== "") return [];
    return parseLabel(line, start, offset);
  });
}

function nextFence(current: string, marker: string): string {
  if (current === "") return marker;
  return marker.startsWith(current) ? "" : current;
}

function displayedBody(text: string): string {
  // Ignore spacing between display blocks, preserving every content line.
  const lines = text.split("\n");
  const first = lines.findIndex((line) => line !== "");
  const last = lines.findLastIndex((line) => line !== "");
  const content = lines.slice(first, last + NEXT_CHARACTER);
  const marker = fenceMarker(content[FIRST_INDEX] ?? "");
  if (marker !== undefined && content.at(LAST_LINE) === marker) {
    return `${content.slice(NEXT_CHARACTER, LAST_LINE).join("\n")}\n`;
  }
  return `${content.join("\n")}\n`;
}

function assertDisplayedItem(
  text: string,
  labels: readonly DisplayLabel[],
  issue: PreviewIssue,
  end: number,
): void {
  for (const title of labels.filter((label) => label.kind === "Title")) {
    assert.equal(
      title.value,
      issue.title,
      "displayed title differs from its command payload",
    );
  }
  labels
    .filter((label) => label.kind === "Body")
    .forEach((body) => {
      const command = labels.find(
        (label) => label.kind === "Command" && label.start > body.start,
      );
      const bodyEnd = command?.start ?? commandFenceStart(text, end);
      assert.equal(
        body.value,
        "",
        "display a complete body rather than an inline summary",
      );
      assert.equal(
        displayedBody(text.slice(body.end, bodyEnd)),
        displayedBody(issue.body),
        "displayed body differs from its command payload",
      );
    });
}

function commandFenceStart(text: string, end: number): number {
  const beforeCommand = text.slice(FIRST_INDEX, end);
  const lastNewline = beforeCommand.lastIndexOf("\n");
  if (beforeCommand.slice(lastNewline + NEXT_CHARACTER).trim() !== "") {
    return end;
  }
  const previousNewline = beforeCommand.lastIndexOf(
    "\n",
    lastNewline - NEXT_CHARACTER,
  );
  const header = beforeCommand.slice(
    previousNewline + NEXT_CHARACTER,
    lastNewline,
  );
  return fenceMarker(header) === undefined
    ? end
    : previousNewline + NEXT_CHARACTER;
}

/** The command is a complete preview by itself; any separate display must agree. */
export function previewIssues(text: string): PreviewIssue[] {
  const issues: PreviewIssue[] = [];
  const labels = displayLabels(text);
  let previousEnd = 0;
  const pattern =
    /GH_HOST=github\.com\s+GH_PROMPT_DISABLED=1\s+(?<command>gh\s+issue\s+create\b[\s\S]*?)<<'(?<delimiter>[A-Za-z_]\w*)'\r?\n(?<body>[\s\S]*?)^\k<delimiter>[\t ]*$/gm;
  for (const match of text.matchAll(pattern)) {
    assert.ok(match.groups !== undefined);
    const issue = parsePreviewPayload(match.groups);
    const start = previousEnd;
    const itemLabels = labels.filter(
      (label) => label.start >= start && label.start < match.index,
    );
    assertDisplayedItem(text, itemLabels, issue, match.index);
    issues.push(issue);
    previousEnd = match.index + match[FIRST_INDEX].length;
  }
  return issues;
}
