#!/usr/bin/env node
// Entry point for the local eval suite.
//
//   node evals/src/orchestration/run.ts                    every case, 5 attempts each
//   node evals/src/orchestration/run.ts --tier=1           routing cases only (fast, cents)
//   node evals/src/orchestration/run.ts --case=path-error  one case
//   node evals/src/orchestration/run.ts --attempts=1       one attempt per case (cheap smoke run)
//
// Each case runs `--attempts` times (default 5); its score is the percent of
// attempts that passed. Attempts run sequentially: they spend real tokens and
// the wall-clock cost of parallelism is not worth the token burn on a suite
// this small.
//
// Exit codes: 0 every executed case passed · 1 a case failed or was degraded · 2 no cases matched · 3 suite error · 4 usage error

import { Effect } from "effect";

import { ARGV_START } from "#/orchestration/invocation/arguments.ts";
import { runCli } from "#/orchestration/suite/coordination.ts";
import {
  RunnerOutputLive,
  RunnerServicesLive,
} from "#/orchestration/suite/services.ts";

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
