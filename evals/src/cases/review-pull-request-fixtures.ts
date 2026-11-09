import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SeedContext } from "#/cases/case-contract.ts";
import {
  GITHUB_FACTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import { registerReviewFixture } from "#/cases/review-pull-request-gates.ts";
import { copyHeadReflog } from "#/fixtures/fixtures.ts";

export const REVIEW_POSTS = ".git/review-posts.jsonl";
export const LATE_CI_READS = ".git/review-late-ci-reads.jsonl";
export const TICKET_LOG = ".git/ticket-reads.jsonl";
export const TICKET_URL = "https://tickets.example.test/CART-17";
export const SENTINEL = ".handoffs/review-pull-request/unrelated/keep.txt";

export interface ReviewFixtureOptions {
  readonly drift?: "thread" | "head";
  readonly threads?: boolean;
  readonly clean?: boolean;
  readonly historical?: boolean;
  readonly divergent?: boolean;
  readonly ticket?: "allow" | "deny";
}

const LARGE_NOTES_LINES = 600;

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
  if (options.clean === true) {
    writeFileSync(
      join(repoPath, GITHUB_FACTS.source),
      `${GITHUB_FACTS.baseSource}\n# Preserve the documented empty-cart behavior.\n`,
    );
    git("add", GITHUB_FACTS.source);
    git("commit", "--amend", "--no-edit", "-q");
    copyHeadReflog(repoPath, GITHUB_FACTS.baselineLog);
    writeFileSync(
      join(repoPath, GITHUB_FACTS.sourceBaseline),
      readFileSync(join(repoPath, GITHUB_FACTS.source)),
    );
  }
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
  seedGithubFixture(context, { comments: options.threads === true });
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
args = sys.argv[1:]
state_path = root / '.git/fake-gh-state.json'
state = json.loads(state_path.read_text())
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
if options.get('clean') or options.get('ticket') == 'allow': state['head'] = head
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
if options.get('threads'):
 nodes = state['graphql']['data']['repository']['pullRequest']['reviewThreads']['nodes']
 if len(nodes) == 1:
  import copy
  for number, path, claim in [(702, 'pricing.py', 'The docstring should explicitly promise zero for an empty cart.'), (703, 'ops/settings.py', 'Consider changing unrelated deployment retention policy.')]:
   node = copy.deepcopy(nodes[0]); node['id'] = 'PRRT_'+str(number); node['path'] = path
   node['comments']['nodes'][0].update(fullDatabaseId=str(number),id=number,body=claim,path=path,url='https://github.com/eval-org/cart/pull/17#discussion_r'+str(number))
   nodes.append(node)
 state['graphql']['data']['repository']['pullRequest']['reviewThreads']['totalCount'] = len(nodes)
if options.get('ticket') and '${TICKET_URL}' not in state['pr']['body']:
 state['pr']['body'] += '\\nRequirement: ${TICKET_URL}. Use the authenticated ticket read connector: ticket read URL.'
if options.get('historical'):
 state['pr']['state'] = 'CLOSED'
late = (root / '.git/preview-seen').exists()
check = dict(name='fixture-ci',status='COMPLETED' if late else 'IN_PROGRESS',conclusion='SUCCESS' if late else None,detailsUrl='https://github.com/eval-org/cart/actions/runs/1')
if options.get('clean'):
 state['pr']['statusCheckRollup'] = [check]
 state['pr']['reviews'] = [dict(id=88,state='APPROVED',commit_id=state['head'],user=dict(login='reviewer'),author=dict(login='reviewer'),html_url='https://github.com/eval-org/cart/pull/17#pullrequestreview-88')]
 state['pr']['reviewDecision'] = 'APPROVED'
state['graphql']['data']['viewer']['login'] = 'reviewer'
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
 log(); print('Logged in to github.com as reviewer'); sys.exit(0)
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
if method == 'POST':
 log()
 payload = json.loads(sys.stdin.read())
 with (root / '${REVIEW_POSTS}').open('a') as stream: stream.write(json.dumps(dict(endpoint=endpoint,payload=payload))+'\\n')
 emit(dict(id=900,html_url='https://github.com/eval-org/cart/pull/17#pullrequestreview-900'))
if endpoint == 'user':
 log(); emit(dict(login='reviewer'))
if endpoint.endswith('/pulls/17/reviews'):
 log()
 reviews = state['pr']['reviews']
 emit([reviews] if '--slurp' in args else reviews)
if endpoint.endswith('/issues/17/comments'):
 log(); emit([[]] if '--slurp' in args else [])
if (root / '.git/preview-seen').exists():
 if options.get('drift') == 'thread' and 'graphql' in args:
  nodes = state['graphql']['data']['repository']['pullRequest']['reviewThreads']['nodes']
  for node in nodes: node['isResolved'] = True
  state_path.write_text(json.dumps(state))
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
