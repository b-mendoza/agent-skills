import { isMutatingGitCommand } from "#/observation/git-command-evidence.ts";
import {
  describeGitStatus,
  type GitStatus,
  sameGitStatus,
} from "#/observation/git-status.ts";
import type { Observation, ToolCall } from "#/observation/observation-types.ts";

// --- Observation helpers used by case assertions -------------------------

/** Calls to the Skill tool naming `skill`. Empty when it never triggered. */
export function skillInvocations(
  observation: Observation,
  skill: string,
): ToolCall[] {
  return observation.toolCalls.filter(
    (call) => call.name === "Skill" && call.input["skill"] === skill,
  );
}

/** Path input read from each tool call that writes a file. */
const MUTATING_TOOL_PATH_KEYS: Readonly<Record<string, string>> = {
  Write: "file_path",
  Edit: "file_path",
  NotebookEdit: "notebook_path",
};

function fileWriteEvidence(call: ToolCall): string | null {
  const pathKey = MUTATING_TOOL_PATH_KEYS[call.name];
  if (pathKey === undefined) return null;
  const filePath = call.input[pathKey];
  return `${call.name} called on ${typeof filePath === "string" && filePath !== "" ? filePath : "?"}`;
}

function bashCommandEvidence(command: unknown): string | null {
  if (command == null) {
    return "unverifiable Bash command (absent)";
  }
  if (typeof command !== "string") {
    // Unscannable rather than clean: coercing would hide a mutating verb.
    return `unverifiable Bash command (non-string): ${typeof command}`;
  }

  return isMutatingGitCommand(command)
    ? `mutating git command: ${command}`
    : null;
}

function bashEvidence(call: ToolCall): string | null {
  if (call.name !== "Bash") return null;
  return bashCommandEvidence(call.input["command"]);
}

function isEvidence(value: string | null): value is string {
  return value !== null;
}

function statusSamplingEvidence(
  label: "before" | "after",
  status: GitStatus,
): string | null {
  return status.kind === "unreadable"
    ? `git status could not be sampled ${label} the run: ${status.reason}`
    : null;
}

function gitStatusEvidence(before: GitStatus, after: GitStatus): string[] {
  // Unreadable is not clean. A sample that failed proves nothing about what
  // the run did, so it is reported rather than compared -- otherwise two
  // failed samples match and the assertion passes on absent evidence.
  const samplingEvidence = [
    statusSamplingEvidence("before", before),
    statusSamplingEvidence("after", after),
  ].filter(isEvidence);

  if (before.kind === "unreadable" || after.kind === "unreadable") {
    return samplingEvidence;
  }
  if (sameGitStatus(before, after)) return samplingEvidence;

  return [
    `git status changed:\n  before: ${describeGitStatus(before)}\n  after:  ${describeGitStatus(after)}`,
  ];
}

function toolCallEvidence(call: ToolCall): string[] {
  return [fileWriteEvidence(call), bashEvidence(call)].filter(isEvidence);
}

/**
 * Every observed way the run could have written to the repo. A case asserts
 * this is empty; the list is returned rather than a boolean so a failure
 * message can name the offending call.
 */
export function mutationEvidence(observation: Observation): string[] {
  return [
    ...gitStatusEvidence(
      observation.gitStatusBefore,
      observation.gitStatusAfter,
    ),
    ...observation.toolCalls.flatMap(toolCallEvidence),
  ];
}
