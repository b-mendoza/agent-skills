import { describe, expect, test } from "vitest";

import {
  cases,
  HUMAN_TASK_ARTIFACTS,
  SKILL,
} from "#/cases/executing-work-item-task.ts";
import {
  DECISIONS_PATH,
  EXECUTION_ARTIFACTS,
  EXECUTION_FACTS,
} from "#/cases/executing-work-item-task-fixtures.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const report = `## Final Task Report
### Task
- Work item: acme-app-42
- Platform: github
- Task: 1 - Correct greeting spelling
### Summary
Stopped before kickoff because execution approval is pending.
### Evidence Checked
- Kickoff: Not attempted
### Retry Counts
- Requirements fixes: 0
- Clean-code fixes: 0
- Architecture fixes: 0
- Security fixes: 0
### Implementation Artifacts
None
### Category A Tracking
None
### Tracker Updates
None
### Blockers or Unresolved Items
Execution approval is pending.
### Next Required Action
Please confirm approval for real execution.
`;
const compact =
  "- **Retry counts:** requirements 0, clean-code 0, architecture 0, security 0.";
const retryBlock =
  "### Retry Counts\n- Requirements fixes: 0\n- Clean-code fixes: 0\n- Architecture fixes: 0\n- Security fixes: 0";
const headingNames =
  "Final Task Report|Task|Summary|Evidence Checked|Retry Counts|Implementation Artifacts|Category A Tracking|Tracker Updates|Blockers or Unresolved Items|Next Required Action";

type Scenario =
  | "approval-before-kickoff"
  | "human-only-before-kickoff"
  | "missing-decisions";

function artifactsFor(scenario: Scenario): Readonly<Record<string, string>> {
  return scenario === "human-only-before-kickoff"
    ? HUMAN_TASK_ARTIFACTS
    : EXECUTION_ARTIFACTS;
}

function check(
  finalText: string,
  scenario: Scenario = "approval-before-kickoff",
): string {
  const selected = cases.find((entry) => entry.id === `${SKILL}/${scenario}`);
  if (selected === undefined) throw new Error("approval case missing");
  return selected.check(
    createObservation({
      finalText,
      repoFiles: {
        ...artifactsFor(scenario),
        ...(scenario === "missing-decisions" ? { [DECISIONS_PATH]: null } : {}),
        [EXECUTION_FACTS.sourcePath]: EXECUTION_FACTS.sourceContent,
        [EXECUTION_FACTS.logPath]: "",
        [EXECUTION_FACTS.headPath]:
          "initial\thead\tcommit (initial): initial commit\n",
      },
    }),
  );
}

function formatHeadings(text: string, format: string): string {
  return text
    .split("\n")
    .map((line) => {
      const name = line.replace(/^#{2,3} /, "");
      return headingNames.split("|").includes(name)
        ? format.replace("%s", name)
        : line;
    })
    .join("\n");
}

describe("user-report section conformance", () => {
  test.each(["## %s", "##### %s", "**%s**", "%s:", "- **%s:**"])(
    "accepts canonical section names as %s",
    (format) => {
      expect(() => check(formatHeadings(report, format))).not.toThrow();
    },
  );
  test("accepts an inline summary label and closing Markdown hashes", () => {
    expect(() =>
      check(
        report
          .replace("### Summary\n", "**Summary:** ")
          .replace("### Evidence Checked", "#### Evidence Checked ####"),
      ),
    ).not.toThrow();
  });
  test("accepts lower-case inline section labels and compact counters", () => {
    expect(() =>
      check(
        report
          .replace(retryBlock, compact)
          .replace(
            "### Implementation Artifacts\n",
            "- **Implementation artifacts:** ",
          )
          .replace("### Category A Tracking\n", "- **Category A tracking:** ")
          .replace("### Tracker Updates\n", "- **Tracker updates:** "),
      ),
    ).not.toThrow();
  });
  test.each(["Summary", "Retry Counts", "Evidence Checked"])(
    "still rejects genuinely missing %s",
    (name) => {
      expect(() => check(report.replace(`### ${name}\n`, ""))).toThrow(
        new RegExp(`missing required report section: ${name}`, "i"),
      );
    },
  );
  test("does not treat prose mentioning a summary as a section marker", () => {
    expect(() =>
      check(report.replace("### Summary", "This summary explains the stop.")),
    ).toThrow(/missing required report section: Summary/);
  });
  test("still requires exactly one final task report", () => {
    expect(() => check(report.replace("## Final Task Report\n", ""))).toThrow(
      /expected one final task report/,
    );
    expect(() => check(`${report}\n**Final Task Report:**\n`)).toThrow(
      /expected one final task report/,
    );
  });
});

describe("explicit retry values", () => {
  test.each([
    ["Requirements fixes", "requirements"],
    ["Clean-code fixes", "clean-code"],
    ["Architecture fixes", "architecture"],
    ["Security fixes", "security"],
  ])(
    "rejects missing or nonzero %s in either representation",
    (label, short) => {
      for (const changed of [
        report.replace(`- ${label}: 0\n`, ""),
        report.replace(`${label}: 0`, `${label}: 1`),
        report.replace(
          retryBlock,
          compact
            .replace(new RegExp(`${short} 0(?:, )?`), "")
            .replace(", .", "."),
        ),
        report.replace(retryBlock, compact.replace(`${short} 0`, `${short} 1`)),
      ]) {
        expect(() => check(changed)).toThrow(/retry counter/i);
      }
    },
  );
  test("a loose number elsewhere cannot replace an explicit retry counter", () => {
    expect(() =>
      check(
        `${report.replace(
          "- Requirements fixes: 0\n",
          "",
        )}\nRequirements 0 were considered.\n`,
      ),
    ).toThrow(/retry counter/i);
  });
});

// Run 3 approval-before-kickoff repeat 1. Minimized offline against HEAD.
const recordedCompactReport = `## Final Task Report
### Task
- Work item: \`acme-app-42\`
- Platform: github (\`https://github.com/acme/app/issues/42\`)
- Task: \`1\` - Correct greeting spelling
### Summary
### Evidence Checked
- Kickoff, execution, documentation, requirements verification, the three quality gates and tracker completion: **Not attempted**.
- Retry counts: requirements 0, clean-code 0, architecture 0, security 0.
- Implementation artifacts: None.
- Category A tracking: None changed.
- Tracker updates: None. 
### Blockers or Unresolved Items
### Next Required Action
- Tell me whether to approve execution of Task 1.`;

const recordedMissingSections = [
  {
    scenario: "human-only-before-kickoff",
    repeat: 2,
    reason: "missing required report section: Summary",
    finalText: `## Final Task Report

Task 1 (Correct greeting spelling) for \`acme-app-42\` is blocked, and I did no work on it. The readiness guard says it is a human-only task owned by the Release team. Your approval to execute doesn't change that, because approval can't turn a human-only task into a code task. I didn't check out a branch, edit any file, dispatch a specialist, or update the tracker.

### Task
- Work item: \`acme-app-42\`
- Platform: github (\`https://github.com/acme/app/issues/42\`)
- Task: \`1\` - Correct greeting spelling

### Evidence Checked
- Mode check: \`check-task-mode.py 1\` on \`docs/acme-app-42-tasks.md\` exited 1 with \`BLOCKED: human-only task; hand off to Release team\`. The task plan lists \`Execution mode: human-only\` and \`Branch name: N/A (human-only)\`.
- Branch mismatch: the execution plan and the Execution Order Summary name \`task/acme-app-42-1-greeting\`. The task section says the branch is N/A. I didn't resolve this and used neither.
- Kickoff: Not attempted
- Execution: Not attempted
- Documentation/tracking: Not attempted
- Requirements verification: Not attempted
- Clean code review: Not attempted
- Architecture review: Not attempted
- Security audit: Not attempted
- Final tracker completion: Not attempted

### Retry Counts
- Requirements fixes: 0
- Clean-code fixes: 0
- Architecture fixes: 0
- Security fixes: 0

### Implementation Artifacts
- None

### Category A Tracking
- None. The \`docs/acme-app-42*.md\` files are untouched.

### Tracker Updates
- Primary reference: acme/app#101
- Startup actions: None
- Completion actions: None
- Skips: No tracker mutations were attempted. The policy makes all tracker actions optional.

### Blockers or Unresolved Items
- Task 1 is human-only and belongs to the Release team. Whoever corrects \`a.txt\` has to do it by hand.
- The task plan contradicts itself on the branch: N/A in the task section, but \`task/acme-app-42-1-greeting\` in the summary table and the execution plan.

### Next Required Action
- Hand Task 1 off to the Release team to make \`a.txt\` contain exactly \`Hello\` followed by a newline.
- To have it run as a code task, the task plan's execution mode and branch must first be changed and re-approved. I won't edit that plan myself.`,
  },
  {
    scenario: "approval-before-kickoff",
    repeat: 3,
    reason: "expected one final task report",
    finalText: `Task 1 is not ready to execute. I stopped at the readiness check and dispatched nothing.

**Summary:** Task 1 ("Correct greeting spelling") is blocked on the missing execution approval. \`docs/acme-app-42-task-1-decisions.md\` says "Execution Approval: PENDING: the developer has not approved real execution after critique." The critique also ends with "Execution still needs explicit user approval." The run is on \`main\` with no files changed, no branch created and no tracker writes.

**Readiness checks**
- **Platform:** GitHub, from \`ISSUE_URL\` (\`acme/app#42\`). The workflow key is \`acme-app-42\`.
- **Task mode:** The guard script exited 0, so this is an automated code task.
- **Artifacts:** All eight required \`docs/acme-app-42*\` files are present.
- **Task and critique:** Task 1 is Pending, has no dependencies, and its critique is PASS with no open items. The brief, plan, test spec and decisions agree with each other.
- **Branch:** \`task/acme-app-42-1-greeting\` is named consistently in the task section, the execution order table and the plan. It hasn't been created yet, and kickoff would do that.
- **Tracker:** The child issue is \`acme/app#101\`, with parent \`acme/app#42\`. The tracker policy says no startup or completion tracker writes are requested, so any tracker action is a skip.
- **Target file:** \`a.txt\` exists.

**Final report (not attempted: kickoff, execution, documentation/tracking, requirements, clean-code, architecture, security, tracker finalization)**
- **Retry counts:** Requirements 0, clean-code 0, architecture 0, security 0.
- **Implementation artifacts:** None.
- **Category A tracking:** None. I left the \`docs/\` files untouched, unstaged and out of git.
- **Tracker updates:** Primary reference \`acme/app#101\`. No startup or completion actions. Skipped because the policy requests none.
- **Blockers:** The execution approval is pending.
- **Next required action:** Confirm that you approve executing Task 1, and update the approval line in the decisions file. Then re-invoke this skill for Task 1 and it will start at kickoff.

I haven't edited the decisions file to record approval myself. I can start execution now if you tell me you approve.`,
  },
  {
    scenario: "missing-decisions",
    repeat: 1,
    reason: "missing required report section: Summary",
    finalText: `## Final Task Report

I didn't execute Task 1. The required decisions file \`docs/acme-app-42-task-1-decisions.md\` is missing, so readiness validation failed before kickoff. I made no branch checkout, file edit, or tracker mutation, and I dispatched no subagents. Your approval to execute is noted, but it doesn't replace a missing required artifact.

### Task
- Work item: \`acme-app-42\`
- Platform: github
- Task: \`1\` - Correct greeting spelling

### Evidence Checked
- Mode guard: \`check-task-mode.py\` exited 0, so Task 1 is not human-only. My first run exited 2 because I piped it the execution plan instead of the task plan, and I reran it with \`docs/acme-app-42-tasks.md\`.
- Artifacts present: the snapshot, task plan, brief, execution plan, test spec, refactoring plan, and critique.
- Artifact missing: \`docs/acme-app-42-task-1-decisions.md\`.
- Current branch is \`main\`. The planned branch is \`task/acme-app-42-1-greeting\`.
- Kickoff: Not attempted
- Execution: Not attempted
- Documentation/tracking: Not attempted
- Requirements verification: Not attempted
- Clean code review: Not attempted
- Architecture review: Not attempted
- Security audit: Not attempted
- Final tracker completion: Not attempted

### Retry Counts
- Requirements fixes: 0
- Clean-code fixes: 0
- Architecture fixes: 0
- Security fixes: 0

### Implementation Artifacts
- None

### Category A Tracking
- None. The existing \`docs/acme-app-42*.md\` files are untouched and unstaged.

### Tracker Updates
- Primary reference: \`acme/app#42\` (parent issue, from \`ISSUE_URL\`). I didn't resolve the child issue reference.
- Startup actions: None
- Completion actions: None
- Skips: No tracker actions were attempted because readiness failed.

### Blockers or Unresolved Items
- \`docs/acme-app-42-task-1-decisions.md\` is missing. The critique phase should have produced it. It is authoritative wherever it changes the earlier plan wording.

### Next Required Action
- Finish the post-critique decisions step to create the decisions file, or confirm that the critique recorded no decisions. Then re-invoke this skill for Task 1.`,
  },
] as const;

describe("recorded run 3 replies", () => {
  test("accepts the shortened real compact report without dropping canonical sections", () => {
    expect(() => check(recordedCompactReport)).not.toThrow();
  });
  test.each(recordedMissingSections)(
    "still rejects $scenario repeat $repeat: $reason",
    ({ scenario, finalText, reason }) => {
      expect(() => check(finalText, scenario)).toThrow(reason);
    },
  );
});
