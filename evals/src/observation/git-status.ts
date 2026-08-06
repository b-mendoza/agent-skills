import { execFileSync } from "node:child_process";

import { Context, Data, Effect, Layer, Option, Schema } from "effect";

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
const FIRST_LINE_INDEX = 0;

const undefinedOnDecodeFailure = <S extends Schema.Constraint>(schema: S) =>
  Schema.optional(schema).pipe(
    Schema.catchDecoding(() => Effect.succeed(Option.some(undefined))),
  );

/** The subprocess-error fields consumed by git-status classification. */
const subprocessErrorSchema = Schema.Struct({
  status: undefinedOnDecodeFailure(Schema.NullOr(Schema.Number)),
  stderr: undefinedOnDecodeFailure(Schema.Unknown),
  code: undefinedOnDecodeFailure(Schema.Unknown),
  message: undefinedOnDecodeFailure(Schema.Unknown),
}).pipe(
  Schema.catchDecoding(() =>
    Effect.succeed(
      Option.some({
        status: undefined,
        stderr: undefined,
        code: undefined,
        message: undefined,
      }),
    ),
  ),
);

const decodeSubprocessError = Schema.decodeUnknownSync(subprocessErrorSchema);

type Attempt<T> =
  | { readonly kind: "success"; readonly value: T }
  | { readonly kind: "failure"; readonly cause: unknown };

function attempt<T>(operation: () => T): Attempt<T> {
  try {
    return { kind: "success", value: operation() };
  } catch (cause) {
    return { kind: "failure", cause };
  }
}

/** Whether two samples describe the same repository state. */
export function sameGitStatus(before: GitStatus, after: GitStatus): boolean {
  if (before.kind === "worktree" && after.kind === "worktree") {
    return before.entries === after.entries;
  }
  return before.kind === after.kind;
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

function isNotRepositoryFailure(
  status: number | null | undefined,
  stderr: string,
): boolean {
  return (
    status === GIT_NOT_A_REPOSITORY &&
    /^fatal: not a git repository/im.test(stderr)
  );
}

function firstStderrLine(stderr: string): string {
  return stderr.trim().split("\n").at(FIRST_LINE_INDEX) ?? "";
}

function subprocessFailureFallback(
  code: unknown,
  message: unknown,
  error: unknown,
): unknown {
  return code ?? message ?? error;
}

function subprocessFailureReason(
  stderr: string,
  code: unknown,
  message: unknown,
  error: unknown,
): string {
  // git's own message when there is one, else the syscall code (ENOENT for
  // a missing directory or a missing git binary), else whatever was thrown.
  const detail = firstStderrLine(stderr);
  if (detail !== "") return detail;
  return toText(subprocessFailureFallback(code, message, error));
}

function classifyGitFailure(error: unknown): GitStatus {
  const subprocessError = decodeSubprocessError(error);
  const stderr = toText(subprocessError.stderr);

  // Exit 128 alone does not mean "not a repository" -- a corrupt index and
  // an unreadable HEAD return it too. Only git's own wording separates the
  // expected `not-git` fixture state from a repository that cannot be read,
  // and everything unmatched falls through to `unreadable` so an unfamiliar
  // failure fails closed rather than passing as clean. The match is anchored
  // to git's own fatal line so an unrelated failure whose path happens to
  // contain the phrase cannot be promoted into an expected state.
  if (isNotRepositoryFailure(subprocessError.status, stderr)) {
    return { kind: "no-worktree" };
  }

  return {
    kind: "unreadable",
    reason: subprocessFailureReason(
      stderr,
      subprocessError.code,
      subprocessError.message,
      error,
    ),
  };
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

function toPrimitiveText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return toNumericOrBooleanText(value);
}

function toNumericOrBooleanText(value: unknown): string | undefined {
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value.toString();
  return undefined;
}

function toJsonText(value: unknown): string | undefined {
  const serialization = attempt(() => JSON.stringify(value));
  if (serialization.kind === "failure") return undefined;
  return typeof serialization.value === "string"
    ? serialization.value
    : undefined;
}

function toStringCoercionText(value: unknown): string {
  const conversion = attempt(() => String(value));
  return conversion.kind === "success"
    ? conversion.value
    : "(unprintable value)";
}

/** Foreign values, rendered without rejecting observation settlement. */
export function toText(value: unknown): string {
  const primitiveText = toPrimitiveText(value);
  if (primitiveText !== undefined) return primitiveText;

  const jsonText = toJsonText(value);
  if (jsonText !== undefined) return jsonText;

  return toStringCoercionText(value);
}
