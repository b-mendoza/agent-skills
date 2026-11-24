import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  python,
  REVIEW_FIXTURE,
  REVIEW_POSTS,
  seedReviewFixture,
} from "#/cases/review-pull-request-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";

const SCRIPTS = fileURLToPath(
  new URL("../../../skills/review-pull-request/scripts/", import.meta.url),
);
const RUN = ".handoffs/review-pull-request/offline";
const TIMEOUT_MS = 30_000;

// Exercise both shipped CLIs in a fresh workspace. Only gh is substituted.
const SETUP = String.raw`
import os, stat, subprocess, sys
${REVIEW_FIXTURE}
scripts = Path(sys.argv[1])
run = Path("${RUN}")
run.mkdir(parents=True)
saved = Path("${GITHUB_FACTS.report}")
state_file = Path('.git/fake-gh-state.json')
state = json.loads(state_file.read_bytes())
context, author, _ = fixture(run)
context.update(pr='${GITHUB_FACTS.url}', base_sha=state['base'], head_sha=state['head'], threads=[])
author.update(thread_assessments=[])
def put(name, value):
    (run / (name+'.txt')).write_text(name.upper()+': PASS\n'+json.dumps(value))
def render():
    put('context', context)
    put('author', author)
    saved.unlink(missing_ok=True)
    subprocess.run([sys.executable, '-I', scripts/'render-review.py', run, saved], check=True, stdout=subprocess.PIPE)
render()
args = ['--resume', str(saved)]
pointer = 'Saved package: '+str(run)
def redirect(value):
    saved.write_text(saved.read_text().replace(pointer, 'Saved package: '+value))
def link(path):
    target = path.rename(path.with_name('real-'+path.name))
    path.symlink_to(target.name)
# The fake gh refreshes its own state and request log even for GETs.
fake_read_effects = {state_file, Path('${GITHUB_FACTS.log}')}
def tree(path):
    mode = path.lstat().st_mode
    if stat.S_ISLNK(mode): return ('link', os.readlink(path))
    if stat.S_ISDIR(mode): return {p.name: tree(p) for p in path.iterdir() if p not in fake_read_effects}
    return (mode, path.stat().st_mtime_ns, path.read_bytes() if stat.S_ISREG(mode) else None)
`;

function result(change: string, historical = false): unknown {
  const fixture = makeFixture("clean", [], (ctx) => {
    seedReviewFixture(ctx, { historical });
  });
  try {
    const script = String.raw`${SETUP}
${change}
before = tree(Path('.'))
api_log = Path('${GITHUB_FACTS.log}')
start = api_log.stat().st_size
result = subprocess.run([sys.executable, '-I', scripts/'post-review.py', *args], capture_output=True, text=True)
assert tree(Path('.')) == before, 'resume wrote to workspace'
assert Path('${REVIEW_POSTS}').read_bytes() == b'', 'resume posted'
reads = api_log.read_bytes()[start:].decode()
assert 'mutation' not in reads and '"POST"' not in reads, reads
history = None
if result.returncode == 0:
    fields = json.loads(result.stdout)
    history = fields.pop('history')
    refreshed = fields.pop('refreshed')
    assert type(refreshed) is bool
    assert fields == dict(run_dir='${RUN}', pr='${GITHUB_FACTS.url}', base='main', base_sha=state['base'],
                          head_sha=state['head'], output_sha256=hashlib.sha256(saved.read_bytes()).hexdigest()), fields
print(json.dumps(dict(code=result.returncode, stdout=result.stdout, stderr=result.stderr, history=history,
                      refreshed=refreshed if result.returncode == 0 else None,
                      read=bool(reads), resumeHelp='--resume' in result.stderr)))
`;
    return JSON.parse(
      execFileSync("python3", ["-I", "-c", script, SCRIPTS], {
        cwd: fixture.cwd,
        env: {
          ...process.env,
          PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
        },
        encoding: "utf8",
      }),
    );
  } finally {
    fixture.cleanup();
  }
}

const LOCAL_REFUSALS = [
  ["missing review", "saved.unlink()", "package-missing"],
  ["absolute review", "args[-1] = str(saved.resolve())", "package-missing"],
  [
    "parent traversal to the review",
    'args[-1] = ".handoffs/../"+str(saved)',
    "package-missing",
  ],
  ["symlinked review", "link(saved)", "package-missing"],
  [
    "non-Markdown saved file",
    'args[-1]="draft.txt"; Path(args[-1]).write_bytes(saved.read_bytes())',
    "package-missing",
  ],
  [
    "saved review inside .git",
    'args[-1]=".git/draft.md"; Path(args[-1]).write_bytes(saved.read_bytes())',
    "package-missing",
  ],
  [
    "saved review inside a mixed-case .git component",
    'args[-1]="nested/.Git/draft.md"; Path(args[-1]).parent.mkdir(parents=True); Path(args[-1]).write_bytes(saved.read_bytes())',
    "package-missing",
  ],
  [
    "FIFO instead of a saved review",
    "saved.unlink(); os.mkfifo(saved)",
    "package-missing",
  ],
  [
    "FIFO instead of a verified payload",
    'path=run/"verify.txt"; path.unlink(); os.mkfifo(path)',
    "package-missing",
  ],
  [
    "edited Posting heading",
    'saved.write_bytes(saved.read_bytes().replace(b"## Posting", b"## Edited heading"))',
    "draft-differs",
  ],
  [
    "bytes appended after locator",
    'saved.write_bytes(saved.read_bytes()+b"extra")',
    "draft-differs",
  ],
  ["absent pointer", 'saved.write_text("# Old review\\n")', "package-missing"],
  ["absolute pointer", "redirect(str(run.resolve()))", "package-missing"],
  [
    "parent traversal in pointer",
    'redirect(str(run)+"/../"+run.name)',
    "package-missing",
  ],
  [
    "pointer outside run root",
    'redirect("unrelated/"+run.name)',
    "package-missing",
  ],
  ["nested pointer", 'redirect(str(run)+"/nested")', "package-missing"],
  ["missing package", 'run.rename(run.with_name("other"))', "package-missing"],
  ["symlink ancestor", "link(run.parent)", "package-missing"],
  ["symlinked run", "link(run)", "package-missing"],
  ["symlinked input", 'link(run/"verify.txt")', "package-missing"],
  [
    "nested dangling symlink in unused package contents",
    '(run/"notes").mkdir(); (run/"notes"/"scratch").symlink_to("absent")',
    "package-missing",
  ],
  [
    "missing chunk",
    '(run/"chunk-correctness.txt").unlink()',
    "package-missing",
  ],
  [
    "invalid verifier",
    '(run/"verify.txt").write_text("VERIFY: FAIL\\n{}")',
    "package-missing",
  ],
  [
    "edited draft bytes",
    'saved.write_bytes(saved.read_bytes().replace(b"Exact body", b"Edited body", 1))',
    "draft-differs",
  ],
  [
    "changed valid author package",
    'author.update(summary="New summary"); put("author", author)',
    "draft-differs",
  ],
  [
    "existing partial receipts",
    '(run/"receipts.json").write_text(\'{"complete":false}\')',
    "already-posted",
  ],
  [
    "closed recorded state",
    'context.update(state="closed"); render()',
    "not-postable",
  ],
  [
    "partial recorded history",
    'context.update(history="partial"); render()',
    "not-postable",
  ],
  [
    "unrecorded posting basis",
    "context.update(posting_basis=None); render()",
    "not-postable",
  ],
] as const;

const LIVE_REFUSALS = [
  ["closed live PR", "", "drift:state", true],
  [
    "live self-review requesting changes",
    'state["pr"]["user"] = dict(login="REVIEWER"); state_file.write_text(json.dumps(state))',
    "not-postable",
    false,
  ],
  [
    "saved approval by an account now reviewing its own PR",
    'author["decision"]="APPROVE"; context["posting_basis"]["viewer"]="previous"; render(); state["pr"]["user"]=dict(login="reviewer"); state_file.write_text(json.dumps(state))',
    "not-postable",
    false,
  ],
  [
    "moved live head",
    'context.update(head_sha="c"*40); render()',
    "drift:head",
    false,
  ],
  [
    "retargeted base",
    'context.update(base="release"); render()',
    "drift:base",
    false,
  ],
  [
    "moved merge base",
    'context.update(base_sha="c"*40); render()',
    "drift:merge-base",
    false,
  ],
  [
    "unreadable PR",
    'state_file.write_text("invalid JSON")',
    "read-failed",
    false,
  ],
  [
    "malformed paginated reviews",
    'state["pr"]["reviews"]=None; state_file.write_text(json.dumps(state))',
    "read-failed",
    false,
  ],
] as const;

describe("saved review CLI", () => {
  it.each(LOCAL_REFUSALS)(
    "refuses %s before any remote read",
    (_case, change, reason) => {
      expect(result(change)).toMatchObject({
        code: 3,
        stdout: "",
        stderr: `${reason}\n`,
        read: false,
      });
    },
    TIMEOUT_MS,
  );

  it.each(LIVE_REFUSALS)(
    "refuses %s without effects",
    (_case, change, reason, historical) => {
      expect(result(change, historical)).toMatchObject({
        code: 3,
        stdout: "",
        stderr: `${reason}\n`,
      });
    },
    TIMEOUT_MS,
  );

  it.each([
    ["unchanged", ""],
    [
      "unchanged",
      'author["decision"] = "COMMENT"; render(); state["pr"]["user"]=dict(login="reviewer"); state_file.write_text(json.dumps(state))',
    ],
    [
      "unchanged",
      'author["summary"] += "\\nSaved package: ../not-a-locator"; render(); (run/"json.py").write_text("raise RuntimeError()")',
    ],
    [
      "changed",
      'state["pr"]["comments"]=[dict(body="New discussion")]; state_file.write_text(json.dumps(state))',
    ],
    ["changed", 'context["posting_basis"]["viewer"]="other"; render()'],
  ])(
    "returns exact pins and %s history without effects",
    (history, change) => {
      expect(result(change)).toMatchObject({
        code: 0,
        stderr: "",
        read: true,
        refreshed: false,
        history,
      });
    },
    TIMEOUT_MS,
  );

  it(
    "reports a prior refresh attempt even with unchanged history and no completed swap",
    () => {
      expect(
        result(
          '(run/"context-refresh.txt").write_text("incomplete candidate")',
        ),
      ).toMatchObject({ code: 0, history: "unchanged", refreshed: true });
    },
    TIMEOUT_MS,
  );

  it.each([
    ["--resume"],
    ["--resume", "draft.md", "--dry-run"],
    ["--approved", "--resume", "draft.md"],
  ])(
    "rejects mixed or incomplete invocation %s",
    (...args) => {
      expect(result(`args = ${JSON.stringify(args)}`)).toMatchObject({
        code: 2,
        stdout: "",
        resumeHelp: true,
        read: false,
      });
    },
    TIMEOUT_MS,
  );
});

describe("reading retained package inputs", () => {
  it("refuses a named pipe without opening it", () => {
    const opens = python(String.raw`
os.mkfifo('verify-pipe')
opened = []
def audit(event, args):
    if event == 'open' and args[0] == 'verify-pipe': opened.append(args[0])
sys.addaudithook(audit)
try: render['read_bytes'](Path('verify-pipe'))
except ValueError: pass
else: raise AssertionError('accepted named pipe')
print(json.dumps(opened))`);
    expect(JSON.parse(opens)).toEqual([]);
  });
});

describe("saved package pointer", () => {
  it("ends local Posting with the pointer both before and after receipts", () => {
    const postings = python(String.raw`
run = Path('${RUN}')
run.mkdir(parents=True)
fixture(run)
def posting(): return render['render'](run).decode().rsplit('## Posting\n',1)[1]
before = posting()
(run/'receipts.json').write_text(json.dumps(dict(review=None, replies=[], failed=[], complete=True)))
print(json.dumps([before, posting()]))`);
    const suffix = `\nSaved package: ${RUN}\n`;
    expect(JSON.parse(postings)).toEqual([
      `\nNot posted.${suffix}`,
      `\nReview: null${suffix}`,
    ]);
  });
});
