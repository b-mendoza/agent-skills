import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases as clarificationCases } from "#/cases/clarifying-assumptions.ts";
import { cases as fetchingCases } from "#/cases/fetching-work-item.ts";
import { cases as auditCases } from "#/cases/improving-skill-definition.ts";
import { cases as executionPlanningCases } from "#/cases/planning-task-execution.ts";
import { cases as workItemPlanningCases } from "#/cases/planning-work-item-tasks.ts";
import { cases as prCreatorCases } from "#/cases/pr-creator.ts";
import { cases as refactorCases } from "#/cases/refactoring-code.ts";
import { cases as replyCases } from "#/cases/responding-to-pr-review-comments.ts";
import { cases as reviewCases } from "#/cases/review-pull-request.ts";
import {
  assertFileAbsent,
  assertFileExists,
  assertFileMatches,
  assertNoMutation,
  assertNoPublicStatusLine,
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
  normalizeReplyText,
  replyAsksFor,
} from "#/cases/shared-checks.ts";
import { cases as architectCases } from "#/cases/workflow-skill-architect.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

describe("reply text normalization", () => {
  test("makes emphasized labels match plain-text patterns", () => {
    expect(normalizeReplyText("**References fetched:** none")).toMatch(
      /References fetched:\s*none/,
    );
  });

  test.each([
    ["**bold** __bold__ *italic* _italic_", "bold bold italic italic"],
    ["**bold with _italic_**", "bold with italic"],
    ["`PR_CREATE` and ``my_file_name.ts``", "PR_CREATE and my_file_name.ts"],
    ["PR_CREATE my_file_name.ts a__b__c", "PR_CREATE my_file_name.ts a__b__c"],
    ["_PR_CREATE_ and __my_file_name.ts__", "PR_CREATE and my_file_name.ts"],
    [
      "## Heading\n> Quoted\n- First\n+ Second\n* Third\n1. Fourth\n2) Fifth\n\nLast",
      "Heading\nQuoted\nFirst\nSecond\nThird\nFourth\nFifth\n\nLast",
    ],
    ["> - ### **Nested**\n  > Reply", "Nested\nReply"],
    ["first\r\n\r\nlast", "first\r\n\r\nlast"],
    ["left > right; C#; 2 * 3; a - b", "left > right; C#; 2 * 3; a - b"],
  ])(
    "normalizes %s without losing content or line breaks",
    (reply, plainText) => {
      expect(normalizeReplyText(reply)).toBe(plainText);
    },
  );
});

describe("public status lines", () => {
  test.each([
    "PR_CREATE: PR_EXISTS",
    "**PR_CREATE:** PR_EXISTS",
    "__PR_CREATE:__ PR_EXISTS",
    "`PR_CREATE: PR_EXISTS`",
    "  PR_CREATE: PR_EXISTS  ",
    "## PR_CREATE: PR_EXISTS",
    "> - PR_CREATE: PR_EXISTS",
    "1. PR_CREATE: PR_EXISTS",
  ])("rejects a status line in %s and quotes the line", (reply) => {
    expect(() => {
      assertNoPublicStatusLine(reply, "PR_CREATE");
    }).toThrow(/public status line.*"[^"\n]*PR_CREATE: PR_EXISTS/);
  });

  test("checks every supplied prefix on every line", () => {
    expect(() => {
      assertNoPublicStatusLine(
        "I need context.\nCOMMIT_SCOPED_CHANGES: NEEDS_CONTEXT",
        "PR_CREATE",
        "COMMIT_SCOPED_CHANGES",
      );
    }).toThrow(/COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT/);
  });

  test.each([
    "no PR_CREATE call was made",
    "I did not emit PR_CREATE: PR_EXISTS.",
    "OTHER_PREFIX: DONE",
    "NOT_PR_CREATE: PR_EXISTS",
    "PR_CREATE_EXTRA: PR_EXISTS",
    "",
  ])("accepts a reply without the requested status prefix: %s", (reply) => {
    expect(() => {
      assertNoPublicStatusLine(reply, "PR_CREATE");
    }).not.toThrow();
  });

  test("treats prefixes as literal text", () => {
    expect(() => {
      assertNoPublicStatusLine("PRxCREATE: DONE", "PR.CREATE");
    }).not.toThrow();
    expect(() => {
      assertNoPublicStatusLine("PR.CREATE: DONE", "PR.CREATE");
    }).toThrow(/public status line/);
  });
});

describe("requests about a topic", () => {
  test.each([
    "Send the job posting and I'll run the review.",
    "Which job posting should I use?",
    "**Share** the job posting.",
    "Provide the job posting.",
    "Paste the job posting.",
    "Reply with the job posting.",
    "Tell me which job posting to use.",
    "Let me know which job posting to use.",
    "Please include the job posting.",
    "Confirm the job posting.",
    "Choose the job posting.",
    "Approve the job posting.",
    "I need the job posting before I can start.",
    "What I need: the backend job posting.",
    "The job posting is the input we need from you.",
    "You haven't given me the job posting.",
    "You haven't supplied the job posting.",
    "You haven't provided the job posting.",
    "The job posting is missing.",
    "The job posting is absent. Please send it as a URL or pasted text.",
    "The job posting is absent. Please send:\n1. The job posting\n2. Your CV",
  ])("accepts a question or request about the posting: %s", (reply) => {
    expect(replyAsksFor(reply, /job posting/i)).toBe(true);
  });

  test.each([
    "I reviewed the job posting.",
    "Send the resume.",
    "Which resume should I use?\n\nI reviewed the job posting.",
    "Please send the resume.\n \nI reviewed the job posting.",
    "I reviewed the job posting.\r\n\r\nPlease send the resume.",
    "The job posting provides the requirements.",
    "The job posting was approved.",
    "",
  ])("rejects statements or requests about another topic: %s", (reply) => {
    expect(replyAsksFor(reply, /job posting/i)).toBe(false);
  });

  test("does not consume a stateful topic regex across paragraphs or calls", () => {
    const topic = /job posting/gi;
    topic.lastIndex = "I reviewed the job posting.".length;
    const reply = "I reviewed the job posting. Send the job posting.";
    expect(replyAsksFor(reply, topic)).toBe(true);
    expect(replyAsksFor(reply, topic)).toBe(true);
    expect(topic.lastIndex).toBe("I reviewed the job posting.".length);
  });
});

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

const artifactFixtureCases: readonly EvalCase[] = [
  ...clarificationCases,
  ...fetchingCases,
  ...auditCases,
  ...executionPlanningCases,
  ...workItemPlanningCases,
  ...prCreatorCases,
  ...refactorCases,
  ...replyCases,
  ...reviewCases,
  ...architectCases,
].filter((entry) => "seed" in entry);

test.each(artifactFixtureCases)(
  "$id seeds and captures lexical and canonical fixture roots",
  (entry) => {
    const { seed, snapshotPaths } = entry;
    if (seed === undefined || snapshotPaths === undefined) {
      throw new Error("missing case seed or snapshot paths");
    }
    const fixture = makeFixture(entry.fixture, [], (context) => {
      const lexical = join(dirname(context.repoPath), "linked-repo");
      symlinkSync(context.repoPath, lexical);
      seed({ ...context, repoPath: lexical });
    });
    try {
      const lexical = join(dirname(fixture.cwd), "linked-repo");
      expect(snapshotRepoFiles(lexical, snapshotPaths)[FIXTURE_ROOT_PATH]).toBe(
        `${lexical}\n${realpathSync(lexical)}`,
      );
    } finally {
      fixture.cleanup();
    }
  },
);
