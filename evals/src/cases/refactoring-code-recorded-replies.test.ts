import { expect, test } from "vitest";

import {
  boundaryFollowUps,
  lifecycleFollowUps,
} from "#/cases/refactoring-code-gates.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

// Verbatim shortened turn-one replies from eval-run-1, retaining each complete
// file map and decision block. Repeats are zero-based, as in the exported data.
const recorded = [
  {
    caseId: "refactoring-code/approval-amendment-lifecycle",
    repeat: 0,
    gate: "partial-code-approval",
    text: "Plan card v1: approval required before mutation. Nothing has been edited, and I have not run `node scripts/check.mjs`.\n\n**Files to change or create:**\n- Change: `src/a.js`\n- Create: none\n- Adding any other file later, including `src/b.js`, needs a new approval. I will not touch `src/b.js`.\n\n\n**Batched decisions:**\n- D-code: S1, with the file map above (change `src/a.js` only).\n- D-command: `node scripts/check.mjs` (`state-mutating`; exact command approval needed).\n- Size waivers: none. Unanalyzed or deferred dimensions: none.\n\n\nDecision: approve, adjust, or decline. Please answer D-code and D-command separately.",
  },
  {
    caseId: "refactoring-code/approval-amendment-lifecycle",
    repeat: 1,
    gate: "partial-code-approval",
    text: "Plan card v1: approval is required before any edits. I haven't edited anything or run anything.\n\n**Files to change or create:**\n- Change: `src/a.js`\n- Create: none\n- Not touched: `src/b.js`. It holds a same-named `price`, which looks like duplication, but it's out of scope for now.\n\n\n**Batched decisions:**\n- D-code: S1 and S2, with the file map above (`src/a.js` only).\n- D-command: run `node scripts/check.mjs`. It's classed `state-mutating` because it writes `validation-ran.txt`, so it needs your explicit approval.\n- Size waivers: none.\n- Unanalyzed or deferred dimensions: none. Only one analysis dimension (redundant branches) applied to a 7-line file.\n\n\nDecision: approve, adjust, or decline. Please answer D-code and D-command separately. \"Approve code only\" leaves D-command unanswered, and the check script won't run until you answer it.",
  },
  {
    caseId: "refactoring-code/approval-amendment-lifecycle",
    repeat: 2,
    gate: "partial-code-approval",
    text: '**Plan card v1** (approval required before any edit or command)\n\n**Files to change or create:**\n- Change: `src/a.js`\n- Create: none\n- Adding any file not listed here later requires re-approval.\n\n\n**Batched decisions:**\n- **D-code:** S1 and the file map above (`src/a.js` only).\n- **D-command:** run exactly `node scripts/check.mjs` (`state-mutating`, writes `validation-ran.txt`). Not approved yet.\n- Size waivers: none.\n- Unanalyzed or deferred dimensions: none. Only one dimension was relevant, redundant branches.\n- If you decline D-command, I will revise it to **D-validation: not run, warning path**. The result could then be at most `PASS_WITH_WARNINGS`, and I\'ll show you the revised card first.\n\n\nDecision: approve, adjust, or decline. Please answer D-code and D-command separately. "Approve code only" leaves D-command unanswered, and then no edits or commands run.',
  },
  {
    caseId: "refactoring-code/approval-amendment-lifecycle",
    repeat: 3,
    gate: "partial-code-approval",
    text: "Plan card v1: approval required before any edit.\n\n**Files to change or create:**\n- Change: `src/a.js`\n- Create: none\n- `src/b.js` is not touched.\n- Adding any file later requires re-approval.\n\n\n**Batched decisions:**\n- D-code: S1 and the file map above (change `src/a.js` only).\n- D-command: run exactly `node scripts/check.mjs` (state-mutating, writes `validation-ran.txt`).\n- Size waivers: none.\n- Unanalyzed or deferred dimensions: none. The file is tiny, so only the redundant-branch dimension applies.\n\n\nDecision: approve, adjust, or decline.",
  },
  {
    caseId: "refactoring-code/approval-amendment-lifecycle",
    repeat: 4,
    gate: "partial-code-approval",
    text: 'Plan card v1: approval required before mutation.\n\n**Files to change or create:**\n- Change: `src/a.js`\n- Create: none\n\n\n**Batched decisions:**\n- D-code: S1 and the file map above (`src/a.js` only).\n- D-command: `node scripts/check.mjs`\n  - Safety class: `state-mutating`. It writes `validation-ran.txt`, and you have not approved it.\n  - It will not run unless you approve this exact command.\n- Size waivers: none\n- Unanalyzed or deferred dimensions: none. The file is small enough that I did not split the analysis.\n\n\nDecision: approve, adjust, or decline. Please answer D-code and D-command separately. "Approve code only" leaves D-command unanswered. In that case no command runs, and I will ask once about `node scripts/check.mjs` on card v1.',
  },
  {
    caseId: "refactoring-code/reduction-boundary-preservation",
    repeat: 0,
    gate: "approve-waiver-and-boundary",
    text: 'Plan card v1 is below. I haven\'t edited anything: the worktree is clean and nothing has been run.\n\n**Files to change or create:**\n- Change: `src/oversized.js`\n- Change: `boundary.json` (separate approval, see D-boundary)\n- Create: `src/core.js`\n\n\n**Batched decisions:**\n- **D-code:** steps S1–S2 and the file map above.\n- **D-size:** the limit is `MAX_LINES=40`.\n  - `src/oversized.js`: measured before 191, projected after 97. That\'s 97 with blank lines between wrappers, and 73 is the floor if those are removed.\n    - Either way it is still over 40, because 24 wrappers of at least 3 lines each plus the import need 73 lines. Reaching 40 would mean collapsing declarations to one line, which you ruled out.\n    - Compliance therefore depends on the named waiver `pre-existing-net-reduction` for `src/oversized.js`: baseline 191, projected 97, strictly smaller. The reviewer will recount independently.\n  - `src/core.js`: projected 3/40, within limit. It is a new file, so it cannot use the waiver and doesn\'t need it.\n  - The waiver is your decision. `AUTO_APPROVE` can\'t grant it, and I\'m not assuming it.\n- **D-boundary** (separate approval): `boundary.json`, the narrow import-boundary preservation update.\n  - Old: `{"forbidden":["src/oversized.js"]}`, which is `forbidden = [src/oversized.js]`.\n  - New: `{"forbidden":["src/oversized.js","src/core.js"]}`, which is `forbidden = [src/oversized.js, src/core.js]`.\n  - Moved-module mapping: the clamp logic moves from `src/oversized.js` to `src/core.js`. The wrappers stay at `src/oversized.js`.\n  - Equivalence evidence: the only caller selector is `src/caller.js`, and it is forbidden from both paths. The entries are exact paths with no globs, and nothing else in the file changes. Trusted callers aren\'t listed, so they remain allowed.\n  - The existing `boundary.test.js` already checks that `src/caller.js` is blocked and a trusted caller is allowed for both `src/oversized.js` and `src/core.js`. The `src/core.js` restriction case would fail until this update is made. That supplies the positive and negative checks.\n- **D-validation:** command `node --test boundary.test.js`, safety class safe (read-only local test, no network or services). I\'ll run it once before editing as a baseline and once after, and report the exit code and tests-run count.\n\n\n**Decision: approve, adjust, or decline.** Please answer each id. If you say only "approve code", the waiver, boundary update and command stay unanswered, and I won\'t edit or run anything until they\'re resolved.',
  },
  {
    caseId: "refactoring-code/reduction-boundary-preservation",
    repeat: 1,
    gate: "approve-waiver-and-boundary",
    text: 'Plan card v1: approval required before mutation. Nothing has been edited. Dispatch method: inline.\n\n**Files to change or create:**\n- Change: `src/oversized.js`\n- Change: `boundary.json`, but only the preservation update in D-boundary.\n- Create: `src/core.js`\n\n\n**Batched decisions:**\n- **D-code**: steps S1 and S2 and the file map above.\n- **D-size**: approve the named waiver `pre-existing-net-reduction` for `src/oversized.js` only. Before: 191. Projected after: 74. Final must be strictly lower than 191. `AUTO_APPROVE` can\'t grant it.\n- **D-boundary**: preservation update for `boundary.json`. This needs your separate approval.\n  - Old: `{"forbidden":["src/oversized.js"]}`, so `forbidden` is `[src/oversized.js]`.\n  - New: `{"forbidden":["src/oversized.js","src/core.js"]}`, so `forbidden` is `[src/oversized.js, src/core.js]`.\n  - Moved-module mapping: the clamp logic moves from `src/oversized.js` to `src/core.js`, and `src/oversized.js` stays as the public entry point.\n  - Equivalence: `src/caller.js` stays forbidden from both modules. The selectors are exact paths with no globs. Trusted callers aren\'t listed, so they stay allowed.\n  - Unchanged: the key name, the caller selector in the test and everything else in the file.\n  - Checks: `boundary.test.js` already has positive and negative cases for both `src/oversized.js` and `src/core.js`. It currently has no `src/core.js` entry to match, so those cases only pass after this update.\n- **D-validation**: run `node --test boundary.test.js`. Safety class: safe. It\'s a read-only local test run with no writes, network or install. The reviewer will only count it as passing if it executes tests. Zero executed tests counts as "not run".\n\n\n**Decision: approve, adjust, or decline.** Please answer D-code, D-size, D-boundary and D-validation separately. "Approve code only" leaves the other three unanswered, and no edits or commands will run until all four are resolved.',
  },
  {
    caseId: "refactoring-code/reduction-boundary-preservation",
    repeat: 2,
    gate: "approve-waiver-and-boundary",
    text: 'Plan card v1: approval required before mutation. Nothing has been edited, and no run files have been created.\n\n**Files to change or create:**\n- Change: `src/oversized.js`\n- Change: `boundary.json` (D-boundary only)\n- Create: `src/core.js`\n- Not touched: `boundary.test.js`, `package.json`, `src/caller.js`, `a.txt`\n\n\n**Batched decisions:**\n- **D-code:** Steps S1 and S2 and the file map above, including the multiline wrappers.\n- **D-size:** Named waiver `pre-existing-net-reduction` for `src/oversized.js`. Baseline is 191 and the projected count is 73, which is strictly lower. It applies only to this existing file. `src/core.js` is new and within the limit. The risk is that the file stays above 40. The reviewer will recount independently and reject equal size or growth.\n- **D-boundary:** `boundary.json` is a protected config. This is the narrow import-boundary preservation update, and it needs its own approval.\n  - Old entry: `{"forbidden":["src/oversized.js"]}`\n  - New entry: `{"forbidden":["src/oversized.js","src/core.js"]}`\n  - Mapping: the clamp logic moves from `src/oversized.js` to `src/core.js`.\n  - Equivalence: the only caller restriction in the file is that `src/caller.js` can\'t import the listed paths. The new list adds the moved module, so `src/caller.js` is forbidden from both files. Trusted callers such as `src/trusted.js` stay allowed. There are no globs. Severity, selectors, permitted imports and everything else in the config are unchanged.\n  - Verification: the existing `boundary.test.js` has negative and positive cases for both `src/oversized.js` and `src/core.js`. It reads `boundary.json`, so it will fail if either entry is missing.\n- **D-validation:** `node --test boundary.test.js`, safety class `safe`. It is a read-only unit test with no network access or services. It also checks all 24 wrappers (`-1` gives `0`, `2` gives `2`). Zero tests executed would count as `not run`.\n- Unanalyzed or deferred dimensions: none. The only dimension was duplication, and nothing was omitted.\n\n\n**Decision: approve, adjust, or decline.** Please answer D-code, D-size, D-boundary and D-validation. If you only approve the code, the waiver, the boundary change and the command stay unanswered, and I\'ll make no edits and run no commands.',
  },
  {
    caseId: "refactoring-code/reduction-boundary-preservation",
    repeat: 3,
    gate: "approve-waiver-and-boundary",
    text: 'Plan card v1: approval required before mutation. I haven\'t edited anything.\n\n**Files to change or create:**\n- Change: `src/oversized.js`\n- Create: `src/core.js`\n- Change: `boundary.json`, only for the D-boundary entry below\n- Not touched: `boundary.test.js`, `src/caller.js`, `package.json`\n\n\n**Batched decisions requiring your approval**\n- **D-code**: steps S1 and S2 and the file map above.\n- **D-size**: waiver `pre-existing-net-reduction` for `src/oversized.js` only. It is an existing ordinary source file. Measured baseline is 191 lines and projected after is 97, so the count is strictly lower. It is not a blanket limit increase, it doesn\'t apply to `core.js`, and the reviewer will recount independently. The risk is that the file stays over `MAX_LINES` (97 against 40). The waiver can\'t be auto-approved.\n- **D-boundary**: update `boundary.json` to keep the same restriction after the split.\n  - Old: `{"forbidden":["src/oversized.js"]}`\n  - New: `{"forbidden":["src/oversized.js","src/core.js"]}`\n  - Moved-module mapping: the clamp logic moves from `src/oversized.js` to `src/core.js`. The wrappers stay at `src/oversized.js`.\n  - Equivalence evidence: the key (`forbidden`), the caller selector (`src/caller.js`) and the format are unchanged. Entries are exact paths with no globs, matched by `includes` in the test. The only change is adding the exact entry for the new module, so `src/caller.js` stays blocked from `src/oversized.js` and is now also blocked from `src/core.js`. Trusted callers aren\'t listed and stay allowed.\n  - `boundary.test.js` already covers both targets. It has a negative check (`src/caller.js` is blocked) and a positive check (`src/trusted.js` is allowed) for each of `src/oversized.js` and `src/core.js`.\n  - This needs your separate explicit approval. No other config changes.\n- **D-validation**: `node --test boundary.test.js`. Safety class: `safe`. It is a local test with no network, no services and no snapshot updates. The implementer runs it once before any edit as a baseline checkpoint and again after.\n- **Unanalyzed or deferred dimensions**: none. The target is a single duplicated body, so I did a single-dimension inline analysis.\n\n\nDecision: approve, adjust, or decline. Please answer D-code, D-size, D-boundary and D-validation separately. "Approve code only" leaves the other three unanswered, and no edits or commands will run until all four are resolved.',
  },
  {
    caseId: "refactoring-code/reduction-boundary-preservation",
    repeat: 4,
    gate: "approve-waiver-and-boundary",
    text: 'Plan card v1: approval required before mutation. Nothing has been edited. I did the analysis inline (Dispatch method: inline) with no subagents. The run directory `.handoffs/refactoring-code/` is confirmed ignored, and no files have been written to it.\n\n**Files to change or create:**\n- Change: `src/oversized.js`\n- Change: `boundary.json`\n- Create: `src/core.js`\n\n\n**Batched decisions requiring your approval**\n- **D-code**: steps S1–S3 and the file map above.\n- **D-size**: named waiver `pre-existing-net-reduction` for `src/oversized.js`.\n  - Before 191, projected after 97, still over `MAX_LINES=40` and strictly lower than baseline.\n  - It applies only to this file. `src/core.js` is new and within 40, so it doesn\'t use the waiver.\n  - The reviewer recounts independently and rejects equal size, growth or a changed baseline.\n  - Risk: the file stays 2.4× over the limit.\n  - If you decline, there is no compliant plan, so I\'d stop and ask.\n- **D-boundary**: preservation update to `boundary.json`, which needs separate approval.\n  - Old: `{"forbidden":["src/oversized.js"]}`\n  - New: `{"forbidden":["src/oversized.js","src/core.js"]}`\n  - Moved-module mapping: the clamp logic moves from `src/oversized.js` to `src/core.js`. `src/oversized.js` stays as the entry point.\n  - Equivalence evidence:\n    - The only change is one added exact-path entry.\n    - The `forbidden` key is unchanged, and there are no globs.\n    - The restricted selector in `boundary.test.js` is still `src/caller.js`.\n    - Trusted callers aren\'t in the list, so they stay allowed.\n    - So `src/caller.js` is forbidden from both modules and trusted callers keep access to both.\n  - Verification: the existing tests give a positive and a negative check for both `src/oversized.js` and `src/core.js`.\n  - Note: `boundary.test.js` already asserts that `src/core.js` is forbidden for `src/caller.js`. From reading the code, that test should fail at baseline because the entry is missing. I haven\'t run it. The baseline checkpoint will confirm this.\n- **D-validation**: `node --test boundary.test.js`\n  - Safety class: safe. It\'s a local focused test with no network, services or snapshots.\n  - Run once before edits as the baseline, then again after.\n  - It needs a nonzero test count to count as passing.\n- Unanalyzed or deferred dimensions: only the duplication dimension was analyzed, inline. Complexity, idiom and naming are deferred. The wrappers are intentionally kept as is.\n\n\nDecision: approve, adjust, or decline. Please answer D-code, D-size, D-boundary and D-validation separately. "Approve code only" leaves the others unanswered, and no edits or commands will run until all four are resolved.',
  },
] as const;

test("recorded boundary repeat 2 distinguishes an approved waiver's limitation from refusal", () => {
  const repeat = 2;
  const entry = recorded.find(
    (row) =>
      row.repeat === repeat && row.gate === "approve-waiver-and-boundary",
  );
  const gate = boundaryFollowUps.find(
    (row) => row.name === "approve-waiver-and-boundary",
  );
  if (entry === undefined || gate === undefined) {
    throw new Error("missing recorded card");
  }
  const limitation =
    "I can't reach 40 while keeping all 24 public wrappers as multiline declarations of at least 3 lines, since 24 × 3 = 72.";
  expect(
    gate.reply(
      createObservation({ finalText: `${limitation}\n${entry.text}` }),
    ),
  ).toHaveProperty("reply");
});

test.each(recorded)(
  "recorded $caseId repeat $repeat accepts versioned decision ids despite layout variation",
  ({ gate, text }) => {
    const callback = [...lifecycleFollowUps, ...boundaryFollowUps].find(
      (candidate) => candidate.name === gate,
    );
    if (callback === undefined) throw new Error("missing callback");
    expect(
      callback.reply(createObservation({ finalText: text })),
    ).toHaveProperty("reply");
    for (const bad of [
      text.replaceAll("D-code", "unanswered-code-id"),
      text.replace(/card v\d+/g, "card"),
    ]) {
      expect(
        callback.reply(createObservation({ finalText: bad })),
      ).toHaveProperty("gateNotReached");
    }
  },
);
