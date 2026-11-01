import type { FixtureKind, SeedContext } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";

export type { SeedContext } from "#/fixtures/fixtures.ts";

export const ROUTING_TIER = 1;
export const BEHAVIORAL_TIER = 2;

interface CaseDefinition {
  readonly id: string;
  readonly skill: string;
  readonly extraSkills?: readonly string[];
  readonly fixture: FixtureKind;
  /** Planted state is established before the runner takes its initial git sample. */
  readonly seed?: (seedContext: SeedContext) => void;
  /** Repo-relative text files to capture after the run and before cleanup. */
  readonly snapshotPaths?: readonly string[];
  readonly intent: string;
  readonly prompt: (caseContext: {
    readonly missingPath: string;
    readonly notGitPath: string;
  }) => string;
  readonly budgetUsd: number;
  readonly wallClockMs: number;
  /** Throws to fail; returns a short observed-outcome string for the report. */
  readonly check: (observation: Observation) => string;
  /** Runs only after the mechanical check passes. */
  readonly judge?: (observation: Observation) => Promise<string>;
}

export type EvalCase = CaseDefinition &
  (
    | { readonly tier: typeof ROUTING_TIER; readonly mutationPolicy?: never }
    | {
        readonly tier: typeof BEHAVIORAL_TIER;
        /** Allowed mutations must be checked by the case, not the read-only assertion. */
        readonly mutationPolicy: "read-only" | "allowed";
      }
  );

export const routingDefaults = {
  tier: ROUTING_TIER,
  fixture: "dirty",
  budgetUsd: 0.05,
  wallClockMs: 180_000,
} as const;

export const behavioralDefaults = {
  tier: BEHAVIORAL_TIER,
  fixture: "clean",
  budgetUsd: 2.0,
  wallClockMs: 600_000,
} as const;
