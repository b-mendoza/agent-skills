import assert from "node:assert/strict";

import {
  fixtureRelativePath,
  normalizeReplyText,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

const FIRST_LINE = 0;
const ONE_LINE = 1;

function evidenceSection(
  text: string,
  heading: string,
  headings: readonly string[],
): string {
  const lines = text.split(/\r?\n/);
  const normalized = (line: string) =>
    normalizeReplyText(line).trim().toLowerCase();
  const start = lines.findIndex(
    (line) => normalized(line) === heading.toLowerCase(),
  );
  if (start < FIRST_LINE) return "";
  const content = lines.slice(start + ONE_LINE);
  const titles = new Set(headings.map((name) => name.toLowerCase()));
  const end = content.findIndex(
    (line) => /^\s*#{1,6}\s/.test(line) || titles.has(normalized(line)),
  );
  return content
    .slice(FIRST_LINE, end < FIRST_LINE ? content.length : end)
    .join("\n");
}

export function assertReportedDirectory(
  observation: Observation,
  handoff: string,
  prefix: string,
  headings: readonly string[],
): void {
  const section = evidenceSection(
    observation.finalText,
    "Preserved Run Directory",
    headings,
  );
  const paths = section
    .split(/[\s`*"'()[\]<>|,;]+/)
    .filter((word) => word.includes(prefix));
  assert.deepEqual(
    new Set(
      paths.map((word) =>
        fixtureRelativePath(observation, word.replace(/\.$/, ""))?.replace(
          /\/$/,
          "",
        ),
      ),
    ),
    new Set([handoff]),
    "preserved evidence must name the actual run directory",
  );
}

export const BLOCKED_HEADINGS = [
  "Decision",
  "Blocking Reason",
  "Completed Checks",
  "Preserved Evidence",
  "Commit Warning",
  "Follow-Up Findings",
  "Sections Present",
] as const;

export function assertNoFilesDisclosure(text: string): void {
  const section = normalizeReplyText(
    evidenceSection(text, "Preserved Evidence", BLOCKED_HEADINGS),
  );
  const statement = section
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(?:run|audit|handoff|evidence|new) /g, "")
    .replace(/\bartifacts?\b/g, "files");
  const noFiles = [
    /\bno files? (?:were |was |have been )?(?:created|written|produced)\b/,
    /\b(?:did not|didn't|never) (?:create|write|produce) (?:any )?files?\b/,
    /\b(?:created|wrote|produced) no files?\b/,
  ];
  assert.ok(
    noFiles.some((pattern) => pattern.test(statement)),
    "preserved evidence must say no run files were created",
  );
}
