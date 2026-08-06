// Persists the final text of every failing attempt so a FAIL can be diagnosed
// from evidence instead of guessed at: the report cell keeps one truncated
// line, and without this the output that actually failed is gone when the run
// ends.
//
// Artifacts land under <tmpdir>/agent-skills-eval-failures/<caseId>-<n>.txt,
// where <n> makes concurrent failures within a run distinct. Persistence is a
// debug aid: a failure to write must never fail the attempt, so errors are
// reported to stderr and swallowed.

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Context, Effect, Layer } from "effect";

export const FAILURE_ARTIFACT_DIRECTORY = join(
  tmpdir(),
  "agent-skills-eval-failures",
);

export interface FailureArtifacts {
  /** Persists a failing attempt's final text; resolves with the path, or undefined when persistence itself failed. */
  readonly persist: (
    caseId: string,
    finalText: string,
  ) => Effect.Effect<string | undefined>;
}

export const FailureArtifacts = Context.Service<FailureArtifacts>(
  "evals/orchestration/FailureArtifacts",
);

function persistToDisk(caseId: string, finalText: string): string | undefined {
  try {
    mkdirSync(FAILURE_ARTIFACT_DIRECTORY, { recursive: true });
    const existingCount = readdirSync(FAILURE_ARTIFACT_DIRECTORY).filter(
      (fileName) => fileName.startsWith(`${caseId}-`),
    ).length;
    const artifactPath = join(
      FAILURE_ARTIFACT_DIRECTORY,
      `${caseId}-${existingCount}.txt`,
    );
    writeFileSync(artifactPath, finalText);
    return artifactPath;
  } catch (cause) {
    console.error(`failure-artifact persistence failed: ${String(cause)}`);
    return undefined;
  }
}

export const FailureArtifactsLive = Layer.succeed(
  FailureArtifacts,
  FailureArtifacts.of({
    persist: (caseId, finalText) =>
      Effect.sync(() => persistToDisk(caseId, finalText)),
  }),
);

/** Test layer: records calls, writes nothing. */
export const FailureArtifactsNoop = Layer.succeed(
  FailureArtifacts,
  FailureArtifacts.of({
    persist: () => Effect.succeed(undefined),
  }),
);
