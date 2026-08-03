import { execFileSync } from "node:child_process";

import { Context, Data, Effect, Layer } from "effect";
import * as z from "zod";

export interface GitSampler {
  readonly sample: (repo: string) => Effect.Effect<GitStatus>;
}

export const GitSampler = Context.Service<GitSampler>(
  "evals/observation/GitSampler",
);

/**
 * The outcome of sampling a repository's status.
 *
 * Three outcomes, not two, because "the worktree is clean" and "the sample
 * failed" used to be the same empty string. Two failed samples then compared
 * equal and the read-only assertion passed on evidence that was never
 * collected -- the mutation-scope guarantee silently reduced to "nothing was
 * observed", which is exactly what it must not mean.
 */
export type GitStatus =
  | { kind: "worktree"; entries: string }
  | { kind: "no-worktree" }
  | { kind: "unreadable"; reason: string };

/** A git exit status meaning "this is not a repository". */
const GIT_NOT_A_REPOSITORY = 128;

/** The subprocess-error fields consumed by git-status classification. */
const subprocessErrorSchema = z
  .object({
    status: z.number().nullish().catch(undefined),
    stderr: z.unknown().optional().catch(undefined),
    code: z.unknown().optional().catch(undefined),
    message: z.unknown().optional().catch(undefined),
  })
  .catch({
    status: undefined,
    stderr: undefined,
    code: undefined,
    message: undefined,
  });

/** Whether two samples describe the same repository state. */
export function sameGitStatus(a: GitStatus, b: GitStatus): boolean {
  if (a.kind === "worktree" && b.kind === "worktree") {
    return a.entries === b.entries;
  }
  return a.kind === b.kind;
}

/** Renders a status for a failure message. */
export function describeGitStatus(status: GitStatus): string {
  if (status.kind === "worktree") return JSON.stringify(status.entries);
  if (status.kind === "no-worktree") return "(not a worktree)";
  return `(unreadable: ${status.reason})`;
}

class GitCommandError extends Data.TaggedError("GitCommandError")<{
  readonly cause: unknown;
}> {}

function executeGitStatus(repo: string): string {
  return execFileSync("git", ["status", "--short"], {
    cwd: repo,
    encoding: "utf8",
    // stderr is captured, not silenced: exit 128 is git's generic fatal
    // code, so the message is the only thing separating "not a repository"
    // from a corrupt index. Discarding it would put both in the same bucket.
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function classifyGitFailure(error: unknown): GitStatus {
  const subprocessError = subprocessErrorSchema.parse(error);
  const stderr = toText(subprocessError.stderr);

  // Exit 128 alone does not mean "not a repository" -- a corrupt index and
  // an unreadable HEAD return it too. Only git's own wording separates the
  // expected `not-git` fixture state from a repository that cannot be read,
  // and everything unmatched falls through to `unreadable` so an unfamiliar
  // failure fails closed rather than passing as clean.
  if (
    subprocessError.status === GIT_NOT_A_REPOSITORY &&
    /not a git repository/i.test(stderr)
  ) {
    return { kind: "no-worktree" };
  }

  // git's own message when there is one, else the syscall code (ENOENT for
  // a missing directory or a missing git binary), else whatever was thrown.
  const detail = stderr.trim().split("\n")[0] ?? "";
  const fallback = subprocessError.code ?? subprocessError.message ?? error;
  return {
    kind: "unreadable",
    reason: detail === "" ? toText(fallback) : detail,
  };
}

/**
 * Samples `git status --short` synchronously for compatibility callers.
 *
 * The Effect-native harness uses `GitSampler`; this facade stays synchronous
 * because existing case helpers consume it directly.
 */
export function gitStatus(repo: string): GitStatus {
  try {
    return { kind: "worktree", entries: executeGitStatus(repo).trim() };
  } catch (error) {
    return classifyGitFailure(error);
  }
}

const sampleGitStatus = (repo: string): Effect.Effect<GitStatus> =>
  Effect.try({
    try: () => executeGitStatus(repo),
    catch: (cause) => new GitCommandError({ cause }),
  }).pipe(
    Effect.match({
      onFailure: (error) => classifyGitFailure(error.cause),
      onSuccess: (output) => ({ kind: "worktree", entries: output.trim() }),
    }),
  );

export const GitSamplerLive = Layer.succeed(
  GitSampler,
  GitSampler.of({ sample: sampleGitStatus }),
);

/** Foreign values, rendered without rejecting observation settlement. */
export function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") {
    return value.toString();
  }

  try {
    const json: unknown = JSON.stringify(value);
    if (typeof json === "string") return json;
    // eslint-disable-next-line sonarjs/no-ignored-exceptions -- Serialization failure is expected for values such as BigInt or cycles, which use the guarded fallback below.
  } catch (jsonSerializationError) {
    // Continue to the guarded string-conversion fallback.
  }

  try {
    // oxlint-disable-next-line typescript/no-base-to-string -- Guarded last-resort rendering is required for foreign cyclic and BigInt values.
    return String(value);
  } catch (stringConversionError) {
    return "(unprintable value)";
  }
}
