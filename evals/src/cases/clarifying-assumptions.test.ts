import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { cases, SKILL } from "#/cases/clarifying-assumptions.ts";
import {
  CLARIFICATION_FACTS,
  CLARIFICATION_INPUTS,
  seedClarificationArtifacts,
} from "#/cases/clarifying-assumptions-fixtures.ts";
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
const blocked = `- Critique artifact: -
- Files updated: -
- RE_PLAN_NEEDED: false
- BLOCKERS_PRESENT: true
- Blocking verdict: INPUT: BLOCKED
- Reason: TASK_NUMBER is required for MODE=critique.
- Decisions file: -
`;

function getCase(name: string) {
  const testCase = cases.find((entry) => entry.id === `${SKILL}/${name}`);
  assert.ok(testCase !== undefined);
  return testCase;
}

function validObservation(name: string): Observation {
  if (name === "trigger-positive") {
    return createObservation({
      toolCalls: [{ name: "Skill", input: { skill: SKILL } }],
    });
  }
  if (name === "trigger-negative-plan-validation") return createObservation();
  return behavioralObservation(name === "upfront-preview-gate");
}

function behavioralObservation(isPreview: boolean): Observation {
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
  if (isPreview) return observation;
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

const caseNames = [
  "trigger-positive",
  "trigger-negative-plan-validation",
  "upfront-preview-gate",
  "critique-missing-task-number",
];

describe("clarifying-assumptions", () => {
  test.each(caseNames)(
    "%s accepts correct evidence and rejects invalid runs",
    (name) => {
      const observation = validObservation(name);
      expect(getCase(name).check(observation)).toBeTypeOf("string");
      expect(() =>
        getCase(name).check({ ...observation, timedOut: true }),
      ).toThrow();
      expect(() =>
        getCase(name).check({ ...observation, subtype: "query_error" }),
      ).toThrow();
    },
  );

  test("routing rejects the wrong invocation presence", () => {
    expect(() =>
      getCase("trigger-positive").check(createObservation()),
    ).toThrow();
    expect(() =>
      getCase("trigger-negative-plan-validation").check(
        validObservation("trigger-positive"),
      ),
    ).toThrow();
  });

  test("preview requires the contract header, counts, hard gate row, and readiness question", () => {
    const observation = validObservation("upfront-preview-gate");
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
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "Bash", input: { command: "git add docs" } },
          ],
        },
      ] satisfies Array<Partial<Observation>>) {
        expect(() =>
          getCase(name).check({ ...observation, ...overrides }),
        ).toThrow();
      }
      for (const path of Object.keys(CLARIFICATION_INPUTS)) {
        expect(() =>
          getCase(name).check({
            ...observation,
            repoFiles: { ...observation.repoFiles, [path]: "changed" },
          }),
        ).toThrow();
      }
    },
  );

  test("blocked summary rejects wrong flags, order, reason, and premature artifacts", () => {
    const observation = validObservation("critique-missing-task-number");
    for (const finalText of [
      blocked.replace("RE_PLAN_NEEDED: false", "RE_PLAN_NEEDED: true"),
      blocked.replace("BLOCKERS_PRESENT: true", "BLOCKERS_PRESENT: false"),
      blocked.replace("INPUT: BLOCKED", "CRITIQUE: FAIL"),
      blocked.replace("TASK_NUMBER", "input"),
      blocked.replace(
        "- Critique artifact: -\n- Files updated: -",
        "- Files updated: -\n- Critique artifact: -",
      ),
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

  test("seed preserves unresolved audience and exposes individual untracked paths", () => {
    const fixture = makeFixture("clean", [], seedClarificationArtifacts);
    try {
      for (const [path, content] of Object.entries(CLARIFICATION_INPUTS)) {
        expect(readFileSync(join(fixture.cwd, path), "utf8")).toBe(content);
      }
      expect(
        readFileSync(join(fixture.cwd, CLARIFICATION_FACTS.planPath), "utf8"),
      ).toContain(CLARIFICATION_FACTS.audienceGap);
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

test.each(["/outside", "../outside", "/fixture-other"])(
  "critique rejects foreign-root same-suffix write from %s",
  (root) => {
    const good = behavioralObservation(true);
    expect(() =>
      getCase("upfront-preview-gate").check({
        ...good,
        repoFiles: {
          ...good.repoFiles,
          ".git/eval-fixture-root": "/fixture\n/canonical/fixture",
        },
        toolCalls: [
          ...good.toolCalls,
          {
            name: "Edit",
            input: { file_path: `${root}/${CLARIFICATION_FACTS.critiquePath}` },
          },
        ],
      }),
    ).toThrow();
  },
);

test.each(["", "/fixture/", "/canonical/fixture/"])(
  "accepts artifact writes relative to or within fixture root %s",
  (prefix) => {
    const good = behavioralObservation(true);
    expect(() =>
      getCase("upfront-preview-gate").check({
        ...good,
        toolCalls: [
          ...good.toolCalls.filter(
            (call) => !["Write", "Edit"].includes(call.name),
          ),
          {
            name: "Write",
            input: {
              file_path: `${prefix}${CLARIFICATION_FACTS.critiquePath}`,
            },
          },
        ],
      }),
    ).not.toThrow();
  },
);
