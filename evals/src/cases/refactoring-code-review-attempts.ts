import assert from "node:assert/strict";
import { basename } from "node:path";

import {
  commandParts,
  literalWords,
} from "#/cases/refactoring-code-gate-evidence.ts";
import { HANDOFFS } from "#/cases/refactoring-code-regression-fixtures.ts";
import { capturedText, fixtureRelativePath } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

const LAST = -1;
const REVIEWER = "refactor-reviewer";

interface ReviewEvent {
  writes: string[];
  replaced: string[];
  assigned: string | undefined;
  reviewerDispatch: boolean;
  reviewRetry: boolean;
  validation: { role: string; path: string } | undefined;
}

export function reviewRetry(words: string[], output: string): boolean {
  const [script = "", mode, role, count, evidence] = words;
  const matches = [
    basename(script) === "validate-report.py",
    mode === "retry",
    role === REVIEWER,
  ];
  if (!matches.every(Boolean)) return false;
  assert.equal(
    output,
    "RETRY",
    "reviewer retry was not authorized by the validator",
  );
  assert.equal(count, "0");
  assert.ok(["report-transient", "host-transient"].includes(String(evidence)));
  return true;
}

function reviewedPath({ validation }: ReviewEvent): string | undefined {
  return validation?.role === REVIEWER ? validation.path : undefined;
}

export function assertDistinctReviewAttempts(
  events: ReviewEvent[],
  accepted: number,
): void {
  // The parent can revalidate an unchanged report. At a dispatch or inline
  // retry, all paths used before that boundary are unavailable to the attempt.
  const used = new Set<string>();
  const validated = new Set<string>();
  let previousAttempts = new Set<string>();
  let assignment: string | undefined = undefined;
  events.forEach((event, index) => {
    if (event.reviewerDispatch || event.reviewRetry) {
      previousAttempts = new Set(used);
      assignment = event.assigned;
      assert.ok(
        accepted > index,
        "last reviewer attempt has no subsequent validation",
      );
    }
    const review = reviewedPath(event);
    assertAssignedReview(assignment, review);
    [assignment, review].forEach((path) => {
      if (path !== undefined) {
        assert.ok(
          !previousAttempts.has(path),
          `reviewer reused an earlier report path: ${path}`,
        );
      }
    });
    recordPaths(event, used, validated, review);
  });
}

function assertAssignedReview(
  assigned: string | undefined,
  review: string | undefined,
): void {
  if (assigned !== undefined && review !== undefined) {
    assert.equal(
      review,
      assigned,
      "reviewer validated a different path than its assignment",
    );
  }
}

function recordPaths(
  event: ReviewEvent,
  used: Set<string>,
  validated: Set<string>,
  review: string | undefined,
): void {
  [...event.writes, ...event.replaced].forEach((path) => {
    assert.ok(
      !validated.has(path),
      `validated reviewer report was rewritten: ${path}`,
    );
    used.add(path);
  });
  if (event.assigned !== undefined) used.add(event.assigned);
  if (review !== undefined) {
    validated.add(review);
    used.add(review);
  }
}

export function replacedReports(
  observation: Observation,
  command: string,
): string[] {
  const [program = "", ...args] = literalWords(command);
  if (!["cp", "mv"].includes(basename(program))) return [];
  return args
    .slice(LAST)
    .filter((target) => target.includes(HANDOFFS))
    .map((target) => fixtureRelativePath(observation, target))
    .filter((path): path is string => path?.startsWith(HANDOFFS) === true);
}

export function lifecycleCommandParts(command: string): string[] {
  // A newline following && continues the same list. Leave quotes and all
  // other operators intact so a masked exit never becomes validator evidence.
  const normalized = command
    .trim()
    .replace(/"[^"]*"|'[^']*'|&&[ \t\r\n]+/g, (part) =>
      part.startsWith("&&") ? "&&" : part,
    );
  return commandParts(normalized);
}

function printfContent(command: string): string | undefined {
  // A single-quoted printf operand is literal. Never expand shell data to
  // reconstruct bytes from an opaque command; the snapshot is revalidated.
  const literal =
    /^\s*printf\s+'%s(?:\\n)?'\s+'[^']*'\s*>\s*(?:[^\s"';&|<>]+|"[^"]+"|'[^']+')\s*$/;
  if (!literal.test(command)) return undefined;
  const [, format, text = ""] = literalWords(command);
  return format === "%s\\n" ? `${text}\n` : text;
}

function literalReportContent(call: ToolCall): string | undefined {
  const { command, content } = call.input;
  if (call.name === "Write" && typeof content === "string") return content;
  if (call.name !== "Bash") return undefined;
  return printfContent(String(command));
}

export function assertRetainedWrite(
  observation: Observation,
  call: ToolCall | undefined,
  report: string,
): void {
  if (call === undefined) return;
  const content = literalReportContent(call);
  if (content !== undefined) {
    assert.equal(
      capturedText(observation, report),
      content,
      "retained reviewer report differs from the observed write",
    );
  }
}

export function executableParts(parts: string[]): string[] {
  return parts.filter((part) => !/^[;&|\n]+$/.test(part));
}

export function attributedOutput(parts: string[], call: ToolCall): string {
  if (parts.some((part) => /^[;&|\n]+$/.test(part) && part !== "&&")) return "";
  return call.result?.isError === false ? call.result.content.trim() : "";
}
