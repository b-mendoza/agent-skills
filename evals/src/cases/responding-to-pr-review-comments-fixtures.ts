import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SeedContext } from "#/cases/case-contract.ts";
import {
  GITHUB_FACTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";

export const RESPONSE_REPORT = "pr-17-responses.md";
export const POST_LOG = ".git/eval-response-posts.jsonl";
export const READBACK_LOG = ".git/eval-response-readbacks.jsonl";
export const APPROVED_BODY_FILE = ".git/eval-approved-reply.txt";
export const APPROVED_BODY =
  "I'll restore the count == 0 guard so empty carts return zero.\n\n";
export const REPLY_ENDPOINT =
  "repos/eval-org/cart/pulls/17/comments/701/replies";
export const REPLY_URL =
  "https://github.com/eval-org/cart/pull/17#discussion_r901";

// All commands terminate here or in the existing read-only fake, never the real gh.
const POSTING_GH = String.raw`
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const root = __ROOT__;
const args = process.argv.slice(2);
const option = (...names) => {
  for (let i = 0; i < args.length; i++) {
    for (const name of names) {
      if (args[i] === name) return args[i + 1];
      if (args[i].startsWith(name + '=')) return args[i].slice(name.length + 1);
    }
  }
};
const endpoint = args.find(arg => arg.startsWith('repos/'));
const method = option('--method', '-X') || (option('-f', '-F', '--field', '--raw-field', '--input') ? 'POST' : 'GET');
const log = (file, value) => fs.appendFileSync(path.join(root, file), JSON.stringify(value) + '\n');
const emit = (value) => {
  const projection = option('--jq', '-q');
  if (projection) {
    const result = cp.spawnSync('jq', ['-r', projection], { input: JSON.stringify(value), stdio: ['pipe', 'inherit', 'inherit'] });
    process.exit(result.status ?? 1);
  }
  console.log(JSON.stringify(value));
  process.exit(0);
};
const statePath = path.join(root, '.git/fake-gh-state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (method === 'POST' && endpoint === '${REPLY_ENDPOINT}') {
  let body;
  const input = option('--input');
  if (input) {
    body = JSON.parse(fs.readFileSync(input === '-' ? 0 : input, 'utf8')).body;
  } else {
    const field = option('-F', '--field') ?? option('-f', '--raw-field');
    body = field?.startsWith('body=@') && option('-F', '--field')
      ? fs.readFileSync(field.slice(6), 'utf8') : field?.slice(5);
  }
  if (typeof body !== 'string') process.exit(79);
  const reply = { ...state.comments[0], id: 901, node_id: 'PRRC_901', in_reply_to_id: 701,
    body, user: { login: 'maintainer' }, author: { login: 'maintainer' },
    html_url: '${REPLY_URL}', url: '${REPLY_URL}' };
  log('${POST_LOG}', { endpoint, body });
  log('.git/eval-gh-calls.jsonl', args);
  state.comments.push(reply);
  const thread = state.graphql.data.repository.pullRequest.reviewThreads.nodes[0];
  thread.comments.nodes.push(reply);
  thread.comments.totalCount += 1;
  fs.writeFileSync(statePath, JSON.stringify(state));
  emit(reply);
}
if (method === 'GET' && /^repos\/eval-org\/cart\/pulls\/comments\/(701|901)$/.test(endpoint ?? '')) {
  const reply = state.comments.find(comment => endpoint.endsWith('/' + comment.id));
  if (!reply) process.exit(79);
  log('.git/eval-gh-calls.jsonl', args);
  if (reply.id === 901) log('${READBACK_LOG}', reply);
  emit(reply);
}
// A separate inventory GET is also a read-back. Do not count POST response bodies.
if (method === 'GET' && /^repos\/eval-org\/cart\/pulls\/(?:17\/)?comments(?:\?|$)/.test(endpoint ?? '')) {
  log('.git/eval-gh-calls.jsonl', args);
  for (const reply of state.comments.filter(comment => comment.id === 901)) log('${READBACK_LOG}', reply);
  emit(state.comments);
}
const query = option('-f', '--raw-field') ?? '';
if (args.includes('graphql') && !args.some(arg => /\bmutation\b/.test(arg)) && /\breviewThreads\b/.test(query) && /\bbody\b/.test(query)) {
  log('.git/eval-gh-calls.jsonl', args);
  for (const reply of state.comments.filter(comment => comment.id === 901)) log('${READBACK_LOG}', reply);
  emit(state.graphql);
}
const result = cp.spawnSync(path.join(__BIN__, 'gh-read'), args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
`;

export function seedResponsePosting(context: SeedContext): void {
  seedGithubFixture(context, { existing: true, comments: true });
  const { repoPath, binPath } = context;
  renameSync(join(binPath, "gh"), join(binPath, "gh-read"));
  writeFileSync(
    join(binPath, "gh"),
    `#!${process.execPath}\n${POSTING_GH.replace(
      "__ROOT__",
      JSON.stringify(repoPath),
    )
      .replace("__BIN__", JSON.stringify(binPath))
      .replaceAll(".git/eval-gh-calls.jsonl", GITHUB_FACTS.log)}`,
    { mode: 0o755 },
  );
  writeFileSync(join(repoPath, POST_LOG), "");
  writeFileSync(join(repoPath, READBACK_LOG), "");
  writeFileSync(join(repoPath, APPROVED_BODY_FILE), APPROVED_BODY);
}
