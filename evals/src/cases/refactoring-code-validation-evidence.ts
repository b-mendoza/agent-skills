import assert from "node:assert/strict";
import { basename } from "node:path";
import { stripVTControlCharacters } from "node:util";

import {
  commandParts,
  literalWords,
  shellWriteTargets,
  writePath,
} from "#/cases/refactoring-code-gate-evidence.ts";
import { HANDOFFS } from "#/cases/refactoring-code-regression-fixtures.ts";
import {
  assertDistinctReviewAttempts,
  assertRetainedWrite,
  attributedOutput,
  executableParts,
  lifecycleCommandParts,
  replacedReports,
  reviewRetry,
} from "#/cases/refactoring-code-review-attempts.ts";
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

function orderedParts(call: ToolCall): ToolCall[] {
  const { command } = call.input;
  if (call.name !== "Bash" || typeof command !== "string") return [call];
  return commandParts(command)
    .filter((part) => !/^[;&|\n]+$/.test(part))
    .map((part) => ({ ...call, input: { ...call.input, command: part } }));
}

function currentCalls(observation: Observation): ToolCall[] {
  const calls = observation.toolCalls.flatMap(orderedParts);
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

const REVIEWER = "refactor-reviewer";

function isDispatch(call: ToolCall): boolean {
  return call.name === "Agent" || call.name === "Task";
}

function reviewerDispatch(call: ToolCall): boolean {
  if (!isDispatch(call)) return false;
  return [
    call.input["subagent_type"],
    call.input["description"],
    call.input["prompt"],
  ].some(
    (value) => typeof value === "string" && /\brefactor-reviewer\b/.test(value),
  );
}

function assignedReport(
  observation: Observation,
  call: ToolCall,
): string | undefined {
  const { prompt } = call.input;
  if (!isDispatch(call) || typeof prompt !== "string") return undefined;
  const field = /\bREPORT_PATH\b[\s`*"':=|]+(?<path>[^\s`"'|;,<>]+)/gi;
  const named = [...prompt.matchAll(field)].map(
    (match) => match.groups?.["path"] ?? "",
  );
  return (
    uniqueReport(observation, named) ??
    uniqueReport(observation, prompt.split(/[\s`*"'|;,<>()=:]+/))
  );
}

function uniqueReport(
  observation: Observation,
  words: string[],
): string | undefined {
  const paths = words
    .filter((word) => word.includes(HANDOFFS))
    .map(
      (word) => fixtureRelativePath(observation, word.replace(/\.$/, "")) ?? "",
    );
  const files = new Set(paths.filter((path) => ownedRun(path) !== undefined));
  return files.size === ONE ? files.values().next().value : undefined;
}

function bashCommand(call: ToolCall): string {
  const { command } = call.input;
  return call.name === "Bash" && typeof command === "string" ? command : "";
}

export function handoffWrites(
  observation: Observation,
  call: ToolCall,
): string[] {
  const direct = writePath(call, observation);
  if (direct !== undefined) return direct.startsWith(HANDOFFS) ? [direct] : [];
  return shellReportWrites(bashCommand(call))
    .map((target) =>
      fixtureRelativePath(observation, target.replace(/^["']|["']$/g, "")),
    )
    .filter((path): path is string => path?.startsWith(HANDOFFS) === true);
}

function shellReportWrites(command: string): string[] {
  // Only collect positive file-write evidence; a directory operation is not a file creation.
  const [program = ""] = literalWords(command);
  if (
    !["touch", "tee", "sed", "perl", "node", "python", "python3"].includes(
      basename(program),
    ) &&
    !command.includes(">")
  ) {
    return [];
  }
  return orderingWriteTargets(command).filter((target) =>
    target.includes(HANDOFFS),
  );
}

function validatorArguments(command: string): string[] {
  const words = literalWords(command);
  if (/^python3?$/.test(basename(words[FIRST] ?? ""))) words.shift();
  if (words[FIRST] === "-I") words.shift();
  return words;
}

const VALIDATOR_WORD_COUNT = 5;
function reportInvocation(
  words: string[],
): words is [string, string, string, string, string] {
  const [script = "", mode] = words;
  return [
    words.length === VALIDATOR_WORD_COUNT,
    basename(script) === "validate-report.py",
    mode === "report",
  ].every(Boolean);
}

function validationAttempt(
  observation: Observation,
  words: string[],
  status: string,
) {
  if (!reportInvocation(words)) return undefined;
  const [, , role, file, directory] = words;
  const path = fixtureRelativePath(observation, file) ?? "";
  const run = fixtureRelativePath(observation, directory.replace(/\/$/, ""));
  return { role, path, run, status };
}

function ownedRun(report: string): string | undefined {
  if (!report.startsWith(HANDOFFS)) return undefined;
  const [id, file] = report.slice(HANDOFFS.length).split("/");
  return file === undefined || file === ""
    ? undefined
    : `${HANDOFFS}${String(id)}`;
}

function lifecycleEvents(observation: Observation) {
  return observation.toolCalls.flatMap((call) => {
    const parts = lifecycleCommandParts(bashCommand(call));
    const commands = executableParts(parts);
    const calls =
      call.name === "Bash"
        ? commands.map((command) => ({
            ...call,
            input: { ...call.input, command },
          }))
        : [call];
    const output = attributedOutput(parts, call);
    return calls.map((part, index) => {
      const status = index === calls.length - ONE ? output : "";
      const words = validatorArguments(bashCommand(part));
      return {
        call: part,
        writes: handoffWrites(observation, part),
        replaced: replacedReports(observation, bashCommand(part)),
        assigned: assignedReport(observation, part),
        reviewerDispatch: reviewerDispatch(part),
        reviewRetry: reviewRetry(words, status),
        validation: validationAttempt(observation, words, status),
      };
    });
  });
}

type LifecycleEvent = ReturnType<typeof lifecycleEvents>[number];

function createdPaths(event: LifecycleEvent): string[] {
  const { validation } = event;
  const writes = [...event.writes, ...event.replaced];
  if (validation === undefined) return writes;
  return /^[A-Z][A-Z_]*$/.test(validation.status) &&
    ownedRun(validation.path) === validation.run
    ? [...writes, validation.path]
    : writes;
}

function reviewBoundary(
  events: LifecycleEvent[],
  observation: Observation,
  report: string,
): number {
  const mutation = events.findLastIndex(({ call }) =>
    sourceMutation(observation, call),
  );
  const dispatch = events.findLastIndex(
    (event) => event.reviewerDispatch || event.reviewRetry,
  );
  const assignment = events[dispatch];
  // No dispatch in the current attempt: the inline role still writes and validates.
  if (assignment === undefined || assignment.reviewRetry) {
    return Math.max(mutation, dispatch);
  }
  assert.ok(
    dispatch > mutation,
    "reviewer dispatch preceded the last source mutation",
  );
  assert.notEqual(
    assignment.call.result?.isError,
    true,
    "latest reviewer dispatch failed",
  );
  assert.equal(
    assignment.assigned,
    report,
    "latest reviewer dispatch and validated report differ",
  );
  return dispatch;
}

export function lifecycleReportEvidence(observation: Observation) {
  const events = lifecycleEvents(observation);
  const latest = events.findLastIndex(
    ({ validation }) => validation?.role === REVIEWER,
  );
  assertDistinctReviewAttempts(events, latest);
  const review = events[latest]?.validation;
  assert.ok(
    review?.status === "PASS",
    "latest reviewer validation did not pass",
  );
  const { path: report, run } = review;
  assert.ok(run !== undefined, "missing validated run");
  assert.equal(
    run,
    ownedRun(report),
    "reviewer report is outside its owned run",
  );
  const boundary = reviewBoundary(events, observation, report);
  const produced = freshReportWrite(events, report, boundary, latest);
  assertRetainedWrite(observation, produced, report);
  return { run, report, createdPaths: new Set(events.flatMap(createdPaths)) };
}

function freshReportWrite(
  events: LifecycleEvent[],
  report: string,
  boundary: number,
  latest: number,
) {
  // Without a dispatch, a validation for another path separates two inline attempts.
  const previousReview = events
    .slice(FIRST, latest)
    .findLastIndex(
      ({ validation }) =>
        validation?.role === REVIEWER && validation.path !== report,
    );
  const start = Math.max(boundary, previousReview);
  const produced = events.findLastIndex(({ writes }) =>
    writes.includes(report),
  );
  assert.ok(
    produced > start && produced < latest,
    "latest reviewer report lacks a fresh write followed by validation",
  );
  const earlier = events.slice(FIRST, start + ONE);
  assert.ok(
    !earlier.some((event) => createdPaths(event).includes(report)),
    "latest reviewer reused an earlier report path",
  );
  assert.ok(
    !earlier.slice(FIRST, -ONE).some((event) => event.assigned === report),
    "latest reviewer reused an earlier assignment",
  );
  return events[produced]?.call;
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
