import assert from "node:assert/strict";
import { basename } from "node:path";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { pinnedShellCommands } from "#/cases/review-pull-request-shell.ts";
import { parseGitHubApiArguments } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

const FIRST = 0;
const NEXT = 1;
const OPTION_AND_VALUE = 2;
const GIT_VALUE_OPTIONS = new Set(["-C", "-c", "--git-dir", "--work-tree"]);
const NON_PATCH_DIFF_OPTIONS = new Set([
  "--quiet",
  "--check",
  "--name-only",
  "--name-status",
]);
const METADATA_DIFF_OPTIONS = new Set([
  "--stat",
  "--numstat",
  "--shortstat",
  "--dirstat",
  "--dirstat-by-file",
  "--cumulative",
  "--summary",
  "--compact-summary",
  "--raw",
]);
const PATCH_DIFF_OPTIONS = new Set([
  "--binary",
  "--patch",
  "-p",
  "-u",
  "-U",
  "--unified",
  "--patch-with-stat",
  "--patch-with-raw",
]);
const PATCH_FORMAT_OPTIONS = new Set([
  ...PATCH_DIFF_OPTIONS,
  "--no-patch",
  "-s",
]);
interface ReadTarget {
  readonly sha: string;
  readonly path: string;
  readonly base: string;
  readonly head: string;
}

function isOption(argument: string | undefined): boolean {
  return typeof argument === "string" && argument.startsWith("-");
}

function gitArguments(command: readonly string[]): readonly string[] {
  let index = NEXT;
  while (isOption(command[index])) {
    index += GIT_VALUE_OPTIONS.has(command[index] ?? "")
      ? OPTION_AND_VALUE
      : NEXT;
  }
  return command.slice(index);
}

function comparesPins(args: readonly string[], target: ReadTarget): boolean {
  if (args.includes(target.base) && args.includes(target.head)) return true;
  return (
    args.includes(`${target.base}...${target.head}`) ||
    args.includes(`${target.base}..${target.head}`)
  );
}

function diffCarriesContent(args: readonly string[]): boolean {
  const options = args.map(
    (arg) => arg.replace(/^-U\d+$/, "-U").split("=")[FIRST] ?? "",
  );
  const patchFormat = options.findLast((option) =>
    PATCH_FORMAT_OPTIONS.has(option),
  );
  return (
    !options.some((option) => NON_PATCH_DIFF_OPTIONS.has(option)) &&
    (patchFormat === undefined
      ? !options.some((option) => METADATA_DIFF_OPTIONS.has(option))
      : PATCH_DIFF_OPTIONS.has(patchFormat))
  );
}

function diffReads(args: readonly string[], target: ReadTarget): boolean {
  const separator = args.indexOf("--");
  return (
    separator >= FIRST &&
    diffCarriesContent(args.slice(FIRST, separator)) &&
    args.slice(separator + NEXT).includes(target.path) &&
    comparesPins(args.slice(FIRST, separator), target)
  );
}

function gitReads(command: readonly string[], target: ReadTarget): boolean {
  const [verb, ...args] = gitArguments(command);
  if (verb === "show") return args.includes(`${target.sha}:${target.path}`);
  if (verb === "diff") return diffReads(args, target);
  return false;
}

function readMethod(method: unknown): boolean {
  return method === "GET" || method === "HEAD";
}

function apiEndpoint(command: readonly string[]): URL | null {
  if (command[NEXT] !== "api") return null;
  const parsed = parseGitHubApiArguments(command.slice(OPTION_AND_VALUE));
  if (!readMethod(parsed.method)) return null;
  const endpoint =
    parsed.positionals.find((part) => part.includes("repos/")) ?? "";
  return new URL(endpoint.replace(/^\//, ""), "https://api.github.com/");
}

function apiReads(command: readonly string[], target: ReadTarget): boolean {
  const url = apiEndpoint(command);
  if (url === null) return false;
  const prefix = `/repos/${GITHUB_FACTS.repository}`;
  if (
    decodeURIComponent(url.pathname) === `${prefix}/contents/${target.path}`
  ) {
    return (
      url.searchParams.get("ref") === target.sha ||
      command.includes(`ref=${target.sha}`)
    );
  }
  return url.pathname === `${prefix}/compare/${target.base}...${target.head}`;
}

function reads(command: readonly string[], target: ReadTarget): boolean {
  const executable = basename(command[FIRST] ?? "");
  if (executable === "git") return gitReads(command, target);
  if (executable === "gh") return apiReads(command, target);
  return false;
}

function citationTarget(
  citation: string,
  base: string,
  head: string,
): ReadTarget {
  const [, encoded] = new URL(citation).pathname.split("/blob/");
  assert.ok(encoded !== undefined);
  const [sha, ...parts] = encoded.split("/");
  assert.ok(sha !== undefined);
  return { sha, path: decodeURIComponent(parts.join("/")), base, head };
}

export function assertPinnedReads(
  observation: Observation,
  report: string,
  base: string,
  head: string,
): void {
  const bashCalls = observation.toolCalls.filter(
    (call) => call.name === "Bash",
  );
  const hasCapturedResults = bashCalls.some(
    (call) => call.result !== undefined,
  );
  // Run-1 compatibility applies only when no Bash call has a captured result.
  // Once capture is observed, each pinned read needs a successful, nonempty result.
  const commands = bashCalls
    .filter((call) =>
      call.result === undefined
        ? !hasCapturedResults
        : !call.result.isError && call.result.content.trim() !== "",
    )
    .flatMap((call) => pinnedShellCommands(String(call.input["command"])));
  const citations = report.matchAll(
    /https:\/\/github\.com\/eval-org\/cart\/blob\/[a-f0-9]{40}\/[^\s)#]+#L\d+/g,
  );
  for (const [citation] of citations) {
    const target = citationTarget(citation, base, head);
    assert.ok(
      commands.some((command) => reads(command, target)),
      `no observed pinned reads for ${target.sha}:${target.path}`,
    );
  }
}
