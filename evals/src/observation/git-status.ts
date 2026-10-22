import { execFileSync } from "node:child_process";

export type GitStatus =
  | { kind: "worktree"; entries: string }
  | { kind: "no-worktree" }
  | { kind: "unreadable"; reason: string };

const GIT_NOT_A_REPOSITORY = 128;
const FIRST_LINE_INDEX = 0;

/** Whether two samples describe the same repository state. */
export function sameGitStatus(before: GitStatus, after: GitStatus): boolean {
  if (before.kind === "worktree" && after.kind === "worktree") {
    return before.entries === after.entries;
  }
  return before.kind === after.kind;
}

export function describeGitStatus(status: GitStatus): string {
  if (status.kind === "worktree") return JSON.stringify(status.entries);
  if (status.kind === "no-worktree") return "(not a worktree)";
  return `(unreadable: ${status.reason})`;
}

/** A failed sample is evidence, never an empty or clean worktree. */
export function sampleGitStatus(repo: string): GitStatus {
  try {
    const output = execFileSync("git", ["status", "--short"], {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { kind: "worktree", entries: output.trim() };
  } catch (error) {
    return classifyGitFailure(error);
  }
}

function classifyGitFailure(error: unknown): GitStatus {
  const fields = errorFields(error);
  const stderr = toText(fields["stderr"]);
  if (
    fields["status"] === GIT_NOT_A_REPOSITORY &&
    /^fatal: not a git repository/im.test(stderr)
  ) {
    return { kind: "no-worktree" };
  }
  return { kind: "unreadable", reason: failureReason(stderr, fields, error) };
}

function failureReason(
  stderr: string,
  fields: Record<string, unknown>,
  error: unknown,
): string {
  const detail = stderr.trim().split("\n").at(FIRST_LINE_INDEX) ?? "";
  return detail === "" ? failureFallback(fields, error) : detail;
}

function errorFields(error: unknown): Record<string, unknown> {
  return isRecord(error) ? error : {};
}

function failureFallback(
  fields: Record<string, unknown>,
  error: unknown,
): string {
  return toText(fields["code"] ?? fields["message"] ?? error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Render foreign failures, including non-finite numbers and cyclic objects. */
export function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return serialize(value);
}

const stringify: (value: unknown) => string | undefined = JSON.stringify;

function serialize(value: unknown): string {
  try {
    return stringify(value) ?? coerceText(value);
  } catch (error) {
    return coerceText(value);
  }
}

function coerceText(value: unknown): string {
  try {
    return String(value);
  } catch (error) {
    return "(unprintable value)";
  }
}
