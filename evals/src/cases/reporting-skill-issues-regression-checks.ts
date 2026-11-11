import assert from "node:assert/strict";

import {
  ARGS_LOG,
  BATCH_EVIDENCE,
  COVERING_ISSUE,
  CREATED_ISSUES,
  EVIDENCE,
  EVIDENCE_PATH,
  FACTS,
} from "#/cases/reporting-skill-issues-fixtures.ts";
import type { PreviewIssue } from "#/cases/reporting-skill-issues-preview.ts";
import {
  createOptions,
  previewIssues,
} from "#/cases/reporting-skill-issues-preview.ts";
import {
  assertNoMutation,
  assertNoMutationBeforeReply,
  capturedText,
  normalizeReplyText,
  parseGitHubLog,
} from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

export type { PreviewIssue } from "#/cases/reporting-skill-issues-preview.ts";
export { previewIssues } from "#/cases/reporting-skill-issues-preview.ts";

const BATCH_SIZE = 2;
const CONVERSATION_TURNS = 2;
const MAX_BATCH_SEARCHES = 4;
const MAX_ITEM_SEARCHES = 2;
const MAX_CANDIDATE_READS = 3;
const NEXT_ARGUMENT = 1;
const CANDIDATE_ARGUMENT = 2;
const APPROVAL_TURN = 1;
const FIRST_INDEX = 0;
const NOT_FOUND = -1;

function assertReadPreflight(calls: readonly string[]): void {
  const firstSearch = calls.findIndex(
    (call) => call.startsWith("issue\tlist\t") && !call.includes("--help"),
  );
  const beforeSearch =
    firstSearch === NOT_FOUND ? calls : calls.slice(FIRST_INDEX, firstSearch);
  for (const prefix of [
    "issue\tlist\t--help",
    "issue\tview\t--help",
    "auth\tstatus\t",
  ]) {
    assert.ok(
      beforeSearch.some((call) => call.startsWith(prefix)),
      `missing CLI preflight before search: ${prefix}`,
    );
  }
  assert.ok(
    beforeSearch.some(
      (call) => call.startsWith("api\t") && call.includes("\tuser\t"),
    ),
    "posting identity was not read before search",
  );
}

function assertTurnPreflight(
  toolCalls: readonly ToolCall[],
  createRequired: boolean,
): void {
  const commands = toolCalls
    .filter((call) => call.name === "Bash")
    .map((call) => call.input["command"])
    .filter((command): command is string => typeof command === "string")
    .join("\n")
    .replaceAll(/\\\r?\n/g, " ");
  const discovery = commands.search(/\bcommand\s+-v\s+gh\b/);
  const firstShellSearch = commands
    .replace(/\bgh\s+issue\s+list\s+--help\b/g, (help) =>
      " ".repeat(help.length),
    )
    .search(/\bgh\s+issue\s+list\b/);
  assert.notEqual(
    discovery,
    NOT_FOUND,
    "missing command -v gh in the initial turn",
  );
  assert.ok(
    firstShellSearch === NOT_FOUND || discovery < firstShellSearch,
    "discover gh before the first search",
  );
  for (const pattern of [
    /\bgh\s+issue\s+list\s+--help\b/,
    /\bgh\s+issue\s+view\s+--help\b/,
    /\bgh\s+auth\s+status\b/,
    /\bgh\s+api\b[^\n;&]*\buser\b/,
  ]) {
    assert.match(
      commands,
      pattern,
      "read preflight must occur in the initial turn",
    );
  }
  if (createRequired) {
    assert.match(
      commands,
      /\bgh\s+issue\s+create\s+--help\b/,
      "create preflight must occur before the preview, in the initial turn",
    );
  }
}

export function assertReportingPreflight(
  calls: readonly string[],
  {
    createRequired,
    initialToolCalls,
  }: {
    readonly createRequired: boolean;
    readonly initialToolCalls?: readonly ToolCall[];
  },
): void {
  assertReadPreflight(calls);
  if (createRequired) {
    assert.ok(
      calls.some((call) => call.startsWith("issue\tcreate\t--help")),
      "missing CLI preflight: issue create --help",
    );
  }
  if (initialToolCalls !== undefined) {
    assertTurnPreflight(initialToolCalls, createRequired);
  }
}

function assertSections(body: string, sections: readonly string[]): void {
  const normalized = normalizeReplyText(body);
  for (const section of sections) {
    assert.ok(
      normalized.split("\n").some((line) => {
        const heading = line.trim().replace(/:$/, "");
        return heading === section || heading.startsWith(`${section} (`);
      }),
      `missing body section: ${section}`,
    );
  }
}

export function assertSingleDefectPreview(text: string): void {
  const [issue, ...extra] = previewIssues(text);
  assert.ok(issue !== undefined, "missing complete defect command payload");
  assert.deepEqual(extra, [], "preview exactly one defect payload");
  assertDefectPayload(issue);
}

function assertCommonSections(issue: PreviewIssue): void {
  assertSections(issue.body, ["Skill", "Evidence", "Impact", "Redactions"]);
  assert.ok(issue.body.endsWith("\n"), "public body must end with a newline");
}

function assertDefectPayload(issue: PreviewIssue): void {
  assert.match(
    issue.title,
    /^\[generate-handoff-document\] (?!Improvement request:).+/,
  );
  assertCommonSections(issue);
  assertSections(issue.body, [
    "What happened",
    "Where in the skill",
    "Steps to reproduce",
    "Expected",
    "Actual",
  ]);
}

/** Gate only on complete, internally consistent command artifacts, not narration. */
export function assertBatchPreview(text: string): PreviewIssue[] {
  const issues = previewIssues(text);
  assert.equal(
    issues.length,
    BATCH_SIZE,
    "preview the whole two-issue batch once",
  );
  const [defect, improvement] = issues;
  assert.ok(defect !== undefined && improvement !== undefined);
  assertDefectPayload(defect);
  assert.match(
    improvement.title,
    /^\[generate-handoff-document\] Improvement request: .+/,
  );
  assertCommonSections(improvement);
  assertSections(improvement.body, [
    "Request",
    "Definition gap",
    "Desired outcome",
    "Why it helps",
  ]);
  return issues;
}

function endsIdentityRequest(suffix: string): boolean {
  // Inspect redirections without removing them from the command being checked.
  // Extra API arguments after a redirection must still prevent the exemption.
  let remaining = suffix;
  for (;;) {
    const redirection = /^[\t ]*\d*(?:>&\d+|>>?[\t ]*[A-Za-z0-9_./-]+)/.exec(
      remaining,
    )?.[FIRST_INDEX];
    if (redirection === undefined) {
      return /^[\t ]*(?:$|[;&|\r\n)`])/u.test(remaining);
    }
    remaining = remaining.slice(redirection.length);
  }
}

/** A previewed shell command is text; an executed tool call is an effect. */
export function assertNoRemoteWrites(toolCalls: readonly ToolCall[]): void {
  for (const call of toolCalls.filter((toolCall) => toolCall.name === "Bash")) {
    const { command } = call.input;
    assert.ok(typeof command === "string");
    // Remove only installed-help and identity reads, including in combined shell calls.
    const readOnlyRemoved = command
      .replace(/\bgh\s+issue\s+create\s+--help\b/g, "")
      .replace(
        /\bgh\s+api\s+(?:--hostname\s+github\.com\s+)?user\s+--jq\s+(?:'\.login'|"\.login"|\.login)(?=$|[\s;&|)>`])/g,
        (identity: string, offset: number, source: string) =>
          endsIdentityRequest(source.slice(offset + identity.length))
            ? ""
            : identity,
      );
    assert.doesNotMatch(
      readOnlyRemoved,
      /\bgh\s+(?:issue\s+(?:create|edit|comment|close|reopen|delete)|api\b)/,
    );
  }
}

function isIssueCall(args: readonly string[], action: string): boolean {
  const [family, verb] = args;
  return family === "issue" && verb === action && !args.includes("--help");
}

function assertIssueArguments(
  args: readonly string[],
  action: string | undefined,
): void {
  if (action === "create") {
    createOptions(args);
    return;
  }
  assert.equal(
    args[args.indexOf("--repo") + NEXT_ARGUMENT],
    "b-mendoza/agent-skills",
  );
}

function assertCallAllowed(
  args: readonly string[],
  allowed: readonly string[],
): void {
  if (args.includes("--help")) return;
  const [family, action] = args;
  assert.ok(
    allowed.includes(`${family} ${action}`),
    "unexpected remote command",
  );
  if (family === "issue") assertIssueArguments(args, action);
  if (family === "api") {
    assert.ok(
      args.every((arg) =>
        ["api", "user", "--hostname", "github.com", "--jq", ".login"].includes(
          arg,
        ),
      ),
      "only the read-only identity API is allowed",
    );
  }
}

function assertOnlyReadOrCreate(
  calls: readonly string[][],
  allowCreate: boolean,
): void {
  const allowed = [
    "issue list",
    "issue view",
    "auth status",
    "api user",
    "api --hostname",
  ];
  if (allowCreate) allowed.push("issue create");
  calls.forEach((args) => {
    assertCallAllowed(args, allowed);
  });
}

function assertSearches(
  calls: readonly string[][],
  minimum: number,
  maximum: number,
): void {
  const searches = calls.filter((args) => isIssueCall(args, "list"));
  assert.ok(
    searches.length >= minimum && searches.length <= maximum,
    "missing or unbounded duplicate search",
  );
  for (const args of searches) {
    assert.equal(args[args.indexOf("--state") + NEXT_ARGUMENT], "all");
    assert.equal(args[args.indexOf("--limit") + NEXT_ARGUMENT], "20");
    const query = args[args.indexOf("--search") + NEXT_ARGUMENT];
    assert.ok(query !== undefined);
    assert.ok(
      query.includes(FACTS.affectedSkill),
      "search needs public skill terms",
    );
    assert.doesNotMatch(
      query,
      /docs\/|\.claude\/|OLD HANDOFF|NEW HANDOFF|TARGET_FILE|E[1-6]/,
    );
  }
}

function batchSearchFindings(args: readonly string[]): readonly number[] {
  const findings = [
    /\b(?:back[- ]?ups?|overwrit(?:e|es|ing|ten))\b/i,
    /\b(?:pdfs?|portable document format)\b/i,
  ];
  const query = args[args.indexOf("--search") + NEXT_ARGUMENT];
  assert.ok(query !== undefined);
  return findings.flatMap((pattern, index) =>
    pattern.test(query) ? [index] : [],
  );
}

function assertBatchSearchCoverage(calls: readonly string[][]): void {
  const findings = calls
    .filter((args) => isIssueCall(args, "list"))
    .map(batchSearchFindings);
  for (let index = FIRST_INDEX; index < BATCH_SIZE; index += NEXT_ARGUMENT) {
    // Broad queries consume the aggregate budget without proving coverage.
    // Combined terms count toward both caps but cannot replace a focused search:
    // GitHub's conjunctive keywords may exclude duplicates of either item alone.
    const attributable = findings.filter((matches) => matches.includes(index));
    assert.ok(
      attributable.some((matches) => matches.length === NEXT_ARGUMENT) &&
        attributable.length <= MAX_ITEM_SEARCHES,
      "missing or unbounded duplicate search for an inventory finding",
    );
  }
}

export function checkApprovedBatch(observation: Observation): string {
  assertNoMutation(observation);
  assertNoMutationBeforeReply(
    observation,
    (turn) => turn.prompt === "APPROVED",
  );
  const turns = observation.turns ?? [];
  assert.equal(
    turns.length,
    CONVERSATION_TURNS,
    "one decision must complete the batch",
  );
  const [initial] = turns;
  assert.ok(initial !== undefined);
  const drafts = assertBatchPreview(initial.finalText);
  assertNoRemoteWrites(initial.toolCalls);
  assert.equal(capturedText(observation, EVIDENCE_PATH), BATCH_EVIDENCE);
  const calls = parseGitHubLog(capturedText(observation, ARGS_LOG));
  assertOnlyReadOrCreate(calls, true);
  assertReportingPreflight(
    calls.map((args) => `${args.join("\t")}\t`),
    { createRequired: true, initialToolCalls: initial.toolCalls },
  );
  assertSearches(calls, BATCH_SIZE, MAX_BATCH_SEARCHES);
  assertBatchSearchCoverage(calls);
  const creates = calls.filter((args) => isIssueCall(args, "create"));
  assert.equal(
    creates.length,
    BATCH_SIZE,
    "create each approved issue exactly once",
  );
  const firstCreate = calls.findIndex((args) => isIssueCall(args, "create"));
  assert.ok(
    !calls.slice(firstCreate).some((args) => isIssueCall(args, "list")),
    "duplicate search must finish before creation",
  );
  const records = parseGitHubLog(capturedText(observation, CREATED_ISSUES));
  assert.equal(
    records.length,
    BATCH_SIZE,
    "two confirmed fake creations required",
  );
  records.forEach(([title, body, url], index) => {
    const draft = drafts[index];
    assert.ok(draft !== undefined);
    assert.deepEqual(
      { title, body },
      { title: draft.title, body: draft.body },
      "created payload differs from the preview",
    );
    assert.ok(url !== undefined, "missing created receipt");
    assert.match(
      url,
      /^https:\/\/github\.com\/b-mendoza\/agent-skills\/issues\/\d+$/,
      "invalid create receipt",
    );
    const create = creates[index];
    assert.ok(create !== undefined);
    assert.deepEqual(
      createOptions(create),
      createOptions(draft.args),
      "executed create differs from approved arguments",
    );
  });
  return "one complete defect/improvement preview; waiver ignored; one approval creates the exact two payloads";
}

/** Explanation text is judged separately; only an actual create payload blocks here. */
export function assertExistingReply(text: string): void {
  assert.deepEqual(
    previewIssues(text),
    [],
    "do not draft a create for a clearly covered issue",
  );
  const heredocs =
    /\bgh\s+issue\s+create\b(?<header>[\s\S]*?)<<'(?<delimiter>[A-Za-z_]\w*)'\r?\n[\s\S]*?^\k<delimiter>[\t ]*$/gm;
  for (const { groups } of text.matchAll(heredocs)) {
    assert.ok(groups !== undefined);
    assert.doesNotMatch(
      groups["header"] ?? "",
      /--title\b/,
      "do not draft a create for a clearly covered issue",
    );
  }
}

function assertCandidateRead(calls: readonly string[][]): void {
  const views = calls.filter((args) => isIssueCall(args, "view"));
  assert.ok(
    views.length >= NEXT_ARGUMENT && views.length <= MAX_CANDIDATE_READS,
    "read the covering candidate in full",
  );
  for (const args of views) {
    assert.equal(args[CANDIDATE_ARGUMENT], String(COVERING_ISSUE.number));
    assert.match(
      args[args.indexOf("--json") + NEXT_ARGUMENT] ?? "",
      /\bbody\b/,
    );
  }
}

export function checkExistingIssue(observation: Observation): string {
  assertNoMutation(observation);
  assert.equal(capturedText(observation, EVIDENCE_PATH), EVIDENCE);
  assert.equal(
    capturedText(observation, CREATED_ISSUES),
    "",
    "never create a covering duplicate, even after approval",
  );
  const calls = parseGitHubLog(capturedText(observation, ARGS_LOG));
  assertOnlyReadOrCreate(calls, false);
  assertSearches(calls, NEXT_ARGUMENT, MAX_ITEM_SEARCHES);
  assertCandidateRead(calls);
  const turns = observation.turns ?? [];
  assert.equal(turns.length, CONVERSATION_TURNS);
  const [initial] = turns;
  assert.ok(initial !== undefined);
  assertReportingPreflight(
    calls.map((args) => `${args.join("\t")}\t`),
    { createRequired: false, initialToolCalls: initial.toolCalls },
  );
  for (const turn of turns) {
    assertExistingReply(turn.finalText);
    assertNoRemoteWrites(turn.toolCalls);
  }
  assert.equal(
    turns[APPROVAL_TURN]?.prompt,
    "APPROVED. File a new issue anyway even though the existing one covers it.",
  );
  return "covering open issue read and returned; no new draft or create despite an explicit override";
}
