import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases } from "#/cases/clarifying-assumptions.ts";
import {
  CLARIFICATION_FACTS,
  COPY_EDIT_INPUTS,
} from "#/cases/clarifying-assumptions-fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import type { JudgeRequest } from "#/observation/judge.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const { judge } = vi.hoisted(() => ({
  judge: vi
    .fn<(request: JudgeRequest) => Promise<string>>()
    .mockResolvedValue("offline judge configuration checked"),
}));
vi.mock(import("#/observation/judge.ts"), () => ({ judgeLive: judge }));

const LAST = -1;
const SUCCESS = 0;
const FAILURE = 1;
const REVISION_TURN_COUNT = 4;
const APPROVAL_TURN_INDEX = 3;

function getCase(name: string): EvalCase {
  const candidate = cases.find(
    (entry) => entry.id === `clarifying-assumptions/${name}`,
  );
  assert.ok(candidate !== undefined);
  return candidate;
}

function structuralObservation(plan: string): Observation {
  return createObservation({
    finalText: "- RE_PLAN_NEEDED: true\n- BLOCKERS_PRESENT: false",
    turns: Array.from({ length: REVISION_TURN_COUNT }, (_, index) =>
      createTurn({
        name: index === APPROVAL_TURN_INDEX ? "confirm and revise" : "initial",
      }),
    ),
    repoFiles: {
      ...COPY_EDIT_INPUTS,
      [CLARIFICATION_FACTS.planPath]: plan,
      ".git/logs/HEAD": "initial\thead\tcommit (initial): initial commit\n",
    },
  });
}

const structuralSeed = COPY_EDIT_INPUTS[CLARIFICATION_FACTS.planPath] ?? "";
const structuralDecisionLog = `| Iteration | Scope | Item ID | Category | Outcome | Summary | Re-plan | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Plan-wide | PF1 | problem-framing | revised | Tenant administrators may export all tenant accounts, including other owners. | Yes | - |`;
const structuralPlan = structuralSeed.replace(
  "No accepted decisions yet.",
  structuralDecisionLog,
);

it("structural revision rejects unchanged seed files despite all turns and correct flags", () => {
  const observation = structuralObservation(structuralSeed);
  expect(observation.turns).toHaveLength(REVISION_TURN_COUNT);
  expect(() =>
    getCase("structural-revision-replans").check(observation),
  ).toThrow(/persisted decision/);
});

it("structural revision rejects an open audience question with unrelated new text", () => {
  const plan = structuralSeed.replace(
    "## Decisions Log",
    "Audit downloads should include a timestamp.\n## Decisions Log",
  );
  expect(() =>
    getCase("structural-revision-replans").check(structuralObservation(plan)),
  ).toThrow(/persisted decision/);
});

it.each([
  { name: "Decisions Log row", plan: structuralPlan },
  {
    name: "inline decision annotation",
    plan: structuralSeed.replace(
      "No default is approved.",
      "No default is approved. [DECISION PF1 — revised: Tenant administrators may export all tenant accounts, including other owners.]",
    ),
  },
  {
    name: "equivalent wording in a log row",
    plan: structuralPlan.replace(
      "Tenant administrators may export all tenant accounts, including other owners.",
      "A tenant's admins can download every account belonging to that tenant, not just their own.",
    ),
  },
])("structural revision accepts a persisted $name", ({ plan }) => {
  expect(() =>
    getCase("structural-revision-replans").check(structuralObservation(plan)),
  ).not.toThrow();
});

it("structural revision does not mistake a later section for the Decisions Log", () => {
  const plan = `${structuralSeed}\n## Proposed alternatives\n${structuralDecisionLog}\n`;
  expect(() =>
    getCase("structural-revision-replans").check(structuralObservation(plan)),
  ).toThrow(/persisted decision/);
});

it("only the structural revision sends persisted plan evidence to a judge", async () => {
  const candidate = getCase("structural-revision-replans");
  assert.ok(candidate.judge !== undefined);
  judge.mockClear();
  await candidate.judge(structuralObservation(structuralPlan));
  const [request] = judge.mock.calls.at(LAST) ?? [];
  assert.ok(request !== undefined);
  expect(request.artifact).toBe(`<main_plan>\n${structuralPlan}\n</main_plan>`);
  expect(request.knownFacts).toContain("including other owners");
  expect(request.rubric.map((item) => item.id)).toContain(
    "persisted-structural-decision",
  );
  expect(getCase("localized-copy-edit").judge).toBeUndefined();
});

const script = fileURLToPath(
  new URL(
    "../../../skills/clarifying-assumptions/scripts/validate-local-revision.py",
    import.meta.url,
  ),
);
const key = "acme-app-42";
const old = "recieve the audit download";
const replacement = "receive the audit download";
const before = `# Plan\n\n## Implementation notes\nUsers ${old}.\n`;

const SUFFIXES = {
  upfront: ["tasks", "stage-1-detailed", "stage-2-prioritized"],
  critique: [
    "tasks",
    "task-1-brief",
    "task-1-execution-plan",
    "task-1-test-spec",
    "task-1-refactoring-plan",
  ],
};
function extraChange(text: string, applies: boolean): string {
  return applies ? `${text}\n## Task 2: Delete data\n` : text;
}
function seedAfter(
  path: string,
  wrong: string,
  beforeText: string,
  [first, last]: readonly [string | undefined, string | undefined],
): string {
  if (wrong === "stale" && path === last) return beforeText;
  const text = beforeText.replace(old, replacement);
  return extraChange(text, wrong === "extra" && path === first);
}
function runRevision(
  mode: "upfront" | "critique",
  wrong: string,
  endings = { before: "\n", after: "\n" },
) {
  const root = mkdtempSync(join(tmpdir(), "local-revision-"));
  mkdirSync(join(root, "docs"));
  const beforeText = before.replaceAll("\n", endings.before);
  const paths = SUFFIXES[mode].map((suffix) => `docs/${key}-${suffix}.md`);
  for (const path of paths) writeFileSync(join(root, path), beforeText);
  const files = Object.fromEntries(
    paths.map((path) => [path, readFileSync(join(root, path), "utf8")]),
  );
  const [first] = paths;
  const last = paths.at(LAST);
  for (const path of paths) {
    const afterText = seedAfter(path, wrong, beforeText, [first, last]);
    writeFileSync(
      join(root, path),
      afterText.replaceAll(/\r?\n/g, endings.after),
    );
  }
  const evidence = Object.fromEntries(
    Object.entries(files).filter(
      ([path]) => wrong !== "missing" || path !== last,
    ),
  );
  try {
    return spawnSync("python3", ["-I", script, root, key, mode, "1"], {
      input: JSON.stringify({
        files: evidence,
        replacements: [{ old, new: replacement }],
      }),
      encoding: "utf8",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("localized revision evidence", () => {
  it.each(["upfront", "critique"] as const)(
    "validates all %s artifacts after an exact copy edit",
    (mode) => {
      const result = runRevision(mode, "");
      expect(result.status).toBe(SUCCESS);
      expect(result.stdout).toMatch(/^LOCAL_REVISION: PASS files=\d+\n$/);
    },
  );
  it("preserves CRLF bytes while applying the approved edit", () => {
    const result = runRevision("upfront", "", {
      before: "\r\n",
      after: "\r\n",
    });
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout).toBe("LOCAL_REVISION: PASS files=3\n");
  });
  it.each([
    { name: "LF to CRLF", before: "\n", after: "\r\n" },
    { name: "CRLF to LF", before: "\r\n", after: "\n" },
  ])("rejects an unapproved $name conversion", (endings) => {
    const result = runRevision("upfront", "", endings);
    expect(result.status).toBe(FAILURE);
    expect(result.stderr).toContain("stale artifact or unexpected edit");
  });
  it.each(["stale", "extra", "missing"])(
    "rejects %s artifact evidence",
    (wrong) => {
      expect(runRevision("critique", wrong).status).toBe(FAILURE);
    },
  );
});
