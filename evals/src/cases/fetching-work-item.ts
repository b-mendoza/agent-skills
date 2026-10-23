import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertOnlySnapshotWritten,
  assertReadOnlyGitHub,
  GH_LOG,
  ISSUE,
  seedGitHub,
  SNAPSHOT,
} from "#/cases/fetching-work-item-fixtures.ts";
import {
  assertFileAbsent,
  assertFileExists,
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
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
const METADATA_ROWS = [
  "ISSUE_SLUG",
  "Repository",
  "Issue number",
  "State",
  "Author",
  "Created",
  "Updated",
  "Closed",
  "URL",
];

const ONE_COMMENT = 1;

function sectionText(artifact: string, heading: string): string {
  const [, remainder = ""] = artifact.split(`## ${heading}\n`);
  const [section = ""] = remainder.split("\n## ");
  return section;
}

function checkMetadata(artifact: string): void {
  const metadata = sectionText(artifact, "Metadata");
  assert.deepEqual(
    [
      ...metadata.matchAll(
        /^\|\s*(?<field>ISSUE_SLUG|Repository|Issue number|State|Author|Created|Updated|Closed|URL)\s*\|/gm,
      ),
    ].map((match) => match.groups?.["field"]),
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
  for (const [field, value] of Object.entries({
    ISSUE_SLUG: ISSUE.slug,
    Repository: "acme/app",
    "Issue number": "42",
    State: "OPEN",
    Author: "billing-owner",
    Created: "2026-01-02 10:00 UTC",
    Updated: "2026-01-03 11:00 UTC",
    Closed: "_None_",
    URL: ISSUE.url,
  })) {
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
    id: "fetching-work-item/github-snapshot",
    skill: SKILL,
    tier: BEHAVIORAL_TIER,
    fixture: "clean",
    mutationPolicy: "allowed",
    budgetUsd: 2,
    wallClockMs: 600_000,
    seed: (context) => {
      seedGitHub(context);
    },
    snapshotPaths: [SNAPSHOT, GH_LOG],
    intent:
      "Fetch and validate an issue snapshot without changing the tracker or unrelated files",
    prompt: () =>
      `Use ${SKILL}. ISSUE_URL=${ISSUE.url}. Retrieve the work item and return the normal handoff.`,
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
    id: "fetching-work-item/not-found",
    skill: SKILL,
    tier: BEHAVIORAL_TIER,
    fixture: "clean",
    mutationPolicy: "read-only",
    budgetUsd: 2,
    wallClockMs: 300_000,
    seed: (context) => {
      seedGitHub(context, "missing");
    },
    snapshotPaths: [SNAPSHOT, GH_LOG],
    intent: "A 404 is reported without a fabricated snapshot or tracker writes",
    prompt: () =>
      `Use ${SKILL}. ISSUE_URL=${ISSUE.url}. Return the structured failure summary if retrieval fails.`,
    check: (observation) => {
      assertNoMutation(observation);
      assertReadOnlyGitHub(observation);
      assertFileAbsent(observation, SNAPSHOT);
      assert.match(
        observation.finalText,
        /^FETCH: FAIL\nValidation: NOT_RUN\nFailure category: NOT_FOUND\nFile written: None/m,
      );
      assert.match(
        observation.finalText,
        /^Issue: acme\/app#42: Unknown\nState: Unknown\nComments: N\/A\nChild issues: N\/A\nLinked issues: N\/A\nAttachments: N\/A\nWarnings: None\nReason: .*(?:404|not found)/im,
      );
      return "NOT_FOUND with no artifact or mutation";
    },
  },
] as const satisfies readonly EvalCase[];
