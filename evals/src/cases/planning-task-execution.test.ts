import { AssertionError } from "node:assert";
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
import { SEED_COMMIT } from "#/cases/planning-work-item-tasks-checks.ts";
import { HEAD_LOG, makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const [BRIEF_ARTIFACT, PLAN_ARTIFACT, , REFACTORING_ARTIFACT] = ARTIFACTS;
const [FIRST_BRIEF_HEADING] = BRIEF_ARTIFACT.headings;

function getCase(suffix: string) {
  const selected = cases.find((entry) => entry.id === `${SKILL}/${suffix}`);
  if (selected === undefined) throw new Error(`Case not found: ${suffix}`);
  return selected;
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

const selectedTask = getCase("selected-task-artifacts");
const unfinishedDependency = getCase("unfinished-dependency");
const plainReply = completedObservation().finalText;
const validBrief = artifactContent(BRIEF_ARTIFACT, "No refactoring needed");

const PLANNED_REPLY = `Task 2 ("Reject invalid timeout values") of acme-timer-42 is planned. All four stages returned PASS and I checked each artifact's headings. I did not implement anything, and the files are left unstaged and uncommitted.

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
const GROUPED_REPLY =
  'Planning for Task 2 of `acme-timer-42`, "Reject invalid timeout values", is complete. All four stages returned `PASS` and every artifact passed validation. I didn\'t implement anything, and nothing is staged or committed.\n\n**Artifacts** (untracked, in `docs/`):\n- `acme-timer-42-task-2-brief.md`\n- `acme-timer-42-task-2-execution-plan.md`\n- `acme-timer-42-task-2-test-spec.md`\n- `acme-timer-42-task-2-refactoring-plan.md`\n\n**Refactoring verdict:** No refactoring needed.\n\n**References fetched:** none.';

describe("selected-task completion", () => {
  test.each([
    ["plain full paths", plainReply],
    ["planned full-path bullets", PLANNED_REPLY],
    ["bold labels and grouped filenames", GROUPED_REPLY],
  ])("accepts %s completion replies", (_label, finalText) => {
    expect(() =>
      selectedTask.check({ ...completedObservation(), finalText }),
    ).not.toThrow();
  });
  test.each([
    ["missing brief", BRIEF_ARTIFACT.path, null],
    [
      "wrong task identity",
      BRIEF_ARTIFACT.path,
      validBrief.replace("Task 2:", "Task 3:"),
    ],
    [
      "wrong first heading",
      BRIEF_ARTIFACT.path,
      validBrief.replace(`## ${FIRST_BRIEF_HEADING}`, "## Wrong heading"),
    ],
    ["extra task artifact", OTHER_TASK_PATH, "unwanted Task 3 brief"],
    ["changed product code", "src/timeout.js", "new implementation"],
    [
      "invalid refactoring verdict",
      REFACTORING_ARTIFACT.path,
      artifactContent(REFACTORING_ARTIFACT, "Something else."),
    ],
    ["changed HEAD", HEAD_LOG, "commit: implemented timeout\n"],
  ] satisfies ReadonlyArray<readonly [string, string, string | null]>)(
    "rejects %s in captured planning files",
    (_label, path, content) => {
      const observation = completedObservation();
      expect(() =>
        selectedTask.check({
          ...observation,
          repoFiles: { ...observation.repoFiles, [path]: content },
        }),
      ).toThrow(AssertionError);
    },
  );
  test.each([
    ["public status line", `${plainReply}\nCompletion: PASS`],
    ["omitted artifact paths", plainReply.replace(OUTPUT_PATHS.join("\n"), "")],
    [
      "missing reference disclosure",
      plainReply.replace("References fetched: none", ""),
    ],
    ["missing completion", plainReply.replace("Planning completed.", "")],
    [
      "grouped filenames outside docs/",
      GROUPED_REPLY.replace("in `docs/`", "in `elsewhere/`"),
    ],
  ])("rejects %s in completion replies", (_label, finalText) => {
    expect(() =>
      selectedTask.check({ ...completedObservation(), finalText }),
    ).toThrow(AssertionError);
  });
  test.each([
    [
      "ignored-file Edit",
      {
        toolCalls: [
          { name: "Edit", input: { file_path: ".claude/config.json" } },
        ],
      },
    ],
    [
      "unexpected status delta",
      { gitStatusAfter: { kind: "worktree", entries: "?? extra.md" } },
    ],
  ] satisfies ReadonlyArray<readonly [string, Partial<Observation>]>)(
    "rejects %s outside declared planning writes",
    (_label, overrides) => {
      expect(() =>
        selectedTask.check({ ...completedObservation(), ...overrides }),
      ).toThrow(AssertionError);
    },
  );
  test.each([
    ["execution plan", PLAN_ARTIFACT],
    ["execution brief", BRIEF_ARTIFACT],
  ] satisfies ReadonlyArray<readonly [string, (typeof ARTIFACTS)[number]]>)(
    "rejects a git directive in the %s despite unchanged HEAD",
    (_label, artifact) => {
      const observation = completedObservation();
      const directive = "4. Run `git add -A`, then `git commit -m fix`.";
      expect(() =>
        selectedTask.check({
          ...observation,
          repoFiles: {
            ...observation.repoFiles,
            [artifact.path]: `${artifactContent(artifact, "No refactoring needed")}\n${directive}\n`,
          },
        }),
      ).toThrow(/line \d+: git add\b/);
    },
  );
});

describe("unfinished dependency", () => {
  test("accepts an unfinished dependency without writes", () => {
    expect(() => unfinishedDependency.check(failedObservation())).not.toThrow();
  });
  test.each([
    [
      "public prep status line",
      { finalText: `PREP: FAIL\n${failedObservation().finalText}` },
    ],
    [
      "completion without a stop",
      {
        finalText:
          "Task 1 is an unfinished dependency, but Task 2 planning completed successfully.",
      },
    ],
    [
      "omitted Task 1",
      {
        finalText:
          "Planning stopped because an unknown dependency is unfinished.",
      },
    ],
    [
      "written brief",
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
    "rejects %s when a dependency is unfinished",
    (_label, overrides) => {
      expect(() =>
        unfinishedDependency.check({ ...failedObservation(), ...overrides }),
      ).toThrow(AssertionError);
    },
  );
});

describe("planning input seeds", () => {
  test.each([
    ["selected-task-artifacts", TASK_PLAN],
    ["unfinished-dependency", BLOCKED_PLAN],
  ])(
    "seeds %s with tracked inputs and a clean worktree",
    (suffix, expectedPlan) => {
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
        expect(snapshots[INPUT_PATH]).toBe(expectedPlan);
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
});

describe("baseline evidence", () => {
  const baselineCommand = "node --test test/timeout.test.js";
  const claimingObservation: Observation = {
    ...completedObservation(),
    repoFiles: {
      ...completedObservation().repoFiles,
      [PLAN_ARTIFACT.path]: `${artifactContent(PLAN_ARTIFACT, "No refactoring needed")}\nThe baseline run passed (1 test).\n`,
    },
  };
  test("accepts a baseline claim backed by a captured passing tail", () => {
    expect(() =>
      selectedTask.check({
        ...claimingObservation,
        toolCalls: [
          {
            name: "Bash",
            input: { command: baselineCommand },
            result: {
              content:
                "Earlier output omitted\nℹ tests 1\nℹ pass 1\nℹ fail 0\n",
              isError: false,
              truncated: true,
            },
          },
        ],
      }),
    ).not.toThrow();
  });
  test.each([
    [
      "an echo command",
      [
        {
          name: "Bash",
          input: { command: `echo ${baselineCommand}` },
          result: {
            content: "# pass 1\n# fail 0\n",
            isError: false,
            truncated: false,
          },
        },
      ],
    ],
    [
      "no captured result",
      [{ name: "Bash", input: { command: baselineCommand } }],
    ],
    [
      "an error result",
      [
        {
          name: "Bash",
          input: { command: baselineCommand },
          result: {
            content: "# pass 1\n# fail 0\n",
            isError: true,
            truncated: false,
          },
        },
      ],
    ],
  ] satisfies ReadonlyArray<readonly [string, Observation["toolCalls"]]>)(
    "rejects baseline claims with %s",
    (_label, toolCalls) => {
      expect(() =>
        selectedTask.check({ ...claimingObservation, toolCalls }),
      ).toThrow(/baseline.*evidence/i);
    },
  );
});
