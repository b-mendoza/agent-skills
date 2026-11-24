import assert from "node:assert/strict";

import { fixtureRelativePath } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

const FIRST = 0;
const ONE = 1;

function payloadAfterStatus(content: string): string | undefined {
  const status = /\b(?:CONTEXT|CHUNK|AUTHOR|VERIFY): [A-Z_]+/.exec(content);
  if (status === null) return undefined;
  const tail = content.slice(status.index + status[FIRST].length).trimStart();
  const line = tail.split("\n", ONE)[FIRST] ?? "";
  const bare = line.trim().replace(/^[`"']|[`"']$/g, "");
  return bare.endsWith(".txt") ? bare : undefined;
}

function editedBytes(
  input: ToolCall["input"],
  prior: string | undefined,
): string | undefined {
  if (prior === undefined) return undefined;
  return applyEdit(input, prior);
}

function applyEdit(
  input: ToolCall["input"],
  prior: string,
): string | undefined {
  const old = input["old_string"];
  const replacement = input["new_string"];
  if (typeof old !== "string") return undefined;
  if (typeof replacement !== "string") return undefined;
  return input["replace_all"] === true
    ? prior.replaceAll(old, () => replacement)
    : prior.replace(old, () => replacement);
}

function relativePath(observation: Observation, path: unknown): string {
  assert.ok(typeof path === "string", "production path missing");
  const relative = fixtureRelativePath(observation, path);
  assert.ok(relative !== undefined, `produced file outside fixture: ${path}`);
  return relative;
}

export function* scratchAssignments(role: ToolCall): Generator<string> {
  const assignments =
    /\bSCRATCH_FILE\s*[:=]\s*[`"']?(?<path>[^\s`"']+\/scratch-[a-z][a-z0-9-]*\.txt)(?=[\s`"',.;)]|$)/g;
  for (const match of String(role.input["prompt"]).matchAll(assignments)) {
    const path = match.groups?.["path"];
    assert.ok(path !== undefined);
    yield path;
  }
}

function recordReturned(
  produced: Map<string, string | undefined>,
  observation: Observation,
  role: ToolCall,
): void {
  const path = returnedPayload(role);
  if (path === undefined) return;
  produced.set(relativePath(observation, path), undefined);
  for (const assigned of scratchAssignments(role)) {
    const scratch = relativePath(observation, assigned);
    // A completed redispatch may update its assigned notes without an outer Write.
    if (produced.has(scratch)) produced.set(scratch, undefined);
  }
}

function returnedPayload(call: ToolCall): string | undefined {
  const content = call.result?.content ?? "";
  return payloadAfterStatus(content);
}

function recordProduction(
  produced: Map<string, string | undefined>,
  observation: Observation,
  call: ToolCall,
): void {
  if (["Task", "Agent"].includes(call.name)) {
    recordReturned(produced, observation, call);
    return;
  }
  if (!["Write", "Edit"].includes(call.name)) return;
  const path = relativePath(observation, call.input["file_path"]);
  const { content } = call.input;
  if (typeof content === "string") produced.set(path, content);
  else produced.set(path, editedBytes(call.input, produced.get(path)));
}

export function producedReviewFiles(
  observation: Observation,
): ReadonlyMap<string, string | undefined> {
  const produced = new Map<string, string | undefined>();
  for (const call of observation.toolCalls) {
    if (call.result?.isError !== true) {
      recordProduction(produced, observation, call);
    }
  }
  return produced;
}
