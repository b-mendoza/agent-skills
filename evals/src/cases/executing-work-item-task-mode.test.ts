import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const SUCCESS = 0;
const BLOCKED = 1;
const INVALID = 2;

const script = fileURLToPath(
  new URL(
    "../../../skills/executing-work-item-task/scripts/check-task-mode.py",
    import.meta.url,
  ),
);
function check(plan: string, task = "1") {
  return spawnSync("python3", [script, task], {
    input: plan,
    encoding: "utf8",
  });
}

describe("human-only execution guard", () => {
  test.each([
    {
      label: "a human-only section despite a stale code branch",
      fields:
        "Execution mode: human-only\nHuman owner: Release team\nBranch name: feature/legacy-name",
      stdout: "BLOCKED: human-only task; hand off to Release team\n",
    },
    {
      label: "a formatted human-only branch sentinel",
      fields: "**Branch name**: `N/A (human-only)`",
      stdout:
        "BLOCKED: human-only task; hand off to the human owner (not specified)\n",
    },
  ])("blocks $label before execution", ({ fields, stdout }) => {
    const result = check(`## Task 1: Production signoff\n${fields}\n`);
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toBe(stdout);
  });
  test("stops the owner name before the following task fields", () => {
    const result = check(
      "## Task 1: Do thing\n\n**Owner:** Dana **Execution mode:** human-only **Branch name:** N/A (human-only)\n",
    );
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toBe("BLOCKED: human-only task; hand off to Dana\n");
  });
  test.each([
    { label: "a bare task number", taskCell: "1" },
    { label: "a prefixed task number", taskCell: "Task 1" },
    { label: "an ASCII mapping", taskCell: "C -> 1" },
    { label: "a Unicode mapping", taskCell: "C → Task 1" },
    { label: "a formatted mapping", taskCell: "**`C -> 1`**" },
  ])(
    "blocks a summary-only human task for $label despite a stale code branch",
    ({ taskCell }) => {
      const result = check(
        `## Execution Order Summary\n| Task | Branch |\n| --- | --- |\n| ${taskCell} | \`N/A (human-only)\` |\n## Task 1: Approval\n**Branch name:** feature/stale-code\n`,
      );
      expect(result.status).toBe(BLOCKED);
      expect(result.stdout).toMatch(/^BLOCKED: human-only/);
    },
  );
  test("blocks a sentinel row followed by a thematic break", () => {
    const result = check(
      "## Task 1: Rotate the key\n- **Branch name:** feature/rotate\n\n## Execution Order Summary\n\n| Order | Task | Branch |\n| --- | --- | --- |\n| C | 1 | N/A (human-only) |\n---\nNotes follow.\n",
    );
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toMatch(/^BLOCKED: human-only/);
  });
  test("finds the task column and human sentinel in reordered columns", () => {
    const result = check(
      "## Execution Order Summary\n| Handoff | Task | Branch |\n| --- | --- | --- |\n| N/A (human-only) | Task 1 | feature/stale-code |\n## Task 1: Approval\n**Owner:** Release team\n",
    );
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toBe(
      "BLOCKED: human-only task; hand off to Release team\n",
    );
  });
  test("distinguishes a Task data cell from a table header", () => {
    const result = check(
      "## Execution Order Summary\n| Order | Task | Type | Owner | Branch name |\n| --- | --- | --- | --- | --- |\n| 1 | 1 | Task | dev | feat/one |\n| 2 | 2 | Task | Ops | N/A (human-only) |\n## Task 1: One\n## Task 2: Two\n",
      "2",
    );
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toMatch(/^BLOCKED: human-only/);
  });
  test("checks human sentinels in later summary sections", () => {
    const result = check(
      "## Execution Order Summary\n| Task | Branch |\n| --- | --- |\n| 1 | feature/one |\n## Execution Order Summary\n| Branch | Task |\n| :--- | ---: |\n| N/A (human-only) | 2 |\n## Task 1: One\n## Task 2: Two\n",
      "2",
    );
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toMatch(/^BLOCKED: human-only/);
  });
  test("rejects a human sentinel without a Task column", () => {
    const result = check(
      "## Execution Order Summary\n| Number | Branch |\n| --- | --- |\n| 1 | N/A (human-only) |\n## Task 1: Approval\n",
    );
    expect(result.status).toBe(INVALID);
    expect(result.stdout).toMatch(/^ERROR:/);
  });
  test.each([
    {
      label: "a human sentinel mapped to another task",
      plan: "## Execution Order Summary\n| Task | Branch |\n| --- | --- |\n| 1 -> 3 | N/A (human-only) |\n## Task 1: Implement validation\n**Branch name:** feature/validation\n",
    },
    {
      label: "a malformed Task cell without a human sentinel",
      plan: "## Execution Order Summary\n| Task | Branch |\n| --- | --- |\n| Task 1: Rotate the key | feature/other |\n## Task 1: Implement validation\n**Branch name:** feature/validation\n",
    },
    {
      label: "a human-only mode outside the selected task section",
      plan: "## Task 1: Implement validation\n**Branch name:** feature/validation\n## Task 2: Approval\n**Execution mode:** human-only\n**Branch name:** N/A (human-only)\n",
    },
  ])("continues automation despite $label", ({ plan }) => {
    const result = check(plan);
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout).toMatch(/^AUTOMATED:/);
  });
  test.each([
    { label: "a task title", taskCell: "Task 1: Rotate the key" },
    { label: "an empty mapping source", taskCell: "-> 1" },
  ])("rejects $label in a human-sentinel Task cell", ({ taskCell }) => {
    const result = check(
      `## Execution Order Summary\n| Task | Branch |\n| --- | --- |\n| ${taskCell} | N/A (human-only) |\n## Task 1: Implement validation\n**Branch name:** feature/validation\n`,
    );
    expect(result.status).toBe(INVALID);
    expect(result.stdout).toMatch(/^ERROR:/);
    expect(result.stdout).toContain(`'${taskCell}'`);
  });
  test("recognizes a mixed-case human sentinel", () => {
    const result = check(
      "## Execution Order Summary\n| Task | Branch |\n| --- | --- |\n| 1 | n/a (Human-Only) |\n## Task 1: Approval\n**Branch name:** feature/stale-code\n",
    );
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toMatch(/^BLOCKED: human-only/);
  });
  test.each([
    { label: "missing", plan: "## Task 2: Not the selected task\n" },
    { label: "duplicated", plan: "## Task 1: One\n## Task 1: Duplicate\n" },
  ])("rejects $label selected-task identity", ({ plan }) => {
    expect(check(plan).status).toBe(INVALID);
  });
  test("rejects an invalid task-number argument with usage exit", () => {
    expect(check("## Task 1: Code\n", "zero").status).toBe(INVALID);
  });
  test("keeps blocking the selected task after a later human-only task", () => {
    const result = check(
      "## Execution Order Summary\n| Task | Branch |\n| --- | --- |\n| C -> 1 | N/A (human-only) |\n| E -> 3 | N/A (human-only) |\n## Task 1: Approval\n**Branch name:** feature/stale-code\n**Human owner:** Release team\n## Task 3: Signoff\n",
    );
    expect(result.status).toBe(BLOCKED);
    expect(result.stdout).toBe(
      "BLOCKED: human-only task; hand off to Release team\n",
    );
  });
});
