import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

const skill = new URL("../../../skills/review-pull-request/", import.meta.url);
function prompt(path: string) {
  return readFileSync(new URL(path, skill), "utf8");
}
const machine = prompt("state-machine.md");
function row(id: string) {
  return machine.split("\n").find((line) => line.startsWith(`| ${id} |`));
}

it("routes unchanged history with a refresh marker through the same author revision as a successful swap", () => {
  expect(row("8b")).toMatch(/refreshed[^|]*8e/i);
  expect(row("8e")).toMatch(
    /REVISE=1.*Dispatch author.*Redo thread assessment/,
  );
});

it("gives author and verifier one reopen choice for every eligible reply", () => {
  const author = prompt("subagents/review-author.md");
  const verifier = prompt("subagents/review-verifier.md");
  for (const text of [prompt("SKILL.md"), author, verifier]) {
    expect(text).not.toMatch(
      /restrictions on targets|requested (?:reply )?targets|requested eligible reopen/i,
    );
  }
  expect(author).toMatch(
    /every reply[^.]*`REOPEN_RESOLVED=yes`[^.]*`is_resolved`[^.]*`viewer_can_unresolve`/i,
  );
  expect(verifier).toMatch(
    /`VERIFY: FAIL`[^.]*eligible reply[^.]*lacks `reopen`/,
  );
});

it("routes verifier defects to bounded author repair even after refresh", () => {
  expect(row("14")).toMatch(
    /`VERIFY: FAIL` \| If `VERIFY_REPAIR < 2`.*author.*`VERIFY_FAIL`.*fresh review/i,
  );
  expect(machine).not.toContain("stop on failure instead of repairing");
  expect(prompt("subagents/review-verifier.md")).not.toContain(
    "every FAIL goes to review-author",
  );
});
