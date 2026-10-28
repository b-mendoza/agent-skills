import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  assertFileAbsent,
  assertFileExists,
  assertFileMatches,
  assertNoMutation,
  assertRoutingRunEndedEarly,
  assertRunHappened,
  capturedFilesUnder,
  checkMutationScope,
  checkNegativeRouting,
  checkPositiveRouting,
  findBashCalls,
  FIXTURE_ROOT_PATH,
  fixtureRelativePath,
  formatToolNames,
} from "#/cases/shared-checks.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const skill = "some-skill";
const invoked = createObservation({
  toolCalls: [{ name: "Skill", input: { skill } }],
});

test("run and routing validity reject a run that never happened", () => {
  for (const check of [assertRunHappened, assertRoutingRunEndedEarly]) {
    expect(() => {
      check(createObservation());
    }).not.toThrow();
    expect(() => {
      check(createObservation({ timedOut: true }));
    }).toThrow(/wall clock/);
  }
});

test("routing checks use the requested skill, not a fixed target", () => {
  expect(checkPositiveRouting(invoked, skill)).toBe("Skill invoked");
  expect(() => checkPositiveRouting(invoked, "another-skill")).toThrow(
    /skill never triggered/,
  );
  expect(checkNegativeRouting(invoked, "another-skill")).toBe("no trigger");
  expect(() => checkNegativeRouting(invoked, skill, "wrong route")).toThrow(
    /wrong route/,
  );
  for (const check of [checkPositiveRouting, checkNegativeRouting]) {
    expect(() => check(createObservation({ timedOut: true }), skill)).toThrow(
      /wall clock/,
    );
  }
});

test("tool names describe calls or their absence", () => {
  expect(formatToolNames([])).toBe("none");
  expect(formatToolNames(invoked.toolCalls)).toBe("Skill");
});

test("no-mutation check rejects writes and invalid runs", () => {
  expect(() => {
    assertNoMutation(createObservation());
  }).not.toThrow();
  expect(() => {
    assertNoMutation(
      createObservation({ toolCalls: [{ name: "Write", input: {} }] }),
    );
  }).toThrow(/read-only contract violated/);
  expect(() => {
    assertNoMutation(createObservation({ subtype: "query_error" }));
  }).toThrow(/query produced no result/);
});

test("Bash matching ignores other tools and missing commands, including stateful regexes", () => {
  const bash = { name: "Bash", input: { command: "gh pr view 1" } };
  const observation = createObservation({
    toolCalls: [
      bash,
      { name: "Read", input: { command: "gh pr view 1" } },
      { name: "Bash", input: {} },
      { name: "Bash", input: { command: "git status" } },
      bash,
    ],
  });
  expect(findBashCalls(observation, /gh pr/g)).toStrictEqual([bash, bash]);
  expect(findBashCalls(observation, /gh issue/)).toStrictEqual([]);
});

describe("file snapshots", () => {
  const observation = createObservation({
    repoFiles: { "report.md": "# Result\npassed\n", "absent.txt": null },
  });

  test("existence distinguishes files, missing paths, and unrequested paths", () => {
    expect(() => {
      assertFileExists(observation, "report.md");
    }).not.toThrow();
    expect(() => {
      assertFileExists(observation, "absent.txt");
    }).toThrow(/absent/);
    expect(() => {
      assertFileExists(observation, "unrequested");
    }).toThrow(/not captured/);
  });

  test("absence requires a captured missing path", () => {
    expect(() => {
      assertFileAbsent(observation, "absent.txt");
    }).not.toThrow();
    expect(() => {
      assertFileAbsent(observation, "report.md");
    }).toThrow(/exists/);
    expect(() => {
      assertFileAbsent(createObservation(), "absent.txt");
    }).toThrow(/not captured/);
  });

  test("content matching rejects wrong content and absent files", () => {
    expect(() => {
      assertFileMatches(observation, "report.md", /^# Result/m);
    }).not.toThrow();
    expect(() => {
      assertFileMatches(observation, "report.md", /failed/);
    }).toThrow();
    expect(() => {
      assertFileMatches(observation, "absent.txt", /./);
    }).toThrow(/absent/);
  });
});

describe("captured directory files", () => {
  test("returns only regular captured descendants, preserving repo-relative keys", () => {
    expect(
      capturedFilesUnder(
        createObservation({
          repoFiles: {
            "reports/": "",
            "reports/a.md": "a",
            "reports/nested/b.yaml": "b",
            "reports/nested/": "",
            "reports/absent": null,
            "reports-other/c": "unrelated",
          },
        }),
        "reports/",
      ),
    ).toEqual({ "reports/a.md": "a", "reports/nested/b.yaml": "b" });
  });

  test.each([null, ""])(
    "returns no files for a requested absent or empty directory: %s",
    (marker) => {
      expect(
        capturedFilesUnder(
          createObservation({ repoFiles: { "reports/": marker } }),
          "reports/",
        ),
      ).toEqual({});
    },
  );

  test("rejects unrequested prefixes even when exact descendants were captured", () => {
    expect(() =>
      capturedFilesUnder(
        createObservation({ repoFiles: { "reports/a.md": "a" } }),
        "reports/",
      ),
    ).toThrow(/not captured/);
    expect(() => capturedFilesUnder(createObservation(), "reports/")).toThrow(
      /not captured/,
    );
  });

  test("requires a directory prefix and a valid run", () => {
    expect(() =>
      capturedFilesUnder(
        createObservation({ repoFiles: { reports: "text" } }),
        "reports",
      ),
    ).toThrow(/end.*\//);
    expect(() =>
      capturedFilesUnder(
        createObservation({ timedOut: true, repoFiles: { "reports/": "" } }),
        "reports/",
      ),
    ).toThrow(/wall clock/);
  });
});

test("native mutation grading accepts a clean run and rejects writes", () => {
  expect(checkMutationScope(createObservation())).toBe(
    "1 behavioral run(s) left no trace",
  );
  expect(() =>
    checkMutationScope(
      createObservation({
        toolCalls: [
          { name: "Bash", input: { command: "git commit -m changed" } },
        ],
      }),
    ),
  ).toThrow(/read-only contract violated/);
});

describe("fixture-relative artifact paths", () => {
  const observation = createObservation({
    repoFiles: { [FIXTURE_ROOT_PATH]: "/fixture\n/canonical/fixture" },
  });

  test.each([
    "docs/report.md",
    "./docs/report.md",
    "/fixture/docs/report.md",
    "/canonical/fixture/docs/report.md",
  ])("resolves an in-root path %s", (path) => {
    expect(fixtureRelativePath(observation, path)).toBe("docs/report.md");
  });

  test.each([
    "/outside/docs/report.md",
    "/fixture-other/docs/report.md",
    "../outside/docs/report.md",
    "/fixture/../outside/docs/report.md",
  ])("rejects a foreign or traversing path %s", (path) => {
    expect(fixtureRelativePath(observation, path)).toBeUndefined();
  });

  test("does not infer an absolute fixture root from tool paths", () => {
    expect(() =>
      fixtureRelativePath(createObservation(), "/fixture/docs/report.md"),
    ).toThrow(/not captured/);
  });

  test("resolves both names of a symlinked fixture after cleanup", () => {
    const directory = mkdtempSync(join(tmpdir(), "artifact-roots-"));
    const lexical = join(directory, "fixture-link");
    const target = join(directory, "fixture");
    mkdirSync(target);
    symlinkSync(target, lexical);
    const canonical = realpathSync(lexical);
    const captured = createObservation({
      repoFiles: { [FIXTURE_ROOT_PATH]: `${lexical}\n${canonical}` },
    });
    rmSync(directory, { recursive: true, force: true });
    expect(fixtureRelativePath(captured, join(lexical, "docs/report.md"))).toBe(
      "docs/report.md",
    );
    expect(
      fixtureRelativePath(captured, join(canonical, "docs/report.md")),
    ).toBe("docs/report.md");
  });
});
