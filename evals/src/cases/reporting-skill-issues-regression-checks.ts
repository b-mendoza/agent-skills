import assert from "node:assert/strict";

import type { PreviewIssue } from "#/cases/reporting-skill-issues-preview.ts";
import { previewIssues } from "#/cases/reporting-skill-issues-preview.ts";
import { normalizeReplyText } from "#/cases/shared-checks.ts";

export type { PreviewIssue } from "#/cases/reporting-skill-issues-preview.ts";
export { previewIssues } from "#/cases/reporting-skill-issues-preview.ts";

function assertSections(body: string, sections: readonly string[]): void {
  const normalized = normalizeReplyText(body);
  for (const section of sections) {
    assert.ok(
      normalized.split("\n").some((line) => {
        const heading = line.trim().replace(/:$/, "");
        return heading === section || heading.startsWith(`${section} (`);
      }),
      `missing body section: ${section}`,
    );
  }
}

export function assertSingleDefectPreview(text: string): void {
  const [issue, ...extra] = previewIssues(text);
  assert.ok(issue !== undefined, "missing complete defect command payload");
  assert.deepEqual(extra, [], "preview exactly one defect payload");
  assertDefectPayload(issue);
}

function assertCommonSections(issue: PreviewIssue): void {
  assertSections(issue.body, ["Skill", "Evidence", "Impact", "Redactions"]);
  assert.ok(issue.body.endsWith("\n"), "public body must end with a newline");
}

function assertDefectPayload(issue: PreviewIssue): void {
  assert.match(
    issue.title,
    /^\[generate-handoff-document\] (?!Improvement request:).+/,
  );
  assertCommonSections(issue);
  assertSections(issue.body, [
    "What happened",
    "Where in the skill",
    "Steps to reproduce",
    "Expected",
    "Actual",
  ]);
}
