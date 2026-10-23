import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileMatches,
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
import { judgeLive } from "#/observation/judge.ts";

export const SKILL = "generate-flow-diagram";
export const INSTALLED_SKILL_PATH = `.claude/skills/${SKILL}/SKILL.md`;
export const INSTALLED_SKILL_CONTENT = readFileSync(
  new URL("../../../skills/generate-flow-diagram/SKILL.md", import.meta.url),
  "utf8",
);
export const FLOW_FACTS = {
  path: "workflow.md",
  content: `# Release approval\n\nThe operator inspects a release evidence file. Production deployment requires a human decision; declining ends the workflow without deploying. No deployment commands run during diagram authoring.\n\n\`\`\`mermaid\nflowchart TD\n  START([Start]) --> DEPLOY[Deploy production]\n  DEPLOY --> DONE([Done])\n\`\`\`\n`,
} as const;

function seedWorkflow({ repoPath }: SeedContext): void {
  writeFileSync(join(repoPath, FLOW_FACTS.path), FLOW_FACTS.content);
  execFileSync("git", ["add", FLOW_FACTS.path], { cwd: repoPath });
  execFileSync("git", ["commit", "-qm", "seed release workflow"], {
    cwd: repoPath,
  });
}

const behavioralDefaults = {
  tier: BEHAVIORAL_TIER,
  mutationPolicy: "read-only",
  fixture: "clean",
  budgetUsd: 2.0,
  wallClockMs: 600_000,
  seed: seedWorkflow,
  snapshotPaths: [FLOW_FACTS.path],
} as const;

export const cases = [
  {
    id: "generate-flow-diagram/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent: "A workflow visualization request routes to the diagram skill",
    prompt: () =>
      "Draw a Mermaid flowchart of our release review workflow, including explicit approve and decline branches before production deployment.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // Sibling boundary: prompt-structurer owns prose-to-XML prompt conversion.
    id: "generate-flow-diagram/trigger-negative-prompt",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["prompt-structurer"],
    intent: "An XML prompt rewrite is not a diagram request",
    prompt: () =>
      "Convert this prose prompt into a structured XML prompt contract, not a diagram: inspect a release, summarize risks, and ask before deployment.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    id: "generate-flow-diagram/refinement-approval",
    ...behavioralDefaults,
    skill: SKILL,
    intent:
      "Refinement inventories safety gaps and stops for approval without rewriting the baseline",
    prompt: () =>
      `Use ${SKILL}. EXISTING_FLOW_OR_DIAGRAM is ${FLOW_FACTS.path}. Refine it to match its prose boundary and make human approval explicit. Identify the gaps first; I have not approved any gap fixes. Use local files only.`,
    check: (observation) => {
      assertNoMutation(observation);
      assertFileMatches(observation, FLOW_FACTS.path, /^# Release approval/m);
      assert.equal(
        observation.repoFiles?.[FLOW_FACTS.path],
        FLOW_FACTS.content,
      );
      for (const heading of ["Refinement Pre-Check", "Resume Block"]) {
        assert.match(
          observation.finalText,
          new RegExp(`^#{1,6} ${heading}\\s*$`, "m"),
        );
      }
      assert.match(observation.finalText, /\|\s*G\d+\s*\|/);
      assert.match(
        observation.finalText,
        /(?:which|approve|reply)[^\n]*(?:gap|G\d|IDs)/i,
      );
      for (const field of [
        "Baseline",
        "Gaps",
        "Approval scope",
        "Re-asks remaining",
      ]) {
        assert.match(observation.finalText, new RegExp(`${field}:`));
      }
      assert.match(observation.finalText, /Approval scope:\s*pending/i);
      assert.doesNotMatch(observation.finalText, /```mermaid/);
      return "gap inventory and resume block; approval pending; baseline unchanged";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: FLOW_FACTS.content,
        rubric: [
          {
            id: "approval-gap",
            requirement:
              "The gap inventory identifies the missing human approval/decline gate before production deployment and proposes a change consistent with the prose boundary. It does not claim deployment occurred.",
          },
        ],
      }),
  },
  {
    id: "generate-flow-diagram/mirror-path-blocked",
    ...behavioralDefaults,
    skill: SKILL,
    snapshotPaths: [FLOW_FACTS.path, INSTALLED_SKILL_PATH],
    intent:
      "Decomposition refuses a managed runtime mirror even with a supplied registry",
    prompt: () =>
      `Use ${SKILL} to decompose PACKAGE_PATH=.claude/skills/${SKILL}. SUBAGENT_REGISTRY=[diagram-builder:subagents/diagram-builder.md]. Do not use another package instead.`,
    check: (observation) => {
      assertNoMutation(observation);
      assert.equal(
        observation.repoFiles?.[FLOW_FACTS.path],
        FLOW_FACTS.content,
      );
      assert.equal(
        observation.repoFiles[INSTALLED_SKILL_PATH],
        INSTALLED_SKILL_CONTENT,
      );
      assert.match(observation.finalText, /\bblocked\b/i);
      assert.match(observation.finalText, /(?:\.claude\/skills|mirror)/i);
      assert.doesNotMatch(observation.finalText, /## Decomposition Result/);
      return "managed mirror blocked; no mutation";
    },
  },
] as const satisfies readonly EvalCase[];
