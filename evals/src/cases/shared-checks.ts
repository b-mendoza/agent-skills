import assert from "node:assert/strict";
import { realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { QUERY_ERROR_SUBTYPE } from "#/observation/agent-query.ts";
import {
  mutationEvidence,
  skillInvocations,
} from "#/observation/mutation-evidence.ts";

/** Normalizes reply formatting for lexical checks without joining lines. */
export function normalizeReplyText(finalText: string): string {
  return finalText
    .replace(/^[\t ]*(?:>[\t ]*)+/gm, "")
    .replace(/^[\t ]*(?:[-+*]|\d+[.)])[\t ]+/gm, "")
    .replace(/^[\t ]*#{1,6}[\t ]+/gm, "")
    .replace(
      /(?<!\w)(?<marker>\*\*|__)(?=\S)(?<text>[^\r\n]*?\S)\k<marker>(?!\w)/g,
      "$<text>",
    )
    .replace(
      /(?<!\w)(?<marker>[*_])(?=\S)(?<text>[^\r\n]*?\S)\k<marker>(?!\w)/g,
      "$<text>",
    )
    .replace(/`+/g, "");
}

export function assertNoPublicStatusLine(
  finalText: string,
  ...prefixes: [string, ...string[]]
): void {
  for (const line of normalizeReplyText(finalText).split("\n")) {
    assert.ok(
      !prefixes.some((prefix) => line.trim().startsWith(`${prefix}:`)),
      `reply contains public status line: ${JSON.stringify(line.trim())}`,
    );
  }
}

/** Accepts a topic in the same sentence/line as ? or send/provide/share/paste/reply/tell me/let me know/please/confirm/choose/approve. */
// shortcut: lexical matching only; use a semantic judge if negation or quoted examples matter.
export function replyAsksFor(finalText: string, topic: RegExp): boolean {
  const sentences =
    normalizeReplyText(finalText).match(/[^.!?\r\n]+[.!?]?/g) ?? [];
  return sentences.some(
    (sentence) =>
      new RegExp(topic).test(sentence) &&
      (sentence.includes("?") ||
        /\b(?:send|provide|share|paste|reply|tell me|let me know|please|confirm|choose|approve)\b/i.test(
          sentence,
        )),
  );
}

export const GH_API_OPTIONS = {
  cache: { type: "string" },
  field: { type: "string", short: "F", multiple: true },
  header: { type: "string", short: "H" },
  hostname: { type: "string" },
  input: { type: "string" },
  jq: { type: "string", short: "q" },
  method: { type: "string", short: "X" },
  preview: { type: "string", short: "p" },
  "raw-field": { type: "string", short: "f", multiple: true },
  template: { type: "string", short: "t" },
} as const;

export function parseGitHubApiArguments(args: readonly string[]) {
  const parsed = parseArgs({
    args: [...args],
    allowPositionals: true,
    strict: false,
    tokens: true,
    options: GH_API_OPTIONS,
  });
  const hasBody = parsed.tokens.some(
    (token) =>
      token.kind === "option" &&
      ["field", "raw-field", "input"].includes(token.name),
  );
  return {
    ...parsed,
    method: parsed.values.method ?? (hasBody ? "POST" : "GET"),
  };
}

/** Returns whether this is GraphQL, rejecting queries not proven read-only by argv. */
export function assertReadOnlyGraphqlArguments(
  args: readonly string[],
): boolean {
  const [family] = args;
  if (family !== "api") return false;
  const { positionals, tokens } = parseGitHubApiArguments(args);
  const [, endpoint] = positionals;
  if (endpoint !== "graphql") return false;
  if (
    tokens.some((token) => token.kind === "option" && token.name === "help")
  ) {
    return true;
  }
  assert.ok(
    !tokens.some((token) => token.kind === "option" && token.name === "input"),
    "GraphQL body unavailable in argv; remote write cannot be ruled out",
  );
  const fields = tokens.flatMap((token) => {
    if (
      token.kind !== "option" ||
      !["field", "raw-field"].includes(token.name)
    ) {
      return [];
    }
    return [token.value ?? ""];
  });
  assert.ok(
    !fields.some((field) => /^[^=]*=@/.test(field)),
    "GraphQL body unavailable in argv; remote write cannot be ruled out",
  );
  const queries = fields
    .filter((field) => field.startsWith("query="))
    .map((field) => field.slice("query=".length).trim());
  assert.notDeepEqual(queries, [], "GraphQL query missing from argv");
  assert.ok(
    queries.every(
      (query) => /^(?:query\b|\{)/.test(query) && !/\bmutation\b/.test(query),
    ),
    "GraphQL mutation or unknown query attempted without approval",
  );
  return true;
}

export const FIXTURE_ROOT_PATH = ".git/eval-fixture-root";

export function seedFixtureRoot(repoPath: string): void {
  writeFileSync(
    join(repoPath, FIXTURE_ROOT_PATH),
    `${repoPath}\n${realpathSync(repoPath)}`,
  );
}

/** Resolves tool paths only within the recorded lexical or canonical fixture root. */
export function fixtureRelativePath(
  observation: Observation,
  path: string,
): string | undefined {
  if (path.split("/").includes("..")) return undefined;
  if (!isAbsolute(path)) return normalize(path);
  const roots = capturedFile(observation, FIXTURE_ROOT_PATH);
  assert.ok(roots !== null, "fixture roots are absent");
  return roots
    .split("\n")
    .filter(isAbsolute)
    .map((root) => relative(root, resolve(root, path)))
    .find(
      (relativePath) =>
        !isAbsolute(relativePath) && !relativePath.split("/").includes(".."),
    );
}

const NO_TOOL_CALLS = 0;
const NO_SKILL_INVOCATIONS = 0;
const NO_COST_USD = 0;

/** The result subtype for a run stopped by the suite's configured budget cap. */
export const BUDGET_STOP_SUBTYPE = "error_max_budget_usd";

/** Keeps a failure message to the single line the report cell can hold. */
function firstLine(text: string): string {
  const [line = ""] = text.trim().split("\n");
  return line === "" ? "(no output)" : line;
}

/**
 * Fails when the agent never actually ran.
 *
 * A negative case passes by observing an absence -- no Skill call, no report --
 * and a run that never started produces exactly that absence. Without this,
 * a query that failed before reaching a model reads as "the skill correctly
 * declined", which is a green check that means nothing. Every case calls this
 * first.
 */
export function assertRunHappened(observation: Observation): void {
  assert.ok(!observation.timedOut, "run exceeded its wall clock");
  assert.notEqual(
    observation.subtype,
    QUERY_ERROR_SUBTYPE,
    `the query produced no result, so this run observed nothing: ${firstLine(observation.finalText)}`,
  );
  // Defensive: every real result message carries a subtype, and the harness's
  // synthetic failure carries QUERY_ERROR_SUBTYPE. An empty subtype is a shape
  // no run produces, so it must not pass as one.
  assert.notEqual(observation.subtype, "", "run carries no result verdict");
  // A query that concludes is not a run that happened. An expired login
  // returns in milliseconds with `is_error` set, a `success` subtype, and the
  // auth message where the answer belongs -- so the SDK started, reported, and
  // ended clean, satisfying the checks above while reaching no model at all.
  // What it leaves behind is silence, which is also what a passing negative
  // case looks like, so an expired login turns those green on evidence never
  // collected.
  //
  // Tolerated in two cases, because neither is a run that failed to happen: a
  // stop the suite asked for by capping the budget, and an error that arrived
  // after the run had already spent money or called a tool, where the case's
  // own assertions can judge what was observed.
  if (!observation.isError) return;
  if (observation.subtype === BUDGET_STOP_SUBTYPE) return;
  assert.ok(
    observation.toolCalls.length > NO_TOOL_CALLS ||
      observation.costUsd > NO_COST_USD,
    `the SDK reported a failed run before it did anything (subtype: ${observation.subtype}): ${firstLine(observation.finalText)}`,
  );
}

/** Routing runs must be valid even when the budget stops them. */
export function assertRoutingRunEndedEarly(observation: Observation): void {
  assertRunHappened(observation);
}

/** Names the tools a run actually called, for failure messages. */
export function formatToolNames(toolCalls: readonly ToolCall[]): string {
  const names = toolCalls.map((toolCall) => toolCall.name).join(", ");
  return names === "" ? "none" : names;
}

export function checkPositiveRouting(
  observation: Observation,
  skill: string,
): string {
  assertRoutingRunEndedEarly(observation);
  assert.ok(
    skillInvocations(observation, skill).length > NO_SKILL_INVOCATIONS,
    `skill never triggered; tools called: ${formatToolNames(observation.toolCalls)}`,
  );
  return "Skill invoked";
}

export function checkNegativeRouting(
  observation: Observation,
  skill: string,
  failureMessage = `skill ${skill} unexpectedly triggered`,
): string {
  assertRoutingRunEndedEarly(observation);
  assert.equal(
    skillInvocations(observation, skill).length,
    NO_SKILL_INVOCATIONS,
    failureMessage,
  );
  return "no trigger";
}

/** No observed mutation, not proof against arbitrary shell writes. */
export function assertNoMutation(observation: Observation): void {
  assertRunHappened(observation);
  const evidence = mutationEvidence(observation);
  assert.deepEqual(
    evidence,
    [],
    `read-only contract violated:\n${evidence.join("\n")}`,
  );
}

/** Native per-attempt grading for read-only behavioral cases. */
export function checkMutationScope(observation: Observation): string {
  assertNoMutation(observation);
  return "1 behavioral run(s) left no trace";
}

/** Lexical command matches only; this does not prove successful execution. */
export function findBashCalls(
  observation: Observation,
  pattern: RegExp,
): ToolCall[] {
  return observation.toolCalls.filter(
    (toolCall) =>
      toolCall.name === "Bash" &&
      typeof toolCall.input["command"] === "string" &&
      new RegExp(pattern).test(toolCall.input["command"]),
  );
}

function capturedFile(observation: Observation, path: string): string | null {
  assertRunHappened(observation);
  const files = observation.repoFiles;
  assert.ok(
    files !== undefined && Object.hasOwn(files, path),
    `file was not captured: ${path}`,
  );
  const content = files[path];
  assert.ok(content !== undefined, `file was not captured: ${path}`);
  return content;
}

/** Returns captured regular descendants of an explicitly requested trailing-slash directory. Absent and empty directories return {}. */
export function capturedFilesUnder(
  observation: Observation,
  directoryPrefix: string,
): Readonly<Record<string, string>> {
  assert.ok(directoryPrefix.endsWith("/"), "directory prefix must end with /");
  const marker = capturedFile(observation, directoryPrefix);
  if (marker === null) return {};
  assert.equal(
    marker,
    "",
    `invalid directory capture marker: ${directoryPrefix}`,
  );
  return Object.fromEntries(
    Object.entries(observation.repoFiles ?? {}).filter(
      (entry): entry is [string, string] => {
        const [path, content] = entry;
        return (
          path.startsWith(directoryPrefix) &&
          !path.endsWith("/") &&
          content !== null
        );
      },
    ),
  );
}

/** Requires a captured regular file, including an empty file. */
export function assertFileExists(observation: Observation, path: string): void {
  assert.notEqual(
    capturedFile(observation, path),
    null,
    `file is absent: ${path}`,
  );
}

/** Requires a captured missing path, not an unrequested path. */
export function assertFileAbsent(observation: Observation, path: string): void {
  assert.equal(capturedFile(observation, path), null, `file exists: ${path}`);
}

export function assertFileMatches(
  observation: Observation,
  path: string,
  pattern: RegExp,
): void {
  const content = capturedFile(observation, path);
  assert.ok(content !== null, `file is absent: ${path}`);
  assert.match(content, pattern, `file content did not match: ${path}`);
}
