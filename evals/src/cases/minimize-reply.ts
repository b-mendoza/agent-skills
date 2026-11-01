import { AssertionError } from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import type { Observation } from "#/observation/agent-query.ts";

type Check = EvalCase["check"];

/**
 * `pass:` followed by the string the check returned, or `fail:` followed by the
 * exact message it threw. Keeping the returned string means a shorter reply
 * cannot pass through a different branch. A generated `assert.match`/
 * `doesNotMatch` message echoes the whole reply, so it is reduced to the
 * operator and pattern; otherwise no shorter reply could keep it.
 */
export type Outcome = `pass:${string}` | `fail:${string}`;

export interface MinimizeRequest {
  readonly check: Check;
  readonly observation: Observation;
  /** Required for a passing reply: the case's check from an earlier ref that rejected it. */
  readonly contrastCheck?: Check;
}

export interface MinimizeResult {
  readonly finalText: string;
  readonly outcome: Outcome;
  readonly contrastOutcome?: Outcome;
  readonly linesBefore: number;
  readonly linesAfter: number;
}

interface Unit {
  readonly line: number;
  readonly text: string;
}

type Keeps = (units: readonly Unit[]) => boolean;

const ECHOING_OPERATORS: ReadonlySet<unknown> = new Set([
  "match",
  "doesNotMatch",
]);
const INITIAL_GRANULARITY = 2;
/** A kept complement holds one chunk fewer than the partition it came from. */
const DROPPED_CHUNKS = 1;
const SENTENCE_BREAK = /(?<=[.?!])\s+/g;
const PASS_PREFIX = "pass:";

export function outcomeOf(check: Check, observation: Observation): Outcome {
  try {
    return `${PASS_PREFIX}${check(observation)}`;
  } catch (error) {
    return `fail:${failureMessage(error)}`;
  }
}

function failureMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return echoesReply(error)
    ? `${error.operator} ${String(error.expected)}`
    : error.message;
}

function echoesReply(error: Error): error is AssertionError {
  return (
    error instanceof AssertionError &&
    error.generatedMessage &&
    ECHOING_OPERATORS.has(error.operator)
  );
}

/**
 * Shrinks `finalText` by deterministic delta debugging, first over lines and
 * then over sentences, while every outcome the reply is guarded by stays the same.
 * Throws when a passing reply has no failing contrast to preserve.
 */
export function minimizeReply(request: MinimizeRequest): MinimizeResult {
  const targets = targetOutcomes(request);
  const keeps = keepsOutcomes(request, targets);
  const lines = request.observation.finalText
    .split("\n")
    .map((text, line) => ({ line, text }));
  const sentences = ddmin(lines, keeps).flatMap(splitSentences);
  const minimized = ddmin(sentences, keeps);
  const finalText = render(minimized);
  return {
    finalText,
    ...targets,
    linesBefore: lines.length,
    linesAfter: finalText.split("\n").length,
  };
}

function targetOutcomes(
  request: MinimizeRequest,
): Pick<MinimizeResult, "outcome" | "contrastOutcome"> {
  const outcome = outcomeOf(request.check, request.observation);
  if (!isPass(outcome)) return { outcome };
  if (request.contrastCheck === undefined) {
    throw new Error(
      "refused: the reply passes the current check; pass a contrast check from a ref that rejected it",
    );
  }
  const contrastOutcome = outcomeOf(request.contrastCheck, request.observation);
  if (isPass(contrastOutcome)) {
    throw new Error(
      "refused: the contrast check also passes, so nothing pins the guarded phrasing",
    );
  }
  return { outcome, contrastOutcome };
}

function isPass(outcome: Outcome): boolean {
  return outcome.startsWith(PASS_PREFIX);
}

function keepsOutcomes(
  request: MinimizeRequest,
  targets: Pick<MinimizeResult, "outcome" | "contrastOutcome">,
): Keeps {
  const { contrastCheck, observation } = request;
  return (units) => {
    const candidate = { ...observation, finalText: render(units) };
    return (
      outcomeOf(request.check, candidate) === targets.outcome &&
      (contrastCheck === undefined ||
        outcomeOf(contrastCheck, candidate) === targets.contrastOutcome)
    );
  };
}

function splitSentences(unit: Unit): Unit[] {
  const sentences: Unit[] = [];
  let start = 0;
  for (const match of unit.text.matchAll(SENTENCE_BREAK)) {
    const [separator] = match;
    const end = match.index + separator.length;
    // Keep separators on the preceding sentence so deletions cannot add leading whitespace.
    sentences.push({ line: unit.line, text: unit.text.slice(start, end) });
    start = end;
  }
  sentences.push({ line: unit.line, text: unit.text.slice(start) });
  return sentences;
}

function render(units: readonly Unit[]): string {
  const lines = new Map<number, string[]>();
  for (const unit of units) {
    lines.set(unit.line, [...(lines.get(unit.line) ?? []), unit.text]);
  }
  return [...lines.values()].map((texts) => texts.join("")).join("\n");
}

/** Zeller's ddmin: returns a 1-minimal subsequence of `units` that still `keeps`. */
function ddmin(units: readonly Unit[], keeps: Keeps): readonly Unit[] {
  let current = units;
  let granularity = INITIAL_GRANULARITY;
  while (current.length >= INITIAL_GRANULARITY) {
    const reduced = reduceOnce(current, granularity, keeps);
    if (reduced !== undefined) {
      [current, granularity] = reduced;
    } else if (granularity < current.length) {
      granularity = Math.min(granularity * INITIAL_GRANULARITY, current.length);
    } else {
      break;
    }
  }
  return current;
}

function reduceOnce(
  units: readonly Unit[],
  granularity: number,
  keeps: Keeps,
): [readonly Unit[], number] | undefined {
  const chunks = partition(units, granularity);
  const subset = chunks.find(keeps);
  if (subset !== undefined) return [subset, INITIAL_GRANULARITY];
  const complement = chunks
    .map((_, skipped) => chunks.filter((__, index) => index !== skipped).flat())
    .find(keeps);
  return complement === undefined
    ? undefined
    : [complement, Math.max(granularity - DROPPED_CHUNKS, INITIAL_GRANULARITY)];
}

function partition(units: readonly Unit[], count: number): Unit[][] {
  const size = Math.ceil(units.length / count);
  return Array.from({ length: Math.ceil(units.length / size) }, (_, index) =>
    units.slice(index * size, index * size + size),
  );
}
