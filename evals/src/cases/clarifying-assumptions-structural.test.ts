import assert from "node:assert/strict";

import { expect, it, vi } from "vitest";

import {
  getCase,
  structuralDecisionLog,
  structuralObservation,
  structuralPlan,
  structuralSeed,
} from "#/cases/clarifying-assumptions-test-support.ts";
import type { JudgeRequest } from "#/observation/judge.ts";

const { judge } = vi.hoisted(() => ({
  judge: vi
    .fn<(request: JudgeRequest) => Promise<string>>()
    .mockResolvedValue("offline judge configuration checked"),
}));
vi.mock(import("#/observation/judge.ts"), () => ({ judgeLive: judge }));

const LAST = -1;
const REVISION_TURN_COUNT = 4;

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
  ...["confirmed", "revised", "skipped", "resolved", "override", "blocked"].map(
    (outcome) => ({
      name: `${outcome} outcome cell`,
      plan: structuralPlan.replace("| revised |", `| ${outcome} |`),
    }),
  ),
  {
    name: "log row with ordinary cell whitespace",
    plan: structuralPlan.replace(
      /^\| 1 \|.*$/m,
      "  |\t1 | Plan-wide\t| PF1 | problem-framing |\trevised\t| Tenant administrators may export all tenant accounts, including other owners. | Yes | -\t|  ",
    ),
  },
  {
    name: "log row with a GFM-escaped pipe",
    plan: structuralPlan.replace(
      /^\| 1 \|.*$/m,
      "  |\t1 | Plan-wide\t| PF1 | problem-framing |\trevised\t| Tenant admins \\| owners may export all tenant accounts, including other owners. | Yes | -\t|  ",
    ),
  },
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

it.each([
  { name: "neither outer pipe", leading: "", trailing: "" },
  { name: "only a leading pipe", leading: "|", trailing: "" },
  { name: "only a trailing pipe", leading: "", trailing: "|" },
  { name: "both outer pipes", leading: "|", trailing: "|" },
])(
  "structural revision accepts a log row with $name",
  ({ leading, trailing }) => {
    const plan = structuralPlan.replace(
      /^\| 1 \|.*$/m,
      (row) => `${leading}${row.replace(/^\||\|$/g, "")}${trailing}`,
    );
    expect(() =>
      getCase("structural-revision-replans").check(structuralObservation(plan)),
    ).not.toThrow();
  },
);

it.each([
  {
    name: "missing outcome",
    row: "| 1 | Plan-wide | PF1 | problem-framing | | Tenant administrators may export all tenant accounts. | Yes | - |",
  },
  {
    name: "unresolved outcome",
    row: "| 1 | Plan-wide | PF1 | problem-framing | unresolved | Should tenant administrators export all tenant accounts? | Yes | - |",
  },
  {
    name: "outcome word in another cell",
    row: "| 1 | Plan-wide | PF1 | problem-framing | unresolved | revised | Yes | - |",
  },
  {
    name: "missing column",
    row: "| 1 | Plan-wide | PF1 | problem-framing | revised | Tenant administrators may export all tenant accounts. | Yes |",
  },
])("structural revision rejects a log row with $name", ({ row }) => {
  const plan = structuralPlan.replace(/^\| 1 \|.*$/m, row);
  expect(() =>
    getCase("structural-revision-replans").check(structuralObservation(plan)),
  ).toThrow(/persisted decision/);
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
