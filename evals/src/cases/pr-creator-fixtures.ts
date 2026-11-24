import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SeedContext } from "#/cases/case-contract.ts";
import { FAKE_GH } from "#/cases/pr-creator-fake-gh.ts";
import { FIXTURE_ROOT_PATH, seedFixtureRoot } from "#/cases/shared-checks.ts";
import { copyHeadReflog, GH_LOG, HEAD_LOG } from "#/fixtures/fixtures.ts";

export const GITHUB_FACTS = {
  repository: "eval-org/cart",
  url: "https://github.com/eval-org/cart/pull/17",
  branch: "feature/unit-price",
  title: "refactor: simplify unit price",
  report: "pr-17-review.md",
  log: GH_LOG,
  baselineLog: ".git/eval-head-log",
  source: "pricing.py",
  sourceBaseline: ".git/eval-pricing.py",
  rootId: 701,
  comment:
    "The empty-cart contract still requires zero. Please restore the count == 0 guard; unit_price(10, 0) now divides by zero.",
  headSource:
    'def unit_price(total, count):\n    """Return zero for an empty cart."""\n    return total / count\n',
  baseSource:
    'def unit_price(total, count):\n    """Return zero for an empty cart."""\n    if count == 0:\n        return 0\n    return total / count\n',
  existingReport: "User-owned earlier review. Do not replace.\n",
} as const;

export const GITHUB_SNAPSHOTS = [
  FIXTURE_ROOT_PATH,
  GITHUB_FACTS.log,
  HEAD_LOG,
  GITHUB_FACTS.baselineLog,
  GITHUB_FACTS.source,
  GITHUB_FACTS.sourceBaseline,
] as const;

function git(repoPath: string, ...arguments_: string[]): string {
  return execFileSync("git", arguments_, {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

interface GithubFixtureOptions {
  collaborators?: readonly string[];
  issueWriteFailsOn?: { action: "comment" | "close"; number: number };
  defaultBranch?: string;
  issues?: ReadonlyArray<{
    number: number;
    title: string;
    state: "open" | "closed";
    isPr?: boolean;
    repository?: string;
  }>;
  allowEdit?: boolean;
  editFailsOn?: "pr edit" | "pr ready";
  mutateBeforeEdit?: boolean;
  allowIssueWrites?: boolean;
  me?: string;
  existing?: boolean;
  comments?: boolean;
  existingReport?: boolean;
  allowCreate?: boolean;
  readbackDrift?: boolean;
  readback?: Readonly<Record<string, unknown>>;
  baseSource?: string;
  headSource?: string;
  templates?: Readonly<Record<string, string>>;
}

function fixtureSources(options: GithubFixtureOptions) {
  return {
    baseSource: options.baseSource ?? GITHUB_FACTS.baseSource,
    headSource: options.headSource ?? GITHUB_FACTS.headSource,
  };
}

function seedTemplates(repoPath: string, options: GithubFixtureOptions): void {
  for (const [path, text] of Object.entries(options.templates ?? {})) {
    const destination = join(repoPath, path);
    mkdirSync(join(destination, ".."), { recursive: true });
    writeFileSync(destination, text);
    git(repoPath, "add", path);
  }
}

function seedExistingReport(
  repoPath: string,
  options: GithubFixtureOptions,
): void {
  if (options.existingReport === true) {
    writeFileSync(
      join(repoPath, GITHUB_FACTS.report),
      GITHUB_FACTS.existingReport,
    );
  }
}

function seedDefaultBranch(repoPath: string, options: GithubFixtureOptions) {
  const defaultBranch = options.defaultBranch ?? "main";
  if (defaultBranch !== "main") git(repoPath, "branch", defaultBranch, "main");
  return defaultBranch;
}

function seedRemote(
  context: SeedContext,
  options: GithubFixtureOptions,
  defaultBranch: string,
): void {
  const { repoPath } = context;
  const remote = join(repoPath, ".git", "fixture-origin.git");
  git(repoPath, "clone", "--bare", "--quiet", repoPath, remote);
  if (options.defaultBranch !== undefined) {
    git(remote, "symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`);
  }
  // Preserve GitHub identity in URL inspection while all SSH transport stays local.
  git(
    repoPath,
    "config",
    "core.sshCommand",
    `sh -c 'exec git-upload-pack "$1"' fixture-ssh ${JSON.stringify(remote)}`,
  );
  git(repoPath, "config", "ssh.variant", "ssh");
  git(
    repoPath,
    "remote",
    "add",
    "origin",
    `git@github.com:${GITHUB_FACTS.repository}.git`,
  );
  git(repoPath, "fetch", "-q", "origin");
  git(
    repoPath,
    "symbolic-ref",
    "refs/remotes/origin/HEAD",
    `refs/remotes/origin/${defaultBranch}`,
  );
  git(repoPath, "branch", "--set-upstream-to", `origin/${GITHUB_FACTS.branch}`);
}

function actionOptions(options: GithubFixtureOptions) {
  return {
    collaborators: options.collaborators,
    allow_edit: options.allowEdit === true,
    edit_fails_on: options.editFailsOn,
    mutate_before_edit: options.mutateBeforeEdit === true,
    issues: options.issues,
    issue_write_fails_on: options.issueWriteFailsOn,
    allow_issue_writes: options.allowIssueWrites === true,
    me: options.me ?? "maintainer",
  };
}

export function seedGithubFixture(
  context: SeedContext,
  options: GithubFixtureOptions = {},
): void {
  const { repoPath, binPath } = context;
  seedFixtureRoot(repoPath);
  const { baseSource, headSource } = fixtureSources(options);
  seedTemplates(repoPath, options);
  git(repoPath, "branch", "-M", "main");
  writeFileSync(join(repoPath, GITHUB_FACTS.source), baseSource);
  git(repoPath, "add", GITHUB_FACTS.source);
  git(repoPath, "commit", "-qm", "feat: define empty-cart unit price");
  const base = git(repoPath, "rev-parse", "HEAD");
  git(repoPath, "switch", "-qc", GITHUB_FACTS.branch);
  writeFileSync(join(repoPath, GITHUB_FACTS.source), headSource);
  git(repoPath, "add", GITHUB_FACTS.source);
  git(repoPath, "commit", "-qm", GITHUB_FACTS.title);
  const head = git(repoPath, "rev-parse", "HEAD");
  const diff = execFileSync("git", ["diff", `${base}...${head}`], {
    cwd: repoPath,
    encoding: "utf8",
  });
  const defaultBranch = seedDefaultBranch(repoPath, options);
  seedRemote(context, options, defaultBranch);
  appendFileSync(join(repoPath, ".git/info/exclude"), "\n.handoffs/\n");
  copyHeadReflog(repoPath, GITHUB_FACTS.baselineLog);
  writeFileSync(join(repoPath, GITHUB_FACTS.sourceBaseline), headSource);
  writeFileSync(join(repoPath, GITHUB_FACTS.log), "");
  seedExistingReport(repoPath, options);
  const comment = {
    id: GITHUB_FACTS.rootId,
    node_id: "PRRC_701",
    body: GITHUB_FACTS.comment,
    path: GITHUB_FACTS.source,
    line: 3,
    original_line: 3,
    side: "RIGHT",
    user: { login: "reviewer" },
    author: { login: "reviewer" },
    html_url: `${GITHUB_FACTS.url}#discussion_r701`,
    url: `${GITHUB_FACTS.url}#discussion_r701`,
    pull_request_url: `https://api.github.com/repos/${GITHUB_FACTS.repository}/pulls/17`,
    created_at: "2026-10-20T12:00:00Z",
    updated_at: "2026-10-20T12:00:00Z",
    commit_id: head,
    original_commit_id: head,
    diff_hunk: diff,
    fullDatabaseId: "701",
  };
  const comments = options.comments === true ? [comment] : [];
  const repo = {
    name: "cart",
    nameWithOwner: GITHUB_FACTS.repository,
    full_name: GITHUB_FACTS.repository,
    owner: { login: "eval-org" },
    default_branch: defaultBranch,

    defaultBranchRef: { name: defaultBranch },
    isFork: false,
    fork: false,
    parent: null,
    viewerPermission: "ADMIN",
  };
  const [addedLines, deletedLines] = git(
    repoPath,
    "diff",
    "--numstat",
    `${base}...${head}`,
  ).split("\t");
  const additions = Number(addedLines);
  const deletions = Number(deletedLines);
  const files = [
    {
      path: GITHUB_FACTS.source,
      filename: GITHUB_FACTS.source,
      status: "modified",
      additions,
      deletions,
      patch: diff,
    },
  ];
  const pr = {
    number: 17,
    title: GITHUB_FACTS.title,
    body: "Simplify unit_price while preserving the empty-cart zero contract.",
    url: GITHUB_FACTS.url,
    html_url: GITHUB_FACTS.url,
    state: "OPEN",
    isDraft: true,
    draft: true,
    merged: false,
    mergedAt: null,
    author: { login: "maintainer" },
    user: { login: "maintainer" },
    baseRefName: "main",
    headRefName: GITHUB_FACTS.branch,
    baseRefOid: base,
    headRefOid: head,
    base: { ref: "main", sha: base, repo },
    head: { ref: GITHUB_FACTS.branch, sha: head, repo },
    labels: [],
    assignees: [],
    reviewRequests: [],
    reviews: [],
    comments: [],
    files,
    statusCheckRollup: [],
    additions,
    deletions,
    changedFiles: 1,
  };
  const nodes = comments.map((entry) => ({
    id: "PRRT_701",
    isResolved: false,
    isOutdated: false,
    path: GITHUB_FACTS.source,
    line: 3,
    comments: {
      totalCount: 1,
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [entry],
    },
  }));
  const actions = actionOptions(options);
  const graphql = {
    data: {
      viewer: { login: actions.me },
      repository: {
        ...repo,
        pullRequest: {
          ...pr,
          state: "OPEN",
          reviewThreads: {
            totalCount: nodes.length,
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes,
          },
        },
      },
    },
  };
  writeFileSync(
    join(repoPath, ".git/fake-gh-state.json"),
    JSON.stringify({
      repo,
      pr,
      comments,
      graphql,
      diff,
      base,
      head,
      existing: options.existing === true,
      base_source: baseSource,
      head_source: headSource,
      ...actions,
      allow_create: options.allowCreate === true,
      readback_drift: options.readbackDrift === true,
      readback: options.readback ?? {},
    }),
  );
  mkdirSync(binPath, { recursive: true });
  writeFileSync(
    join(binPath, "gh"),
    FAKE_GH.replace("__EVAL_REPO_PATH__", JSON.stringify(repoPath)),
    { mode: 0o755 },
  );
}
