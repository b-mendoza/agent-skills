import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { SNAPSHOT_SECTIONS } from "#/cases/fetching-work-item.ts";
import {
  assertReadOnlyGitHub,
  ISSUE,
  seedGitHub,
  SNAPSHOT,
} from "#/cases/fetching-work-item-fixtures.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import { FIXTURE_ROOT_PATH } from "#/cases/shared-checks.ts";
import { GH_LOG, makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const READ_LOG = `${JSON.stringify(["issue", "view", ISSUE.url, "--json", "title,body,comments"])}\n`;
const METADATA = [
  `# ${ISSUE.slug}: ${ISSUE.title}`,
  `> Retrieved on: 2026-01-04 10:00 UTC Source: ${ISSUE.url} Repository: acme/app | Issue: #42`,
  "## Metadata\n| Field | Value |\n| --- | --- |",
  ...Object.entries({
    ISSUE_SLUG: ISSUE.slug,
    Repository: "acme/app",
    "Issue number": "42",
    State: "OPEN",
    Author: "billing-owner",
    Created: "2026-01-02 10:00 UTC",
    Updated: "2026-01-03 11:00 UTC",
    Closed: "_None_",
    URL: ISSUE.url,
  }).map(([field, value]) => `| ${field} | ${value} |`),
].join("\n");
const ARTIFACT = `${METADATA}
## Description
${ISSUE.goal}
**Scope**
${ISSUE.scope}
## Acceptance Criteria
${ISSUE.criterion}
## Comments
### Comment 1 - billing-reviewer (2026-01-03 11:00 UTC)
${ISSUE.comment}
${SNAPSHOT_SECTIONS.slice(SNAPSHOT_SECTIONS.indexOf("Retrieval Warnings"))
  .map((section) => `## ${section}\n_None_`)
  .join("\n")}
`;
const SUCCESS = createObservation({
  finalText: `Work item fetched to ${SNAPSHOT}.`,
  repoFiles: {
    [SNAPSHOT]: ARTIFACT,
    [GH_LOG]: READ_LOG,
    [FIXTURE_ROOT_PATH]: "/fixture\n/canonical/fixture",
  },
  gitStatusAfter: { kind: "worktree", entries: `?? ${SNAPSHOT}` },
  toolCalls: [
    { name: "Write", input: { file_path: SNAPSHOT, content: ARTIFACT } },
  ],
});
const FAILURE = createObservation({
  finalText:
    "GitHub issue acme/app#42 was not found (404). No snapshot was written and the tracker was not changed. Please check the issue URL and access.",
  repoFiles: { [SNAPSHOT]: null, [GH_LOG]: READ_LOG },
});
function getCase(suffix: string) {
  return getRegisteredCase(`fetching-work-item/${suffix}`);
}

describe("snapshot checks", () => {
  test("accepts the validated artifact and only its scoped write", () => {
    expect(() => getCase("github-snapshot").check(SUCCESS)).not.toThrow();
  });
  test.each([
    ["missing artifact", null],
    ["wrong identity", ARTIFACT.replace(ISSUE.slug, "other-42")],
    ["missing preamble", ARTIFACT.replace("Retrieved on:", "Generated:")],
    [
      "missing repository identity",
      ARTIFACT.replace("Repository: acme/app", "Repository: other/app"),
    ],
    ["missing heading", ARTIFACT.replace("## Projects", "## Workspaces")],
    [
      "wrong heading order",
      ARTIFACT.replace("## Description", "## TEMP")
        .replace("## Acceptance Criteria", "## Description")
        .replace("## TEMP", "## Acceptance Criteria"),
    ],
    ["missing metadata", ARTIFACT.replace("| Author | billing-owner |", "")],
    [
      "incorrect metadata value",
      ARTIFACT.replace("| State | OPEN |", "| State | CLOSED |"),
    ],
    ["missing criterion", ARTIFACT.replace(ISSUE.criterion, "")],
    [
      "criteria duplicated",
      ARTIFACT.replace(ISSUE.goal, `${ISSUE.goal}\n${ISSUE.criterion}`),
    ],
    [
      "incorrect comment count",
      ARTIFACT.replace("### Comment 1 -", "### Note 1 -"),
    ],
    [
      "invented relation",
      ARTIFACT.replace(
        "## Child Issues\n_None_",
        "## Child Issues\nacme/app#99",
      ),
    ],
  ])("rejects %s", (_label, artifact) => {
    expect(() =>
      getCase("github-snapshot").check({
        ...SUCCESS,
        repoFiles: { [SNAPSHOT]: artifact, [GH_LOG]: READ_LOG },
      }),
    ).toThrow();
  });
  test.each([
    { finalText: "Done" },
    {
      gitStatusAfter: {
        kind: "worktree",
        entries: `?? ${SNAPSHOT}\n?? unwanted.txt`,
      },
    },
    { toolCalls: [{ name: "Write", input: { file_path: "other.md" } }] },
    {
      toolCalls: [
        { name: "Bash", input: { command: "git commit -am unauthorized" } },
      ],
    },
    { repoFiles: { [SNAPSHOT]: ARTIFACT, [GH_LOG]: "" } },
    { repoFiles: { [SNAPSHOT]: ARTIFACT, [GH_LOG]: "[3]\n" } },
  ] satisfies Array<Partial<Observation>>)(
    "rejects missing evidence and writes outside scope %#",
    (overrides) => {
      expect(() =>
        getCase("github-snapshot").check({ ...SUCCESS, ...overrides }),
      ).toThrow();
    },
  );
});

test("accepts the recorded 404 nothing-written disclosure without its routing envelope", () => {
  const finalText =
    "The fetch failed: GitHub returned 404 for the issue, so nothing was written to docs/. Nothing on the platform was modified. To retry, check that acme/app is the right repository and issue number.";
  expect(() =>
    getCase("not-found").check({ ...FAILURE, finalText }),
  ).not.toThrow();
});
test("404 requires the missing-issue outcome and absence of an artifact", () => {
  const evalCase = getCase("not-found");
  expect(() => evalCase.check(FAILURE)).not.toThrow();
  for (const finalText of [
    "",
    "Authentication is missing. No snapshot was written. Please log in.",
    "GitHub returned an unknown error. No snapshot was written.",
    "GitHub returned 404. A snapshot was written to docs/.",
    FAILURE.finalText.replace(
      "No snapshot was written",
      "Snapshot was written",
    ),
    `${FAILURE.finalText}\nFETCH: FAIL`,
  ]) {
    expect(() => evalCase.check({ ...FAILURE, finalText })).toThrow();
  }
  expect(() =>
    evalCase.check({
      ...FAILURE,
      repoFiles: { [SNAPSHOT]: ARTIFACT, [GH_LOG]: READ_LOG },
    }),
  ).toThrow(/file exists/);
  expect(() =>
    evalCase.check({
      ...FAILURE,
      toolCalls: [{ name: "Edit", input: { file_path: "a.txt" } }],
    }),
  ).toThrow(/read-only/);
});
test("snapshot success rejects a leaked public fetch status", () => {
  expect(() =>
    getCase("github-snapshot").check({
      ...SUCCESS,
      finalText: `${SUCCESS.finalText}\n**FETCH:** PASS`,
    }),
  ).toThrow(/public status line/);
});
test("fetching accepts a canonical-root snapshot write", () => {
  expect(() =>
    getCase("github-snapshot").check({
      ...SUCCESS,
      toolCalls: [
        {
          name: "Write",
          input: { file_path: `/canonical/fixture/${SNAPSHOT}` },
        },
      ],
    }),
  ).not.toThrow();
});
test("fetching rejects a foreign-root lookalike", () => {
  expect(() =>
    getCase("github-snapshot").check({
      ...SUCCESS,
      toolCalls: [
        { name: "Write", input: { file_path: `/outside/${SNAPSHOT}` } },
      ],
    }),
  ).toThrow(/unexpected file write/);
});

const SUCCESS_EXIT = 0;
const FAILURE_EXIT = 1;
const apiMethodCases = [
  { options: ["--raw-field=title=changed"], readOnly: false },
  { options: ["-XPOST"], readOnly: false },
  { options: ["-f", "--method=GET"], readOnly: false },
  { options: ["--method", "GET", "-f", "per_page=100"], readOnly: true },
  { options: ["--method=GET", "-f", "--method=PATCH"], readOnly: true },
];
test.each(apiMethodCases.filter(({ readOnly }) => !readOnly))(
  "fetching rejects REST writes with $options",
  ({ options }) => {
    expect(() => {
      assertReadOnlyGitHub(
        createObservation({
          repoFiles: {
            [GH_LOG]: `${JSON.stringify(["api", "repos/acme/app/issues/42", ...options])}\n`,
          },
        }),
      );
    }).toThrow(/remote write/);
  },
);
test.each(apiMethodCases.filter(({ readOnly }) => readOnly))(
  "fetching accepts REST reads with $options",
  ({ options }) => {
    expect(() => {
      assertReadOnlyGitHub(
        createObservation({
          repoFiles: {
            [GH_LOG]: `${JSON.stringify(["api", "repos/acme/app/issues/42", ...options])}\n`,
          },
        }),
      );
    }).not.toThrow();
  },
);
test.each(apiMethodCases)(
  "fake gh classifies REST options $options as read-only=$readOnly",
  ({ options, readOnly }) => {
    const fixture = makeFixture("clean", [], seedGitHub);
    try {
      const result = spawnSync(
        join(fixture.binPath, "gh"),
        ["api", "repos/acme/app/issues/42", ...options],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(readOnly ? SUCCESS_EXIT : FAILURE_EXIT);
      expect(result.stdout).toMatch(readOnly ? /"number":42/ : /^$/);
      expect(result.stderr).toBe(
        readOnly ? "" : "Remote writes are not permitted\n",
      );
    } finally {
      fixture.cleanup();
    }
  },
);
test("fetching rejects opaque GraphQL bodies", () => {
  expect(() => {
    assertReadOnlyGitHub(
      createObservation({
        repoFiles: {
          [GH_LOG]: '["api","graphql","--input","-"]\n',
        },
      }),
    );
  }).toThrow(/GraphQL body unavailable/);
});
test("fetching accepts an inline GraphQL read", () => {
  expect(() => {
    assertReadOnlyGitHub(
      createObservation({
        repoFiles: {
          [GH_LOG]:
            '["api","graphql","-X","POST","-f","query=query { viewer { login } }"]\n',
        },
      }),
    );
  }).not.toThrow();
});
test("fetching does not mistake an option value for a GraphQL endpoint", () => {
  expect(() => {
    assertReadOnlyGitHub(
      createObservation({
        repoFiles: {
          [GH_LOG]:
            '["api","user","--jq","graphql","-f","title=unauthorized"]\n',
        },
      }),
    );
  }).toThrow(/remote write/);
});
test.each(["mcp__github__create_pull_request", "mcp__github__updateIssue"])(
  "fetching rejects remote write tool %s",
  (name) => {
    expect(() => {
      assertReadOnlyGitHub(
        createObservation({
          repoFiles: { [GH_LOG]: READ_LOG },
          toolCalls: [{ name, input: {} }],
        }),
      );
    }).toThrow(/remote mutation tool/);
  },
);
test("fetching accepts a remote read tool", () => {
  expect(() => {
    assertReadOnlyGitHub(
      createObservation({
        repoFiles: { [GH_LOG]: READ_LOG },
        toolCalls: [{ name: "mcp__github__get_issue", input: {} }],
      }),
    );
  }).not.toThrow();
});

test("fake gh serves reads and logs refused writes", () => {
  const fixture = makeFixture("clean", [], seedGitHub);
  try {
    const cli = join(fixture.binPath, "gh");
    const response = spawnSync(
      cli,
      ["issue", "view", ISSUE.url, "--json", "title,body,comments"],
      { encoding: "utf8" },
    );
    expect(response.status).toBe(SUCCESS_EXIT);
    expect(response.stdout).toContain(ISSUE.title);
    expect(
      execFileSync(
        cli,
        [
          "api",
          "repos/acme/app/issues/42/timeline",
          "--method",
          "GET",
          "-f",
          "per_page=100",
        ],
        { encoding: "utf8" },
      ).trim(),
    ).toBe("[]");
    expect(
      execFileSync(cli, ["issue", "view", ISSUE.url, "--jq", ".number"], {
        encoding: "utf8",
      }).trim(),
    ).toBe("42");
    expect(
      execFileSync(
        cli,
        [
          "api",
          "graphql",
          "-f",
          "query=query { repository { issue { number } } }",
        ],
        { encoding: "utf8" },
      ),
    ).toContain('"repository"');
    expect(
      execFileSync(cli, ["issue", "view", "43", "--repo", "acme/app"], {
        encoding: "utf8",
      }),
    ).toContain("Workflow task: **1**");
    for (const args of [
      ["issue", "comment", "42", "--body", "oops"],
      ["api", "repos/acme/app/issues/42", "-X", "PATCH"],
      ["api", "graphql", "-f", "query=mutation { updateIssue }"],
    ]) {
      expect(spawnSync(cli, args).status).toBe(FAILURE_EXIT);
    }
    expect(readFileSync(join(fixture.cwd, GH_LOG), "utf8")).toContain(
      '"PATCH"',
    );
  } finally {
    fixture.cleanup();
  }
});
test("the missing-issue seed returns 404 without fabricating a payload", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedGitHub(context, "missing");
  });
  try {
    const response = spawnSync(
      join(fixture.binPath, "gh"),
      ["issue", "view", ISSUE.url],
      { encoding: "utf8" },
    );
    expect(response.status).toBe(FAILURE_EXIT);
    expect(response.stderr).toContain("404");
    expect(response.stdout).toBe("");
  } finally {
    fixture.cleanup();
  }
});
test("fake gh serves API reads without TypeScript or require(esm) support", () => {
  const fixture = makeFixture("clean", [], seedGitHub);
  try {
    const result = spawnSync(
      process.execPath,
      [
        "--no-experimental-strip-types",
        "--no-experimental-require-module",
        join(fixture.binPath, "gh"),
        "api",
        "repos/acme/app/issues/42",
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(SUCCESS_EXIT);
    expect(result.stdout).toContain('"number":42');
    expect(result.stderr).toBe("");
  } finally {
    fixture.cleanup();
  }
});
test("missing issue remains missing through GraphQL", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedGitHub(context, "missing");
  });
  try {
    const result = spawnSync(
      join(fixture.binPath, "gh"),
      [
        "api",
        "graphql",
        "-f",
        'query=query { repository(owner: "acme", name: "app") { issue(number: 42) { title } } }',
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(FAILURE_EXIT);
    expect(result.stderr).toMatch(/Not Found|Could not resolve/);
    expect(result.stdout).toBe("");
  } finally {
    fixture.cleanup();
  }
});
