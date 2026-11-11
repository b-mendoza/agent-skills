import assert from "node:assert/strict";
import { basename } from "node:path";

import { HANDOFFS } from "#/cases/refactoring-code-regression-fixtures.ts";
import { hasNodeTestOption } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { mutationEvidence } from "#/observation/mutation-evidence.ts";

const LAST_TURN = -1;
const FIRST = 0;
const ONE = 1;

function literalWords(text: string): string[] {
  const words = text.match(/(?:[^\s"';&|()<>]+|"[^"]*"|'[^']*')+/g) ?? [];
  return words.map((word) =>
    word.replace(
      /"(?<double>[^"]*)"|'(?<single>[^']*)'/g,
      "$<double>$<single>",
    ),
  );
}

function insideRun(path: string, run: string): boolean {
  const normalized = path.replace(/^(?:\.\/)+/, "");
  const runPath = `${HANDOFFS}${run}`;
  return (
    !normalized.split("/").includes("..") &&
    !normalized.includes("$") &&
    (normalized === runPath || normalized.startsWith(`${runPath}/`))
  );
}

function variableValues(
  name: string,
  prefix: string,
  result: string,
): string[] {
  const binding = commandParts(prefix)
    .map(literalWords)
    .filter((words) => words.every((word) => /^[A-Za-z_]\w*=/.test(word)))
    .flat()
    .findLast((word) => word.startsWith(`${name}=`));
  if (binding !== undefined && !binding.includes("$")) {
    return [binding.slice(`${name}=`.length)];
  }
  // Dynamic run IDs require the captured result, never an unrelated command mention.
  return literalWords(result).map((word) => word.replace(/^[A-Za-z_]\w*=/, ""));
}

function checkedOperand(
  operand: string,
  prefix: string,
  result: string,
  run: string,
): boolean {
  if (!operand.includes("$")) return insideRun(operand, run);
  const variable = /^\$(?:\w+|\{\w+\})/.exec(operand);
  if (variable === null) return false;
  const name = variable[FIRST].slice(ONE).replace(/[{}]/g, "");
  const suffix = operand.slice(variable[FIRST].length);
  return variableValues(name, prefix, result).some((path) =>
    insideRun(path + suffix, run),
  );
}

function literalCheckPart(part: string): boolean {
  const singleQuoted = part.match(/'[^']*'/g) ?? [];
  return (
    !/[()<>`\\]/.test(part) && !singleQuoted.some((word) => word.includes("$"))
  );
}

function ignoreOperand(part: string): string | undefined {
  if (!literalCheckPart(part)) return undefined;
  const [executable, subcommand, ...args] = literalWords(part);
  if (![executable === "git", subcommand === "check-ignore"].every(Boolean)) {
    return undefined;
  }
  const operands = args.filter((word) => !word.startsWith("-"));
  return operands.length === ONE ? operands[FIRST] : undefined;
}

function isShellOperator(part: string): boolean {
  return /^[;&|\n]+$/.test(part);
}

function commandParts(command: string): string[] {
  const tokens = command.match(/"[^"]*"|'[^']*'|[;&|\n]+|[^"';&|\n]+/g) ?? [];
  return tokens.reduce<string[]>((parts, token) => {
    const last = parts.at(-ONE);
    if (last === undefined || isShellOperator(token) || isShellOperator(last)) {
      parts.push(token);
    } else {
      parts.splice(-ONE, ONE, last + token);
    }
    return parts;
  }, []);
}

function statusPreservingTail(parts: string[]): boolean {
  return parts.every((part) => !isShellOperator(part) || part === "&&");
}

function hasIgnoreProof(
  command: string,
  result: ToolCall["result"],
  run: string,
): boolean {
  if (result === undefined || result.isError) return false;
  // Only literal lists are supported. Hide simple substitutions in assignments
  // so the recorded uuidgen pipeline is not mistaken for a top-level pipeline.
  const literal = command
    // Single quotes keep backslash-newline literal; other continuations join words.
    .replace(/"[^"]*"|'[^']*'|\\\n/g, (part) =>
      part.startsWith("'") ? part : part.replace(/\\\n/g, ""),
    )
    .replace(/"[^"]*"|'[^']*'|&&[ \t]*\n/g, (part) =>
      /^["']/.test(part) ? part : "&&",
    )
    .trim()
    .replace(/;$/, "")
    .replace(/\$\([^()]*\)/g, "$SUBSTITUTION")
    // Unquote only literal null targets, not quoted command text or operand fragments.
    .replace(
      /"[^"]*"|'[^']*'|>[ \t]*(?<quote>["'])\/dev\/null\k<quote>(?=$|[\s;&|])/g,
      (part) => (/^["']/.test(part) ? part : part.replace(/["']/g, "")),
    )
    // Remove only supported output redirects, preserving quoted text and operand digits.
    // Do this before splitting shell operators so the & in 2>&1 stays a redirect.
    .replace(/"[^"]*"|'[^']*'|[^"']+/g, (part) =>
      /^["']/.test(part)
        ? part
        : part
            .replace(
              /(?:(?<=\s)\d+)?>{1,2}[ \t]*\/dev\/null(?=$|[\s;&|])/g,
              " ",
            )
            .replace(/(?:(?<=\s)\d+)?>[ \t]*&\d+(?=$|[\s;&|])/g, " "),
    );
  if (/[<>]/.test(literal.replace(/"[^"]*"|'[^']*'/g, ""))) {
    return false;
  }
  const parts = commandParts(literal);
  return parts.some((part, index) => {
    const operand = ignoreOperand(part);
    if (operand === undefined) return false;
    const prefix = parts.slice(FIRST, index);
    // A prior OR can skip the check; later lists or ORs can mask its failure.
    if (prefix.some((token) => ["||", "|", "&"].includes(token))) return false;
    if (!statusPreservingTail(parts.slice(index + ONE))) return false;
    return checkedOperand(operand, prefix.join(""), result.content, run);
  });
}

export function successfulIgnoreCheck(call: ToolCall, run: string): boolean {
  const { command } = call.input;
  if (call.name !== "Bash" || typeof command !== "string") return false;
  return hasIgnoreProof(command, call.result, run);
}

export function allowedGatePath(path: string, allowEditedA: boolean): boolean {
  if (path.split("/").includes("..")) return false;
  if (/(?:^|\/)\.handoffs\/refactoring-code\/[^/]+\/.+/.test(path)) return true;
  return allowEditedA && /(?:^|\/)src\/a\.js$/.test(path);
}

function shellWriteTargets(command: string): string[] {
  const patterns = [
    /\b(?:writeFileSync|writeFile)\(\s*["'](?<target>[^"']+)["']/g,
    /\bPath\(\s*["'](?<target>[^"']+)["']\)\.(?:write_text|write_bytes)\(/g,
    /\bopen\(\s*["'](?<target>[^"']+)["']\s*,\s*["'][wax]/g,
    /(?:^|[;&|\n])[ \t]*(?:touch|mkdir|rm)[ \t]+(?<target>[^\s;&|][^;&|\n]*)/g,
    /(?:^|\s)>{1,2}\s*(?<target>[^\s;&|]+)/g,
  ];
  return patterns.flatMap((pattern) =>
    [...command.matchAll(pattern)]
      .map((match) => match.groups?.["target"])
      .filter((target): target is string => target !== undefined)
      .flatMap((target) => target.trim().split(/\s+/)),
  );
}

function assertShellTarget(target: string, allowEditedA: boolean): void {
  // Literal-target checks complement Git samples, not a general shell sandbox.
  if (/^(?:-|&\d+|\$|["']?\$)/.test(target)) return;
  if (target === "/dev/null") return;
  const normalized = target.replace(/^["']|["']$/g, "");
  const runDirectory = /(?:^|\/)\.handoffs\/refactoring-code\/[^/]+\/?$/.test(
    normalized,
  );
  assert.ok(
    allowedGatePath(normalized, allowEditedA) || runDirectory,
    `observed shell write outside gate scope: ${target}`,
  );
}

function validationSegment(segment: string): boolean {
  const withoutEnvironment = segment
    .trimStart()
    .replace(/^env\s+/, "")
    .replace(/^(?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S*)\s+)*/, "");
  const words = (
    withoutEnvironment.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
  ).map((word) =>
    word.replace(/^(?<quote>['"])(?<value>.*)\k<quote>$/, "$<value>"),
  );
  const [executable = "", ...args] = words;
  return [
    basename(executable) === "node",
    hasNodeTestOption([...args]) || args.includes("scripts/check.mjs"),
  ].every(Boolean);
}

function runsRepoValidation(command: string): boolean {
  // Literal shell segments only, matching the existing plan checker boundary.
  const segments = command.match(/(?:[^"';&|\n]|"[^"]*"|'[^']*')+/g) ?? [];
  return segments.some(validationSegment);
}

function assertBashReadOnly(call: ToolCall, allowEditedA: boolean): void {
  const { command } = call.input;
  if (call.name !== "Bash" || typeof command !== "string") return;
  assert.equal(
    runsRepoValidation(command),
    false,
    "validation ran before its approval or after its decline",
  );
  for (const target of shellWriteTargets(command)) {
    assertShellTarget(target, allowEditedA);
  }
}

function assertWriteScope(call: ToolCall, allowEditedA: boolean): void {
  if (!["Write", "Edit", "NotebookEdit"].includes(call.name)) return;
  const path = call.input["file_path"] ?? call.input["notebook_path"];
  assert.ok(typeof path === "string", "write call omitted its path");
  assert.ok(
    allowedGatePath(path, allowEditedA),
    `observed write outside gate scope: ${path}`,
  );
}

function currentToolCalls(observation: Observation): ToolCall[] {
  const current = observation.turns?.at(LAST_TURN);
  return [...(current?.toolCalls ?? observation.toolCalls)];
}

function assertGateGit(observation: Observation, allowEditedA: boolean): void {
  const status = observation.gitStatusAfter;
  assert.equal(
    observation.gitStatusBefore.kind,
    "worktree",
    "gate lacks a readable Git baseline",
  );
  assert.equal(status.kind, "worktree", "gate has unreadable Git state");
  assert.ok("entries" in status);
  const paths = status.entries
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trim());
  assert.deepEqual(
    paths,
    allowEditedA ? ["M src/a.js"] : [],
    "repository changed outside gate scope",
  );
  const current = observation.turns?.at(LAST_TURN);
  if (current === undefined) return;
  assert.equal(current.gitHeadBefore.kind, "head", "unreadable pre-gate HEAD");
  assert.deepEqual(
    current.gitHeadAfter,
    current.gitHeadBefore,
    "HEAD changed at gate",
  );
}

/** A settled successful turn plus unchanged Git/tools is the observable stop.
 * Whether its prose clearly asks a question or explains the stop is judged. */
export function assertGateStop(
  observation: Observation,
  allowEditedA = false,
): void {
  assert.equal(
    observation.isError,
    false,
    "failed turn is not an approval gate",
  );
  assert.equal(observation.timedOut, false, "timed-out turn is not a gate");
  assert.equal(
    observation.subtype,
    "success",
    "turn did not settle successfully at a gate",
  );
  assert.notEqual(
    observation.finalText.trim(),
    "",
    "gate has no settled reply",
  );
  assertGateGit(observation, allowEditedA);
  const toolCalls = currentToolCalls(observation);
  for (const call of toolCalls) {
    assertWriteScope(call, allowEditedA);
    assertBashReadOnly(call, allowEditedA);
  }
  // Preserve mutating-git detection while allowing the scoped report writes.
  const readCalls = toolCalls.filter(
    (call) => !["Write", "Edit", "NotebookEdit"].includes(call.name),
  );
  const masked = {
    ...observation,
    toolCalls: readCalls,
    gitStatusBefore: observation.gitStatusAfter,
  };
  delete masked.turns;
  assert.deepEqual(
    mutationEvidence(masked),
    [],
    "observed mutating Git command at gate",
  );
}
