import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { SeedContext } from "#/cases/case-contract.ts";
import {
  GITHUB_FACTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import { reviewApi } from "#/cases/review-pull-request-fake-api.ts";
import { registerReviewFixture } from "#/cases/review-pull-request-gates.ts";
import { copyHeadReflog } from "#/fixtures/fixtures.ts";

export const REVIEW_ACCOUNT = "reviewer";
export const REVIEW_POSTS = ".git/review-posts.jsonl";
export const REOPEN_APPROVAL = ".git/reopen-approved";
export const UNRESOLVE =
  "mutation($id:ID!){unresolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}";
export const REOPEN_THREAD = "PRRT_701";
export const LATE_CI_READS = ".git/review-late-ci-reads.jsonl";
export const TICKET_LOG = ".git/ticket-reads.jsonl";
export const TICKET_URL = "https://tickets.example.test/CART-17";
export const SENTINEL = ".handoffs/review-pull-request/unrelated/keep.txt";

export const FEEDBACK_URL = {
  review: `${GITHUB_FACTS.url}#pullrequestreview-810`,
  discussion: `${GITHUB_FACTS.url}#issuecomment-811`,
} as const;

export interface ReviewFixtureOptions {
  readonly feedback?: keyof typeof FEEDBACK_URL;
  readonly drift?: "thread" | "head";
  readonly threads?: boolean;
  readonly reopen?: boolean;
  readonly secondReply?: boolean;
  readonly clean?: boolean;
  readonly historical?: boolean;
  readonly selfReview?: boolean;
  readonly divergent?: boolean;
  readonly ticket?: "allow" | "deny";
}

const LARGE_NOTES_LINES = 600;
const FENCE = "```";
const REVIEW_SCRIPTS = fileURLToPath(
  new URL("../../../skills/review-pull-request/scripts/", import.meta.url),
);

// Python source defining fixture(run): writes one passing context, chunk,
// author and verify payload into run and returns (context, author, body).
export const REVIEW_FIXTURE = String.raw`
import hashlib, json
from pathlib import Path
def fixture(run):
    body = "Exact body  \n\n${FENCE}suggestion\nnew value  \n${FENCE}\n\nTrailing spaces  \n"
    context = dict(pr="https://github.com/cli/cli/pull/1", state="open", title="Fixture", author="someone",
                   base="main", head="fix", base_sha="a" * 40, head_sha="b" * 40, shortstat="",
                   changed_files=["file.py"], ci="Not run; collected at fixture time",
                   linked_context="", test_signals="", behavior_summary="Fixture behavior", risk_areas=[],
                   dimensions=[dict(name="correctness", files=["file.py"], rationale="Changed logic")],
                   history="complete", threads=[dict(thread_id="thread", is_resolved=False, viewer_can_unresolve=False, path="file.py",
                   line=1, root_comment_id=7, root_url="https://github.com/cli/cli/pull/1#discussion_r7",
                   summary="Existing")], feedback=[], references=[], limitations=[],
                   posting_basis=dict(viewer="reviewer", approval_urls=[],
                       history_sha256=hashlib.sha256(b'[[],[],[]]').hexdigest()))
    finding = dict(id="F1", severity="important", title="Fix this", confidence="high",
                   anchor=dict(path="file.py", line=2, side="RIGHT", start_line=1), evidence="Evidence  \n",
                   failure_scenario="Failure", minimal_fix="Fix", sources=[], placement="inline", body=body)
    author = dict(decision="REQUEST_CHANGES", summary=body, findings=[finding], dropped=[],
                  residual_risks=[], references=[], thread_assessments=[
                      dict(root_comment_id=7, status="still-valid", evidence="file.py:1-2 at pinned head")])
    chunk = dict(dimension="correctness", inspected=[dict(path="file.py", ranges="1-2")], gaps=[],
                 findings=[], residual_risks=[], references=[])
    for mode, name, value in [("context", "context.txt", context), ("chunk", "chunk-correctness.txt", chunk),
                              ("author", "author.txt", author),
                              ("verify", "verify.txt", dict(issues=[], observed_checks=["Fixture only"]))]:
        (Path(run) / name).write_bytes((mode.upper() + ": PASS\n" + json.dumps(value)).encode())
    return context, author, body
`;

// Python source for validate-output.py cases ported from its former --self-test.
// VALIDATOR_CASES needs python()'s validate; report(cases) prints the failures.
export const VALIDATOR_CASES = String.raw`
import copy
MODES, FAILURES = validate.__globals__["MODES"], validate.__globals__["FAILURES"]
finding = dict(id="c1", severity="blocking", title="Guard", confidence="high", anchor=None,
                 evidence="Missing guard", failure_scenario="Empty", minimal_fix="Guard", sources=[])
good = {
    "context": dict(pr="https://github.com/a/b/pull/1", state="open", title="T", author="A",
        base_sha="a" * 40, head_sha="b" * 40, shortstat="", ci="Seen: pass", changed_files=["a"],
        linked_context="", test_signals="", behavior_summary="Guard", risk_areas=[], limitations=[],
        history="complete", dimensions=[dict(name="a", files=["a"], rationale="G")], base="M", head="H",
        posting_basis=None, threads=[dict(thread_id="T1", is_resolved=False, viewer_can_unresolve=False, path="a.py", line=None, root_comment_id=123,
        root_url="https://a.co/r123", summary="Gap")], feedback=[], references=[]),
    "chunk": dict(dimension="tests", inspected=[dict(path="test.py", ranges="1-9")], gaps=[], findings=[],
                  residual_risks=[], references=[]),
    "author": dict(decision="REQUEST_CHANGES", summary="Fix guard.\n\nTests pass.", dropped=[],
                   residual_risks=[], references=[], thread_assessments=[], findings=[
        dict(finding, id="a1", placement="inline", body="Fix:\n\n${FENCE}suggestion\npass\n${FENCE}\n",
        anchor=dict(path="app.py", line=4, start_line=2, side="RIGHT")),
        dict(finding, id="a2", placement="reply", root_comment_id=123, body="Still applies"),
        dict(finding, id="a3", placement="summary"), dict(finding, id="a4", placement="unknown")]),
    "verify": dict(issues=[], observed_checks=["Inspected guard"])}
def payload(mode, data, status="PASS"):
    return (mode.upper() + ": " + status + "\n" + json.dumps(data)).encode()
def report(cases):
    failed = [[name, validate(mode, raw)] for name, mode, raw, expected in cases
              if (not validate(mode, raw) if expected else bool(validate(mode, raw)))
              or (expected and not any(expected in error for error in validate(mode, raw)))]
    print(json.dumps(dict(count=len(cases), failed=failed)))
`;
export const VALIDATOR_MUTATIONS = String.raw`
mutations = [
    ("context", lambda d: d["threads"][0].update(is_resolved=True, line=2), ""),
    ("context", lambda d: d.pop("title"), "title: missing key"),
    ("context", lambda d: d.update(extra=1), "extra: extra key"),
    ("context", lambda d: d.update(state="draft"), "state: expected one of"),
    ("context", lambda d: d.update(base_sha="A" * 40), "base_sha: expected lowercase SHA"),
    ("context", lambda d: d.update(references=["http://example.com"]), "references[0]: expected HTTPS"),
    ("context", lambda d: d["dimensions"][0].update(files=["other.py"]), "not in changed_files"),
    ("context", lambda d: d.update(dimensions=[dict(name=f"d{i}", files=["a"], rationale="R")
                                             for i in range(7)]), "dimensions: expected 1..6"),
    ("context", lambda d: d["dimensions"][0].update(name="Bad_name"), "expected dimension name"),
    ("context", lambda d: d.update(dimensions=d["dimensions"] * 2), "dimensions[1].name: duplicate"),
    ("context", lambda d: d.update(threads=[d["threads"][0]] * 2), "root_comment_id: duplicate"),
    ("chunk", lambda d: d.update(findings=[dict(finding, id="1")]), "id: expected dimension-N"),
    ("chunk", lambda d: d.update(inspected=[]), "inspected/gaps: must not both be empty"),
    ("author", lambda d: d["findings"][0]["anchor"].update(line=True), "anchor.line: expected integer"),
    ("author", lambda d: d["findings"][1].update(id="a1"), "findings[1].id: duplicate"),
    ("author", lambda d: d["findings"][0].update(anchor=None), "anchor: inline requires non-null"),
    ("author", lambda d: d["findings"][1].pop("root_comment_id"), "root_comment_id: missing"),
    ("author", lambda d: d["findings"][3].update(placement="reply", root_comment_id=123, body="R"),
     "root_comment_id: duplicate"),
    ("author", lambda d: d["findings"][2].update(body="extra"), "findings[2].body: extra key"),
    ("author", lambda d: d["findings"][0]["anchor"].update(start_line=4), "start_line: must be < line"),
    ("author", lambda d: d["findings"][0]["anchor"].update(start_line=5), "start_line: must be < line"),
    ("author", lambda d: d.update(findings=[]), "REQUEST_CHANGES requires at least one finding"),
    ("verify", lambda d: d.update(issues=["Problem"]), "issues: must be empty on PASS")]
`;

// Runs source (lines at module level) in a fresh temporary run directory that
// REVIEW_FIXTURE has seeded. The source sees scripts, render (the renderer's
// globals), validate, run, context, author, body and put(mode, value).
export function python(source: string): string {
  return execFileSync(
    "python3",
    [
      "-I",
      "-c",
      `
import contextlib, io, json, os, pathlib, runpy, tempfile, subprocess, sys
${REVIEW_FIXTURE}
scripts = pathlib.Path(${JSON.stringify(REVIEW_SCRIPTS)})
render = runpy.run_path(str(scripts / "render-review.py"))
validate = runpy.run_path(str(scripts / "validate-output.py"))["validate"]
with tempfile.TemporaryDirectory() as directory:
 os.chdir(directory)
 run = pathlib.Path(".")
 context, author, body = fixture(run)
 def put(mode, value):
  (run / (mode + ".txt")).write_text(mode.split("-")[0].upper() + ": PASS\\n" + json.dumps(value))
${source
  .split("\n")
  .map((line) => ` ${line}`)
  .join("\n")}
`,
    ],
    { encoding: "utf8" },
  );
}

function seedPricingVariant(
  repoPath: string,
  options: ReviewFixtureOptions,
  git: (...args: string[]) => string,
): void {
  if (options.clean === true || options.secondReply === true) {
    writeFileSync(
      join(repoPath, GITHUB_FACTS.source),
      options.clean === true
        ? `${GITHUB_FACTS.baseSource}\n# Preserve the documented empty-cart behavior.\n`
        : `${GITHUB_FACTS.headSource}\n\ndef cents_to_dollars(cents):\n    """Return dollars including fractional dollars."""\n    return cents // 100\n`,
    );
    git("add", GITHUB_FACTS.source);
    git("commit", "--amend", "--no-edit", "-q");
    copyHeadReflog(repoPath, GITHUB_FACTS.baselineLog);
    writeFileSync(
      join(repoPath, GITHUB_FACTS.sourceBaseline),
      readFileSync(join(repoPath, GITHUB_FACTS.source)),
    );
  }
}

function seedReviewSources(
  context: SeedContext,
  options: ReviewFixtureOptions,
): void {
  const { repoPath } = context;
  const git = (...args: string[]): string =>
    execFileSync("git", args, { cwd: repoPath, encoding: "utf8" }).trim();
  if (options.divergent === true) {
    writeFileSync(
      join(repoPath, ".git/reviewed-pr-head"),
      git("rev-parse", "HEAD"),
    );
    writeFileSync(join(repoPath, GITHUB_FACTS.source), GITHUB_FACTS.baseSource);
    git("add", GITHUB_FACTS.source);
    git("commit", "-qm", "Local checkout differs from the reviewed PR");
    copyHeadReflog(repoPath, GITHUB_FACTS.baselineLog);
    writeFileSync(
      join(repoPath, GITHUB_FACTS.sourceBaseline),
      GITHUB_FACTS.baseSource,
    );
    writeFileSync(
      join(repoPath, ".git/checkout-head"),
      git("rev-parse", "HEAD"),
    );
  }
  seedPricingVariant(repoPath, options, git);
  if (options.ticket === "allow") {
    writeFileSync(
      join(repoPath, "cart.py"),
      "from pricing import unit_price\n\ndef price(items):\n    return unit_price(sum(items), len(items))\n",
    );
    writeFileSync(
      join(repoPath, "checkout.py"),
      `from cart import price\n\ndef checkout(items):\n    return {'unit_price': price(items)}\n${"# Archived acceptance examples are summarized by CART-17.\n".repeat(LARGE_NOTES_LINES)}`,
    );
    git("add", "cart.py", "checkout.py");
    git("commit", "--amend", "--no-edit", "-q");
    copyHeadReflog(repoPath, GITHUB_FACTS.baselineLog);
  }
}

// Wrap the shared read-only fake locally; do not broaden other skills' mutation fixtures.
export function seedReviewFixture(
  context: SeedContext,
  options: ReviewFixtureOptions = {},
): void {
  seedGithubFixture(context, {
    comments: options.threads === true || options.reopen === true,
  });
  registerReviewFixture(context.repoPath);
  seedReviewSources(context, options);
  const { repoPath, binPath } = context;
  mkdirSync(join(repoPath, SENTINEL, ".."), { recursive: true });
  writeFileSync(join(repoPath, SENTINEL), "unrelated run: preserve me\n");
  writeFileSync(join(repoPath, REVIEW_POSTS), "");
  writeFileSync(join(repoPath, LATE_CI_READS), "");
  writeFileSync(join(repoPath, TICKET_LOG), "");
  renameSync(join(binPath, "gh"), join(binPath, "gh-read-only"));
  const realPython = execFileSync("which", ["python3"], {
    encoding: "utf8",
  }).trim();
  writeFileSync(
    join(binPath, "python3"),
    `#!${realPython}\nimport pathlib, subprocess, sys\nroot=pathlib.Path(${JSON.stringify(repoPath)})\ncode=subprocess.call([${JSON.stringify(realPython)}, *sys.argv[1:]])\nif code == 0 and any(a.endswith('/post-review.py') for a in sys.argv) and '--dry-run' in sys.argv:\n (root / '.git/preview-seen').touch()\nsys.exit(code)\n`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(binPath, "gh"),
    `#!${realPython}
import base64, json, pathlib, re, subprocess, sys
from urllib.parse import unquote, urlsplit, parse_qs
root = pathlib.Path(${JSON.stringify(repoPath)})
options = json.loads(${JSON.stringify(JSON.stringify(options))})
viewer = dict(login=${JSON.stringify(REVIEW_ACCOUNT)})
args = sys.argv[1:]
state_path = root / '.git/fake-gh-state.json'
state = json.loads(state_path.read_text())
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
if options.get('clean') or options.get('secondReply') or options.get('ticket') == 'allow': state['head'] = head
def git(*arguments):
 return subprocess.check_output(['git', *arguments], cwd=root)
comparison = state['base']+'...'+state['head']
state['head_source'] = git('show',state['head']+':pricing.py').decode()
state['base_source'] = git('show',state['base']+':pricing.py').decode()
state['diff'] = git('diff',comparison).decode()
files = []
for row in git('diff','--numstat',comparison).decode().splitlines():
 additions, deletions, name = row.split('\\t',2)
 exists_at_base = subprocess.run(['git','cat-file','-e',state['base']+':'+name],cwd=root,capture_output=True).returncode == 0
 files.append(dict(path=name,filename=name,status='modified' if exists_at_base else 'added',additions=int(additions),deletions=int(deletions),patch=git('diff',comparison,'--',name).decode()))
state['pr']['head']['sha'] = state['head']
state['pr']['headRefOid'] = state['head']
state['pr'].update(files=files,additions=sum(f['additions'] for f in files),deletions=sum(f['deletions'] for f in files),changedFiles=len(files))
nodes = state['graphql']['data']['repository']['pullRequest']['reviewThreads']['nodes']
for node in nodes:
 if 'viewerCanUnresolve' not in node:
  can_reopen = options.get('reopen') is True and node['id'] == 'PRRT_701'
  node['viewerCanUnresolve'] = can_reopen
  if can_reopen: node['isResolved'] = True
if options.get('threads'):
 if len(nodes) == 1:
  import copy
  nodes[0]['comments']['nodes'][0].update(commit_id=head,original_commit_id=head,diff_hunk=state['diff'])
  claims = [(702, 'pricing.py', 2, 'The docstring should explicitly promise zero for an empty cart.'), (703, 'ops/settings.py', None, 'Consider changing unrelated deployment retention policy.')]
  if options.get('secondReply'): claims.append((704, 'pricing.py', 8, 'cents_to_dollars(199) returns 1 rather than 1.99. Preserve fractional dollars instead of rounding down.'))
  for number, path, line, claim in claims:
   node = copy.deepcopy(nodes[0]); node.update(id='PRRT_'+str(number),path=path,line=line)
   url = state['pr']['url']+'#discussion_r'+str(number)
   node['comments']['nodes'][0].update(fullDatabaseId=str(number),id=number,node_id='PRRC_'+str(number),body=claim,path=path,line=line,original_line=line,url=url,html_url=url)
   nodes.append(node)
  state['comments'] = [node['comments']['nodes'][0] for node in nodes]
 state['graphql']['data']['repository']['pullRequest']['reviewThreads']['totalCount'] = len(nodes)
if options.get('ticket') and '${TICKET_URL}' not in state['pr']['body']:
 state['pr']['body'] += '\\nRequirement: ${TICKET_URL}. Use the authenticated ticket read connector: ticket read URL.'
if options.get('feedback'):
 channel = options['feedback']; review = channel == 'review'
 url = ${JSON.stringify(FEEDBACK_URL)}[channel]
 feedback = dict(id=810 if review else 811,html_url=url,url=url,body='Removing the guard in unit_price makes an empty cart divide by zero instead of returning zero.',user=dict(login='auditor'),author=dict(login='auditor'))
 if review: state['pr']['reviews'] = [dict(feedback,state='COMMENTED',commit_id=state['head'])]
 else: state['pr']['comments'] = [feedback]
if options.get('historical'):
 state['pr']['state'] = 'CLOSED'
late = (root / '.git/preview-seen').exists()
check = dict(name='fixture-ci',status='COMPLETED' if late else 'IN_PROGRESS',conclusion='SUCCESS' if late else None,detailsUrl='https://github.com/eval-org/cart/actions/runs/1')
if options.get('clean'):
 state['pr']['statusCheckRollup'] = [check]
 state['pr']['reviews'] = [dict(id=88,state='APPROVED',commit_id=state['head'],user=viewer,author=viewer,html_url='https://github.com/eval-org/cart/pull/17#pullrequestreview-88')]
 state['pr']['reviewDecision'] = 'APPROVED'
if options.get('selfReview'):
 state['pr'].update(author=viewer,user=viewer)
state['graphql']['data']['viewer'] = viewer
state['graphql']['data']['repository']['pullRequest'].update(state['pr'])
state_path.write_text(json.dumps(state))
endpoint = next((a.lstrip('/') for a in args if a == 'user' or a.lstrip('/').startswith('repos/')), '')
method = next((args[i+1] for i,a in enumerate(args[:-1]) if a in ('--method','-X')), 'GET')
def log():
 with (root / '${GITHUB_FACTS.log}').open('a') as stream: stream.write(json.dumps(args)+'\\n')
def emit(value):
 projection = next((args[i+1] for i,a in enumerate(args[:-1]) if a in ('--jq','-q')), None)
 if projection:
  sys.exit(subprocess.run(['jq','-r',projection],input=json.dumps(value),text=True).returncode)
 print(json.dumps(value)); sys.exit(0)
if options.get('clean') and (args[:2] == ['pr','checks'] or endpoint.endswith('/check-runs')):
 log()
 if late:
  with (root / '${LATE_CI_READS}').open('a') as stream: stream.write(json.dumps(args)+'\\n')
 if endpoint.endswith('/check-runs'): emit(dict(total_count=1,check_runs=[dict(check,status=check['status'].lower(),conclusion='success' if late else None)]))
 emit([dict(name='fixture-ci',state='SUCCESS' if late else 'PENDING',bucket='pass' if late else 'pending')])
if args[:2] == ['auth','status']:
 log(); print('Logged in to github.com as '+viewer['login']); sys.exit(0)
if options.get('ticket') == 'allow' and args[:2] == ['pr','diff']:
 log()
 print('pricing.py\\ncart.py\\ncheckout.py' if '--name-only' in args else state['diff']); sys.exit(0)
def not_found():
 print('gh: Not Found (HTTP 404)',file=sys.stderr); sys.exit(1)
def revision(value):
 value = {'main':state['base'],state['pr']['head']['ref']:state['head']}.get(value,value)
 if not re.fullmatch('[a-f0-9]{40}',value): not_found()
 return value
def kind(treeish):
 result = subprocess.run(['git','cat-file','-t',treeish],cwd=root,capture_output=True,text=True)
 if result.returncode: not_found()
 return result.stdout.strip()
def entries(treeish, recursive=False):
 arguments = ['ls-tree','-z'] + (['-r','-t'] if recursive else []) + [treeish]
 result = []
 for row in git(*arguments).split(bytes([0])):
  if not row: continue
  metadata,name = row.split(bytes([9]),1)
  mode,object_type,sha = metadata.decode().split()
  result.append(dict(path=name.decode(),mode=mode,type=object_type,sha=sha))
 return result
parsed = urlsplit(endpoint)
prefix = 'repos/eval-org/cart'
if parsed.path.startswith(prefix+'/git/trees/') and method == 'GET':
 log()
 ref = revision(parsed.path.split('/git/trees/',1)[1]); kind(ref)
 tree_sha = git('rev-parse',ref+'^{tree}').decode().strip()
 emit(dict(sha=tree_sha,truncated=False,tree=entries(ref,parse_qs(parsed.query).get('recursive') == ['1'])))
if (parsed.path == prefix+'/contents' or parsed.path.startswith(prefix+'/contents/')) and method == 'GET':
 log()
 requested = parse_qs(parsed.query).get('ref',[next((a[4:] for a in args if a.startswith('ref=')),'main')])[0]
 ref = revision(requested)
 name = unquote(parsed.path.removeprefix(prefix+'/contents').lstrip('/'))
 treeish = ref+':'+name if name else ref+'^{tree}'
 object_type = kind(treeish)
 if object_type == 'blob':
  content = git('show',treeish)
  if 'raw' in ' '.join(args): sys.stdout.buffer.write(content); sys.exit(0)
  emit(dict(type='file',path=name,name=name.rsplit('/',1)[-1],sha=git('rev-parse',treeish).decode().strip(),encoding='base64',content=base64.b64encode(content).decode()))
 if object_type != 'tree': not_found()
 directory = []
 for entry in entries(treeish):
  full_path = (name+'/' if name else '')+entry['path']
  directory.append(dict(type='dir' if entry['type']=='tree' else 'file',name=entry['path'],path=full_path,sha=entry['sha']))
 emit(directory)
${reviewApi(REOPEN_APPROVAL, UNRESOLVE, REOPEN_THREAD, REVIEW_POSTS)}
if parsed.path == prefix+'/pulls/17/reviews/900/comments':
 log()
 posts = [json.loads(line) for line in (root / '${REVIEW_POSTS}').read_text().splitlines()]
 review = next((post['payload'] for post in posts if post['endpoint'] == prefix+'/pulls/17/reviews'), None)
 if review is None: not_found()
 comments = []
 for i, item in enumerate(review['comments'], start=901):
  comments.append(dict(id=i,html_url=state['pr']['url']+'#discussion_r'+str(i),
                       path=item['path'],side=item['side'],line=item['line'],start_line=item.get('start_line')))
 comments.reverse()
 emit([[comment] for comment in comments] if '--slurp' in args else comments)
if endpoint == 'user':
 log(); emit(viewer)
if parsed.path.endswith('/pulls/17/reviews'):
 log()
 reviews = state['pr']['reviews']
 emit([reviews] if '--slurp' in args else reviews)
if parsed.path.endswith('/issues/17/comments'):
 log(); comments = state['pr']['comments']; emit([comments] if '--slurp' in args else comments)
if (root / '.git/preview-seen').exists():
 if options.get('drift') == 'head' and endpoint.split('?')[0].endswith('/pulls/17'):
  log(); state['pr']['head']['sha'] = 'c'*40; emit(dict(state['pr'],state='open'))
if options.get('historical') and endpoint.split('?')[0].endswith('/pulls/17'):
 log(); emit(dict(state['pr'],state='closed'))
sys.exit(subprocess.call([${JSON.stringify(join(binPath, "gh-read-only"))}, *args]))
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(binPath, "ticket"),
    `#!${realPython}\nimport json, pathlib, sys\nroot=pathlib.Path(${JSON.stringify(repoPath)})\nwith (root / '${TICKET_LOG}').open('a') as stream: stream.write(json.dumps(sys.argv[1:])+'\\n')\nif ${options.ticket === "deny" ? "True" : "False"}:\n print('Access denied', file=sys.stderr); sys.exit(4)\nprint(json.dumps(dict(url='${TICKET_URL}', authenticated_as='reviewer', requirement='For an empty cart, unit_price(total, 0) must return 0.')))\n`,
    { mode: 0o755 },
  );
}
