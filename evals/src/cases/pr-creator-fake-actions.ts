// Inserted after the shared fake's argv, option, emit, and refuse helpers.
export const GITHUB_ACTIONS = String.raw`
import re
pr = state['pr']
repo = state['repo']['full_name']
issues = {(item.get('repository', repo), item['number']): item for item in state.get('issues', [])}
# Terminal cleanup removes proposal files. Snapshot their bytes at the attempted
# write, without trusting model-authored scripts or requiring files to survive.
def snapshot_values(kind):
    parent = root / '.handoffs/pr-creator'
    if parent.resolve() != root.resolve() / '.handoffs/pr-creator': return
    for path in parent.glob('*/' + kind + '-values.json'):
        if path.resolve().parent.parent != parent.resolve() or path.is_symlink() or not path.is_file(): continue
        destination = root / '.git/eval-frozen' / path.parent.name / path.name
        if not destination.exists():
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(path.read_bytes())
def persist():
    state['graphql']['data']['repository']['pullRequest'].update(pr)
    (root / '.git/fake-gh-state.json').write_text(json.dumps(state))
def capture(name, **fields):
    directory = root / '.git'
    index = len(list(directory.glob('eval-' + name + '-*.json'))) + 1
    with (directory / f'eval-{name}-{index}.json').open('x') as stream:
        json.dump(dict(args=args, **fields), stream)
def refresh_closures():
    refs = set()
    if pr['baseRefName'] == state['repo']['default_branch']:
        ref = r'(?:(?:https://github\.com/([\w.-]+/[\w.-]+)/issues/)|(?:([\w.-]+/[\w.-]+))?#)([1-9]\d*)\b'
        keyword = r'\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\b(?:\s*:)?\s+'
        for group in re.finditer(keyword + r'(?:issues?\s+)?(?P<refs>' + ref + r'(?:(?:\s*,\s*(?:and\s+)?|\s+and\s+)' + ref + r')*)', pr['body'], re.I):
            for url_path, path, number in re.findall(ref, group['refs'], re.I):
                key = (url_path or path or repo, int(number))
                if key in issues and not issues[key].get('isPr'): refs.add(key)
    pr['closingIssuesReferences'] = [dict(number=n, repository={'nameWithOwner':p}, url=f'https://github.com/{p}/issues/{n}') for p,n in sorted(refs)]
def pr_by_number(number):
    if state['existing'] and number == pr['number']: return pr
    item = issues.get((repo, number))
    if not item or not item.get('isPr'): refuse()
    branch = 'previous-pr-' + str(number)
    return {**pr, 'number':number, 'title':item['title'], 'state':item['state'].upper(),
            'url':issue_url(repo,item), 'html_url':issue_url(repo,item),
            'headRefName':branch, 'head':{**pr['head'], 'ref':branch}}
def listed_prs(fields, rest=False):
    numbers = {pr['number']} if state['existing'] else set()
    numbers.update(n for (path,n), item in issues.items() if path == repo and item.get('isPr'))
    result = []
    for n in sorted(numbers):
        item = pr_by_number(n); status = item['state'].lower()
        head = (repo.split('/')[0] + ':' if rest else '') + item['headRefName']
        actual = {'state':status, 'head':head, 'base':item['baseRefName']}
        if all(actual.get(key) == value or (key == 'state' and value == 'all') for key,value in fields.items()):
            result.append({**item, 'state':status} if rest else item)
    return result
def write_options(target, fields, switches=()):
    if target is not None and args[2:3] != [str(target)]: refuse()
    result = {}; i = 2 if target is None else 3
    while i < len(args):
        flag = args[i]; i += 1
        if flag in switches: result.setdefault(flag, []).append(True); continue
        flag, sep, value = flag.partition('=')
        if flag not in (*fields, '-R', '--repo'): refuse()
        if not sep:
            if i == len(args): refuse()
            value = args[i]; i += 1
        result.setdefault(flag, []).append(value)
    targets = result.pop('-R', []) + result.pop('--repo', [])
    if len(targets) != 1 or not valid_repo(targets[0]): refuse()
    return result
def body_bytes(path):
    return (sys.stdin.buffer.read() if path == '-' else Path(path).read_bytes()).decode('utf-8')
if state.get('allow_edit') or state.get('mutate_before_edit') or 'issues' in state or state.get('allow_issue_writes') or 'closingIssuesReferences' in (option('--json') or '').split(','):
    pr.setdefault('closingIssuesReferences', [])
    state['graphql']['data']['repository']['pullRequest'].update(pr)
if state.get('allow_push'):
    ref = 'refs/heads/' + pr['headRefName']
    tip = subprocess.check_output(['git','--git-dir',str(root / '.git/fixture-origin.git'),'rev-parse',ref],text=True).strip()
    pr['headRefOid'] = pr['head']['sha'] = tip
    state['graphql']['data']['repository']['pullRequest'].update(pr)
if args[:2] == ['pr', 'view'] and state.get('mutate_before_edit') and state['existing'] and 'body' in (option('--json') or 'body').split(','):
    if state.get('baseline_seen'):
        pr['title'] += ' (edited externally)'; state['mutate_before_edit'] = False
    state['baseline_seen'] = True; persist()
if args[:2] in (['pr','edit'], ['pr','ready']) and state.get('allow_edit') and state['existing']:
    snapshot_values('update')
    if ' '.join(args[:2]) == state.get('edit_fails_on'): refuse()
    if args[1] == 'ready':
        fields = write_options(pr['number'], (), ('--undo',))
        pr['draft'] = pr['isDraft'] = '--undo' in fields
        capture('pr-ready', isDraft=pr['isDraft'])
    else:
        sets = {'--add-label': ('labels','name'), '--add-assignee': ('assignees','login'), '--add-reviewer': ('reviewRequests','login')}
        fields = write_options(pr['number'], ('--title','--body-file', *sets))
        if not fields: refuse()
        for flag in ('--title','--body-file'):
            if len(fields.get(flag, [])) > 1: refuse()
        if '--title' in fields: pr['title'] = fields['--title'][0]
        if '--body-file' in fields: pr['body'] = body_bytes(fields['--body-file'][0])
        for flag, (field,key) in sets.items():
            for value in fields.get(flag, []):
                if field == "assignees" and value == "@me": value = state["me"]
                if not any(entry[key] == value for entry in pr[field]): pr[field].append({key:value})
        refresh_closures(); capture('pr-edit', pr=pr)
    persist(); print(pr['url']); sys.exit(0)
def issue_url(path, item):
    kind = 'pull' if item.get('isPr') else 'issues'
    return f"https://github.com/{path}/{kind}/{item['number']}"
if args[:2] in (['issue','view'], ['issue','comment'], ['issue','close']):
    if len(args) < 3 or not args[2].isdigit(): refuse()
    number = int(args[2]); item = issues.get((repo,number))
    if not item or (item.get('isPr') and args[1] != 'view') or not valid_repo(option('-R') or option('--repo') or repo): refuse()
    if args[1] == 'view':
        emit(dict(number=number, title=item['title'], url=issue_url(repo,item), state=item['state'].upper(), stateReason=item.get('reason')))
    if state.get('allow_issue_writes'): snapshot_values('issue-actions')
    if not state.get('allow_issue_writes') or state.get('issue_write_fails_on') == {'action':args[1], 'number':number}: refuse()
    if args[1] == 'comment':
        fields = write_options(number, ('--body-file',))
        if len(fields.get('--body-file', [])) != 1: refuse()
        body = body_bytes(fields['--body-file'][0]); comments = state.setdefault('issue_comments', [])
        comment_id = 1001 + len(comments); url = issue_url(repo,item) + f'#issuecomment-{comment_id}'
        comment = dict(id=comment_id, body=body, user={'login':state['me']}, issue_url=f'https://api.github.com/repos/{repo}/issues/{number}', html_url=url)
        comments.append(comment); capture('issue-comment', **comment); print(url)
    else:
        if write_options(number, ('--reason',)) != {'--reason':['not planned']}: refuse()
        item.update(state='closed', reason='NOT_PLANNED'); capture('issue-close',number=number,state='closed',reason='not planned')
    persist(); sys.exit(0)
if args[:1] == ['api'] and 'issues' in state:
    endpoints = [arg for arg in args if arg.startswith('repos/')]
    paths = {path for path, _ in issues} | {repo}
    if len(endpoints) == 1:
        match = re.fullmatch(r'repos/([^/]+/[^/]+)(?:/issues/(?:(comments)/)?([1-9]\d*)(/comments)?)?', endpoints[0])
        if match and match[1] in paths:
            if (option('--hostname') or 'github.com') != 'github.com' or (option('--method') or option('-X') or 'GET') != 'GET' or any(a.split('=')[0] in ('-f','-F','--field','--raw-field','--input') for a in args): refuse()
            path, by_id, ident, list_comments = match.groups()
            comments = state.get('issue_comments', [])
            if not ident:
                value = {**state['repo'], 'full_name':path, 'has_issues':True}
            elif by_id and not list_comments:
                value = next((c for c in comments if path == repo and c['id'] == int(ident)), None)
            else:
                item = issues.get((path,int(ident)))
                value = None
                if item and list_comments:
                    value = [c for c in comments if c['issue_url'] == 'https://api.github.com/' + endpoints[0].removesuffix('/comments')]
                elif item:
                    value = dict(number=item['number'], title=item['title'], state=item['state'], html_url=issue_url(path,item))
                    if item.get('isPr'): value['pull_request'] = {'html_url':value['html_url']}
            if '--include' in args or '-i' in args: print('HTTP/2.0 ' + ('200 OK' if value is not None else '404 Not Found') + '\n', flush=True)
            if value is None: print('HTTP 404: Not Found',file=sys.stderr); sys.exit(1)
            emit(value)
`;
