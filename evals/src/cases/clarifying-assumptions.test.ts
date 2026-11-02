import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { SKILL } from "#/cases/clarifying-assumptions.ts";
import {
  CLARIFICATION_FACTS,
  CLARIFICATION_INPUTS,
  seedClarificationArtifacts,
} from "#/cases/clarifying-assumptions-fixtures.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { sampleGitStatus } from "#/observation/mutation-evidence.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const critique = `CRITIQUE: PASS
Ticket: acme-app-42 | Mode: upfront | Task: -
Artifact: docs/acme-app-42-upfront-critique.md
## Critique Report
### Artifacts Reviewed
The task plan and two planning intermediates.
### Codebase Verification
Node and plain JavaScript, no framework.
### Problem Framing Critique
| Item ID | Severity | Dimension | Finding | Why this matters | Tier |
| --- | --- | --- | --- | --- | --- |
| PF1 | HIGH | End user | Audience is unresolved | Authorization depends on audience | Tier 3 |
### Technology Critique Items
None.
### Items Not Raised
No technology changes were proposed.
### Summary
- Problem-framing items: 1
- Technology critique items: 0
- User-impact items: 0
`;
const preview = `## Question Manifest - acme-app-42
Questions now: 1 | Deferred: 0 | Irrelevant: 0
| # | Item ID | Category | Severity | Model | Skippable | Affects |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PF1 | Problem framing | HIGH | A | No | All |
Ready to start? I'll walk through these one at a time.
`;
const blocked = `Critique mode needs a task number before I can continue.
Please provide TASK_NUMBER for acme-app-42. No files were changed.
`;

function getCase(name: string) {
  return getRegisteredCase(`${SKILL}/${name}`);
}

function validObservation(name: string): Observation {
  const before = Object.keys(CLARIFICATION_INPUTS)
    .map((path) => `?? ${path}`)
    .sort((left, right) => left.localeCompare(right));
  const after = [...before, `?? ${CLARIFICATION_FACTS.critiquePath}`].sort(
    (left, right) => left.localeCompare(right),
  );
  const observation = createObservation({
    finalText: preview,
    gitStatusBefore: { kind: "worktree", entries: before.join("\n") },
    gitStatusAfter: { kind: "worktree", entries: after.join("\n") },
    toolCalls: [
      {
        name: "Write",
        input: {
          file_path: `/fixture/${CLARIFICATION_FACTS.critiquePath}`,
          content: critique,
        },
      },
    ],
    repoFiles: {
      ...CLARIFICATION_INPUTS,
      ".git/eval-fixture-root": "/fixture\n/canonical/fixture",
      [CLARIFICATION_FACTS.critiquePath]: critique,
      [CLARIFICATION_FACTS.decisionsPath]: null,
      "a.txt": "hello\n",
      ".git/logs/HEAD": "initial\thead\tcommit (initial): initial commit\n",
    },
  });
  if (name === "upfront-preview-gate") return observation;
  return {
    ...observation,
    finalText: blocked,
    toolCalls: [],
    gitStatusAfter: observation.gitStatusBefore,
    repoFiles: {
      ...observation.repoFiles,
      [CLARIFICATION_FACTS.critiquePath]: null,
    },
  };
}

describe("clarifying-assumptions", () => {
  test("preview requires the contract header, counts, hard gate row, and readiness question", () => {
    const observation = validObservation("upfront-preview-gate");
    expect(() =>
      getCase("upfront-preview-gate").check(observation),
    ).not.toThrow();
    for (const finalText of [
      preview.replace("Question Manifest", "Questions"),
      preview.replace("Questions now: 1", "Questions now: 0"),
      preview.replace("| Item ID |", "| ID |"),
      preview.replace("| HIGH | A | No |", "| MEDIUM | B | Yes |"),
      preview.replace("| HIGH | A | No |", "| HIGH | A | Yes |"),
      preview.replace("Ready to start?", "Starting now."),
      `${preview}\n### Brief 1\nRevealed too early.`,
      `${preview}\n- Accepted decisions summary: Chose tenant administrators.`,
    ]) {
      expect(() =>
        getCase("upfront-preview-gate").check({ ...observation, finalText }),
      ).toThrow();
    }
  });

  test("preview requires a written, correctly framed high-severity critique", () => {
    const observation = validObservation("upfront-preview-gate");
    for (const content of [
      null,
      critique.replace("CRITIQUE: PASS", "CRITIQUE: FAIL"),
      critique.replace("Mode: upfront", "Mode: critique"),
      critique.replace("Artifact: docs/", "Artifact: /tmp/repo/docs/"),
      critique.replace("Problem Framing Critique", "Notes"),
      critique.replace("| HIGH |", "| LOW |"),
    ]) {
      expect(() =>
        getCase("upfront-preview-gate").check({
          ...observation,
          repoFiles: {
            ...observation.repoFiles,
            [CLARIFICATION_FACTS.critiquePath]: content,
          },
        }),
      ).toThrow();
    }
  });

  test.each(["upfront-preview-gate", "critique-missing-task-number"])(
    "%s rejects unexpected writes and missing evidence",
    (name) => {
      const observation = validObservation(name);
      for (const overrides of [
        { repoFiles: undefined },
        {
          repoFiles: {
            ...observation.repoFiles,
            [CLARIFICATION_FACTS.decisionsPath]: "invented decision",
          },
        },
        { repoFiles: { ...observation.repoFiles, "a.txt": "modified" } },
        {
          repoFiles: {
            ...observation.repoFiles,
            ".git/logs/HEAD": "new commit\n",
          },
        },
        {
          gitStatusAfter: {
            kind: "worktree",
            entries: `${observation.gitStatusAfter.kind === "worktree" ? observation.gitStatusAfter.entries : ""}\n?? unexpected.txt`,
          },
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "Write", input: { file_path: "unexpected.txt" } },
          ],
        },
      ] satisfies Array<Partial<Observation>>) {
        expect(() =>
          getCase(name).check({ ...observation, ...overrides }),
        ).toThrow();
      }
      expect(() =>
        getCase(name).check({
          ...observation,
          repoFiles: {
            ...observation.repoFiles,
            [CLARIFICATION_FACTS.planPath]: "changed",
          },
        }),
      ).toThrow(/changed input/);
    },
  );

  test("missing task number requires a request and rejects public routing flags", () => {
    const observation = validObservation("critique-missing-task-number");
    expect(() =>
      getCase("critique-missing-task-number").check(observation),
    ).not.toThrow();
    for (const finalText of [
      "No files were changed.",
      "Please provide the work item URL. No files were changed.",
      `${blocked}\n- RE_PLAN_NEEDED: false\n- BLOCKERS_PRESENT: true`,
      `${blocked}\n- Blocking verdict: INPUT: BLOCKED`,
    ]) {
      expect(() =>
        getCase("critique-missing-task-number").check({
          ...observation,
          finalText,
        }),
      ).toThrow();
    }
    expect(() =>
      getCase("critique-missing-task-number").check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [CLARIFICATION_FACTS.critiquePath]: critique,
        },
      }),
    ).toThrow();
  });

  test("seed exposes individual untracked paths without output artifacts", () => {
    const fixture = makeFixture("clean", [], seedClarificationArtifacts);
    try {
      const status = sampleGitStatus(fixture.cwd);
      assert.ok(status.kind === "worktree");
      expect(status.entries).toContain(CLARIFICATION_FACTS.planPath);
      expect(() =>
        readFileSync(join(fixture.cwd, CLARIFICATION_FACTS.critiquePath)),
      ).toThrow();
      expect(() =>
        readFileSync(join(fixture.cwd, CLARIFICATION_FACTS.decisionsPath)),
      ).toThrow();
    } finally {
      fixture.cleanup();
    }
  });
});

test("critique accepts a canonical-root artifact", () => {
  const observation = validObservation("upfront-preview-gate");
  expect(() =>
    getCase("upfront-preview-gate").check({
      ...observation,
      toolCalls: [
        {
          name: "Write",
          input: {
            file_path: `/canonical/fixture/${CLARIFICATION_FACTS.critiquePath}`,
          },
        },
      ],
    }),
  ).not.toThrow();
});

test("critique rejects a foreign-root lookalike", () => {
  const observation = validObservation("upfront-preview-gate");
  expect(() =>
    getCase("upfront-preview-gate").check({
      ...observation,
      toolCalls: [
        {
          name: "Write",
          input: { file_path: `/outside/${CLARIFICATION_FACTS.critiquePath}` },
        },
      ],
    }),
  ).toThrow(/read-only contract violated/);
});
