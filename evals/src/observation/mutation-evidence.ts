import { isMutatingGitCommand } from "#/observation/git-command-evidence.ts";
import { describeGitStatus, sameGitStatus } from "#/observation/git-status.ts";
import type { Observation, ToolCall } from "#/observation/observation-types.ts";

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
  observation: Observation,
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

/** Ordered evidence, including unreadable samples rather than false clean results. */
export function mutationEvidence(observation: Observation): string[] {
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
