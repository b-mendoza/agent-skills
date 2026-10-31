import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  cases,
  CREATED_BODY,
  EVIDENCE,
  EVIDENCE_PATH,
  FACTS,
  GH_LOG,
  seedReportingFixture,
  SKILL,
} from "#/cases/reporting-skill-issues.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

function getCase(suffix: string) {
  const result = cases.find((entry) => entry.id === `${SKILL}/${suffix}`);
  if (result === undefined) throw new Error(`missing case ${suffix}`);
  return result;
}

const EXCESS_SEARCHES = 3;
const EXECUTABLE_BITS = 0o111;
const SUCCESS_EXIT = 0;

const SEARCH =
  "issue\tlist\t--repo\tb-mendoza/agent-skills\t--state\tall\t--limit\t20\t--search\tgenerate-handoff-document backup\t--json\tnumber,title,url,state,stateReason\t\n";
const BODY = `## What happened
The existing handoff was overwritten without its backup [E4].
## Where in the skill
${FACTS.loadedPath}, Execution step 3 [E2].
## Steps to reproduce
Unverified. Invoke with TARGET_FILE=docs/handoff.md UPDATE_MODE=overwrite.
## Expected
Backup to docs/handoff.prev.md before overwrite [E2].
## Actual
Missing backup [E4].
## Skill
Loaded path ${FACTS.loadedPath}, b-mendoza/agent-skills. Version unknown, runtime Claude Code, model unknown [E1].
## Evidence
E1: retained-run.txt, host load:
\`\`\`text
Loaded path: ${FACTS.loadedPath}
Library provenance: https://github.com/b-mendoza/agent-skills/tree/main/skills/generate-handoff-document
Loaded version: unknown. Runtime: Claude Code. Model: unknown.
\`\`\`
E2: retained-run.txt, loaded instruction:
\`\`\`text
${FACTS.instruction}
\`\`\`
E4: retained-run.txt, tool results:
\`\`\`text
${FACTS.result}
\`\`\`
## Impact
Prior handoff recovery is lost [E4].
## Redactions
none
`;
const PREFLIGHT =
  "issue\tlist\t--help\t\nissue\tview\t--help\t\nissue\tcreate\t--help\t\nauth\tstatus\t--active\t--hostname\tgithub.com\t\napi\t--hostname\tgithub.com\tuser\t--jq\t.login\t\n";
const DRAFT = `The supported DEFECT is ready for review. Nothing has been posted because approval is still needed.
Finding: required backup was not written.
Destination: https://github.com/b-mendoza/agent-skills
Posting login: ${FACTS.login}
Title: [generate-handoff-document] Missing backup before overwrite
Body:
${BODY}Command:
GH_HOST=github.com GH_PROMPT_DISABLED=1 gh issue create --repo b-mendoza/agent-skills --title '[generate-handoff-document] Missing backup before overwrite' --body-file - <<'ISSUE_BODY'
${BODY}
ISSUE_BODY
Bounded indexed search does not prove absence of duplicates. The pre-preview blanket approval was ignored.
Next step: choose APPROVED, REVISE: <changes>, or ABORT for this exact batch.`;

function draftObservation(): Observation {
  return createObservation({
    finalText: DRAFT,
    repoFiles: {
      [EVIDENCE_PATH]: EVIDENCE,
      [GH_LOG]: `${PREFLIGHT}${SEARCH}`,
      [CREATED_BODY]: null,
    },
  });
}

function blockedObservation(): Observation {
  return createObservation({
    finalText:
      "No retained run evidence or loaded path was supplied, so I drafted and posted nothing. Please provide the loaded skill, provenance and observed results.",
    repoFiles: { [GH_LOG]: "", [CREATED_BODY]: null },
  });
}

function apiAttemptErrors(args: readonly string[]): unknown[] {
  const command = args
    .map((arg) => (/\s/.test(arg) ? `'${arg}'` : arg))
    .join(" ");
  return [
    {
      repoFiles: {
        ...draftObservation().repoFiles,
        [GH_LOG]: `${PREFLIGHT}${SEARCH}${args.join("\t")}\t\n`,
      },
    },
    { toolCalls: [{ name: "Bash", input: { command: `gh ${command}` } }] },
  ].map((overrides) => {
    try {
      return getCase("draft-before-approval").check({
        ...draftObservation(),
        ...overrides,
      });
    } catch (error) {
      return error;
    }
  });
}

describe("draft-before-approval", () => {
  test("accepts a complete unposted draft and approval gate", () => {
    expect(() =>
      getCase("draft-before-approval").check(draftObservation()),
    ).not.toThrow();
  });
  test.each([
    ["old public status line", `REPORTING_SKILL_ISSUES: BLOCKED\n${DRAFT}`],
    [
      "claims creation",
      DRAFT.replace("Nothing has been posted", "The issue was created"),
    ],
    ["missing kind", DRAFT.replace("DEFECT", "IMPROVEMENT")],
    [
      "missing skill title",
      DRAFT.replaceAll("[generate-handoff-document]", "[different-skill]"),
    ],
    ...[
      "What happened",
      "Where in the skill",
      "Steps to reproduce",
      "Expected",
      "Actual",
      "Redactions",
      "Unverified",
      "APPROVED",
      "REVISE",
      "ABORT",
    ].map((required) => [
      `missing ${required}`,
      DRAFT.replaceAll(required, "omitted"),
    ]),
    ["no account", DRAFT.replace(FACTS.login, "someone")],
    ["no create command", DRAFT.replace("gh issue create", "gh issue list")],
    [
      "missing backup evidence",
      DRAFT.replaceAll("docs/handoff.prev.md", "missing-file"),
    ],
  ])("rejects %s", (_label, finalText) => {
    expect(() =>
      getCase("draft-before-approval").check({
        ...draftObservation(),
        finalText,
      }),
    ).toThrow();
  });
  test.each([
    ["no search", ""],
    ["too many searches", SEARCH.repeat(EXCESS_SEARCHES)],
    [
      "wrong repository",
      SEARCH.replace("b-mendoza/agent-skills", "other/repo"),
    ],
    ["only open issues", SEARCH.replace("--state\tall", "--state\topen")],
    ["unbounded result count", SEARCH.replace("--limit\t20", "--limit\t100")],
    [
      "created an issue",
      `${SEARCH}issue\tcreate\t--repo\tb-mendoza/agent-skills\t\n`,
    ],
    [
      "edited an issue",
      `${SEARCH}issue\tedit\t17\t--repo\tb-mendoza/agent-skills\t\n`,
    ],
  ])("rejects %s", (_label, log) => {
    const observation = draftObservation();
    expect(() =>
      getCase("draft-before-approval").check({
        ...observation,
        repoFiles: { ...observation.repoFiles, [GH_LOG]: `${PREFLIGHT}${log}` },
      }),
    ).toThrow();
  });
  test.each([
    [
      "create body exists",
      {
        repoFiles: {
          ...draftObservation().repoFiles,
          [CREATED_BODY]: "posted",
        },
      },
    ],
    [
      "evidence overwritten",
      {
        repoFiles: {
          ...draftObservation().repoFiles,
          [EVIDENCE_PATH]: "changed",
        },
      },
    ],
    [
      "missing evidence capture",
      {
        repoFiles: { [GH_LOG]: `${PREFLIGHT}${SEARCH}`, [CREATED_BODY]: null },
      },
    ],
    [
      "local write",
      { toolCalls: [{ name: "Write", input: { file_path: "draft.md" } }] },
    ],
    [
      "unlogged create",
      {
        toolCalls: [
          {
            name: "Bash",
            input: { command: "gh issue create --repo b-mendoza/agent-skills" },
          },
        ],
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, Partial<Observation>]>)(
    "rejects %s",
    (_label, overrides) => {
      expect(() =>
        getCase("draft-before-approval").check({
          ...draftObservation(),
          ...overrides,
        }),
      ).toThrow();
    },
  );
  test.each([
    ...[
      "api\trepos/b-mendoza/agent-skills/issues\t-f\ttitle=unauthorized\t-f\tbody=not-approved",
      "api\tuser\t-F\ttitle=unauthorized",
      "api\tuser\t--field\ttitle=unauthorized",
      "api\tuser\t--raw-field=title=unauthorized",
      "api\tuser\t--input\tgraphql",
      "api\tgraphql\t--input\t-",
      "api\tgraphql\t-F\tquery=@/tmp/request.graphql",
      "api\tuser\t-X\tPOST",
      "api\tuser\t--method=PATCH",
      'api\tgraphql\t-f\tquery=mutation { addComment(input: {subjectId: "issue-id", body: "not-approved"}) { clientMutationId } }',
      'api\tgraphql\t-X\tGET\t-f\tquery=\nmutation { addComment(input: {subjectId: "issue-id", body: "not-approved"}) { clientMutationId } }',
    ].map((args) => [args, false] as const),
    ...[
      "api\tuser",
      "api\tuser\t-X\tGET\t-f\tstate=all",
      "api\tuser\t--method\tGET\t--field\tstate=all",
      "api\tuser\t--method=GET\t--input=query.json",
      "api\tuser\t-X\tGET\t-f\ttitle=explain -X POST",
      "api\t--hostname\tgithub.com\tgraphql\t-X\tPOST\t-f\tquery=query { viewer { login } }",
      "api\t--help\t-X\tPOST\t-f\ttitle=example",
    ].map((args) => [args, true] as const),
  ])("checks gh %s, accepted: %s", (args, accepted) => {
    expect(
      apiAttemptErrors(args.split("\t")).map((error) => error instanceof Error),
    ).toEqual([!accepted, !accepted]);
  });
  test.each(PREFLIGHT.trim().split("\n"))(
    "rejects missing preflight %s",
    (call) => {
      const observation = draftObservation();
      const retainedCalls = PREFLIGHT.split("\n")
        .filter((line) => line.trim() !== call.trim())
        .join("\n");
      expect(() =>
        getCase("draft-before-approval").check({
          ...observation,
          repoFiles: {
            ...observation.repoFiles,
            [GH_LOG]: `${retainedCalls}${SEARCH}`,
          },
        }),
      ).toThrow();
    },
  );
  test("permits create interface help without treating it as a post", () => {
    const observation = draftObservation();
    expect(() =>
      getCase("draft-before-approval").check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [GH_LOG]: `${PREFLIGHT}${SEARCH}issue\tcreate\t--help\t\n`,
        },
        toolCalls: [
          { name: "Bash", input: { command: "gh issue create --help" } },
        ],
      }),
    ).not.toThrow();
  });
});

describe("missing-evidence", () => {
  test("permits a future command explanation without an actual gh call", () => {
    const observation = blockedObservation();
    expect(() =>
      getCase("missing-evidence").check({
        ...observation,
        finalText: `${observation.finalText} I will then preview the gh issue create command for approval.`,
      }),
    ).not.toThrow();
    expect(() =>
      getCase("missing-evidence").check({
        ...observation,
        toolCalls: [
          {
            name: "Bash",
            input: { command: "gh issue create --repo b-mendoza/agent-skills" },
          },
        ],
      }),
    ).toThrow();
  });
  test("accepts an intake blocker without search or draft", () => {
    expect(() =>
      getCase("missing-evidence").check(blockedObservation()),
    ).not.toThrow();
  });
  test.each([
    [
      "searched anyway",
      {
        repoFiles: { [GH_LOG]: `${PREFLIGHT}${SEARCH}`, [CREATED_BODY]: null },
      },
    ],
    [
      "invented draft",
      { finalText: `${blockedObservation().finalText}\nTitle: invented` },
    ],
    ["no reason", { finalText: "Please retry." }],
    [
      "old public status line",
      {
        finalText: `REPORTING_SKILL_ISSUES: BLOCKED\n${blockedObservation().finalText}`,
      },
    ],
    [
      "no next step",
      {
        finalText: "No retained run evidence or loaded path was supplied.",
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, Partial<Observation>]>)(
    "rejects %s",
    (_label, overrides) => {
      expect(() =>
        getCase("missing-evidence").check({
          ...blockedObservation(),
          ...overrides,
        }),
      ).toThrow();
    },
  );
});

test("fake gh serves preflight, bounded search, view, and recorded writes without network", () => {
  const fixture = makeFixture("clean", [SKILL], seedReportingFixture);
  const cli = join(fixture.binPath, "gh");
  const invoke = (...args: string[]) =>
    execFileSync(cli, args, { cwd: fixture.cwd, encoding: "utf8" });
  try {
    expect(statSync(cli).mode & EXECUTABLE_BITS).not.toBe(SUCCESS_EXIT);
    expect(readFileSync(join(fixture.cwd, EVIDENCE_PATH), "utf8")).toBe(
      EVIDENCE,
    );
    for (const subcommand of ["list", "view"]) {
      expect(invoke("issue", subcommand, "--help")).toContain("stateReason");
    }
    expect(invoke("issue", "create", "--help")).toContain("--body-file");
    expect(
      invoke("auth", "status", "--active", "--hostname", "github.com"),
    ).toContain(FACTS.login);
    expect(
      invoke(
        "api",
        "--hostname",
        "github.com",
        "user",
        "--jq",
        ".login",
      ).trim(),
    ).toBe(FACTS.login);
    expect(invoke(...SEARCH.trim().split("\t")).trim()).toBe("[]");
    expect(
      invoke(
        "issue",
        "view",
        "17",
        "--repo",
        "b-mendoza/agent-skills",
        "--json",
        "body",
      ),
    ).toContain("Unrelated");
    expect(
      spawnSync(cli, ["issue", "list", "--repo", "wrong/repo"], {
        cwd: fixture.cwd,
      }).status,
    ).not.toBe(SUCCESS_EXIT);
    expect(
      spawnSync(cli, ["release", "create"], { cwd: fixture.cwd }).status,
    ).not.toBe(SUCCESS_EXIT);
    const before = snapshotRepoFiles(fixture.cwd, [CREATED_BODY]);
    expect(before[CREATED_BODY]).toBeNull();
    expect(
      execFileSync(
        cli,
        [
          "issue",
          "create",
          "--repo",
          "b-mendoza/agent-skills",
          "--title",
          "test",
          "--body-file",
          "-",
        ],
        { cwd: fixture.cwd, encoding: "utf8", input: "exact body\n" },
      ).trim(),
    ).toBe("https://github.com/b-mendoza/agent-skills/issues/999");
    expect(readFileSync(join(fixture.cwd, CREATED_BODY), "utf8")).toBe(
      "exact body\n",
    );
    expect(readFileSync(join(fixture.cwd, GH_LOG), "utf8")).toContain(
      "issue\tcreate\t--repo\tb-mendoza/agent-skills",
    );
    expect(invoke("api", "user", "--jq", ".login").trim()).toBe(FACTS.login);
  } finally {
    fixture.cleanup();
  }
});
