import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases } from "#/cases/clarifying-assumptions.ts";
import {
  CLARIFICATION_FACTS,
  COPY_EDIT_INPUTS,
  COPY_EDIT_NEW,
  COPY_EDIT_OLD,
} from "#/cases/clarifying-assumptions-fixtures.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const REVISION_TURN_COUNT = 4;
const APPROVAL_TURN_INDEX = 3;

export function getCase(name: string): EvalCase {
  const candidate = cases.find(
    (entry) => entry.id === `clarifying-assumptions/${name}`,
  );
  assert.ok(candidate !== undefined);
  return candidate;
}

export function structuralObservation(plan: string): Observation {
  return createObservation({
    finalText: "- RE_PLAN_NEEDED: true\n- BLOCKERS_PRESENT: false",
    turns: Array.from({ length: REVISION_TURN_COUNT }, (_, index) =>
      createTurn({
        name: index === APPROVAL_TURN_INDEX ? "confirm and revise" : "initial",
      }),
    ),
    repoFiles: {
      ...COPY_EDIT_INPUTS,
      [CLARIFICATION_FACTS.planPath]: plan,
      ".git/logs/HEAD": "initial\thead\tcommit (initial): initial commit\n",
    },
  });
}

export const structuralSeed =
  COPY_EDIT_INPUTS[CLARIFICATION_FACTS.planPath] ?? "";
export const structuralDecisionLog = `| Iteration | Scope | Item ID | Category | Outcome | Summary | Re-plan | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Plan-wide | PF1 | problem-framing | revised | Tenant administrators may export all tenant accounts, including other owners. | Yes | - |`;
export const structuralPlan = structuralSeed.replace(
  "No accepted decisions yet.",
  structuralDecisionLog,
);

export const pass: ToolCall = {
  name: "Bash",
  input: {
    command:
      "python3 -I scripts/validate-local-revision.py /fixture acme-app-42 upfront -",
  },
  result: {
    content: "LOCAL_REVISION: PASS files=3",
    isError: false,
    truncated: false,
  },
};

export function localObservation(toolCalls: ToolCall[] = [pass]): Observation {
  const observation = structuralObservation(structuralSeed);
  return {
    ...observation,
    finalText: "- RE_PLAN_NEEDED: false\n- BLOCKERS_PRESENT: false",
    toolCalls,
    repoFiles: {
      ...observation.repoFiles,
      ...Object.fromEntries(
        Object.entries(COPY_EDIT_INPUTS).map(([path, text]) => [
          path,
          text.replace(COPY_EDIT_OLD, COPY_EDIT_NEW),
        ]),
      ),
    },
  };
}
