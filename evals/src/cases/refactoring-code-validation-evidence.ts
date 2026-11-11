import assert from "node:assert/strict";
import { basename } from "node:path";
import { stripVTControlCharacters } from "node:util";

import {
  commandParts,
  literalWords,
  shellWriteTargets,
  writePath,
} from "#/cases/refactoring-code-gate-evidence.ts";
import { findBashCalls, fixtureRelativePath } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { mutationEvidence } from "#/observation/mutation-evidence.ts";

const FIRST = 0;
const ONE = 1;
const BOUNDARY_TESTS = 5;
const NO_FAILURES = 0;
const LAST_SUMMARY = -1;

function lastNumericEvidence(
  output: string,
  pattern: RegExp,
): number | undefined {
  const last = [...output.matchAll(pattern)].at(LAST_SUMMARY);
  return last === undefined ? undefined : Number(last.groups?.["count"]);
}

function summaryCount(output: string, field: string): number | undefined {
  return lastNumericEvidence(
    output,
    new RegExp(`^[#ℹ]\\s+${field} (?<count>\\d+)\\b`, "gm"),
  );
}

function successfulBoundaryCheck(call: ToolCall): boolean {
  if (call.result === undefined || call.result.isError) return false;
  const output = stripVTControlCharacters(call.result.content);
  const exit = lastNumericEvidence(output, /^exit=(?<count>-?\d+)\s*$/gm);
  return [
    summaryCount(output, "tests") === BOUNDARY_TESTS,
    summaryCount(output, "pass") === BOUNDARY_TESTS,
    summaryCount(output, "fail") === NO_FAILURES,
    exit === undefined || exit === NO_FAILURES,
  ].every(Boolean);
}

function successfulReviewerValidation(call: ToolCall): boolean {
  if (call.result === undefined || call.result.isError) return false;
  return /^PASS\s*$/m.test(call.result.content);
}

interface EditorOperands {
  inPlace: boolean;
  scriptSeen: boolean;
  options: boolean;
  skipNext: boolean;
  emptyBackup: boolean;
  targets: string[];
}

function readEditorOption(state: EditorOperands, word: string): EditorOperands {
  if (word === "--") return { ...state, options: false };
  // An i suffix is a backup extension; an e/f suffix is a script argument.
  if (/^--in-place(?:=|$)|^-[^-ief]*i/.test(word)) {
    return { ...state, inPlace: true, emptyBackup: /^-[^-ief]*i$/.test(word) };
  }
  if (/^--(?:expression|file)(?:=|$)|^-[^-ief]*[ef]/.test(word)) {
    return {
      ...state,
      scriptSeen: true,
      skipNext: /^(?:--(?:expression|file)|-[^-ief]*[ef])$/.test(word),
    };
  }
  return state;
}

function readEditorOperand(
  state: EditorOperands,
  word: string,
): EditorOperands {
  if (state.scriptSeen) return { ...state, targets: [...state.targets, word] };
  return { ...state, scriptSeen: true };
}

function readEditorArgument(
  state: EditorOperands,
  word: string,
): EditorOperands {
  if (state.skipNext) return { ...state, skipNext: false };
  if (state.options && word.startsWith("-")) {
    return readEditorOption(state, word);
  }
  return readEditorOperand(state, word);
}

function readEditorWord(state: EditorOperands, word: string): EditorOperands {
  // Only the empty word immediately after a bare -i is a BSD backup suffix.
  const next = { ...state, emptyBackup: false };
  if (state.emptyBackup && word === "") return next;
  return readEditorArgument(next, word);
}

function inPlaceWriteTargets(args: string[]): string[] {
  const state = args.reduce<EditorOperands>(readEditorWord, {
    inPlace: false,
    scriptSeen: false,
    options: true,
    skipNext: false,
    emptyBackup: false,
    targets: [],
  });
  return state.inPlace ? state.targets : [];
}

function teeWriteTargets(args: string[]): string[] {
  let options = true;
  return args.filter((word) => {
    if (options && word === "--") {
      options = false;
      return false;
    }
    return !(options && word.startsWith("-"));
  });
}

function operandWriteTargets(command: string): string[] | undefined {
  const [program = "", ...args] = literalWords(command);
  switch (basename(program)) {
    case "sed":
    case "perl":
      return inPlaceWriteTargets(args);
    case "tee":
      return teeWriteTargets(args);
    default:
      return undefined;
  }
}

function withoutQuotedScripts(command: string): string {
  // Keep actual redirects, but do not interpret write-like text in a script.
  return command.replace(/"[^"]*"|'[^']*'/g, (word, offset: number) =>
    />{1,2}\s*$/.test(command.slice(FIRST, offset)) ? word : " ",
  );
}

function orderingWriteTargets(command: unknown): string[] {
  if (typeof command !== "string") return [];
  const operands = operandWriteTargets(command);
  const shell =
    operands === undefined ? command : withoutQuotedScripts(command);
  return [
    ...shellWriteTargets(shell).filter((target) => !target.startsWith("-")),
    ...(operands ?? []),
  ];
}

function sourceTarget(observation: Observation, target: string): boolean {
  const path = target.replace(/^["']|["']$/g, "");
  if (/^(?:&\d+|\$)/.test(path) || path === "/dev/null") return false;
  const relative = fixtureRelativePath(observation, path);
  return relative !== undefined && !/^\.handoffs(?:\/|$)/.test(relative);
}

function sourceMutation(observation: Observation, call: ToolCall): boolean {
  const path = writePath(call, observation);
  if (path !== undefined) return sourceTarget(observation, path);
  const targets = orderingWriteTargets(call.input["command"]);
  if (targets.some((target) => sourceTarget(observation, target))) return true;
  // Reuse observed Write/Edit/NotebookEdit and mutating-Git recognition without
  // treating the run's expected status delta or other turns as a new mutation.
  return (
    mutationEvidence({
      ...observation,
      gitStatusAfter: observation.gitStatusBefore,
      toolCalls: [call],
      turns: [],
    }).length > NO_FAILURES
  );
}

function orderedCalls(observation: Observation): ToolCall[] {
  return observation.toolCalls.flatMap((call) => {
    const { command } = call.input;
    if (call.name !== "Bash" || typeof command !== "string") return [call];
    // Keep quoted code opaque and use the existing literal shell-list boundary.
    return commandParts(command)
      .filter((part) => !/^[;&|\n]+$/.test(part))
      .map((part) => ({ ...call, input: { ...call.input, command: part } }));
  });
}

function currentCalls(observation: Observation): ToolCall[] {
  const calls = orderedCalls(observation);
  const lastMutation = calls.findLastIndex((call) =>
    sourceMutation(observation, call),
  );
  return calls.slice(lastMutation + ONE);
}

export function assertReviewerEvidence(observation: Observation): void {
  assert.ok(
    findBashCalls(
      { ...observation, toolCalls: currentCalls(observation) },
      /validate-report\.py["']?\s+report\s+["']?refactor-reviewer\b/,
    ).some(successfulReviewerValidation),
    "missing successful reviewer validation evidence",
  );
}

export function assertBoundaryValidation(observation: Observation): void {
  const calls = currentCalls(observation);
  const tests = findBashCalls(
    { ...observation, toolCalls: calls },
    /node\s+--test\s+boundary\.test\.js/,
  ).find(successfulBoundaryCheck);
  assert.ok(
    tests !== undefined,
    "missing successful boundary and behavior test evidence",
  );
  assertReviewerEvidence({
    ...observation,
    toolCalls: calls.slice(calls.indexOf(tests) + ONE),
  });
}
