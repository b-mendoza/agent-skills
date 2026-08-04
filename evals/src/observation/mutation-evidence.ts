import { isMutatingGitCommand } from "#/observation/git-command-evidence.ts";
import { describeGitStatus, sameGitStatus } from "#/observation/git-status.ts";
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

function bashEvidence(call: ToolCall): string | null {
  if (call.name !== "Bash") return null;

  const { command } = call.input;
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

/**
 * Every observed way the run could have written to the repo. A case asserts
 * this is empty; the list is returned rather than a boolean so a failure
 * message can name the offending call.
 */
export function mutationEvidence(observation: Observation): string[] {
  const found: string[] = [];
  const { gitStatusBefore: before, gitStatusAfter: after } = observation;

  // Unreadable is not clean. A sample that failed proves nothing about what
  // the run did, so it is reported rather than compared -- otherwise two
  // failed samples match and the assertion passes on absent evidence.
  for (const [label, status] of [
    ["before", before],
    ["after", after],
  ] as const) {
    if (status.kind === "unreadable") {
      found.push(
        `git status could not be sampled ${label} the run: ${status.reason}`,
      );
    }
  }

  const comparable =
    before.kind !== "unreadable" && after.kind !== "unreadable";
  if (comparable && !sameGitStatus(before, after)) {
    found.push(
      `git status changed:\n  before: ${describeGitStatus(before)}\n  after:  ${describeGitStatus(after)}`,
    );
  }

  for (const call of observation.toolCalls) {
    const write = fileWriteEvidence(call);
    if (write !== null) found.push(write);

    const bash = bashEvidence(call);
    if (bash !== null) found.push(bash);
  }

  return found;
}
