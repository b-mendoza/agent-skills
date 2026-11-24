import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  REVIEW_FIXTURE,
  REVIEW_POSTS,
  seedReviewFixture,
} from "#/cases/review-pull-request-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";

const SCRIPTS = fileURLToPath(
  new URL("../../../skills/review-pull-request/scripts/", import.meta.url),
);
export const TIMEOUT_MS = 30_000;
export const SUCCESS = { status: 0, stderr: "" } as const;
const HARNESS = String.raw`
import os, re, subprocess, sys
${REVIEW_FIXTURE}
scripts = Path(sys.argv[1])
run = Path('.handoffs/review-pull-request/refresh-test')
saved = Path('${GITHUB_FACTS.report}')
state_file = Path('.git/fake-gh-state.json')
api_log = Path('${GITHUB_FACTS.log}')
posts = Path('${REVIEW_POSTS}')
run.mkdir(parents=True)
context, author, _ = fixture(run)
author['findings'][0]['anchor']['path'] = 'pricing.py'
state = json.loads(state_file.read_bytes())
context.update(pr=state['pr']['url'], head=state['pr']['head']['ref'], head_sha=state['head'], base_sha=state['base'], threads=[])
author.update(thread_assessments=[])
resume = ['--resume', saved]
candidate = run / 'context-refresh.txt'
installed = run / 'context.txt'

def cli(script, *args, code=0, stdin=None):
    proc = subprocess.run([sys.executable, '-I', scripts / script, *args], input=stdin, text=True, capture_output=True)
    assert proc.returncode == code, (script, args, 'expected', code, 'got', proc.returncode, proc.stdout, proc.stderr)
    return proc

def post(*args, **kwargs): return cli('post-review.py', *args, **kwargs)
def snapshot(): return json.loads(post('--snapshot', '${GITHUB_FACTS.repository}', '17', context['head_sha']).stdout)
def put(path, mode, value): path.write_text(mode.upper() + ': PASS\n' + json.dumps(value, indent=2) + '\n')
def save_draft():
    put(installed, 'context', context)
    put(run/'author.txt', 'author', author)
    cli('render-review.py', run, saved)

def tree():
    # The fake records GETs in these two files. Include everything else, including the fake POST log.
    return {p: (('symlink', os.readlink(p)) if p.is_symlink() else None if p.is_dir() else p.read_bytes())
            for p in Path('.').rglob('*') if p not in (state_file, api_log)}

def no_writes_since(offset):
    reads = api_log.read_bytes()[offset:]
    assert b'"POST"' not in reads and b'mutation' not in reads and not posts.read_bytes(), reads
`;

export function exercise(source: string, threads = false) {
  const fixture = makeFixture("clean", [], (ctx) => {
    seedReviewFixture(ctx, { threads });
  });
  try {
    return spawnSync("python3", ["-I", "-c", HARNESS + source, SCRIPTS], {
      cwd: fixture.cwd,
      env: {
        ...process.env,
        PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
      },
      encoding: "utf8",
    });
  } finally {
    fixture.cleanup();
  }
}
