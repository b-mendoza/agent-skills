import { execFileSync } from "node:child_process";

import { expect, test } from "vitest";

import { ROUTING_TIER } from "#/cases/case-contract.ts";
import { getCase } from "#/cases/registry.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const SKILL = "committing-scoped-changes";
const BEHAVIORAL_IDS = [
  "plan-only",
  "commit-but-not-yet",
  "plan-only-follow-up",
];
const SKILL_CALL = { name: "Skill", input: { skill: SKILL } };
const CLOSE =
  "Plan only. No commits made. No verification commands ran. To commit, make a new commit request; I'll prepare a fresh plan for approval.";
const NO_GATE =
  "No approval gate is open. No commits made. Ask me to commit if you want a fresh plan. Nothing was pushed.";
const PLAN = `### Group 1
**Message:** fix: replace the greeting with goodbye
**Paths:** \`a.txt\`
- Expansions: none
- Verification: \`sh check.sh\`
- Omissions: none
- Warnings: none
Each distinct command runs once on the shared worktree, not on isolated commit trees.`;
const REFLOG = "initial reflog\n";
const VERIFICATION_LOG = ".git/eval-verification.log";

function planTurn(text = `${PLAN}\n\n${CLOSE}`) {
  return createTurn({ finalText: text, toolCalls: [SKILL_CALL] });
}

function approveTurn(overrides: Parameters<typeof createTurn>[0] = {}) {
  return createTurn({
    name: "approve-after-plan-only",
    prompt: "approve",
    finalText: NO_GATE,
    ...overrides,
  });
}

function observation(id: string, text?: string): Observation {
  const initial = planTurn(text);
  const hasFollowUp = id === "plan-only-follow-up";
  return createObservation({
    finalText: hasFollowUp ? NO_GATE : initial.finalText,
    toolCalls: [SKILL_CALL],
    turns: hasFollowUp ? [initial, approveTurn()] : [initial],
    repoFiles: {
      "a.txt": "goodbye\n",
      "unrelated.txt": "unrelated staged work\n",
      "AGENTS.md":
        "For changes to a.txt, the verification command is `sh check.sh`.\n",
      "check.sh": `printf 'ran\\n' >> .git/eval-verification.log
grep -qx goodbye a.txt
`,
      ".git/logs/HEAD": REFLOG,
      ".git/eval-baseline-reflog": REFLOG,
      [VERIFICATION_LOG]: null,
    },
  });
}

test("a plan-only request is a positive tier-1 route", () => {
  const selected = getCase(`${SKILL}/trigger-plan-only`);
  expect(selected.tier).toBe(ROUTING_TIER);
  expect(selected.check(createObservation({ toolCalls: [SKILL_CALL] }))).toBe(
    "Skill invoked",
  );
  expect(() => selected.check(createObservation())).toThrow(
    /skill never triggered/,
  );
});

test.each(BEHAVIORAL_IDS)(
  "%s accepts an accurate plan with no approval or execution",
  (id) => {
    const selected = getCase(`${SKILL}/${id}`);
    expect(selected.mutationPolicy).toBe("read-only");
    expect(() => selected.check(observation(id))).not.toThrow();
  },
);

test.each([
  {
    text: PLAN.replace("`a.txt`", "`a.txt`, `unrelated.txt`"),
    problem: /paths/i,
  },
  {
    text: PLAN.replace("replace the greeting with goodbye", "change timeout"),
    problem: /message/i,
  },
  { text: PLAN.replace("- Omissions: none\n", ""), problem: /omissions/i },
  {
    text: `${PLAN}\nReply approve, revise: <what to change>, or stop.`,
    problem: /approval/i,
  },
  { text: `${PLAN}\nWould you like me to proceed?`, problem: /approval/i },
  { text: `Phase 3/4 - Gate\n${PLAN}`, problem: /approval/i },
  {
    text: `${PLAN}\n\`sh check.sh\` exited 0 and passed.`,
    problem: /verification/i,
  },
  { text: `PLANNED_ONLY\n${PLAN}`, problem: /status/i },
])("rejects misleading plan text: $problem", ({ text, problem }) => {
  const selected = getCase(`${SKILL}/plan-only`);
  expect(() =>
    selected.check(observation("plan-only", `${text}\n\n${CLOSE}`)),
  ).toThrow(problem);
});

test.each([
  "sh check.sh",
  "git diff HEAD --check -- a.txt",
  "git --literal-pathspecs diff HEAD --check -- a.txt",
])("rejects %s even without a verification log", (command) => {
  const selected = getCase(`${SKILL}/plan-only`);
  const base = observation("plan-only");
  const wrong = {
    ...base,
    toolCalls: [...base.toolCalls, { name: "Bash", input: { command } }],
  };
  expect(() => selected.check(wrong)).toThrow(/verification command/i);
});

test.each([
  { path: "a.txt", content: "changed\n" },
  { path: "unrelated.txt", content: "changed\n" },
  { path: ".git/logs/HEAD", content: `${REFLOG}new commit\n` },
  { path: VERIFICATION_LOG, content: "ran\n" },
])("rejects changed snapshot evidence: $path", ({ path, content }) => {
  const selected = getCase(`${SKILL}/plan-only`);
  const base = observation("plan-only");
  expect(() =>
    selected.check({
      ...base,
      repoFiles: { ...base.repoFiles, [path]: content },
    }),
  ).toThrow();
});

const FROZEN_SCOPE = "### Resolved scope (frozen):\n- `a.txt`";
const APPROVAL =
  "Reply `approve` to commit this group, `revise: <what to change>`, or `stop`. No commits have been made.";

function frozenObservation(plan: string, scope = FROZEN_SCOPE): Observation {
  const text = `${scope}\n\n${plan}\n\n${APPROVAL}`;
  const base = observation("frozen-exclusion-plan", text);
  const collector = {
    name: "Bash",
    input: {
      command: `python3 -I "$SKILL_DIR/scripts/collect-state.py" resolve-scope '--all' '--exclude=unrelated.txt'`,
    },
    result: { content: "a.txt\n", isError: false, truncated: false },
  };
  return {
    ...base,
    toolCalls: [...base.toolCalls, collector],
    turns: [
      createTurn({ finalText: text, toolCalls: [SKILL_CALL, collector] }),
    ],
    repoFiles: {
      ...base.repoFiles,
      "check.sh": `${base.repoFiles?.["check.sh"]}grep -qx compatible unrelated.txt\n`,
      "unrelated.txt": "compatible\nunrelated staged work\n",
    },
  };
}

test("exclusion approval shows the frozen list and only its eligible path", () => {
  const selected = getCase(`${SKILL}/frozen-exclusion-plan`);
  expect(() => selected.check(frozenObservation(PLAN))).not.toThrow();
});

test.each([
  {
    defect: "declared expansion",
    plan: PLAN.replace("`a.txt`", "`a.txt` `unrelated.txt`").replace(
      "Expansions: none",
      "Expansions: unrelated.txt",
    ),
    problem: /expansions/i,
  },
  {
    defect: "undeclared path",
    plan: PLAN.replace("`a.txt`", "`a.txt` `unrelated.txt`"),
    problem: /paths/i,
  },
  {
    defect: "missing frozen scope",
    plan: PLAN,
    scope: "",
    problem: /frozen scope/i,
  },
])("rejects a frozen plan with $defect", ({ plan, scope, problem }) => {
  const selected = getCase(`${SKILL}/frozen-exclusion-plan`);
  expect(() => selected.check(frozenObservation(plan, scope))).toThrow(problem);
});

const UNSUPPORTED_REPLIES = [
  {
    id: "unsupported-intake",
    stops: true,
    reply:
      "I cannot amend commits or rewrite history. No commits made. If you want a new local commit instead, ask for one.",
  },
  {
    id: "unsupported-intake-granularity",
    stops: false,
    reply: `There is no granularity setting. I'll show the proposed grouping; at commit approval, use \`revise: <change>\` to adjust it.\n\n${PLAN}\n\n${APPROVAL}`,
  },
];

test.each(UNSUPPORTED_REPLIES)(
  "$id states the limit and takes the expected route",
  ({ id, reply }) => {
    expect(() =>
      getCase(`${SKILL}/${id}`).check(observation(id, reply)),
    ).not.toThrow();
  },
);

test.each(UNSUPPORTED_REPLIES.filter(({ stops }) => stops))(
  "$id must not open commit approval",
  ({ id, reply }) => {
    expect(() =>
      getCase(`${SKILL}/${id}`).check(
        observation(id, `${reply}\n\n${PLAN}\n\n${APPROVAL}`),
      ),
    ).toThrow(/approval/i);
  },
);

test("a granularity preference does not stop instead of showing the plan", () => {
  const id = "unsupported-intake-granularity";
  expect(() =>
    getCase(`${SKILL}/${id}`).check(
      observation(id, "There is no granularity setting. No commits made."),
    ),
  ).toThrow(/approval/i);
});

test("bare approve is sent but cannot dispatch a stale plan", () => {
  const id = "plan-only-follow-up";
  const selected = getCase(`${SKILL}/${id}`);
  expect(
    selected.followUps?.map(({ reply }) => reply(observation("plan-only"))),
  ).toEqual([{ reply: "approve" }]);
  const staleDispatch = approveTurn({
    toolCalls: [
      {
        name: "Agent",
        input: { prompt: "scoped-commit-executor; APPROVED_GROUP: old plan" },
      },
    ],
  });
  expect(() =>
    selected.check({ ...observation(id), turns: [planTurn(), staleDispatch] }),
  ).toThrow(/approve.*tool/i);
});

test("rejects HEAD movement despite an unchanged reflog", () => {
  const id = "plan-only-follow-up";
  const selected = getCase(`${SKILL}/${id}`);
  const committed = approveTurn({
    gitHeadAfter: { kind: "head", oid: "different commit" },
  });
  expect(() =>
    selected.check({ ...observation(id), turns: [planTurn(), committed] }),
  ).toThrow(/HEAD/);
});

test("fixture snapshots detect an actual verification run", () => {
  const selected = getCase(`${SKILL}/plan-only`);
  const fixture = makeFixture(selected.fixture, [SKILL], selected.seed);
  try {
    const capture = () =>
      snapshotRepoFiles(fixture.cwd, selected.snapshotPaths ?? []);
    const base = observation("plan-only");
    const before = capture();
    expect(before).toHaveProperty([VERIFICATION_LOG], null);
    expect(() => selected.check({ ...base, repoFiles: before })).not.toThrow();
    execFileSync("sh", ["check.sh"], { cwd: fixture.cwd });
    expect(capture()).toHaveProperty([VERIFICATION_LOG], "ran\n");
    expect(() => selected.check({ ...base, repoFiles: capture() })).toThrow(
      /verification/i,
    );
  } finally {
    fixture.cleanup();
  }
});
