import { Schema } from "effect";

import { type ApprovalKind, runValidator } from "#/cases/pr-creator-digest.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

const LAST = -1;
const NEXT = 1;
function heredocValue(command: string, filename: string) {
  const header = new RegExp(
    `\\bcat[ \\t]+>[ \\t]*[^\\s;<>]*/${filename.replace(".", "\\.")}["']?[ \\t]+<<[ \\t]*['"]?(?<end>\\w+)['"]?\\s*$`,
  );
  const lines = command.split("\n");
  for (const [index, line] of lines.entries()) {
    const end = delimiter(header, line);
    if (end !== undefined) return bodyThrough(lines, index + NEXT, end);
  }
  return [];
}
function delimiter(header: RegExp, line: string) {
  return header.exec(line)?.groups?.["end"];
}
function bodyThrough(lines: string[], next: number, end: string) {
  const close = lines.indexOf(end, next);
  return close >= next ? [lines.slice(next, close).join("\n")] : [];
}
function fromCall(call: ToolCall, filename: string) {
  if (call.name === "Bash") {
    return heredocValue(String(call.input["command"]), filename);
  }
  if (
    call.name !== "Write" ||
    !String(call.input["file_path"]).endsWith(`/${filename}`)
  ) {
    return [];
  }
  return [String(call.input["content"])];
}
const record = Schema.Record(Schema.String, Schema.Unknown);
function candidate(text: string): string[] {
  try {
    const values = Schema.decodeUnknownSync(record)(JSON.parse(text));
    return interpolateBody(values, text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return [];
  }
}
// Terminal cleanup removes the file before the suite snapshots it. Use only
// evidence from the proposal turn, never execute shell/Python from a transcript.
export function recoveredValues(observation: Observation, gate: ApprovalKind) {
  const calls = observation.turns?.at(LAST)?.toolCalls ?? observation.toolCalls;
  return calls
    .flatMap((call) => fromCall(call, `${gate}-values.json`))
    .flatMap(candidate);
}

function interpolateBody(values: Record<string, unknown>, text: string) {
  // A title/state-only update can interpolate the digest of its unchanged body.
  // This is only a candidate: checkedValues rehashes the ENTIRE object.
  if (
    /^\$\w+$/.test(String(values["baselineBodyDigest"])) &&
    typeof values["body"] === "string"
  ) {
    return [
      JSON.stringify({
        ...values,
        baselineBodyDigest: runValidator(["body"], values["body"]),
      }),
    ];
  }
  return [text];
}
