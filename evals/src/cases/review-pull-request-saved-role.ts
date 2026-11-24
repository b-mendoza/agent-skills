import { dirname } from "node:path";

import { digest } from "#/cases/review-pull-request-retention-checkpoint.ts";
import { savedFileHashes } from "#/cases/review-pull-request-saved-files.ts";
import { capturedText, fixtureRelativePath } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

const FIRST = 0;
const ONE = 1;
const ASSIGNMENT =
  /\b(?<name>PAYLOAD_FILE|PRIOR_CONTEXT_FILE|PRIOR_AUTHOR_FILE|CONTEXT_FILE)[`"']?\s*[:=]\s*[`"']?(?<path>[^\s`"']+?\.txt)(?=[`"'\s,;)]|\.(?:\s|$)|$)/gu;
const REVISION =
  /\bREVISION_REQUEST[`"']?\s*[:=]\s*[`"']?Redo thread assessment, deduplication and placement \(steps 3 and 4\) against the refreshed context\./u;

interface Payload {
  observation: Observation;
  path: string;
  status: string;
}

function assigned(
  prompt: string,
  key: string,
  path: string,
  observation: Observation,
): boolean {
  const matches = [...prompt.matchAll(ASSIGNMENT)].filter(
    (match) => match.groups?.["name"] === key,
  );
  if (matches.length !== ONE) return false;
  return (
    fixtureRelativePath(
      observation,
      String(matches[FIRST]?.groups?.["path"]),
    ) === path
  );
}

function assignedChunks(prompt: string, observation: Observation): boolean {
  const list =
    /\bCHUNK_FILES[`"']?\s*[:=]\s*(?<files>[^\n]+)/u.exec(prompt)?.groups?.[
      "files"
    ] ?? "";
  const assignedPaths = list
    .split(/[\s,;`"'[\]]+/u)
    .map((path) => fixtureRelativePath(observation, path));
  const saved = Object.keys(savedFileHashes(observation)).filter((path) =>
    /\/chunk-[\w-]+\.txt$/u.test(path),
  );
  return saved.every((path) => assignedPaths.includes(path));
}

function authorInputs(
  prompt: string,
  path: string,
  observation: Observation,
): boolean {
  return (
    assigned(prompt, "PRIOR_AUTHOR_FILE", path, observation) &&
    assigned(
      prompt,
      "CONTEXT_FILE",
      `${dirname(path)}/context.txt`,
      observation,
    ) &&
    assignedChunks(prompt, observation) &&
    REVISION.test(prompt)
  );
}

function revisionInputs(
  prompt: string,
  { path, status, observation }: Payload,
): boolean {
  if (status === "CONTEXT: PASS") {
    return assigned(
      prompt,
      "PRIOR_CONTEXT_FILE",
      `${dirname(path)}/context.txt`,
      observation,
    );
  }
  if (status === "AUTHOR: PASS") {
    return authorInputs(prompt, path, observation);
  }
  return true;
}

function returnedPath(content: string, payload: Payload): boolean {
  const lines = content.split(/\r?\n/gu);
  const status = lines.indexOf(payload.status);
  if (status < FIRST) return false;
  return (
    fixtureRelativePath(
      payload.observation,
      String(lines[status + ONE]).trim(),
    ) === payload.path
  );
}

function assignedPayload(call: ToolCall, payload: Payload): boolean {
  const { result } = call;
  if (result === undefined) return false;
  if (!returnedPath(result.content, payload)) return false;
  return assignedInputs(String(call.input["prompt"]), payload);
}

function assignedInputs(prompt: string, payload: Payload): boolean {
  return (
    assigned(prompt, "PAYLOAD_FILE", payload.path, payload.observation) &&
    revisionInputs(prompt, payload)
  );
}

const WRITE_BYTES = new Map([
  ["Write", "content"],
  ["Edit", "new_string"],
]);

function writtenPayload(
  call: ToolCall,
  { observation, path }: Payload,
): boolean {
  const file = String(call.input["file_path"]);
  if (fixtureRelativePath(observation, file) !== path) return false;
  const key = WRITE_BYTES.get(call.name);
  if (key === undefined) return false;
  const bytes = capturedText(observation, path);
  if (call.input[key] !== bytes) return false;
  return completedWrite(call, bytes, savedFileHashes(observation)[path]);
}

function completedWrite(
  call: ToolCall,
  bytes: string,
  priorHash: string | undefined,
): boolean {
  // Write/Edit results are normally not captured. Newly installed bytes corroborate the attempt; unchanged bytes cannot.
  return call.result?.isError === false || digest(bytes) !== priorHash;
}

export function producedPayload(call: ToolCall, payload: Payload): boolean {
  if (call.result?.isError === true) return false;
  if (["Agent", "Task"].includes(call.name)) {
    return assignedPayload(call, payload);
  }
  return writtenPayload(call, payload);
}
