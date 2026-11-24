import assert from "node:assert/strict";
import { basename, dirname } from "node:path";

import { assertSiblingUntouched } from "#/cases/improving-skill-definition-run-evidence.ts";
import {
  commandParts,
  literalWords,
  successfulIgnoreCheck,
} from "#/cases/refactoring-code-gate-evidence.ts";
import {
  HANDOFFS,
  SENTINEL,
} from "#/cases/refactoring-code-regression-fixtures.ts";
import { handoffWrites } from "#/cases/refactoring-code-validation-evidence.ts";
import {
  capturedFilesUnder,
  fixtureRelativePath,
} from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

const FIRST = 0;
const ONE = 1;
const MISSING = "missing successful ignore proof before report write";

function destinationOperands(command: string): string[] {
  const [program = "", ...args] = literalWords(command);
  const operands = args.filter((word) => !word.startsWith("-"));
  if (basename(program) === "mkdir") return operands;
  if (["cp", "mv", "install"].includes(basename(program))) {
    return operands.slice(-ONE);
  }
  return [];
}

function writeTargets(
  observation: Observation,
  call: ToolCall,
  command: string,
): string[] {
  return [
    ...handoffWrites(observation, {
      ...call,
      input: { ...call.input, command },
    }),
    ...destinationOperands(command)
      .filter((target) => target.includes(HANDOFFS))
      .flatMap((target) => fixtureRelativePath(observation, target) ?? []),
  ].filter((path) => path.startsWith(HANDOFFS));
}

// Credit a probe earlier in the same call only when success of the remainder
// implies success of the prefix. Never run shell text from an observation.
function guardedPrefix(parts: string[], index: number): string {
  const suffix = parts.slice(index - ONE);
  if (
    suffix[FIRST] !== "&&" ||
    suffix.some((part) => /^[;&|\n]+$/.test(part) && part !== "&&")
  ) {
    return "";
  }
  return parts.slice(FIRST, index - ONE).join("");
}

function runId(path: string, command: string): string {
  const [run] = path.slice(HANDOFFS.length).split("/");
  assert.ok(run !== undefined && run !== "", "missing run id");
  if (literalWords(command)[FIRST] !== "mkdir") {
    assert.notEqual(path, `${HANDOFFS}${run}`, "shared-root handoff");
  }
  return run;
}

export function assertOwnedReports(observation: Observation): void {
  assertSiblingUntouched(observation, dirname(SENTINEL));
  const reports = capturedFilesUnder(observation, HANDOFFS);
  for (const path of Object.keys(reports).filter((path) => path !== SENTINEL)) {
    assert.match(
      path.slice(HANDOFFS.length),
      /^[^/]+\/.+/,
      "shared-root handoff",
    );
  }
  const verified = new Set<string>();
  observation.toolCalls.forEach((call, callIndex) => {
    const command = call.name === "Bash" ? call.input["command"] : "";
    const parts =
      typeof command === "string" && command !== ""
        ? commandParts(command)
        : [""];
    parts.forEach((part, index) => {
      for (const path of writeTargets(observation, call, part)) {
        const run = runId(path, part);
        if (verified.has(run)) continue;
        const earlier = observation.toolCalls.slice(FIRST, callIndex);
        const prefix = guardedPrefix(parts, index);
        if (prefix !== "") {
          earlier.push({ ...call, input: { command: prefix } });
        }
        assert.ok(
          earlier.some((candidate) =>
            successfulIgnoreCheck(observation, candidate, run),
          ),
          MISSING,
        );
        verified.add(run);
      }
    });
  });
}
