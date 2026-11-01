// Shrinks a recorded reply while its case-check outcomes stay the same.
// Usage: node scripts/minimize-reply.ts --case <id> --observation <json> [--contrast-ref <git-ref>]
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { Predicate, Schema } from "effect";

import type { EvalCase } from "#/cases/case-contract.ts";
import type { MinimizeResult } from "#/cases/minimize-reply.ts";
import { minimizeReply } from "#/cases/minimize-reply.ts";
import { getCase } from "#/cases/registry.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { observationSchema } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

type Check = EvalCase["check"];

/** 256 MiB: room for a `git archive` of the whole repository. */
const ARCHIVE_BUFFER_BYTES = 268_435_456;
const USAGE =
  "usage: --case <id> --observation <json file> [--contrast-ref <git-ref>]";
const decodeObservation = Schema.decodeUnknownSync(observationSchema);

/** Observation fields from `path`, merged over the zero-cost defaults tests use. */
function readObservation(path: string): Observation {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Predicate.isObject(parsed)) {
    throw new Error(`${path}: expected a JSON object of observation fields`);
  }
  try {
    return decodeObservation({ ...createObservation(), ...parsed });
  } catch (error) {
    throw new Error(`${path}: not an observation`, { cause: error });
  }
}

function casesIn(registry: unknown): readonly unknown[] {
  const listed = Predicate.isObject(registry) ? registry["cases"] : undefined;
  return Array.isArray(listed) ? listed : [];
}

function contrastCheckIn(
  registry: unknown,
  caseId: string,
  ref: string,
): Check {
  const found = casesIn(registry).find(
    (entry) => Predicate.isObject(entry) && entry["id"] === caseId,
  );
  const check = Predicate.isObject(found) ? found["check"] : undefined;
  if (typeof check !== "function") {
    throw new Error(`refused: case ${caseId} does not exist at ${ref}`);
  }
  // Thrown errors pass through untouched, so outcomes match the old check's.
  return (observation) =>
    String(Reflect.apply(check, undefined, [observation]));
}

/** Runs `use` with the case's check as it was at `ref`, from a throwaway tree. */
async function withContrastCheck<Result>(
  caseId: string,
  ref: string,
  use: (contrastCheck: Check) => Result,
): Promise<Result> {
  const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
  const tree = mkdtempSync(join(tmpdir(), "minimize-reply-"));
  try {
    const archive = execFileSync("git", ["-C", repoRoot, "archive", ref], {
      maxBuffer: ARCHIVE_BUFFER_BYTES,
    });
    execFileSync("tar", ["-x", "-C", tree], { input: archive });
    symlinkSync(
      resolve(import.meta.dirname, "../node_modules"),
      join(tree, "evals/node_modules"),
    );
    const registry: unknown = await import(
      pathToFileURL(join(tree, "evals/src/cases/registry.ts")).href
    );
    return use(contrastCheckIn(registry, caseId, ref));
  } finally {
    rmSync(tree, { force: true, recursive: true });
  }
}

function summarize(result: MinimizeResult): string {
  return JSON.stringify({
    outcome: result.outcome,
    contrastOutcome: result.contrastOutcome ?? null,
    lines: [result.linesBefore, result.linesAfter].join(" -> "),
  });
}

async function minimize(
  caseId: string,
  observationPath: string,
  contrastRef: string | undefined,
): Promise<MinimizeResult> {
  const request = {
    check: getCase(caseId).check,
    observation: readObservation(observationPath),
  };
  return contrastRef === undefined
    ? minimizeReply(request)
    : withContrastCheck(caseId, contrastRef, (contrastCheck) =>
        minimizeReply({ ...request, contrastCheck }),
      );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      case: { type: "string" },
      observation: { type: "string" },
      "contrast-ref": { type: "string" },
    },
  });
  if (values.case === undefined || values.observation === undefined) {
    throw new Error(USAGE);
  }
  const result = await minimize(
    values.case,
    values.observation,
    values["contrast-ref"],
  );
  process.stdout.write(`${result.finalText}\n`);
  process.stderr.write(`${summarize(result)}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
