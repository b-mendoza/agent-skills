#!/usr/bin/env node
// Entry point for the local eval suite.
//
//   node evals/src/orchestration/run.ts                    every case
//   node evals/src/orchestration/run.ts --tier=1           routing cases only (fast, cents)
//   node evals/src/orchestration/run.ts --case=path-error  one case
//
// Cases run sequentially: they spend real tokens and the wall-clock cost of
// parallelism is not worth the token burn on a suite this small.
//
// Exit codes: 0 all pass · 1 a case failed · 2 no cases matched · 3 suite error · 4 usage error

import { Effect } from "effect";

import { ARGV_START } from "#/orchestration/run-arguments.ts";
import { runCli } from "#/orchestration/run-coordination.ts";
import {
  RunnerOutputLive,
  RunnerServicesLive,
} from "#/orchestration/run-services.ts";

// Only a direct `node run.ts` spends money. Importing this module -- which the
// offline tests do, to reach the pure helpers above -- must never start a run.
if (import.meta.main) {
  const exitCode = await Effect.runPromise(
    runCli(process.argv.slice(ARGV_START)).pipe(
      Effect.provide(RunnerServicesLive),
      Effect.provide(RunnerOutputLive),
    ),
  );
  process.exit(exitCode);
}
