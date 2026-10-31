import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

import {
  ARTIFACTS,
  BLOCKED_PLAN,
  cases,
  INPUT_FILES,
  INPUT_PATH,
  KEY,
  OTHER_TASK_PATH,
  OUTPUT_PATHS,
  SKILL,
  TASK_NUMBER,
  TASK_PLAN,
  TITLE,
} from "#/cases/planning-task-execution.ts";
import {
  HEAD_LOG,
  SEED_COMMIT,
} from "#/cases/planning-work-item-tasks-checks.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const HEADING_START = 0;
const [BRIEF_ARTIFACT, , , REFACTORING_ARTIFACT] = ARTIFACTS;

function getCase(suffix: string) {
  const result = cases.find((entry) => entry.id === `${SKILL}/${suffix}`);
  if (result === undefined) throw new Error(`missing case ${suffix}`);
  return result;
}

function artifactContent(
  artifact: (typeof ARTIFACTS)[number],
  text: string,
): string {
  const sections = artifact.headings
    .map(
      (heading) =>
        `\n## ${heading}\n${heading === "Verdict" ? text : "Plan the selected task."}\n`,
    )
    .join("");
  return `# ${artifact.title} - ${KEY} Task ${TASK_NUMBER}: ${TITLE}\n${sections}`;
}

function completedObservation(): Observation {
  return createObservation({
    finalText: `Task ${TASK_NUMBER}: ${TITLE}\n${OUTPUT_PATHS.join("\n")}\nApproach: validate parser bounds.\nTests: boundaries and default.\nRefactoring: No refactoring needed.\nReferences fetched: none\nPlanning completed.`,
    repoFiles: {
      ...INPUT_FILES,
      ...Object.fromEntries(
        ARTIFACTS.map((artifact) => [
          artifact.path,
          artifactContent(artifact, "No refactoring needed"),
        ]),
      ),
      [OTHER_TASK_PATH]: null,
      [HEAD_LOG]: `commit: ${SEED_COMMIT}\n`,
    },
    gitStatusAfter: {
      kind: "worktree",
      entries: OUTPUT_PATHS.map((path) => `?? ${path}`).join("\n"),
    },
  });
}

function failedObservation(): Observation {
  return createObservation({
    finalText:
      "I stopped planning Task 2 because Task 1 is an unfinished dependency. No artifacts were written. Complete Task 1 first.",
    repoFiles: {
      [INPUT_PATH]: BLOCKED_PLAN,
      [OTHER_TASK_PATH]: null,
      ...Object.fromEntries(OUTPUT_PATHS.map((path) => [path, null])),
    },
  });
}

describe("routing and valid observations", () => {
  test("positive invokes the skill and sibling negative does not", () => {
    const invocation = createObservation({
      toolCalls: [{ name: "Skill", input: { skill: SKILL } }],
    });
    expect(() => getCase("trigger-positive").check(invocation)).not.toThrow();
    expect(() =>
      getCase("trigger-positive").check(createObservation()),
    ).toThrow();
    expect(() =>
      getCase("trigger-negative-decomposition").check(createObservation()),
    ).not.toThrow();
    expect(() =>
      getCase("trigger-negative-decomposition").check(invocation),
    ).toThrow();
  });
  test.each(cases)("$id rejects an unobserved run", (entry) => {
    expect(() => entry.check(createObservation({ timedOut: true }))).toThrow(
      /wall clock/,
    );
  });
  test("accepts four selected-task planning artifacts", () => {
    expect(() =>
      getCase("selected-task-artifacts").check(completedObservation()),
    ).not.toThrow();
  });
  test("accepts unsatisfied dependency without writes", () => {
    expect(() =>
      getCase("unfinished-dependency").check(failedObservation()),
    ).not.toThrow();
  });
});

describe("selected-task-artifacts", () => {
  test("accepts bold labels and directory-factored filenames", () => {
    const observation = completedObservation();
    const filenames = OUTPUT_PATHS.map(
      (path) => `- \`${path.slice("docs/".length)}\``,
    ).join("\n");
    const finalText = observation.finalText
      .replace(
        OUTPUT_PATHS.join("\n"),
        `Artifacts, all in docs/ and left unstaged:\n${filenames}`,
      )
      .replace("References fetched:", "**References fetched:**");
    expect(() =>
      getCase("selected-task-artifacts").check({ ...observation, finalText }),
    ).not.toThrow();
    expect(() =>
      getCase("selected-task-artifacts").check({
        ...observation,
        finalText: finalText.replace("all in docs/", "all in elsewhere/"),
      }),
    ).toThrow();
  });
  test("rejects the old public completion status line", () => {
    const observation = completedObservation();
    expect(() =>
      getCase("selected-task-artifacts").check({
        ...observation,
        finalText: `${observation.finalText}\nCompletion: PASS`,
      }),
    ).toThrow(/public status line/);
  });
  test.each(ARTIFACTS)(
    "rejects missing, wrong-identity and malformed $title",
    (artifact) => {
      const observation = completedObservation();
      const content = observation.repoFiles?.[artifact.path];
      if (typeof content !== "string") {
        throw new Error("synthetic artifact missing");
      }
      for (const changed of [
        null,
        content.replace("Task 2:", "Task 3:"),
        content.replace(
          `## ${artifact.headings.at(HEADING_START)}`,
          "## Wrong heading",
        ),
      ]) {
        expect(() =>
          getCase("selected-task-artifacts").check({
            ...observation,
            repoFiles: { ...observation.repoFiles, [artifact.path]: changed },
          }),
        ).toThrow();
      }
    },
  );
  test.each([
    ["extra task output", OTHER_TASK_PATH, "unwanted Task 3 brief"],
    ["implemented product code", "src/timeout.js", "new implementation"],
    ["changed tests", "test/timeout.test.js", "new test"],
    ["rewritten upstream plan", INPUT_PATH, "different task plan"],
    [
      "missing refactoring verdict",
      REFACTORING_ARTIFACT.path,
      artifactContent(REFACTORING_ARTIFACT, "Something else."),
    ],
    ["commit", HEAD_LOG, "commit: implemented timeout\n"],
  ])("rejects %s", (_label, path, value) => {
    const observation = completedObservation();
    expect(() =>
      getCase("selected-task-artifacts").check({
        ...observation,
        repoFiles: { ...observation.repoFiles, [path]: value },
      }),
    ).toThrow();
  });
  test.each([
    ["incomplete handoff", { finalText: "Planning completed." }],
    [
      "missing reference disclosure",
      {
        finalText: completedObservation().finalText.replace(
          "References fetched: none",
          "",
        ),
      },
    ],
    [
      "missing completion",
      {
        finalText: completedObservation().finalText.replace(
          "Planning completed.",
          "",
        ),
      },
    ],
    [
      "ignored write",
      {
        toolCalls: [
          { name: "Edit", input: { file_path: ".claude/config.json" } },
        ],
      },
    ],
    [
      "unexpected file",
      { gitStatusAfter: { kind: "worktree", entries: "?? extra.md" } },
    ],
  ] satisfies ReadonlyArray<readonly [string, Partial<Observation>]>)(
    "rejects %s",
    (_label, overrides) => {
      expect(() =>
        getCase("selected-task-artifacts").check({
          ...completedObservation(),
          ...overrides,
        }),
      ).toThrow();
    },
  );
});

describe("unfinished-dependency", () => {
  test("rejects the old public prep status line", () => {
    const observation = failedObservation();
    expect(() =>
      getCase("unfinished-dependency").check({
        ...observation,
        finalText: `PREP: FAIL\n${observation.finalText}`,
      }),
    ).toThrow(/public status line/);
  });
  test.each([
    [
      "claims success",
      { finalText: "Task 2 planning completed successfully." },
    ],
    [
      "omits prerequisite",
      {
        finalText:
          "Planning stopped because an unknown dependency is unfinished.",
      },
    ],
    [
      "created brief",
      {
        repoFiles: {
          ...failedObservation().repoFiles,
          [BRIEF_ARTIFACT.path]: "brief",
        },
      },
    ],
    [
      "changed input",
      {
        repoFiles: {
          ...failedObservation().repoFiles,
          [INPUT_PATH]: TASK_PLAN,
        },
      },
    ],
    [
      "mutating tool",
      {
        toolCalls: [
          { name: "Write", input: { file_path: BRIEF_ARTIFACT.path } },
        ],
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, Partial<Observation>]>)(
    "rejects %s",
    (_label, overrides) => {
      expect(() =>
        getCase("unfinished-dependency").check({
          ...failedObservation(),
          ...overrides,
        }),
      ).toThrow();
    },
  );
});

test.each(["selected-task-artifacts", "unfinished-dependency"])(
  "%s seeds task scope and tracked code",
  (suffix) => {
    const entry = getCase(suffix);
    const fixture = makeFixture(
      "clean",
      [SKILL],
      "seed" in entry ? entry.seed : undefined,
    );
    try {
      const snapshots = snapshotRepoFiles(
        fixture.cwd,
        Object.keys(INPUT_FILES),
      );
      expect(snapshots[INPUT_PATH]).toBe(
        suffix === "unfinished-dependency" ? BLOCKED_PLAN : TASK_PLAN,
      );
      expect(snapshots["src/timeout.js"]).toBe(INPUT_FILES["src/timeout.js"]);
      expect(snapshots["test/timeout.test.js"]).toBe(
        INPUT_FILES["test/timeout.test.js"],
      );
      expect(
        execFileSync("git", ["status", "--short"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toBe("");
    } finally {
      fixture.cleanup();
    }
  },
);

test("accepts the recorded planned completion without its retired status line", () => {
  const finalText = `Task 2 ("Reject invalid timeout values") of acme-timer-42 is planned. All four stages returned PASS and I checked each artifact's headings. I did not implement anything, and the files are left unstaged and uncommitted.

**Artifacts**
- \`docs/acme-timer-42-task-2-brief.md\`
- \`docs/acme-timer-42-task-2-execution-plan.md\`
- \`docs/acme-timer-42-task-2-test-spec.md\`
- \`docs/acme-timer-42-task-2-refactoring-plan.md\`

**Recommended approach:** Keep the existing default when no timeout is given, and keep the current numeric conversion. Then require a whole number of seconds from 1 to 300, and extend the existing Node tests.

**Test coverage:** The spec has seven behavior groups, using \`node:test\` with \`node:assert/strict\`. The highest-priority tests cover:
- the default
- both endpoints of the range
- values inside the range
- zero and negative values
- fractions
- values above the maximum
- non-numeric and non-finite values
- the exact error messages

Lower-priority tests cover the full valid range and numeric strings. Every definition-of-done item is mapped to a test.

**Refactoring verdict:** No refactoring needed.

**References fetched:** none. Nothing was fetched from GitHub or the web.
`;
  expect(() =>
    getCase("selected-task-artifacts").check({
      ...completedObservation(),
      finalText,
    }),
  ).not.toThrow();
});
