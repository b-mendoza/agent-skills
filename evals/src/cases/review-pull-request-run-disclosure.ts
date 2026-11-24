import assert from "node:assert/strict";

import { FIXTURE_ROOT_PATH } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

function mentionsPath(reply: string, path: string): boolean {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const token = new RegExp(
    `(?<![\\w./-])${escaped}/?(?=$|[\\s\`'"<>\\]\\[),;:!?]|\\.(?:\\s|$))`,
  );
  return token.test(reply);
}

export function assertNamedReviewRun(
  observation: Observation,
  run: string,
): void {
  const roots = observation.repoFiles?.[FIXTURE_ROOT_PATH]?.split("\n") ?? [];
  const names = [run, `./${run}`, ...roots.map((root) => `${root}/${run}`)];
  assert.ok(
    names.some((name) => mentionsPath(observation.finalText, name)),
    `terminal reply must name the run directory ${run}`,
  );
}

export function assertNoRunFilesDisclosed(reply: string): void {
  const text = reply
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/\s+/g, " ")
    .replace(/\b(?:new|run|review|handoff) /g, "")
    .replace(/\bartifacts?\b/g, "files")
    .replace(/, (?:and |or )?| (?:and|or) /g, ",");
  const statements = [
    /\bno files? (?:(?:were|was|have been) )?(?:created|written|produced|saved)\b/,
    /\b(?:did not|didn't|never) (?:create|write|produce|save) (?:any )?files?\b/,
    /\b(?:have not|haven't) (?:(?:posted|changed) anything,)*(?:created|written|produced|saved) (?:any )?files?\b/,
    /\b(?:created|wrote|produced|saved) no (?:(?:(?:directory|payloads?),)+(?:scratch )?)?files?\b/,
    /\bstopped before (?:writing|creating) anything\b/,
    /\b(?:nothing (?:was )?(?:written|created)|before (?:writing|creating) (?:any )?files?)\b/,
  ];
  assert.ok(
    statements.some((pattern) => pattern.test(text)),
    "terminal reply must say no files were created",
  );
}
