#!/usr/bin/env node
import { ARGV_START, runCli } from "#/orchestration/cli.ts";

// Importing this module must never start a paid run.
if (import.meta.main) {
  process.exit(await runCli(process.argv.slice(ARGV_START)));
}
