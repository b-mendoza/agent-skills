import assert from "node:assert/strict";

import { Schema } from "effect";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";

const FIRST = 0;
const ONE = 1;

function tagName(part: string): string | undefined {
  return /^<(?<name>\/?[a-z]+)/iu.exec(part)?.groups?.["name"]?.toLowerCase();
}

function disclosureFilter() {
  const open: boolean[] = [];
  let summary = false;
  return (part: string): string => {
    switch (tagName(part)) {
      case "details":
        open.push(/\sopen(?:\s|=|>)/iu.test(part));
        break;
      case "/details":
        open.pop();
        break;
      case "summary":
        summary = true;
        break;
      case "/summary":
        summary = false;
        break;
      default: {
        const containers = summary ? open.slice(FIRST, -ONE) : open;
        return containers.every(Boolean) ? part : "";
      }
    }
    return "";
  };
}

/** Closed disclosures hide their contents, but their summary is still visible. */
export function visibleTurn(text: string): string {
  return text
    .replace(/<!--[\s\S]*?(?:-->|$)/gu, "")
    .split(/(?<tag><\/?(?:details|summary)\b[^>]*>)/giu)
    .map(disclosureFilter())
    .join("");
}

function hasTarget(text: string, target: string): boolean {
  return text
    .split(/[\s<>`'"()*[\]]+/u)
    .some(
      (word) =>
        word.startsWith(target) &&
        /^[.,;:!?]*$/u.test(word.slice(target.length)),
    );
}

function identifiesReply(line: string, target: string): boolean {
  const reply = /\brepl(?:y|ies)\b/iu.exec(line);
  return reply !== null && hasTarget(line, target);
}

function field(headers: string, prefix: string): string {
  const line = headers.split("\n").find((row) => row.startsWith(prefix));
  assert.ok(line !== undefined, `poster preview missing ${prefix}`);
  return line.slice(prefix.length);
}

function assertCounts(headers: string, visible: string): void {
  const counts =
    /Inline comments: (?<inline>\d+); thread replies: (?<reply>\d+)/u.exec(
      headers,
    )?.groups;
  assert.ok(counts !== undefined, "poster preview missing counts");
  const prose = visible.replace(
    /\b(?<count>no|zero|0) (?<inline>inline comments?) (?:or|and) (?<replies>(?:thread )?replies)\b/giu,
    "$<count> $<inline> and $<count> $<replies>",
  );
  for (const [kind, noun] of [
    ["inline", "inline(?: comments?)?"],
    ["reply", "(?:thread )?repl(?:y|ies)"],
  ] as const) {
    const count = counts[kind];
    const value = count === "0" ? "(?:0|no|zero)" : String(count);
    assert.match(
      prose,
      new RegExp(
        `\\b(?:${noun}\\s*[:=–-]?\\s*${value}|${value}\\s+${noun})\\b`,
        "iu",
      ),
      `missing ${kind} count`,
    );
  }
}

function assertMetadata(headers: string, visible: string): void {
  const target = field(headers, "POST review to ");
  const [viewer] = field(headers, "Submit a new review as ").split(" ");
  assert.notEqual(viewer, "");
  assert.ok(
    hasTarget(visible, target) || hasTarget(visible, GITHUB_FACTS.url),
    "visible preview missing PR target",
  );
  const words = visible.match(/[\w-]+/gu) ?? [];
  for (const value of [
    viewer,
    field(headers, "event: "),
    field(headers, "merge-base: "),
    field(headers, "commit_id: "),
  ]) {
    assert.ok(
      words.some((word) => word === value),
      `visible preview missing ${value}`,
    );
  }
  assert.match(
    visible,
    /\bnew review\b|\b(?:post|submit)\b[^\n.?!]*\breview\b/iu,
    "visible preview missing new review action",
  );
}

function fenceAt(line: string): string | undefined {
  return /^(?<fence>`{3,}|~{3,})[\w-]*$/u.exec(line)?.groups?.["fence"];
}

function* quoteBodies(lines: readonly string[]): Generator<string> {
  const text = `${lines.join("\n")}\n`;
  for (const [quote] of text.matchAll(/^(?:>[^\n]*\n)+/gmu)) {
    yield quote.replace(/^> ?/gmu, "");
  }
}

function* wrappedBodies(visible: string): Generator<string> {
  const lines = visible.split("\n");
  let start = FIRST;
  let i = FIRST;
  while (i < lines.length) {
    const fence = fenceAt(String(lines[i]));
    if (fence === undefined) {
      i += ONE;
      continue;
    }
    yield* quoteBodies(lines.slice(start, i));
    const end = lines.indexOf(fence, i + ONE);
    if (end < FIRST) return;
    yield `${lines.slice(i + ONE, end).join("\n")}\n`;
    start = end + ONE;
    i = start;
  }
  yield* quoteBodies(lines.slice(start));
}

function wrappedBody(visible: string, body: string): boolean {
  const bytes = body.endsWith("\n") ? body : `${body}\n`;
  return Array.from(wrappedBodies(visible)).includes(bytes);
}

function assertBody(visible: string, body: string): void {
  assert.ok(
    body.length > FIRST &&
      (`\n${visible}\n`.includes(`\n${body}\n`) || wrappedBody(visible, body)),
    "visible preview differs from exact postable body",
  );
}

/** Parse the shipped preview; the reopen scenario separately binds the final action. */
export function assertVisibleReview(output: string, visible: string): void {
  const [headers, contents] = output.split("\n\nSummary body:\n\n");
  assert.ok(
    headers !== undefined && contents !== undefined,
    "missing preview summary",
  );
  assertMetadata(headers, visible);
  assertCounts(headers, visible);
  const [payload] = contents.split("\napproval-sha256: ");
  assert.ok(payload !== undefined);
  const [summary, ...actions] = payload.split(
    /\n\n(?=Reply to root |Inline: |This account already approved this head: )/u,
  );
  assert.ok(summary !== undefined);
  assertBody(visible, summary);
  const targets = actions
    .filter((action) => action.startsWith("Reply to root "))
    .map((action) => action.split("\n\n")[FIRST]?.split(": ").at(ONE) ?? "");
  for (const action of actions) assertAction(visible, action, targets);
}

function replySection(
  visible: string,
  target: string,
  targets: readonly string[],
): string {
  const lines = visible.split("\n");
  const index = lines.findIndex((line) => identifiesReply(line, target));
  assert.ok(index >= FIRST, "visible preview missing reply target");
  const after = lines.slice(index + ONE);
  const next = after.findIndex((line) =>
    targets.some((other) => other !== target && identifiesReply(line, other)),
  );
  return (next < FIRST ? after : after.slice(FIRST, next)).join("\n");
}

const anchor = Schema.decodeUnknownSync(
  Schema.Struct({
    path: Schema.String,
    line: Schema.Number,
    side: Schema.Literals(["LEFT", "RIGHT"]),
    start_line: Schema.optional(Schema.Number),
  }),
);

function hasInlineLocation(visible: string, target: string): boolean {
  if (visible.includes(target)) return true;
  const location = anchor(JSON.parse(target));
  const range =
    location.start_line === undefined
      ? String(location.line)
      : `${location.start_line}-${location.line}`;
  const citation = `${location.path}:${range}`;
  return visible
    .split("\n")
    .some(
      (line) => hasTarget(line, citation) && hasTarget(line, location.side),
    );
}

function assertAction(
  visible: string,
  action: string,
  targets: readonly string[],
): void {
  const separator = action.indexOf("\n\n");
  assert.ok(separator > FIRST);
  const header = action.slice(FIRST, separator);
  if (header.startsWith("This account already approved this head: ")) {
    const urls = field(
      header,
      "This account already approved this head: ",
    ).split(", ");
    assert.ok(
      urls.every((url) => hasTarget(visible, url)),
      "missing prior approval target",
    );
    assert.match(
      visible,
      /already approved|prior approval|existing approval|another approval/iu,
    );
    return;
  }
  const target = header.slice(header.indexOf(": ") + ": ".length);
  const body = action.slice(separator + "\n\n".length);
  if (header.startsWith("Inline:")) {
    assert.ok(hasInlineLocation(visible, target), "missing inline target");
    assertBody(visible, body);
  } else assertBody(replySection(visible, target, targets), body);
}
