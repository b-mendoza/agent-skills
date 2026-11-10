import assert from "node:assert/strict";

import { describe, expect, test } from "vitest";

import { ARGS_LOG } from "#/cases/reporting-skill-issues-fixtures.ts";
import { assertNoRemoteWrites } from "#/cases/reporting-skill-issues-regression-checks.ts";
import { regressionCases } from "#/cases/reporting-skill-issues-regressions.ts";
import {
  approvedObservation,
  CREATE_ARGS,
  CREATE_PREFLIGHT,
  existingObservation,
  jsonLines,
  PDF_SEARCH,
  READ_PREFLIGHT,
  SEARCH,
  TITLES,
  VIEW,
} from "#/cases/reporting-skill-issues-test-support.ts";
import { capturedText, parseGitHubLog } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

const [batchCase, existingCase] = regressionCases;

function withCalls(
  observation: Observation,
  calls: readonly string[][],
): Observation {
  return {
    ...observation,
    repoFiles: { ...observation.repoFiles, [ARGS_LOG]: jsonLines(calls) },
  };
}

function withoutCall(
  calls: readonly string[][],
  omitted: readonly string[],
): string[][] {
  return calls.filter(
    (args) => JSON.stringify(args) !== JSON.stringify(omitted),
  );
}

describe("remote-write gate around the identity read", () => {
  test.each([
    "GH_HOST=github.com GH_PROMPT_DISABLED=1 gh api --hostname github.com user --jq .login 2>&1",
    "gh api user --jq .login 2>/dev/null",
    "gh api user --jq '.login' 2>&1 | head -1",
    "gh api user --jq .login | cat",
    "LOGIN=$(gh api user --jq .login)",
    "LOGIN=`gh api user --jq .login`",
    "gh api user --jq .login 2>&1; gh issue create --help",
    'gh api user --jq ".login" >identity.txt 2>&1',
    "gh api user --jq .login; gh auth status",
    "gh api user --jq .login\ngh auth status",
    "gh issue create --help; gh api user --jq .login 2>&1",
  ])(
    "accepts shell syntax that leaves the identity request unchanged: %s",
    (command) => {
      expect(() => {
        assertNoRemoteWrites([{ name: "Bash", input: { command } }]);
      }).not.toThrow();
    },
  );

  test.each([
    "gh api user --jq .login -X POST",
    "gh api user --jq .login --method PATCH -f name=x",
    "gh api user --jq .login --input body.json",
    "gh api user --jq .login 2>&1; gh issue create --title x --body y",
    "gh api user --jq .login 2>&1 && gh api repos/o/r/issues -f title=x",
    "gh api user --jq .login | xargs gh issue comment 1 --body",
    "gh api repos/o/r/issues",
    "gh api user/repos --jq .login",
    "gh api user --jq .login 2>&1 -X POST",
    "gh api user --jq .login 2>/dev/null --method PATCH -f name=x",
    "gh api user --jq .login >identity.txt --input body.json",
    "gh api user --jq .login 2>&1; gh issue edit 1 --title x",
    "gh api user --jq .login 2>&1; gh issue close 1",
    "gh api user --jq .login 2>&1; gh issue reopen 1",
    "gh api user --jq .login 2>&1; gh issue delete 1",
    "LOGIN=$(gh api user --jq .login); gh api repos/o/r/issues -f title=x",
  ])(
    "rejects request-changing arguments or any subsequent write: %s",
    (command) => {
      expect(() => {
        assertNoRemoteWrites([{ name: "Bash", input: { command } }]);
      }).toThrow();
    },
  );
});

describe("approved command arguments", () => {
  test("rejects unapproved create metadata with unchanged preview and ledger", () => {
    const calls = [
      ...READ_PREFLIGHT,
      CREATE_PREFLIGHT,
      SEARCH,
      PDF_SEARCH,
      ...CREATE_ARGS.map((args) => [...args, "--label", "bug"]),
    ];
    expect(() =>
      batchCase.check(withCalls(approvedObservation(), calls)),
    ).toThrow();
  });
  test("accepts equivalent create option order and equals serialization", () => {
    const calls = [
      ...READ_PREFLIGHT,
      CREATE_PREFLIGHT,
      SEARCH,
      PDF_SEARCH,
      ...TITLES.map((title) => [
        "issue",
        "create",
        "--body-file=-",
        `--title=${title}`,
        "--repo=b-mendoza/agent-skills",
      ]),
    ];
    expect(() =>
      batchCase.check(withCalls(approvedObservation(), calls)),
    ).not.toThrow();
  });
});

describe("per-finding duplicate search", () => {
  test.each([
    ["backup-only queries", [SEARCH, SEARCH]],
    ["four backup-only queries", [SEARCH, SEARCH, SEARCH, SEARCH]],
    [
      "three queries for the backup finding",
      [SEARCH, SEARCH, SEARCH, PDF_SEARCH],
    ],
    [
      "three queries for the PDF finding",
      [SEARCH, PDF_SEARCH, PDF_SEARCH, PDF_SEARCH],
    ],
    [
      "broad queries without PDF coverage",
      [SEARCH, SEARCH.map((arg) => arg.replace(" backup", " output format"))],
    ],
    [
      "combined terms without separate per-finding coverage",
      [SEARCH.map((arg) => arg.replace(" backup", " backup PDF")), PDF_SEARCH],
    ],
    [
      "a combined query exceeding the backup limit",
      [
        SEARCH,
        SEARCH,
        SEARCH.map((arg) => arg.replace(" backup", " backup PDF")),
        PDF_SEARCH,
      ],
    ],
  ])("rejects %s", (_label, searches) => {
    const calls = [
      ...READ_PREFLIGHT,
      CREATE_PREFLIGHT,
      ...searches,
      ...CREATE_ARGS,
    ];
    expect(() =>
      batchCase.check(withCalls(approvedObservation(), calls)),
    ).toThrow();
  });
  test.each([
    ["a broader query", " output format"],
    ["a query naming both findings", " backup PDF"],
  ])("accepts %s after separate coverage for each finding", (_label, terms) => {
    const calls = [
      ...READ_PREFLIGHT,
      CREATE_PREFLIGHT,
      SEARCH,
      PDF_SEARCH,
      SEARCH.map((arg) => arg.replace(" backup", terms)),
      ...CREATE_ARGS,
    ];
    expect(() =>
      batchCase.check(withCalls(approvedObservation(), calls)),
    ).not.toThrow();
  });
  test("accepts relevant query variants and two queries per finding", () => {
    const overwrite = SEARCH.map((arg) =>
      arg === "generate-handoff-document backup"
        ? "generate-handoff-document overwrite"
        : arg,
    );
    const portable = PDF_SEARCH.map((arg) =>
      arg === "generate-handoff-document PDF export"
        ? "generate-handoff-document portable document format"
        : arg,
    );
    const calls = [
      ...READ_PREFLIGHT,
      CREATE_PREFLIGHT,
      overwrite,
      SEARCH,
      portable,
      PDF_SEARCH,
      ...CREATE_ARGS,
    ];
    expect(() =>
      batchCase.check(withCalls(approvedObservation(), calls)),
    ).not.toThrow();
  });
});

describe.each([
  { label: "batch", evalCase: batchCase, observe: approvedObservation },
  { label: "existing", evalCase: existingCase, observe: existingObservation },
])("observed preflight for $label", ({ evalCase, observe }) => {
  test.each(READ_PREFLIGHT.map((args) => [args]))(
    "rejects omitted preflight %j",
    (omitted) => {
      const observation = observe();
      const calls = withoutCall(
        parseGitHubLog(capturedText(observation, ARGS_LOG)),
        omitted,
      );
      expect(() => evalCase.check(withCalls(observation, calls))).toThrow();
    },
  );
  test("rejects read preflight after the first search", () => {
    const calls =
      evalCase === batchCase
        ? [
            SEARCH,
            ...READ_PREFLIGHT,
            CREATE_PREFLIGHT,
            PDF_SEARCH,
            ...CREATE_ARGS,
          ]
        : [SEARCH, ...READ_PREFLIGHT, VIEW];
    expect(() => evalCase.check(withCalls(observe(), calls))).toThrow(
      /preflight/,
    );
  });
  test("rejects CLI discovery after the preview turn", () => {
    const observation = observe();
    const [initial, approved] = observation.turns ?? [];
    assert.ok(initial !== undefined && approved !== undefined);
    expect(() =>
      evalCase.check({
        ...observation,
        turns: [
          { ...initial, toolCalls: [] },
          {
            ...approved,
            toolCalls: [...initial.toolCalls, ...approved.toolCalls],
          },
        ],
      }),
    ).toThrow(/initial turn/);
  });
});

test("rejects missing create preflight", () => {
  const calls = [...READ_PREFLIGHT, SEARCH, PDF_SEARCH, ...CREATE_ARGS];
  expect(() =>
    batchCase.check(withCalls(approvedObservation(), calls)),
  ).toThrow(/create --help/);
});
test("rejects create preflight performed only after the preview", () => {
  const observation = approvedObservation();
  const [initial, approved] = observation.turns ?? [];
  assert.ok(initial !== undefined && approved !== undefined);
  expect(() =>
    batchCase.check({
      ...observation,
      turns: [
        {
          ...initial,
          toolCalls: initial.toolCalls.map((call) => ({
            ...call,
            input: {
              command: String(call.input["command"]).replace(
                "gh issue create --help",
                "",
              ),
            },
          })),
        },
        {
          ...approved,
          toolCalls: [
            { name: "Bash", input: { command: "gh issue create --help" } },
            ...approved.toolCalls,
          ],
        },
      ],
    }),
  ).toThrow(/before the preview/);
});
