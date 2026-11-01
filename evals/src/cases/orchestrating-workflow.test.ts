import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  CRITIQUE_PATH,
  DECISIONS_PATH,
  EXECUTION_FACTS,
} from "#/cases/executing-work-item-task-fixtures.ts";
import { SKILL } from "#/cases/orchestrating-workflow.ts";
import {
  RESUME_ARTIFACTS,
  seedResumeArtifacts,
} from "#/cases/orchestrating-workflow-fixtures.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

function getCase(name: string) {
  return getRegisteredCase(`${SKILL}/${name}`);
}

function validObservation(name: string): Observation {
  return behavioralObservation(name === "resume-at-task-critique");
}

function behavioralObservation(resume: boolean): Observation {
  return createObservation({
    finalText: resume
      ? "Found completed Phase 5 planning for Task 1. Shall I resume at Phase 6, Task 1 critique?"
      : "Which Jira ticket or GitHub issue URL should I resume?",
    repoFiles: {
      ...(resume ? RESUME_ARTIFACTS : {}),
      [CRITIQUE_PATH]: null,
      [DECISIONS_PATH]: null,
      [EXECUTION_FACTS.sourcePath]: EXECUTION_FACTS.sourceContent,
      [EXECUTION_FACTS.headPath]:
        "initial\thead\tcommit (initial): initial commit\n",
      [EXECUTION_FACTS.logPath]: resume ? "--version\nauth status\n" : "",
    },
  });
}

const caseNames = ["resume-at-task-critique", "ambiguous-identifier"];

describe("orchestrating-workflow", () => {
  test.each(caseNames)("%s accepts correct evidence", (name) => {
    expect(getCase(name).check(validObservation(name))).toBeTypeOf("string");
  });

  test.each(["resume-at-task-critique", "ambiguous-identifier"])(
    "%s rejects advancing past the gate",
    (name) => {
      const observation = validObservation(name);
      for (const overrides of [
        {
          toolCalls: [
            { name: "Skill", input: { skill: "clarifying-assumptions" } },
          ],
        },
        {
          toolCalls: [
            { name: "Skill", input: { skill: "executing-work-item-task" } },
          ],
        },
        { toolCalls: [{ name: "Edit", input: { file_path: "a.txt" } }] },
        {
          toolCalls: [
            { name: "Bash", input: { command: "git commit -m started" } },
          ],
        },
        { gitStatusAfter: { kind: "worktree", entries: "?? unexpected.txt" } },
        { repoFiles: undefined },
        {
          repoFiles: {
            ...observation.repoFiles,
            [CRITIQUE_PATH]: "premature critique",
          },
        },
        {
          repoFiles: {
            ...observation.repoFiles,
            [DECISIONS_PATH]: "premature decisions",
          },
        },
        {
          repoFiles: {
            ...observation.repoFiles,
            [EXECUTION_FACTS.sourcePath]: "Hello\n",
          },
        },
        {
          repoFiles: {
            ...observation.repoFiles,
            [EXECUTION_FACTS.headPath]: "changed head\n",
          },
        },
        {
          repoFiles: {
            ...observation.repoFiles,
            [EXECUTION_FACTS.logPath]: "issue edit 42 --title changed\n",
          },
        },
      ] satisfies Array<Partial<Observation>>) {
        expect(() =>
          getCase(name).check({ ...observation, ...overrides }),
        ).toThrow();
      }
    },
  );

  test("resume requires the correct phase, task, and confirmation", () => {
    const observation = validObservation("resume-at-task-critique");
    for (const finalText of [
      "Shall I resume Phase 5 for Task 1?",
      "Shall I resume Phase 6 for Task 2?",
      "Phase 6 Task 1 is next.",
    ]) {
      expect(() =>
        getCase("resume-at-task-critique").check({ ...observation, finalText }),
      ).toThrow();
    }
    for (const path of Object.keys(RESUME_ARTIFACTS)) {
      expect(() =>
        getCase("resume-at-task-critique").check({
          ...observation,
          repoFiles: { ...observation.repoFiles, [path]: "changed" },
        }),
      ).toThrow();
    }
  });

  test("ambiguous input requires one targeted question and no tracker lookup", () => {
    const observation = validObservation("ambiguous-identifier");
    for (const finalText of [
      "Which color?",
      "Which issue? Which repo?",
      "Need a Jira URL.",
    ]) {
      expect(() =>
        getCase("ambiguous-identifier").check({ ...observation, finalText }),
      ).toThrow();
    }
    expect(() =>
      getCase("ambiguous-identifier").check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [EXECUTION_FACTS.logPath]: "--version\n",
        },
      }),
    ).toThrow();
  });

  test("resume seed matches the Phase 5 completed, Phase 6 pending handoff", () => {
    const fixture = makeFixture("clean", [], seedResumeArtifacts);
    try {
      for (const [path, content] of Object.entries(RESUME_ARTIFACTS)) {
        expect(readFileSync(join(fixture.cwd, path), "utf8")).toBe(content);
      }
      expect(() => readFileSync(join(fixture.cwd, CRITIQUE_PATH))).toThrow();
      expect(() => readFileSync(join(fixture.cwd, DECISIONS_PATH))).toThrow();
      expect(
        readFileSync(join(fixture.cwd, EXECUTION_FACTS.logPath), "utf8"),
      ).toBe("");
    } finally {
      fixture.cleanup();
    }
  });
});
