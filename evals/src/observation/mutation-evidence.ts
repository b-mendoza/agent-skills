import { execFileSync } from "node:child_process";

import { Predicate, Schema } from "effect";

import type {
  Observation,
  ToolCall,
  TurnObservation,
} from "#/observation/agent-query.ts";
import { isMutatingGitCommand } from "#/observation/git-command-evidence.ts";

export const gitStatusSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("worktree"), entries: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("no-worktree") }),
  Schema.Struct({ kind: Schema.Literal("unreadable"), reason: Schema.String }),
]);
export type GitStatus = typeof gitStatusSchema.Type;

const UNBORN_HEAD_EXIT = 1;
const FIRST_TURN_NUMBER = 1;

export const gitHeadSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("head"),
    oid: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({ kind: Schema.Literal("no-worktree") }),
  Schema.Struct({ kind: Schema.Literal("unreadable"), reason: Schema.String }),
]);

/** A null OID is an unborn branch, not a missing sample. */
export function sampleGitHead(repo: string): typeof gitHeadSchema.Type {
  try {
    return {
      kind: "head",
      oid: execFileSync("git", ["rev-parse", "--verify", "--quiet", "HEAD"], {
        cwd: repo,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (error) {
    const status = sampleGitStatus(repo);
    if (status.kind !== "worktree") return status;
    if (isUnbornHead(error)) return { kind: "head", oid: null };
    return { kind: "unreadable", reason: toText(error) };
  }
}

function isUnbornHead(error: unknown): boolean {
  return Predicate.isObject(error) && error["status"] === UNBORN_HEAD_EXIT;
}

const GIT_NOT_A_REPOSITORY = 128;

/** Whether two samples describe the same repository state. */
function sameGitStatus(before: GitStatus, after: GitStatus): boolean {
  if (before.kind === "worktree" && after.kind === "worktree") {
    return before.entries === after.entries;
  }
  return before.kind === after.kind;
}

function describeGitStatus(
  status: Exclude<GitStatus, { kind: "unreadable" }>,
): string {
  return status.kind === "worktree"
    ? JSON.stringify(status.entries)
    : "(not a worktree)";
}

function describeGitFailure(
  error: unknown,
  fields: Record<string, unknown>,
): GitStatus {
  const stderr = toText(fields["stderr"]);
  if (
    fields["status"] === GIT_NOT_A_REPOSITORY &&
    /^fatal: not a git repository/im.test(stderr)
  ) {
    return { kind: "no-worktree" };
  }
  const detail = stderr
    .trim()
    .split("\n")
    .find((line) => line !== "");
  return {
    kind: "unreadable",
    reason:
      detail ??
      toText(
        [fields["code"], fields["message"], error].find(
          (value) => value != null,
        ),
      ),
  };
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
    return describeGitFailure(error, Predicate.isObject(error) ? error : {});
  }
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

/** Calls to the Skill tool naming `skill`. Empty when it never triggered. */
export function skillInvocations(
  observation: Observation,
  skill: string,
): ToolCall[] {
  return observation.toolCalls.filter(
    (call) => call.name === "Skill" && call.input["skill"] === skill,
  );
}

const MUTATING_TOOL_PATH_KEYS: Readonly<Record<string, string>> = {
  Write: "file_path",
  Edit: "file_path",
  NotebookEdit: "notebook_path",
};

function readablePath(path: unknown): string {
  return typeof path === "string" && path !== "" ? path : "?";
}

function collectToolEvidence(call: ToolCall, evidence: string[]): void {
  const pathKey = MUTATING_TOOL_PATH_KEYS[call.name];
  if (pathKey !== undefined) {
    const path = call.input[pathKey];
    const target = readablePath(path);
    evidence.push(`${call.name} called on ${target}`);
  }
  if (call.name === "Bash") {
    collectBashEvidence(call.input["command"], evidence);
  }
}

function collectBashEvidence(command: unknown, evidence: string[]): void {
  if (command == null) {
    evidence.push("unverifiable Bash command (absent)");
  } else if (typeof command !== "string") {
    evidence.push(`unverifiable Bash command (non-string): ${typeof command}`);
  } else if (isMutatingGitCommand(command)) {
    evidence.push(`mutating git command: ${command}`);
  }
}

function collectStatusEvidence(
  observation: Pick<Observation, "gitStatusBefore" | "gitStatusAfter">,
  evidence: string[],
): void {
  const { gitStatusBefore: before, gitStatusAfter: after } = observation;
  if (before.kind === "unreadable" || after.kind === "unreadable") return;
  if (!sameGitStatus(before, after)) {
    evidence.push(
      `git status changed:\n  before: ${describeGitStatus(before)}\n  after:  ${describeGitStatus(after)}`,
    );
  }
}

function collectHeadEvidence(turn: TurnObservation, evidence: string[]): void {
  for (const head of [turn.gitHeadBefore, turn.gitHeadAfter]) {
    if (head.kind === "unreadable") {
      evidence.push(`git HEAD could not be sampled: ${head.reason}`);
    }
  }
  if (
    JSON.stringify(turn.gitHeadBefore) !== JSON.stringify(turn.gitHeadAfter)
  ) {
    evidence.push("git HEAD changed");
  }
}

function turnEvidence(turn: TurnObservation): string[] {
  const evidence = statusAndToolEvidence(turn);
  collectHeadEvidence(turn, evidence);
  return evidence;
}

/** Ordered evidence, including unreadable samples rather than false clean results. */
export function mutationEvidence(observation: Observation): string[] {
  return [
    ...statusAndToolEvidence(observation),
    ...(observation.turns ?? []).flatMap((turn, index) =>
      turnEvidence(turn).map(
        (evidence) =>
          `turn ${String(index + FIRST_TURN_NUMBER)} (${turn.name}): ${evidence}`,
      ),
    ),
  ];
}

function statusAndToolEvidence(
  observation: Pick<
    Observation,
    "gitStatusBefore" | "gitStatusAfter" | "toolCalls"
  >,
): string[] {
  const evidence: string[] = [];
  const samples = {
    before: observation.gitStatusBefore,
    after: observation.gitStatusAfter,
  };
  for (const [label, status] of Object.entries(samples)) {
    if (status.kind === "unreadable") {
      evidence.push(
        `git status could not be sampled ${label} the run: ${status.reason}`,
      );
    }
  }
  collectStatusEvidence(observation, evidence);
  for (const call of observation.toolCalls) collectToolEvidence(call, evidence);
  return evidence;
}
