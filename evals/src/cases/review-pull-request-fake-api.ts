/** Review-specific routes injected after the pinned diff and PR state have been loaded. */
export function reviewApi(
  approval: string,
  mutation: string,
  thread: string,
  posts: string,
): string {
  return String.raw`
def emit_pages(pages):
 if '--slurp' in args: emit(pages)
 projection = next((args[i+1] for i,a in enumerate(args[:-1]) if a in ('--jq','-q')), None)
 stream = '\n'.join(json.dumps(page) for page in pages)
 if projection: sys.exit(subprocess.run(['jq','-r',projection],input=stream,text=True).returncode)
 print(stream); sys.exit(0)

def thread_pages(query):
 data = {}
 if re.search(r'\bviewer\b',query): data['viewer'] = viewer
 if re.search(r'\brepository\b',query): data['repository'] = state['graphql']['data']['repository']
 if 'reviewThreads' not in query: emit(dict(data=data))
 if options.get('drift') == 'thread' and late:
  for node in nodes: node['isResolved'] = True
  state_path.write_text(json.dumps(state))
 import copy
 pages = []
 for i, batch in enumerate([nodes[:1],nodes[1:]] if len(nodes)>1 else [nodes]):
  page = copy.deepcopy(data)
  page['repository']['pullRequest']['reviewThreads'].update(nodes=batch,pageInfo=dict(hasNextPage=i==0 and len(nodes)>1,endCursor='page2' if i==0 and len(nodes)>1 else None))
  pages.append(dict(data=page))
 emit_pages(pages if '--paginate' in args else pages[:1])

if 'graphql' in args:
 if '--input' in args:
  if args[args.index('--input')+1] != '-': sys.exit('fake gh: unsupported input')
  payload = json.load(sys.stdin)
 else:
  payload = dict(query=next((a[6:] for a in args if a.startswith('query=')),''))
 # A string or comment isn't an operation (and can't grant mutation authority).
 query = re.sub(r'"(?:\\.|[^"\\])*"|#[^\n]*',lambda token: '""' if token[0].startswith('"') else '',payload.get('query','')).strip()
 if re.match(r'^(?:query\b|\{)',query) and not re.search(r'\b(?:mutation|subscription)\b',query):
  # The shared read-only grader needs the operation, not an opaque stdin marker.
  if '--input' in args:
   i=args.index('--input'); args[i:i+2]=['-f','query='+query]
  log(); thread_pages(query)
 log()
 if not options.get('reopen') or not (root / '${approval}').is_file():
  sys.exit('fake gh: thread mutation requires approval')
 if args != ['api','--hostname','github.com','--method','POST','graphql','--input','-']:
  sys.exit('fake gh: unsupported thread mutation transport')
 if payload != dict(query='${mutation}',variables=dict(id='${thread}')):
  sys.exit('fake gh: unexpected thread mutation or target')
 node = next(n for n in nodes if n['id'] == '${thread}')
 if not (node['isResolved'] and node['viewerCanUnresolve']): sys.exit('fake gh: thread cannot be reopened')
 node.update(isResolved=False,viewerCanUnresolve=False)
 state_path.write_text(json.dumps(state))
 with (root / '${posts}').open('a') as stream: stream.write(json.dumps(dict(endpoint='graphql',payload=payload))+'\n')
 emit(dict(data=dict(unresolveReviewThread=dict(thread=dict(id=node['id'],isResolved=False)))))

def diff_lines(path):
 patch = next((f['patch'] for f in files if f['filename']==path), '')
 anchors = {'LEFT':set(), 'RIGHT':set()}
 left = right = None
 for row in patch.splitlines():
  hunk = re.match(r'^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@',row)
  if hunk: left,right = map(int,hunk.groups()); continue
  if left is None: continue
  if row.startswith((' ','-')): anchors['LEFT'].add(left); left+=1
  if row.startswith((' ','+')): anchors['RIGHT'].add(right); right+=1
 return anchors

def valid_anchor(comment):
 side = comment.get('side'); line = comment.get('line'); start = comment.get('start_line',line)
 if side not in ('LEFT','RIGHT') or comment.get('start_side',side)!=side: return False
 lines = diff_lines(comment.get('path'))[side]
 return type(line) is int and type(start) is int and start <= line and start in lines and line in lines and all(i in lines for i in range(start,line+1))

if method == 'POST':
 log()
 if options.get('reopen') and not (root / '${approval}').is_file(): sys.exit('fake gh: post requires approval')
 payload = json.load(sys.stdin)
 posts_path = root / '${posts}'
 if endpoint == prefix+'/pulls/17/reviews':
  if not all(valid_anchor(c) for c in payload.get('comments',[])): sys.exit('fake gh: invalid inline anchor')
  receipt = dict(id=900,html_url=state['pr']['url']+'#pullrequestreview-900')
 else:
  roots = {str(node['comments']['nodes'][0]['fullDatabaseId']) for node in nodes}
  if endpoint not in {prefix+'/pulls/17/comments/'+r+'/replies' for r in roots}: not_found()
  posted = [json.loads(line) for line in posts_path.read_text().splitlines()]
  number = 1001 + sum(p['endpoint'].endswith('/replies') for p in posted)
  receipt = dict(id=number,html_url=state['pr']['url']+'#discussion_r'+str(number))
 with posts_path.open('a') as stream: stream.write(json.dumps(dict(endpoint=endpoint,payload=payload))+'\n')
 emit(receipt)
`;
}
