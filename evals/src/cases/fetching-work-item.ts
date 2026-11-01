import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { behavioralDefaults, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertOnlySnapshotWritten,
  assertReadOnlyGitHub,
  ISSUE,
  seedGitHub,
  SNAPSHOT,
} from "#/cases/fetching-work-item-fixtures.ts";
import {
  assertFileAbsent,
  assertFileExists,
  assertNoMutation,
  assertNoPublicStatusLine,
  checkNegativeRouting,
  checkPositiveRouting,
  FIXTURE_ROOT_PATH,
  normalizeReplyText,
} from "#/cases/shared-checks.ts";
import { GH_LOG } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

const SKILL = "fetching-work-item";
export const SNAPSHOT_SECTIONS = [
  "Metadata",
  "Description",
  "Acceptance Criteria",
  "Comments",
  "Retrieval Warnings",
  "Child Issues",
  "Linked Issues",
  "Labels",
  "Assignees",
  "Milestone",
  "Projects",
  "Attachments",
] as const;
// Ordered: the metadata table must list these rows in this order.
const METADATA_VALUES = {
  ISSUE_SLUG: ISSUE.slug,
  Repository: "acme/app",
  "Issue number": "42",
  State: "OPEN",
  Author: "billing-owner",
  Created: "2026-01-02 10:00 UTC",
  Updated: "2026-01-03 11:00 UTC",
  Closed: "_None_",
  URL: ISSUE.url,
};
const METADATA_ROWS = Object.keys(METADATA_VALUES);
const METADATA_ROW_PATTERN = new RegExp(
  String.raw`^\|\s*(?<field>${METADATA_ROWS.join("|")})\s*\|`,
  "gm",
);

const ONE_COMMENT = 1;

function sectionText(artifact: string, heading: string): string {
  const [, remainder = ""] = artifact.split(`## ${heading}\n`);
  const [section = ""] = remainder.split("\n## ");
  return section;
}

function checkMetadata(artifact: string): void {
  const metadata = sectionText(artifact, "Metadata");
  assert.deepEqual(
    [...metadata.matchAll(METADATA_ROW_PATTERN)].map(
      (match) => match.groups?.["field"],
    ),
    METADATA_ROWS,
  );
  const fields = Object.fromEntries(
    metadata
      .split("\n")
      .filter((line) => line.startsWith("|"))
      .map((line) => {
        const [, field = "", value = ""] = line.split("|");
        return [field.trim(), value.trim()];
      }),
  );
  for (const [field, value] of Object.entries(METADATA_VALUES)) {
    assert.ok(
      fields[field]?.includes(value) === true,
      `wrong metadata value: ${field}`,
    );
  }
}

function checkSnapshotContent(artifact: string): void {
  for (const fact of [ISSUE.url, ISSUE.goal, ISSUE.criterion, ISSUE.comment]) {
    assert.ok(artifact.includes(fact), `missing planted fact: ${fact}`);
  }
  assert.ok(
    sectionText(artifact, "Acceptance Criteria").includes(ISSUE.criterion),
    "criteria were not extracted into their section",
  );
  assert.ok(
    !sectionText(artifact, "Description").includes(ISSUE.criterion),
    "acceptance criteria duplicated in description",
  );
  assert.equal(
    [...artifact.matchAll(/^### Comment \d+ - /gm)].length,
    ONE_COMMENT,
  );
  assert.ok(
    sectionText(artifact, "Comments").includes(ISSUE.comment),
    "comment is outside its section",
  );
  for (const section of [
    "Child Issues",
    "Linked Issues",
    "Labels",
    "Assignees",
    "Milestone",
    "Projects",
    "Attachments",
    "Retrieval Warnings",
  ]) {
    assert.equal(
      sectionText(artifact, section).trim(),
      "_None_",
      `empty section misrepresented: ${section}`,
    );
  }
}

function checkSnapshot(observation: Observation): string {
  assertNoPublicStatusLine(
    observation.finalText,
    "FETCH",
    "Validation",
    "Failure category",
  );
  assertReadOnlyGitHub(observation);
  assertOnlySnapshotWritten(observation);
  assertFileExists(observation, SNAPSHOT);
  const artifact = observation.repoFiles?.[SNAPSHOT] ?? "";
  assert.match(artifact, new RegExp(`^# ${ISSUE.slug}: ${ISSUE.title}$`, "m"));
  assert.match(
    artifact,
    /> Retrieved on: \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC.*Source: /,
  );
  assert.ok(
    artifact.includes(`Repository: acme/app | Issue: #${ISSUE.number}`),
  );
  assert.deepEqual(
    [...artifact.matchAll(/^## (?<heading>.+)$/gm)].map(
      (match) => match.groups?.["heading"],
    ),
    SNAPSHOT_SECTIONS,
  );
  checkMetadata(artifact);
  checkSnapshotContent(artifact);
  assert.ok(
    observation.finalText.includes(SNAPSHOT),
    "handoff omits artifact path",
  );
  return "validated snapshot shape, planted facts, criteria extraction; one local artifact and no remote writes";
}

export const cases = [
  {
    id: "fetching-work-item/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent: "An issue retrieval request routes to the snapshot skill",
    prompt: () =>
      `Fetch ${ISSUE.url} into a local work-item snapshot for planning.`,
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // Sibling boundary: refine-task owns readiness reviews and tracker-facing drafts.
    id: "fetching-work-item/trigger-negative-refinement",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["refine-task"],
    intent: "A readiness review is not a fetch-only request",
    prompt: () =>
      `Review ${ISSUE.url} for implementation readiness and draft a refinement comment; do not fetch a planning snapshot.`,
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    ...behavioralDefaults,
    id: "fetching-work-item/github-snapshot",
    skill: SKILL,
    mutationPolicy: "allowed",
    seed: (context) => {
      seedGitHub(context);
    },
    snapshotPaths: [FIXTURE_ROOT_PATH, SNAPSHOT, GH_LOG],
    intent:
      "Fetch and validate an issue snapshot without changing the tracker or unrelated files",
    prompt: () =>
      `Use ${SKILL}. ISSUE_URL=${ISSUE.url}. Retrieve the work item and summarize the outcome.`,
    check: checkSnapshot,
    judge: async (observation) =>
      judgeLive({
        artifact: observation.repoFiles?.[SNAPSHOT] ?? "",
        knownFacts: `${ISSUE.title}. ${ISSUE.goal} ${ISSUE.scope} ${ISSUE.criterion} Parent comment: ${ISSUE.comment} There are no child issues, linked issues, projects, labels, assignees, milestone, or attachments.`,
        rubric: [
          {
            id: "snapshot-fidelity",
            requirement:
              "The snapshot faithfully preserves the issue body and comment without inventing issue data or confusing acceptance criteria with descriptive context.",
          },
        ],
      }),
  },
  {
    ...behavioralDefaults,
    id: "fetching-work-item/not-found",
    skill: SKILL,
    mutationPolicy: "read-only",
    wallClockMs: 300_000,
    seed: (context) => {
      seedGitHub(context, "missing");
    },
    snapshotPaths: [FIXTURE_ROOT_PATH, SNAPSHOT, GH_LOG],
    intent: "A 404 is reported without a fabricated snapshot or tracker writes",
    prompt: () =>
      `Use ${SKILL}. ISSUE_URL=${ISSUE.url}. Explain the failure if retrieval fails.`,
    check: (observation) => {
      assertNoMutation(observation);
      assertReadOnlyGitHub(observation);
      assertFileAbsent(observation, SNAPSHOT);
      assertNoPublicStatusLine(
        observation.finalText,
        "FETCH",
        "Validation",
        "Failure category",
        "File written",
      );
      const text = normalizeReplyText(observation.finalText);
      assert.match(
        text,
        /404|not found|could not find|couldn't find/i,
        "missing not-found explanation",
      );
      assert.match(
        text,
        /(?:no snapshot|snapshot (?:was |is )?not (?:written|created)|did not (?:write|create)|didn't (?:write|create)|nothing (?:was )?written)/i,
        "missing no-snapshot disclosure",
      );
      return "NOT_FOUND with no artifact or mutation";
    },
  },
] as const satisfies readonly EvalCase[];
